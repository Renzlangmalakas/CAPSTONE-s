-- Account, patient and appointment are committed together. Existing passwords are never reset.
create or replace function public.create_patient_with_login(patient_record jsonb, appointment_record jsonb, password_hash text, is_walk_in boolean default false)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare account_id uuid; existing_role text; verified boolean; patient_role uuid; result jsonb; email_address text;
begin
  perform pg_advisory_xact_lock(714025610);
  email_address := lower(trim(patient_record->>'email'));
  if email_address is null or email_address='' then raise exception 'Patient email required.'; end if;
  if patient_record->>'gender' not in ('Male','Female') then raise exception 'Select Male or Female.'; end if;
  select u.id,coalesce(substring(u.condition from '^__role:([a-z]+)__'),r.name,'patient'),u.is_verified
    into account_id,existing_role,verified from public.users u left join public.roles r on r.id=u.role_id
    where lower(u.email)=email_address for update of u;
  if account_id is not null and (existing_role<>'patient' or not coalesce(verified,false)) then
    raise exception 'This email belongs to a staff account or an unverified registration. Use a patient email.';
  end if;
  if account_id is null then
    if password_hash is null or password_hash !~ '^\$2[aby]\$[0-9]{2}\$' then raise exception 'A hashed patient password is required.'; end if;
    select id into patient_role from public.roles where name='patient' limit 1;
    insert into public.users(id,name,email,password,is_verified,sex,mobile,address,condition,role_id)
    values(gen_random_uuid(),patient_record->>'name',email_address,password_hash,true,lower(patient_record->>'gender'),
      patient_record->>'contact',patient_record->>'address','__role:patient__|'||coalesce(patient_record->>'condition',''),patient_role)
    returning id into account_id;
  end if;
  if is_walk_in then
    result := public.create_walk_in(patient_record,appointment_record);
  else
    result := public.create_patient_appointment(patient_record,appointment_record);
  end if;
  update public.patients set user_id=account_id where id=(patient_record->>'id')::uuid;
  return result;
end; $$;
revoke all on function public.create_patient_with_login(jsonb,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.create_patient_with_login(jsonb,jsonb,text,boolean) to service_role;
