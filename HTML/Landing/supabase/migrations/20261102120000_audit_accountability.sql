-- Immutable, transaction-level audit events. Values are not truncated.
alter table public.clinic_audit_log add column if not exists actor_id text;
alter table public.clinic_audit_log add column if not exists ip_address text;
alter table public.clinic_audit_log add column if not exists user_agent text;
alter table public.clinic_audit_log add column if not exists module text;
alter table public.clinic_audit_log add column if not exists before_state jsonb not null default '{}';
alter table public.clinic_audit_log add column if not exists after_state jsonb not null default '{}';
alter table public.clinic_audit_log add column if not exists error_reason text;
alter table public.clinic_audit_log add column if not exists security_event boolean not null default false;
alter table public.clinic_audit_log add column if not exists request_id text;
alter table public.clinic_audit_log add column if not exists location text;
create index if not exists clinic_audit_request_idx on public.clinic_audit_log(request_id);
create index if not exists clinic_audit_actor_time_idx on public.clinic_audit_log(actor_email,created_at desc);
create index if not exists clinic_audit_ip_time_idx on public.clinic_audit_log(ip_address,created_at desc);
create table if not exists public.clinic_audit_alerts(id bigint generated always as identity primary key,created_at timestamptz not null default clock_timestamp(),event_id bigint references public.clinic_audit_log(id),trigger_type text not null,description text not null);
alter table public.clinic_audit_alerts enable row level security;
revoke all on public.clinic_audit_alerts from public,anon,authenticated;
revoke all on public.clinic_audit_alerts from service_role;
grant select,insert on public.clinic_audit_alerts to service_role;
grant usage,select on sequence public.clinic_audit_alerts_id_seq to service_role;

create or replace function public.audit_clean(value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb; pair record;
begin
 if jsonb_typeof(value)='object' then
  result:='{}';
  for pair in select * from jsonb_each(value) loop
   if pair.key in ('updatedAt','updated_at','createdAt','created_at','lastSyncedAt','syncStamp') then continue; end if;
   if lower(pair.key) ~ '(password|token|secret|otphash)' then continue; end if;
   result:=result||jsonb_build_object(pair.key,public.audit_clean(pair.value));
  end loop;return result;
 elsif jsonb_typeof(value)='array' then
  select coalesce(jsonb_agg(public.audit_clean(v) order by n),'[]') into result from jsonb_array_elements(value) with ordinality a(v,n);return result;
 else return value;end if;
end;$$;
create or replace function public.audit_record_change() returns trigger language plpgsql security invoker set search_path='' as $$
declare b jsonb:='{}';a jsonb:='{}';ctx jsonb:='{}';headers jsonb;old_values jsonb:='{}';new_values jsonb:='{}';k text;verb text;rid text;changed text[]:='{}';pw_changed boolean:=false;
begin
 if TG_OP<>'INSERT' then b:=to_jsonb(old);end if;
 if TG_OP<>'DELETE' then a:=to_jsonb(new);end if;
 rid:=coalesce(a->>'id',b->>'id',a->>'sync_key',b->>'sync_key');
 if b ? 'data' then b:=b->'data';end if;if a ? 'data' then a:=a->'data';end if;
 pw_changed:=TG_OP='UPDATE' and (b->'password' is distinct from a->'password' or b->'password_hash' is distinct from a->'password_hash');
 b:=public.audit_clean(b);a:=public.audit_clean(a);
 if TG_OP='UPDATE' and b=a and not pw_changed then return new;end if;
 for k in select jsonb_object_keys(b||a) loop
  if b->k is distinct from a->k then
   old_values:=old_values||jsonb_build_object(k,b->k);new_values:=new_values||jsonb_build_object(k,a->k);changed:=array_append(changed,k);
  end if;
 end loop;
 if pw_changed then old_values:=old_values||'{"password":"[redacted]"}';new_values:=new_values||'{"password":"[changed; redacted]"}';changed:=array_append(changed,'password');end if;
 headers:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 if headers ? 'x-clinic-audit-context' and (current_user in ('postgres','service_role') or current_setting('request.jwt.claims',true)::jsonb->>'role'='service_role') then ctx:=convert_from(decode(headers->>'x-clinic-audit-context','base64'),'UTF8')::jsonb;end if;
 verb:=case TG_OP when 'INSERT' then 'Created ' when 'DELETE' then 'Deleted ' else 'Updated ' end||TG_ARGV[1];
 if TG_ARGV[1]='Service' and TG_OP='UPDATE' and changed=array['price'] then verb:='Updated Service Price';end if;
 if pw_changed then verb:='Changed Account Password';end if;
 insert into public.clinic_audit_log(created_at,actor_id,actor_email,actor_role,ip_address,user_agent,action,module,resource,before_state,after_state,outcome,request_id,location,details)
 values(clock_timestamp(),coalesce(ctx->>'id',ctx->>'email','system:database'),coalesce(ctx->>'email','system:database'),coalesce(ctx->>'role','system'),coalesce(ctx->>'ip','unavailable'),coalesce(ctx->>'agent','database process'),verb,TG_ARGV[0],coalesce(rid,TG_TABLE_NAME),old_values,new_values,'Success',ctx->>'requestId',ctx->>'location',jsonb_build_object('description',verb||' '||coalesce(rid,TG_TABLE_NAME)||case when array_length(changed,1)>0 then ': '||array_to_string(changed,', ') else '' end,'fields',changed));
 if TG_OP='DELETE' then return old;else return new;end if;
end;$$;
create or replace function public.audit_detect_anomaly() returns trigger language plpgsql security invoker set search_path='' as $$
declare label text;hour_local int;
begin
 if new.ip_address not in ('unavailable','') and (select count(distinct actor_email) from public.clinic_audit_log where ip_address=new.ip_address and created_at>=new.created_at-interval '5 minutes' and actor_role<>'system')>1 then
 insert into public.clinic_audit_alerts(event_id,trigger_type,description) values(new.id,'shared_ip','Multiple distinct accounts used IP '||new.ip_address||' within five minutes.');end if;
 hour_local:=extract(hour from new.created_at at time zone 'Asia/Manila');
 if hour_local<7 or hour_local>=21 then insert into public.clinic_audit_alerts(event_id,trigger_type,description) values(new.id,'outside_hours',new.actor_email||' performed '||new.action||' outside 07:00-21:00 Asia/Manila.');end if;
 if new.actor_role='admin' and coalesce(new.location,'') not in ('','unavailable') and exists(select 1 from public.clinic_audit_log where actor_email=new.actor_email and id<>new.id and location is not null) and not exists(select 1 from public.clinic_audit_log where actor_email=new.actor_email and id<>new.id and location=new.location) then
 insert into public.clinic_audit_alerts(event_id,trigger_type,description) values(new.id,'new_admin_location','Administrator '||new.actor_email||' used a new location: '||new.location);end if;
 if exists(select 1 from public.clinic_audit_log where id<>new.id and actor_email=new.actor_email and action=new.action and resource=new.resource and after_state=new.after_state and request_id is distinct from new.request_id and created_at>new.created_at-interval '30 seconds') then
 insert into public.clinic_audit_alerts(event_id,trigger_type,description) values(new.id,'repeated_action',new.actor_email||' repeated '||new.action||' for '||new.resource||' within 30 seconds.');end if;
 if new.security_event then insert into public.clinic_audit_alerts(event_id,trigger_type,description) values(new.id,'denied_access',coalesce(new.error_reason,'Unauthorized access attempt'));end if;
 return new;
end;$$;
drop trigger if exists clinic_audit_anomaly on public.clinic_audit_log;
create trigger clinic_audit_anomaly after insert on public.clinic_audit_log for each row execute function public.audit_detect_anomaly();
do $$ declare item record;begin
 for item in select * from (values ('clinic_appointments','Appointments','Appointment'),('clinic_archived_appointments','Appointments','Archived Appointment'),('patients','Patients','Patient Record'),('services','Services','Service'),('clinic_patient_clinical_notes','Patients','Tooth Record'),('clinic_treatment_plans','Patients','Treatment Plan'),('clinic_reschedule_requests','Appointments','Reschedule Request'),('users','Users','Account'),('dentists','Users','Dentist'),('dentist_schedules','Settings','Dentist Schedule'),('clinic_additional_fees','Billing','Additional Fee'),('payments','Billing','Payment'),('clinic_site_content','Settings','Website Settings'),('staffs','Users','Staff Account'),('treatment_logs','Patients','Treatment History'),('clinic_history','Patients','Treatment History')) t(tbl,module,label) loop
 if to_regclass('public.'||item.tbl) is not null then
 execute format('drop trigger if exists clinic_record_audit on public.%I',item.tbl);
 execute format('create trigger clinic_record_audit after insert or update or delete on public.%I for each row execute function public.audit_record_change(%L,%L)',item.tbl,item.module,item.label);
 end if;end loop;
end $$;
revoke all on function public.audit_record_change() from public,anon,authenticated;
revoke all on function public.audit_detect_anomaly() from public,anon,authenticated;
