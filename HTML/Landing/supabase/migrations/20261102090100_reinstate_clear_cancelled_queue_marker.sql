create or replace function public.reinstate_late_appointment(appointment_id text, proposed jsonb, approved_by text, reason text, staff_email text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a jsonb; restored jsonb; audit jsonb;
begin
  perform pg_advisory_xact_lock(714025610);
  select data into a from public.clinic_appointments where id=appointment_id for update;
  if a is null or a->>'autoCancelled' is distinct from 'true' or coalesce(a->>'arrivedAt','') <> '' or a->>'date' <> to_char(now() at time zone 'Asia/Manila','YYYY-MM-DD') then raise exception 'Only today''s auto-cancelled appointments can be reinstated.'; end if;
  if trim(coalesce(approved_by,''))='' or trim(coalesce(reason,''))='' or trim(coalesce(staff_email,''))='' then raise exception 'Dentist approval and a reason are required.'; end if;
  if proposed->>'date' <> a->>'date' or public.clinic_appointment_start(proposed) < now() then raise exception 'Select a current start time.'; end if;
  audit := jsonb_build_object('approvedByDentistId',approved_by,'recordedBy',staff_email,'arrivalTime',coalesce(a->>'lateArrivalAt',now()::text),
    'reason',reason,'previousCancelledAt',a->>'cancelledAt','previousTime',a->>'time','newTime',proposed->>'time','approvedAt',now());
  restored := a || jsonb_build_object('date',proposed->>'date','time',proposed->>'time','schedule',proposed->>'schedule',
    'status','Approved','lifecycleStatus','Approved','visitStatus','Arrived','autoCancelled',false,'arrivedAt',coalesce(a->>'lateArrivalAt',now()::text),
    'reinstatementHistory',coalesce(a->'reinstatementHistory','[]'::jsonb)||jsonb_build_array(audit),'updatedAt',now());
  restored := restored - 'cancelledAt' - 'cancelledBy' - 'cancellationReason';
  perform set_config('clinic.reinstate_id',appointment_id,true);
  update public.clinic_appointments set data=restored,updated_at=now() where id=appointment_id returning data into restored;
  perform set_config('clinic.reinstate_id','',true);
  return restored;
end; $$;
revoke all on function public.reinstate_late_appointment(text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.reinstate_late_appointment(text,jsonb,text,text,text) to service_role;
