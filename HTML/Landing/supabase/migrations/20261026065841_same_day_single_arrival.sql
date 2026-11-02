-- A single atomic update prevents simultaneous clicks from recording arrival twice.
create or replace function public.mark_appointment_arrived(appointment_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  update public.clinic_appointments a set
    data = a.data || jsonb_build_object('arrivedAt',now()::text,'updatedAt',now()),
    updated_at = now()
  where a.id = appointment_id
    and a.data->>'date' = to_char(now() at time zone 'Asia/Manila', 'YYYY-MM-DD')
    and coalesce(a.data->>'arrivedAt','') = ''
    and coalesce(a.data->>'completedAt','') = ''
    and lower(a.data->>'status') in ('approved','confirmed','waiting','pending','ongoing','in progress')
    and public.clinic_appointment_start(a.data) + interval '30 minutes' > now()
  returning a.data into result;
  if result is null then
    raise exception 'Arrival is allowed once, on the appointment date, before the late cancellation deadline.';
  end if;
  return result;
end; $$;
revoke all on function public.mark_appointment_arrived(text) from public, anon, authenticated;
grant execute on function public.mark_appointment_arrived(text) to service_role;
