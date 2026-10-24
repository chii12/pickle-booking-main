create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 1 and 40),
  email text,
  court text not null check (court in (
    'The Ace Court — ₱400/hour',
    'The Prime Court — ₱500/hour',
    'The Rally Court — ₱400/hour',
    'The Social Court — ₱450/hour'
  )),
  players text not null check (players in ('2 players', '3 players', '4 players')),
  duration integer not null check (duration between 1 and 3),
  date date not null,
  time text not null check (char_length(time) between 1 and 60),
  estimated_total integer not null check (estimated_total > 0),
  promo text not null default '' check (char_length(promo) <= 80),
  notes text not null default '' check (char_length(notes) <= 1000),
  cancellation_token_hash text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists email text;

alter table public.bookings
  add column if not exists cancellation_token_hash text;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

alter table public.bookings enable row level security;

revoke all on table public.bookings from public, anon, authenticated;
grant select, update, delete on table public.bookings to authenticated;

create or replace function public.create_customer_booking(
  p_name text,
  p_phone text,
  p_email text,
  p_court text,
  p_players text,
  p_duration integer,
  p_date date,
  p_time text,
  p_estimated_total integer,
  p_promo text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_id uuid;
  v_cancellation_token text;
  v_time_parts text[];
  v_start_minute integer;
  v_end_minute integer;
begin
  v_time_parts := regexp_match(
    p_time,
    '([0-9]{1,2}):([0-9]{2})[[:space:]]*(AM|PM)[[:space:]]*[–-][[:space:]]*([0-9]{1,2}):([0-9]{2})[[:space:]]*(AM|PM)',
    'i'
  );
  if v_time_parts is null then
    raise exception 'Choose a valid booking time.';
  end if;

  v_start_minute := (
    (v_time_parts[1]::integer % 12)
    + case when upper(v_time_parts[3]) = 'PM' then 12 else 0 end
  ) * 60 + v_time_parts[2]::integer;
  v_end_minute := (
    (v_time_parts[4]::integer % 12)
    + case when upper(v_time_parts[6]) = 'PM' then 12 else 0 end
  ) * 60 + v_time_parts[5]::integer;

  if v_end_minute <= v_start_minute
    or v_end_minute - v_start_minute <> p_duration * 60 then
    raise exception 'The selected time does not match the booking duration.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_date::text || ':' || p_court, 0));

  if exists (
    select 1
    from public.bookings as b
    cross join lateral (
      select regexp_match(
        b."time",
        '([0-9]{1,2}):([0-9]{2})[[:space:]]*(AM|PM)[[:space:]]*[–-][[:space:]]*([0-9]{1,2}):([0-9]{2})[[:space:]]*(AM|PM)',
        'i'
      ) as parts
    ) as parsed
    cross join lateral (
      select
        (
          (parsed.parts[1]::integer % 12)
          + case when upper(parsed.parts[3]) = 'PM' then 12 else 0 end
        ) * 60 + parsed.parts[2]::integer as start_minute,
        (
          (parsed.parts[4]::integer % 12)
          + case when upper(parsed.parts[6]) = 'PM' then 12 else 0 end
        ) * 60 + parsed.parts[5]::integer as end_minute
    ) as existing_time
    where b.date = p_date
      and b.court = p_court
      and b.status in ('pending', 'confirmed')
      and parsed.parts is not null
      and v_start_minute < existing_time.end_minute
      and existing_time.start_minute < v_end_minute
  ) then
    raise exception using
      message = 'That time has just become unavailable. Please choose another time.',
      errcode = '23P01';
  end if;

  v_cancellation_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into public.bookings (
    name, phone, email, court, players, duration, date, "time",
    estimated_total, promo, notes, cancellation_token_hash
  )
  values (
    p_name, p_phone, p_email, p_court, p_players, p_duration, p_date, p_time,
    p_estimated_total, coalesce(p_promo, ''), coalesce(p_notes, ''),
    encode(extensions.digest(convert_to(v_cancellation_token, 'UTF8'), 'sha256'), 'hex')
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'booking_id', v_booking_id,
    'cancellation_token', v_cancellation_token
  );
end;
$$;

revoke all on function public.create_customer_booking(
  text, text, text, text, text, integer, date, text, integer, text, text
) from public, anon, authenticated;
grant execute on function public.create_customer_booking(
  text, text, text, text, text, integer, date, text, integer, text, text
) to anon;

create or replace function public.cancel_customer_booking(
  p_booking_id uuid,
  p_phone text,
  p_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_count integer;
begin
  update public.bookings as b
  set status = 'cancelled',
      cancellation_token_hash = null
  where b.id = p_booking_id
    and b.status in ('pending', 'confirmed')
    and b.created_at >= now() - interval '48 hours'
    and (
      (p_phone is not null and b.phone = p_phone)
      or (
        p_token is not null
        and b.cancellation_token_hash = encode(
          extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'),
          'hex'
        )
      )
    );

  get diagnostics v_updated_count = row_count;
  return v_updated_count = 1;
end;
$$;

revoke all on function public.cancel_customer_booking(uuid, text, text) from public, anon, authenticated;
grant execute on function public.cancel_customer_booking(uuid, text, text) to anon;

create or replace function public.list_public_bookings(p_start_date date, p_end_date date)
returns table (date date, "time" text, court text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.date, b.time, b.court
  from public.bookings as b
  where b.status = 'confirmed'
    and b.date >= p_start_date
    and b.date < p_end_date
$$;

revoke all on function public.list_public_bookings(date, date) from public, anon, authenticated;
grant execute on function public.list_public_bookings(date, date) to anon;

create or replace function public.list_unavailable_booking_times(
  p_booking_date date,
  p_court text
)
returns table ("time" text)
language sql
stable
security definer
set search_path = ''
as $$
  select b."time"
  from public.bookings as b
  where b.date = p_booking_date
    and b.court = p_court
    and b.status in ('pending', 'confirmed')
$$;

revoke all on function public.list_unavailable_booking_times(date, text) from public, anon, authenticated;
grant execute on function public.list_unavailable_booking_times(date, text) to anon;

drop policy if exists "Visitors can submit pending booking requests" on public.bookings;
create policy "Visitors can submit pending booking requests"
  on public.bookings
  for insert
  to anon
  with check (status = 'pending');

drop policy if exists "Signed-in staff can view booking requests" on public.bookings;
create policy "Signed-in staff can view booking requests"
  on public.bookings
  for select
  to authenticated
  using (true);

drop policy if exists "Signed-in staff can update booking requests" on public.bookings;
create policy "Signed-in staff can update booking requests"
  on public.bookings
  for update
  to authenticated
  using (true)
  with check (status in ('pending', 'confirmed', 'cancelled'));

drop policy if exists "Signed-in staff can delete booking requests" on public.bookings;
create policy "Signed-in staff can delete booking requests"
  on public.bookings
  for delete
  to authenticated
  using (true);

notify pgrst, 'reload schema';
