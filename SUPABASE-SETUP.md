# Supabase setup

The customer booking form and staff dashboard share a Supabase Postgres database. The public site can create pending requests; signed-in staff can create, read, change, or delete bookings.

## Connect a Supabase project

1. Create a Supabase project.
2. In **Project Settings → API**, copy the **Project URL** and the public **anon** key into `supabase-config.js`.
   Never use a `service_role` key in this website. Browser code and its anon key are public.
3. In the Supabase **SQL Editor**, run all of `supabase-schema.sql`. Re-run it after pulling schema updates so the staff booking permissions are applied.
4. In **Authentication → Providers / Sign In**, disable public sign-ups. Create staff users yourself in **Authentication → Users** with the intended staff email and password. Any account allowed to sign in can administer bookings, so do not enable public registration.
5. Serve the site from an HTTP(S) origin (not by opening `index.html` directly). Add that origin to Supabase's allowed site/redirect URLs if required by the project's Auth settings.
6. Submit a test booking from the public form, then open the admin page by clicking a site logo five times and sign in with the staff account.

The database uses row-level security: anonymous visitors can only insert a new pending booking, while authenticated users can create pending or confirmed bookings and list, update, or delete bookings. The admin page checks for an overlapping active booking on the selected court before creating a staff booking. Customer submissions are saved directly to the database; failed saves show an error and are not presented as successful.

While staff are signed in, the admin page automatically checks for database changes every five seconds and updates its list without a page reload. It checks again when the admin tab becomes visible. The dashboard also has a manual **Refresh now** button. Staff can create a booking directly from the dashboard; new staff bookings default to confirmed, can be saved as pending, and are checked for overlapping active bookings on the same court and date.

The overlap check runs in the dashboard before saving and is not an atomic database constraint, so simultaneous bookings may still race. Anonymous submissions may need CAPTCHA/rate limiting before the site is exposed to abuse.
