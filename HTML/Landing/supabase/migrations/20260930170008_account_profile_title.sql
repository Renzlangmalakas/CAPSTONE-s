-- Display-only job title. The existing role column still controls access.
alter table public.users add column if not exists profile_title text not null default '';
