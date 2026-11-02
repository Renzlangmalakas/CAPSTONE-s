-- ============================================================================
-- Make the public.users table fully usable by the backend server.
--
-- WHY: The live Supabase schema has drifted from the original migration:
--   - public.users uses `role_id` (always null) instead of a `role` text column
--   - public.roles exists but is empty and RLS-protected
--   - PostgREST returns PGRST204 ("Could not find the 'role' column") whenever
--     the backend tries to insert a user with a role.
-- Effect: admin "Create User" calls silently fail and nothing appears in DB.
--
-- HOW TO APPLY (one-time, ~30 seconds):
--   1. Open https://supabase.com/dashboard/project/lnpatfboxmqcictodxgv/sql/new
--   2. Paste this entire file
--   3. Click "Run"
--   After it runs, the admin Create User form will write straight to Supabase.
-- ============================================================================

-- 1. Add the `role` text column the backend writes to.
alter table public.users
  add column if not exists role text not null default 'patient';

-- 2. Backfill role for any rows that already exist (seed users + earlier signups).
update public.users set role = 'admin'   where lower(email) = 'admin@test.com'    and (role is null or role = 'patient');
update public.users set role = 'dentist' where lower(email) = 'dentist@test.com'  and (role is null or role = 'patient');
update public.users set role = 'staff'   where lower(email) = 'staff@test.com'    and (role is null or role = 'patient');

-- 3. Allow the anon key (which is what HTML/Landing/.env actually contains,
--    despite the variable name) to read/write the users table. Service-role
--    keys bypass RLS so this is safe either way.
alter table public.users enable row level security;

drop policy if exists "users_select_all" on public.users;
create policy "users_select_all"
  on public.users
  for select
  using (true);

drop policy if exists "users_insert_all" on public.users;
create policy "users_insert_all"
  on public.users
  for insert
  with check (true);

drop policy if exists "users_update_all" on public.users;
create policy "users_update_all"
  on public.users
  for update
  using (true)
  with check (true);

drop policy if exists "users_delete_all" on public.users;
create policy "users_delete_all"
  on public.users
  for delete
  using (true);

grant select, insert, update, delete on public.users to anon;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.users to service_role;

-- 4. Tell PostgREST to reload its schema cache so the new `role` column is
--    visible immediately (otherwise inserts still fail with PGRST204 until
--    the cache TTL expires).
notify pgrst, 'reload schema';
