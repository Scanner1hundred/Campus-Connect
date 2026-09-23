-- =====================================================================
-- Campus Connect: Laundry — admin access
-- PR first, then run in the Supabase SQL Editor once merged. Safe to
-- re-run. Layers on top of laundry_payments.sql. No table or function
-- signature changes — only RLS, same public.is_admin() check the
-- rentals admin queue already uses.
-- =====================================================================
--
-- What this adds
--   * Admins can read every student's bookings (previously "own rows
--     only"), so the admin page can list bookings for any day.
--   * Admins can add, update (e.g. take offline) and remove machines.
--     laundry_availability / book_laundry_slot already only count
--     machines with active = true, so taking a machine offline (rather
--     than deleting it) is enough to pull it out of the capacity count
--     without losing its history.
-- =====================================================================

drop policy if exists "students read own bookings" on laundry_bookings;
create policy "students read own bookings" on laundry_bookings
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists "admins manage machines" on laundry_machines;
create policy "admins manage machines" on laundry_machines
  for all
  using (public.is_admin())
  with check (public.is_admin());
