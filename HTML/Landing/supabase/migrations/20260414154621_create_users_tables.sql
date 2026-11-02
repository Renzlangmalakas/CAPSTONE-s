create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  password text not null,
  is_verified boolean not null default true,
  sex text default '',
  dob text default '',
  mobile text default '',
  address text default '',
  condition text default '',
  verification_token text,
  profile_image text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists role text default 'patient';

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dentists (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.staffs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  target text default 'admin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dentist_schedules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.patients add column if not exists sync_key text unique;
alter table public.patients add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.patients add column if not exists updated_at timestamptz not null default now();

alter table public.dentists add column if not exists sync_key text unique;
alter table public.dentists add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.dentists add column if not exists updated_at timestamptz not null default now();

alter table public.staffs add column if not exists sync_key text unique;
alter table public.staffs add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.staffs add column if not exists updated_at timestamptz not null default now();

alter table public.appointments add column if not exists sync_key text unique;
alter table public.appointments add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.appointments add column if not exists updated_at timestamptz not null default now();

alter table public.notifications add column if not exists sync_key text unique;
alter table public.notifications add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists target text default 'admin';
alter table public.notifications add column if not exists updated_at timestamptz not null default now();

alter table public.dentist_schedules add column if not exists sync_key text unique;
alter table public.dentist_schedules add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.dentist_schedules add column if not exists updated_at timestamptz not null default now();

alter table public.services add column if not exists sync_key text unique;
alter table public.services add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.services add column if not exists updated_at timestamptz not null default now();

alter table public.payments add column if not exists sync_key text unique;
alter table public.payments add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.payments add column if not exists updated_at timestamptz not null default now();

create table if not exists public.clinic_patients (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_dentists (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_staff (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_appointments (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_archived_appointments (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_reschedule_requests (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_patient_clinical_notes (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_treatment_plans (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_history (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clinic_notifications (
  id text primary key,
  target text not null check (target in ('admin', 'dentist', 'patient', 'staff')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (lower(email));
create index if not exists users_verification_token_idx on public.users (verification_token);
create index if not exists patients_sync_key_idx on public.patients (sync_key);
create index if not exists dentists_sync_key_idx on public.dentists (sync_key);
create index if not exists staffs_sync_key_idx on public.staffs (sync_key);
create index if not exists appointments_sync_key_idx on public.appointments (sync_key);
create index if not exists notifications_sync_key_idx on public.notifications (sync_key);
create index if not exists notifications_target_idx on public.notifications (target);
create index if not exists dentist_schedules_sync_key_idx on public.dentist_schedules (sync_key);
create index if not exists services_sync_key_idx on public.services (sync_key);
create index if not exists payments_sync_key_idx on public.payments (sync_key);
create index if not exists clinic_notifications_target_idx on public.clinic_notifications (target);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_patients_updated_at on public.patients;
create trigger set_patients_updated_at
before update on public.patients
for each row execute function public.set_updated_at();

drop trigger if exists set_dentists_updated_at on public.dentists;
create trigger set_dentists_updated_at
before update on public.dentists
for each row execute function public.set_updated_at();

drop trigger if exists set_staffs_updated_at on public.staffs;
create trigger set_staffs_updated_at
before update on public.staffs
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

drop trigger if exists set_dentist_schedules_updated_at on public.dentist_schedules;
create trigger set_dentist_schedules_updated_at
before update on public.dentist_schedules
for each row execute function public.set_updated_at();

drop trigger if exists set_services_updated_at on public.services;
create trigger set_services_updated_at
before update on public.services
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_patients_updated_at on public.clinic_patients;
create trigger set_clinic_patients_updated_at
before update on public.clinic_patients
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_dentists_updated_at on public.clinic_dentists;
create trigger set_clinic_dentists_updated_at
before update on public.clinic_dentists
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_staff_updated_at on public.clinic_staff;
create trigger set_clinic_staff_updated_at
before update on public.clinic_staff
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_appointments_updated_at on public.clinic_appointments;
create trigger set_clinic_appointments_updated_at
before update on public.clinic_appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_archived_appointments_updated_at on public.clinic_archived_appointments;
create trigger set_clinic_archived_appointments_updated_at
before update on public.clinic_archived_appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_reschedule_requests_updated_at on public.clinic_reschedule_requests;
create trigger set_clinic_reschedule_requests_updated_at
before update on public.clinic_reschedule_requests
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_patient_clinical_notes_updated_at on public.clinic_patient_clinical_notes;
create trigger set_clinic_patient_clinical_notes_updated_at
before update on public.clinic_patient_clinical_notes
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_treatment_plans_updated_at on public.clinic_treatment_plans;
create trigger set_clinic_treatment_plans_updated_at
before update on public.clinic_treatment_plans
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_history_updated_at on public.clinic_history;
create trigger set_clinic_history_updated_at
before update on public.clinic_history
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_notifications_updated_at on public.clinic_notifications;
create trigger set_clinic_notifications_updated_at
before update on public.clinic_notifications
for each row execute function public.set_updated_at();
