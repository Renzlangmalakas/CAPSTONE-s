create or replace function public.create_patient_appointment(patient_record jsonb, appointment_record jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare existing jsonb; patient_id uuid;
begin
  perform pg_advisory_xact_lock(714025610);
  select data into existing from public.clinic_appointments where id=appointment_record->>'id';
  if existing is not null then
    if existing->>'patientId' <> patient_record->>'id' or existing->>'createdBy' is distinct from appointment_record->>'createdBy' then raise exception 'Booking reference already used.'; end if;
    return existing;
  end if;
  patient_id := (patient_record->>'id')::uuid;
  insert into public.patients(id,name,contact,email,age,gender,address,condition,archived)
  values(patient_id,patient_record->>'name',patient_record->>'contact',patient_record->>'email',
    (patient_record->>'age')::integer,patient_record->>'gender',patient_record->>'address',patient_record->>'condition',false);
  appointment_record := appointment_record || jsonb_build_object('patientId',patient_id::text,'createdAt',now(),'updatedAt',now());
  insert into public.clinic_appointments(id,data) values(appointment_record->>'id',appointment_record) returning data into existing;
  return existing;
end; $$;
revoke all on function public.create_patient_appointment(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_patient_appointment(jsonb,jsonb) to service_role;
