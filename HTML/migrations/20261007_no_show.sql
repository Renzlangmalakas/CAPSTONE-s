create extension if not exists pg_cron;
create schema if not exists clinic_private;
revoke all on schema clinic_private from public, anon, authenticated;
create table if not exists clinic_private.no_show_policy (
  id boolean primary key default true check (id), enabled_at timestamptz not null default now()
);
alter table clinic_private.no_show_policy enable row level security;
insert into clinic_private.no_show_policy(id) values (true) on conflict do nothing;

create or replace function public.clinic_appointment_start(record jsonb)
returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  if coalesce(record->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' then return null; end if;
  return ((record->>'date')::date + (record->>'time')::time) at time zone 'Asia/Manila';
exception when others then return null;
end; $$;
revoke all on function public.clinic_appointment_start(jsonb) from public, anon, authenticated;
grant execute on function public.clinic_appointment_start(jsonb) to service_role;

create or replace function public.cancel_late_appointments()
returns integer language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  update public.clinic_appointments a set
    data = a.data || jsonb_build_object('status','Cancelled','visitStatus','Cancelled',
      'lifecycleStatus','Cancelled','autoCancelled',true,'cancelledAt',now(),
      'cancellationReason','Patient did not arrive within 30 minutes of the appointment.', 'updatedAt',now()),
    updated_at = now()
  where lower(a.data->>'status') in ('approved','confirmed','waiting','pending')
    and coalesce(a.data->>'arrivedAt','') = ''
    and coalesce(a.data->>'completedAt','') = ''
    and lower(coalesce(a.data->>'visitStatus','')) not in ('ongoing','in progress','completed')
    and public.clinic_appointment_start(a.data) >= (select enabled_at from clinic_private.no_show_policy where id)
    and public.clinic_appointment_start(a.data) + interval '30 minutes' <= now();
  get diagnostics affected = row_count;
  return affected;
end; $$;
revoke all on function public.cancel_late_appointments() from public, anon, authenticated, service_role;

create or replace function public.mark_appointment_arrived(appointment_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  update public.clinic_appointments a set
    data = a.data || jsonb_build_object('arrivedAt',coalesce(nullif(a.data->>'arrivedAt',''),now()::text),'updatedAt',now()),
    updated_at = now()
  where a.id = appointment_id
    and lower(a.data->>'status') in ('approved','confirmed','waiting','pending','ongoing','in progress')
    and (public.clinic_appointment_start(a.data) + interval '30 minutes' > now() or coalesce(a.data->>'arrivedAt','') <> '')
  returning a.data into result;
  if result is null then raise exception 'Appointment is cancelled, overdue, or unavailable. Refresh the schedule.'; end if;
  return result;
end; $$;
revoke all on function public.mark_appointment_arrived(text) from public, anon, authenticated;
grant execute on function public.mark_appointment_arrived(text) to service_role;

create or replace function clinic_private.keep_no_show_cancellation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.data->>'autoCancelled' = 'true' then
    new.data = new.data || jsonb_build_object('status','Cancelled','visitStatus','Cancelled','lifecycleStatus','Cancelled',
      'autoCancelled',true,'cancelledAt',old.data->>'cancelledAt','cancellationReason',old.data->>'cancellationReason');
  end if;
  return new;
end; $$;
drop trigger if exists keep_no_show_cancellation on public.clinic_appointments;
create trigger keep_no_show_cancellation before update on public.clinic_appointments
for each row execute function clinic_private.keep_no_show_cancellation();
select cron.schedule('clinic-cancel-late-appointments', '* * * * *', 'select public.cancel_late_appointments();');
