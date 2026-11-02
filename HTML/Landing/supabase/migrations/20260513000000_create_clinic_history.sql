create table if not exists public.clinic_history (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_clinic_history_updated_at on public.clinic_history;
create trigger set_clinic_history_updated_at
before update on public.clinic_history
for each row execute function public.set_updated_at();
