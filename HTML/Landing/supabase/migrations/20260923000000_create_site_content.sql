create table if not exists public.clinic_site_content (
  id text primary key check (id = 'website'),
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_by text
);
alter table public.clinic_site_content enable row level security;
revoke all on public.clinic_site_content from anon, authenticated;
grant select, insert, update on public.clinic_site_content to service_role;
insert into public.clinic_site_content (id) values ('website') on conflict (id) do nothing;
