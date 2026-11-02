-- Restore tables required by clinic snapshot sync without changing existing records.
create table if not exists public.clinic_archived_appointments (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_archived_appointments enable row level security;
revoke all on public.clinic_archived_appointments from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_archived_appointments to service_role;
drop trigger if exists set_clinic_archived_appointments_updated_at on public.clinic_archived_appointments;
create trigger set_clinic_archived_appointments_updated_at before update on public.clinic_archived_appointments
for each row execute function public.set_updated_at();

create table if not exists public.clinic_reschedule_requests (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_reschedule_requests enable row level security;
revoke all on public.clinic_reschedule_requests from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_reschedule_requests to service_role;
drop trigger if exists set_clinic_reschedule_requests_updated_at on public.clinic_reschedule_requests;
create trigger set_clinic_reschedule_requests_updated_at before update on public.clinic_reschedule_requests
for each row execute function public.set_updated_at();

create table if not exists public.clinic_patient_clinical_notes (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_patient_clinical_notes enable row level security;
revoke all on public.clinic_patient_clinical_notes from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_patient_clinical_notes to service_role;
drop trigger if exists set_clinic_patient_clinical_notes_updated_at on public.clinic_patient_clinical_notes;
create trigger set_clinic_patient_clinical_notes_updated_at before update on public.clinic_patient_clinical_notes
for each row execute function public.set_updated_at();

create table if not exists public.clinic_treatment_plans (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_treatment_plans enable row level security;
revoke all on public.clinic_treatment_plans from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_treatment_plans to service_role;
drop trigger if exists set_clinic_treatment_plans_updated_at on public.clinic_treatment_plans;
create trigger set_clinic_treatment_plans_updated_at before update on public.clinic_treatment_plans
for each row execute function public.set_updated_at();

notify pgrst, 'reload schema';
