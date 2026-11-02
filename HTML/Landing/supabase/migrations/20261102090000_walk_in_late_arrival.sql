-- Atomic walk-in creation and staff-only late-arrival reinstatement.
alter table public.patients add column if not exists email text;
alter table public.patients add column if not exists condition text;

create or replace function public.create_walk_in(patient_record jsonb, appointment_record jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing jsonb; patient_id uuid;
begin
  perform pg_advisory_xact_lock(714025610);
  select data into existing from public.clinic_appointments where id=appointment_record->>'id';
  if existing is not null then return existing; end if;
  patient_id := (patient_record->>'id')::uuid;
  insert into public.patients(id,name,contact,email,age,gender,address,condition,archived)
  values(patient_id,patient_record->>'name',patient_record->>'contact',patient_record->>'email',
    (patient_record->>'age')::integer,patient_record->>'gender',patient_record->>'address',patient_record->>'condition',false);
  appointment_record := appointment_record || jsonb_build_object('patientId',patient_id::text,'arrivedAt',now(),'walkIn',true,'createdAt',now(),'updatedAt',now());
  insert into public.clinic_appointments(id,data) values(appointment_record->>'id',appointment_record) returning data into existing;
  return existing;
end; $$;
revoke all on function public.create_walk_in(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_walk_in(jsonb,jsonb) to service_role;

create or replace function clinic_private.keep_no_show_cancellation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.data->>'autoCancelled' = 'true' and coalesce(current_setting('clinic.reinstate_id',true),'') <> old.id then
    new.data := new.data || jsonb_build_object('status','Cancelled','visitStatus','Cancelled','lifecycleStatus','Cancelled',
      'autoCancelled',true,'cancelledAt',old.data->>'cancelledAt','cancellationReason',old.data->>'cancellationReason');
  end if;
  if coalesce(current_setting('clinic.reinstate_id',true),'') <> old.id then
    if old.data ? 'reinstatementHistory' then
      new.data := new.data || jsonb_build_object('reinstatementHistory',old.data->'reinstatementHistory');
    else new.data := new.data - 'reinstatementHistory'; end if;
  end if;
  return new;
end; $$;

create or replace function public.record_staff_arrival(appointment_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare a jsonb; late integer;
begin
  perform pg_advisory_xact_lock(714025610);
  select data into a from public.clinic_appointments where id=appointment_id for update;
  if a is null or a->>'date' <> to_char(now() at time zone 'Asia/Manila','YYYY-MM-DD') then raise exception 'Arrival is allowed only on the appointment date.'; end if;
  if coalesce(a->>'arrivedAt','') <> '' then raise exception 'Arrival was already recorded.'; end if;
  late := greatest(0,floor(extract(epoch from (now()-public.clinic_appointment_start(a)))/60)::integer);
  if a->>'autoCancelled' = 'true' or (late >= 30 and lower(a->>'status') in ('approved','confirmed','waiting','pending')) then
    a := a || jsonb_build_object('status','Cancelled','lifecycleStatus','Cancelled','visitStatus','Cancelled','autoCancelled',true,
      'cancelledAt',coalesce(a->>'cancelledAt',now()::text),'cancellationReason','Patient did not arrive within 30 minutes of the appointment.',
      'lateArrivalAt',coalesce(a->>'lateArrivalAt',now()::text),'updatedAt',now());
    update public.clinic_appointments set data=a,updated_at=now() where id=appointment_id;
    return jsonb_build_object('appointment',a,'late',true,'minutesLate',late);
  end if;
  if lower(a->>'status') not in ('approved','confirmed','waiting','pending','ongoing','in progress') then raise exception 'This appointment cannot be checked in.'; end if;
  a := a || jsonb_build_object('arrivedAt',now(),'updatedAt',now());
  update public.clinic_appointments set data=a,updated_at=now() where id=appointment_id;
  return jsonb_build_object('appointment',a,'late',false);
end; $$;
revoke all on function public.record_staff_arrival(text) from public,anon,authenticated;
grant execute on function public.record_staff_arrival(text) to service_role;

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
    'reason',reason,'previousTime',a->>'time','newTime',proposed->>'time','approvedAt',now());
  restored := a || jsonb_build_object('date',proposed->>'date','time',proposed->>'time','schedule',proposed->>'schedule',
    'status','Approved','lifecycleStatus','Approved','visitStatus','Arrived','autoCancelled',false,'arrivedAt',coalesce(a->>'lateArrivalAt',now()::text),
    'reinstatementHistory',coalesce(a->'reinstatementHistory','[]'::jsonb)||jsonb_build_array(audit),'updatedAt',now());
  perform set_config('clinic.reinstate_id',appointment_id,true);
  update public.clinic_appointments set data=restored,updated_at=now() where id=appointment_id returning data into restored;
  perform set_config('clinic.reinstate_id','',true);
  return restored;
end; $$;
revoke all on function public.reinstate_late_appointment(text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.reinstate_late_appointment(text,jsonb,text,text,text) to service_role;
