create table if not exists public.clinic_audit_log (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 actor_email text not null,
 actor_role text not null,
 action text not null,
 resource text not null,
 outcome text not null,
 details jsonb not null default '{}'::jsonb
);
create index if not exists clinic_audit_log_created_idx on public.clinic_audit_log(created_at desc, id desc);
alter table public.clinic_audit_log enable row level security;
revoke all on public.clinic_audit_log from public, anon, authenticated, service_role;
grant select, insert on public.clinic_audit_log to service_role;
grant usage, select on sequence public.clinic_audit_log_id_seq to service_role;
notify pgrst, 'reload schema';
