alter table public.patients add column if not exists deleted_at timestamptz;

create or replace function public.preserve_patient_deletion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.deleted_at is not null then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.preserve_patient_deletion() from public, anon, authenticated;
drop trigger if exists preserve_patient_deletion on public.patients;
create trigger preserve_patient_deletion
before update on public.patients
for each row execute function public.preserve_patient_deletion();

notify pgrst, 'reload schema';
