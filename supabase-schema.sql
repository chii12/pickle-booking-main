create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  phone text not null check (char_length(phone) between 1 and 40),
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
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

revoke all on table public.bookings from public, anon, authenticated;
grant insert (name, phone, court, players, duration, date, time, estimated_total, promo, notes)
  on table public.bookings to anon;
grant insert (name, phone, court, players, duration, date, time, estimated_total, promo, notes, status)
  on table public.bookings to authenticated;
grant select, update, delete on table public.bookings to authenticated;

drop policy if exists "Visitors can submit pending booking requests" on public.bookings;
create policy "Visitors can submit pending booking requests"
  on public.bookings
  for insert
  to anon
  with check (status = 'pending');

drop policy if exists "Signed-in staff can create bookings" on public.bookings;
create policy "Signed-in staff can create bookings"
  on public.bookings
  for insert
  to authenticated
  with check (status in ('pending', 'confirmed'));

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
