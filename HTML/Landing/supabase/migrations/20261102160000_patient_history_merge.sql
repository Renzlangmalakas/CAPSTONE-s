-- Ownership changes retain every record ID and payload, including uploaded evidence.
alter table public.users add column if not exists archived boolean not null default false;
alter table public.users add column if not exists merged_into uuid references public.users(id);
alter table public.users add column if not exists merged_at timestamptz;
alter table public.patients add column if not exists merged_into uuid references public.patients(id);
create table public.patient_account_merges (
 id uuid primary key default gen_random_uuid(), created_at timestamptz not null default clock_timestamp(),
 admin_id uuid not null references public.users(id), source_id uuid not null unique references public.users(id),
 destination_id uuid not null references public.users(id), source_email text not null, destination_email text not null,
 source_aliases text[] not null, destination_patient_id uuid not null references public.patients(id),
 manifest jsonb not null, check(source_id <> destination_id)
);
alter table public.patient_account_merges enable row level security;
revoke all on public.patient_account_merges from public,anon,authenticated,service_role;
grant select,insert on public.patient_account_merges to service_role;

-- Only identity/reference fields match; names, descriptions and document URLs are not rewritten.
create function public.merge_has_reference(value jsonb, aliases text[], appointment_ids text[] default '{}')
returns boolean language plpgsql immutable set search_path='' as $$
declare p record; v jsonb;
begin
 if jsonb_typeof(value)='object' then
  for p in select * from jsonb_each(value) loop
   if p.key in ('originalProfiles','originalAccount') then continue; end if;
   if p.key in ('patientId','patient_id','patientKey','patientEmail','email','userEmail','ownerEmail','userId','user_id','accountId')
      and lower(p.value#>>'{}')=any(aliases) then return true; end if;
   if p.key in ('appointmentId','appointment_id') and p.value#>>'{}'=any(appointment_ids) then return true; end if;
   if jsonb_typeof(p.value) in ('object','array') and public.merge_has_reference(p.value,aliases,appointment_ids) then return true; end if;
  end loop;
 elsif jsonb_typeof(value)='array' then
  for v in select * from jsonb_array_elements(value) loop
   if public.merge_has_reference(v,aliases,appointment_ids) then return true; end if;
  end loop;
 end if;
 return false;
end;$$;

create function public.merge_rewrite_reference(value jsonb, aliases text[], new_user uuid, new_patient uuid, new_email text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; p record; v jsonb;
begin
 if jsonb_typeof(value)='object' then
  result:='{}';
  for p in select * from jsonb_each(value) loop
   v:=p.value;
   if p.key in ('originalProfiles','originalAccount') then result:=result||jsonb_build_object(p.key,v); continue; end if;
   if lower(v#>>'{}')=any(aliases) then
    if p.key in ('patientEmail','email','userEmail','ownerEmail') then v:=to_jsonb(new_email);
    elsif p.key in ('userId','user_id','accountId') then v:=to_jsonb(new_user::text);
    elsif p.key in ('patientId','patient_id','patientKey') then v:=to_jsonb(new_patient::text); end if;
   elsif jsonb_typeof(v) in ('object','array') then
    v:=public.merge_rewrite_reference(v,aliases,new_user,new_patient,new_email);
   end if;
   result:=result||jsonb_build_object(p.key,v);
  end loop; return result;
 elsif jsonb_typeof(value)='array' then
  select coalesce(jsonb_agg(public.merge_rewrite_reference(x,aliases,new_user,new_patient,new_email) order by n),'[]')
  into result from jsonb_array_elements(value) with ordinality t(x,n); return result;
 end if;
 return value;
end;$$;

-- A locked, repeatable preview includes destination records too, so changes require re-review.
create function public.merge_patient_history(source_id uuid,destination_id uuid,admin_id uuid,
 execute_merge boolean default false,expected_fingerprint text default null,move_upcoming boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare src public.users; dst public.users; actor public.users; dest_patient uuid; aliases text[]; dest_aliases text[];
 appt_ids text[]; dest_appt_ids text[]; snapshot jsonb:='{}'; destination_snapshot jsonb:='{}'; rows jsonb; dest_rows jsonb;
 counts jsonb:='{}'; conflicts jsonb:='[]'; upcoming integer:=0; fingerprint text; tbl text; item jsonb;
 result jsonb; ctx jsonb:='{}'; headers jsonb; merge_id uuid; src_profiles jsonb; dst_profiles jsonb; unresolved boolean;
begin
 -- Same advisory lock as appointment writes; table locks prevent concurrent snapshot writers.
 perform pg_advisory_xact_lock(714025610);
 lock table public.users, public.patients, public.clinic_appointments, public.clinic_archived_appointments,
 public.clinic_patient_clinical_notes, public.clinic_treatment_plans, public.clinic_reschedule_requests,
 public.appointments, public.payments, public.treatment_logs, public.notifications in share row exclusive mode;
 select * into actor from public.users where id=admin_id;
 if actor.id is null or actor.archived or not actor.is_verified or not (
   actor.condition like '__role:admin__|%' or exists(select 1 from public.roles r where r.id=actor.role_id and lower(r.name)='admin')
 ) then raise exception 'Administrator access is required.' using errcode='42501'; end if;
 if source_id=destination_id then raise exception 'Select two different accounts.'; end if;
 select * into src from public.users where id=source_id;
 select * into dst from public.users where id=destination_id;
 if src.id is null or dst.id is null then raise exception 'Both accounts must exist.'; end if;
 if src.archived or dst.archived or src.merged_into is not null or dst.merged_into is not null then raise exception 'An account is already archived or merged. Refresh the accounts.'; end if;
 if not src.is_verified or not dst.is_verified then raise exception 'Both accounts must be verified.'; end if;
 if exists(select 1 from public.users u left join public.roles r on r.id=u.role_id where u.id in(source_id,destination_id)
   and coalesce(substring(u.condition from '^__role:([^_]+)__'),lower(r.name),'patient') <> 'patient') then
   raise exception 'Only patient accounts can be merged.'; end if;
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into src_profiles from public.patients p where p.user_id=source_id or lower(p.email)=lower(src.email)
 or p.id::text in (select data->>'patientId' from public.clinic_appointments where public.merge_has_reference(data,array[source_id::text,lower(src.email)])
 union select data->>'patientId' from public.clinic_archived_appointments where public.merge_has_reference(data,array[source_id::text,lower(src.email)]));
 select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]') into dst_profiles from public.patients p where p.user_id=destination_id or lower(p.email)=lower(dst.email)
 or p.id::text in (select data->>'patientId' from public.clinic_appointments where public.merge_has_reference(data,array[destination_id::text,lower(dst.email)])
 union select data->>'patientId' from public.clinic_archived_appointments where public.merge_has_reference(data,array[destination_id::text,lower(dst.email)]));
 if exists(select 1 from jsonb_array_elements(src_profiles||dst_profiles) p where nullif(p->>'user_id','') is not null and p->>'user_id' not in(source_id::text,destination_id::text))
 or exists(select 1 from jsonb_array_elements(src_profiles) a join jsonb_array_elements(dst_profiles) b on a->>'id'=b->>'id') then
   raise exception 'Patient profiles have conflicting account links. Review them before merging.'; end if;
 if exists(select 1 from jsonb_array_elements(src_profiles) p where nullif(p->>'email','') is not null and lower(p->>'email')<>lower(src.email))
 or exists(select 1 from jsonb_array_elements(dst_profiles) p where nullif(p->>'email','') is not null and lower(p->>'email')<>lower(dst.email)) then
  raise exception 'A linked patient profile has another email. Review account ownership before merging.'; end if;
 select array_agg(x) into aliases from (select lower(src.email) x union select source_id::text union select p->>'id' from jsonb_array_elements(src_profiles) p) a;
 select array_agg(x) into dest_aliases from (select lower(dst.email) x union select destination_id::text union select p->>'id' from jsonb_array_elements(dst_profiles) p) a;
 select array_agg(id) into appt_ids from (
  select id from public.clinic_appointments where public.merge_has_reference(data,aliases)
  union select id from public.clinic_archived_appointments where public.merge_has_reference(data,aliases)
  union select id::text from public.appointments where patient_id::text=any(aliases)) a;
 select array_agg(id) into dest_appt_ids from (
  select id from public.clinic_appointments where public.merge_has_reference(data,dest_aliases)
  union select id from public.clinic_archived_appointments where public.merge_has_reference(data,dest_aliases)
  union select id::text from public.appointments where patient_id::text=any(dest_aliases)) a;
 appt_ids:=coalesce(appt_ids,'{}'); dest_appt_ids:=coalesce(dest_appt_ids,'{}');
 if exists(select 1 from public.appointments where lower(patient_name)=lower(src.name) and not(coalesce(patient_id::text,'')=any(aliases))) then
  conflicts:=conflicts||jsonb_build_array('Unresolved legacy appointment ownership. Link the appointment to the source patient before merging.'); end if;
 foreach tbl in array array['clinic_appointments','clinic_archived_appointments','clinic_patient_clinical_notes','clinic_treatment_plans','clinic_reschedule_requests'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by id),''[]'') from public.%I t where public.merge_has_reference(data,$1,$2)',tbl) into rows using aliases,appt_ids;
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by id),''[]'') from public.%I t where public.merge_has_reference(data,$1,$2)',tbl) into dest_rows using dest_aliases,dest_appt_ids;
  snapshot:=snapshot||jsonb_build_object(tbl,rows); destination_snapshot:=destination_snapshot||jsonb_build_object(tbl,dest_rows);
  counts:=counts||jsonb_build_object(tbl,jsonb_array_length(rows));
  -- Name-only legacy ownership is unsafe: never silently skip it or guess.
  if exists(select 1 from jsonb_array_elements(rows) s join jsonb_array_elements(dest_rows) d on s->>'id'=d->>'id') then
   conflicts:=conflicts||jsonb_build_array('Shared or conflicting ownership in '||tbl||'. Review the linked records.'); end if;
  execute format('select exists(select 1 from public.%I where (lower(data->>''patientKey'')=lower($1) or lower(data->>''patientName'')=lower($1) or lower(data->>''patient'')=lower($1)) and not public.merge_has_reference(data,$2,$3))',tbl)
   into unresolved using src.name,aliases,appt_ids;
  if unresolved then conflicts:=conflicts||jsonb_build_array('Unresolved legacy name-only records in '||tbl||'. Link these records to the source patient ID before merging.'); end if;
 end loop;
 foreach tbl in array array['appointments','payments','treatment_logs','notifications'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by id),''[]'') from public.%I t where public.merge_has_reference(to_jsonb(t),$1,$2)',tbl) into rows using aliases,appt_ids;
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by id),''[]'') from public.%I t where public.merge_has_reference(to_jsonb(t),$1,$2)',tbl) into dest_rows using dest_aliases,dest_appt_ids;
  snapshot:=snapshot||jsonb_build_object(tbl,rows); destination_snapshot:=destination_snapshot||jsonb_build_object(tbl,dest_rows);
  counts:=counts||jsonb_build_object(tbl,jsonb_array_length(rows));
 end loop;
 snapshot:=snapshot||jsonb_build_object('profiles',src_profiles);
 destination_snapshot:=destination_snapshot||jsonb_build_object('profiles',dst_profiles);
 if exists(select 1 from jsonb_array_elements(snapshot->'clinic_patient_clinical_notes') a
  join jsonb_array_elements(destination_snapshot->'clinic_patient_clinical_notes') b
   on a->'data'->>'recordDate'=b->'data'->>'recordDate'
   and coalesce(a->'data'->>'tooth','')=coalesce(b->'data'->>'tooth','')
   and nullif(a->'data'->>'treatment','')=b->'data'->>'treatment'
   and coalesce(a->'data'->>'condition','')=coalesce(b->'data'->>'condition','')) then
  conflicts:=conflicts||jsonb_build_array('Possible duplicate clinical records share a date, tooth, condition and treatment. Review them before merging.'); end if;
 if exists(
  select 1 from jsonb_array_elements((snapshot->'clinic_appointments')||(snapshot->'clinic_archived_appointments')||(snapshot->'clinic_treatment_plans')) a,
   jsonb_array_elements(case when jsonb_typeof(a->'data'->'paymentProofs')='array' then a->'data'->'paymentProofs' else '[]' end) ap,
   jsonb_array_elements((destination_snapshot->'clinic_appointments')||(destination_snapshot->'clinic_archived_appointments')||(destination_snapshot->'clinic_treatment_plans')) b,
   jsonb_array_elements(case when jsonb_typeof(b->'data'->'paymentProofs')='array' then b->'data'->'paymentProofs' else '[]' end) bp
  where nullif(regexp_replace(ap->>'reference','[\s-]','','g'),'')=regexp_replace(bp->>'reference','[\s-]','','g')) then
  conflicts:=conflicts||jsonb_build_array('Both accounts contain the same payment reference. Review the billing records before merging.'); end if;
 -- The booking helpers handle all supported date/time and duration formats.
 if exists(with all_bookings as (
  select id,data from public.clinic_appointments
  union all select a.id::text,jsonb_build_object('date',a.appointment_date,'time',a.appointment_time,'status',a.status,'serviceName',a.service_name) from public.appointments a
 ) select 1 from all_bookings a join all_bookings b on a.id<>b.id
  where a.id=any(appt_ids) and b.id=any(dest_appt_ids) and public.booking_active(a.data) and public.booking_active(b.data)
  and public.booking_start(a.data)<public.booking_start(b.data)+make_interval(mins=>public.booking_duration(b.data))
  and public.booking_start(b.data)<public.booking_start(a.data)+make_interval(mins=>public.booking_duration(a.data))) then
  conflicts:=conflicts||jsonb_build_array('Active appointments overlap between these accounts. Reschedule or resolve the conflicts before merging.'); end if;
 select count(*) into upcoming from public.clinic_appointments where id=any(appt_ids) and public.booking_active(data)
  and public.booking_start(data)+make_interval(mins=>public.booking_duration(data)) >= clock_timestamp() at time zone 'Asia/Manila';
 upcoming:=upcoming+(select count(*) from public.appointments where id::text=any(appt_ids) and lower(coalesce(status,'')) not in('cancelled','completed','rejected') and appointment_date >= (clock_timestamp() at time zone 'Asia/Manila')::date);
 fingerprint:=md5((snapshot||jsonb_build_object('destination',destination_snapshot,'sourceAccount',public.audit_clean(to_jsonb(src)),'destinationAccount',public.audit_clean(to_jsonb(dst))))::text);
 counts:=counts||jsonb_build_object('profiles',jsonb_array_length(src_profiles));
 result:=jsonb_build_object('source',jsonb_build_object('id',src.id,'name',src.name,'email',src.email,'createdAt',src.created_at),
  'destination',jsonb_build_object('id',dst.id,'name',dst.name,'email',dst.email,'createdAt',dst.created_at),
  'counts',counts,'upcoming',upcoming,'conflicts',conflicts,'fingerprint',fingerprint);
 if not execute_merge then return result; end if;
 if expected_fingerprint is distinct from fingerprint then raise exception 'Records changed since the preview. Preview both accounts again.'; end if;
 if jsonb_array_length(conflicts)>0 then raise exception 'Conflicting records require review. No records were transferred.'; end if;
 if upcoming>0 and not move_upcoming then raise exception 'Explicitly confirm moving upcoming appointments first.'; end if;
 select p.id into dest_patient from public.patients p where (p.user_id=destination_id or lower(p.email)=lower(dst.email)) and not coalesce(p.archived,false) and p.deleted_at is null order by p.created_at,p.id limit 1;
 if dest_patient is null then
  insert into public.patients(user_id,name,email,contact,address,gender,condition) values(dst.id,dst.name,dst.email,dst.mobile,dst.address,dst.sex,dst.condition) returning id into dest_patient;
 end if;
 foreach tbl in array array['clinic_appointments','clinic_archived_appointments','clinic_patient_clinical_notes','clinic_treatment_plans','clinic_reschedule_requests'] loop
  for item in select * from jsonb_array_elements(snapshot->tbl) loop
   execute format('update public.%I set data=public.merge_rewrite_reference(data,$1,$2,$3,$4)||jsonb_build_object(''patientEmail'',$4::text,''patientId'',$3::text,''patientKey'',$3::text),updated_at=clock_timestamp() where id=$5',tbl)
    using aliases,dst.id,dest_patient,dst.email,item->>'id';
  end loop;
 end loop;
 update public.appointments set patient_id=dest_patient,updated_at=clock_timestamp() where patient_id::text=any(aliases);
 update public.treatment_logs set patient_id=dest_patient where patient_id::text=any(aliases) or appointment_id::text=any(appt_ids);
 update public.notifications set user_id=dst.id,data=public.merge_rewrite_reference(data,aliases,dst.id,dest_patient,dst.email) where user_id=src.id;
 -- Profile medical/contact history remains readable alongside the transferred clinical notes.
 -- The original profile is also retained, archived, without overwriting replacement details.
 merge_id:=gen_random_uuid();
 insert into public.clinic_patient_clinical_notes(id,data) values('account-history-'||merge_id::text,
  jsonb_build_object('id','account-history-'||merge_id::text,'patientId',dest_patient::text,'patientKey',dest_patient::text,
   'patientEmail',dst.email,'treatment','Account recovery: original profile history','treatmentStatus','Note',
   'text','Original medical and contact information preserved after account recovery.',
   'appointmentId',coalesce(snapshot->'clinic_appointments'->0->>'id',snapshot->'clinic_archived_appointments'->0->>'id'),
   'recordDate',to_char(clock_timestamp() at time zone 'Asia/Manila','YYYY-MM-DD'),'createdAt',clock_timestamp(),
   'createdBy',actor.email,'condition',regexp_replace(coalesce(src.condition,''),'^__role:[^_]+__\|',''),
   'before',concat_ws(E'\n','Original account: '||src.name||' ('||src.email||')','Original contact: '||coalesce(src.mobile,''),
    'Original address: '||coalesce(src.address,''),(select string_agg(concat_ws(E'\n','Patient ID: '||(p->>'id'),'Medical notes: '||coalesce(p->>'condition',''),
    'Contact: '||coalesce(p->>'contact',''),'Address: '||coalesce(p->>'address',''),'Age: '||coalesce(p->>'age',''),'Gender: '||coalesce(p->>'gender','')),E'\n\n') from jsonb_array_elements(src_profiles) p)),
   'originalProfiles',src_profiles,'originalAccount',public.audit_clean(to_jsonb(src))));
 update public.patients set archived=true,merged_into=dest_patient,updated_at=clock_timestamp() where id::text=any(aliases);
 update public.users set archived=true,merged_into=dst.id,merged_at=clock_timestamp(),updated_at=clock_timestamp() where id=src.id;
 insert into public.patient_account_merges(id,admin_id,source_id,destination_id,source_email,destination_email,source_aliases,destination_patient_id,manifest)
 values(merge_id,actor.id,src.id,dst.id,src.email,dst.email,aliases,dest_patient,
  jsonb_build_object('recordIds',(select jsonb_object_agg(key,(select coalesce(jsonb_agg(r->>'id'),'[]') from jsonb_array_elements(value) r)) from jsonb_each(snapshot)),
   'sourceProfile',public.audit_clean(to_jsonb(src)),'counts',counts));
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 if headers ? 'x-clinic-audit-context' then ctx:=convert_from(decode(headers->>'x-clinic-audit-context','base64'),'UTF8')::jsonb; end if;
 insert into public.clinic_audit_log(actor_id,actor_email,actor_role,ip_address,user_agent,action,module,resource,before_state,after_state,outcome,request_id,details)
 values(actor.id::text,actor.email,'admin',coalesce(ctx->>'ip','unavailable'),coalesce(ctx->>'agent','database process'),
 'Account history merged — old account archived','Users',merge_id::text,
 jsonb_build_object('oldAccountId',src.id,'oldEmail',src.email,'newAccountId',dst.id,'newEmail',dst.email,'archived',false),
 jsonb_build_object('archived',true,'destinationPatientId',dest_patient,'counts',counts),'Success',ctx->>'requestId',
 jsonb_build_object('description','Account history merged — old account archived','oldAccountId',src.id,'oldEmail',src.email,'newAccountId',dst.id,'newEmail',dst.email));
 return result||jsonb_build_object('merged',true,'mergeId',merge_id,'patientId',dest_patient);
end;$$;

-- Stale browser snapshots cannot undo a merge or create new records for its source.
create function public.protect_merged_patient() returns trigger language plpgsql set search_path='' as $$
declare row_value jsonb;
begin
 if TG_TABLE_NAME in('users','patients') then
  if TG_OP<>'INSERT' and to_jsonb(old)->>'merged_into' is not null then
   if TG_OP='DELETE' or to_jsonb(new)->'merged_into' is distinct from to_jsonb(old)->'merged_into' or not (to_jsonb(new)->>'archived')::boolean then
    raise exception 'Merged accounts and profiles are archived permanently for reference.'; end if;
   if TG_TABLE_NAME='users' then raise exception 'This account is archived after a history merge.'; end if;
   if public.audit_clean(to_jsonb(new)) is distinct from public.audit_clean(to_jsonb(old)) then
    raise exception 'The original merged patient profile is retained as read-only history.';
   end if;
  end if;
 end if;
 if TG_OP<>'DELETE' then
  row_value:=to_jsonb(new);
  if TG_TABLE_NAME='patients' and row_value->>'merged_into' is not null then return new; end if;
  if exists(select 1 from public.patient_account_merges m where public.merge_has_reference(row_value,m.source_aliases)) then
   raise exception 'This patient account has been merged. Refresh to use the replacement account.'; end if;
 end if;
 if TG_OP='DELETE' then return old; end if; return new;
end;$$;
do $$ declare tbl text; begin
 foreach tbl in array array['users','patients','clinic_appointments','clinic_archived_appointments','clinic_patient_clinical_notes','clinic_treatment_plans','clinic_reschedule_requests','appointments','treatment_logs','notifications'] loop
 execute format('create trigger protect_merged_patient before insert or update or delete on public.%I for each row execute function public.protect_merged_patient()',tbl);
 end loop;
end;$$;
revoke all on function public.merge_patient_history(uuid,uuid,uuid,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.merge_patient_history(uuid,uuid,uuid,boolean,text,boolean) to service_role;
revoke all on function public.merge_has_reference(jsonb,text[],text[]), public.merge_rewrite_reference(jsonb,text[],uuid,uuid,text), public.protect_merged_patient() from public,anon,authenticated;
grant execute on function public.merge_has_reference(jsonb,text[],text[]), public.merge_rewrite_reference(jsonb,text[],uuid,uuid,text), public.protect_merged_patient() to service_role;
