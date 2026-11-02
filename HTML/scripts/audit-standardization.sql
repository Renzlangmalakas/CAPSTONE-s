-- Preserve original evidence; the clean feed hides only proven no-ops and exact repeats.
alter table public.clinic_audit_log add column if not exists original_event jsonb;
alter table public.clinic_audit_log add column if not exists suppressed_reason text;
alter table public.clinic_audit_log add column if not exists event_fingerprint text;
create index if not exists clinic_audit_fingerprint_time_idx on public.clinic_audit_log(event_fingerprint,created_at desc);
create or replace function public.audit_specific_event(e jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare
 a text:=coalesce(e->>'action',''); role_name text:=lower(coalesce(e->>'actor_role','system')); result text;
 b jsonb:=coalesce(e->'before_state','{}'); n jsonb:=coalesce(e->'after_state','{}');
 d jsonb:=coalesce(e->'details','{}'); t jsonb; fields text; person text; service text; schedule text; tooth text; account_name text; outcome text; reason text;
begin
 t:=b||n||jsonb_strip_nulls(coalesce(d->'target','{}'));
 person:=coalesce(nullif(t->>'patientName',''),nullif(t->>'patient',''),nullif(t->>'name',''),nullif(d->>'patientName',''), 'record '||coalesce(e->>'resource','unidentified'));
 account_name:=coalesce(nullif(t->>'name',''),nullif(t->>'email',''),e->>'resource','unidentified account');
 service:=coalesce(nullif(t->>'service',''),nullif(t->>'treatment',''),nullif(t->>'serviceName',''),'procedure not recorded');
 schedule:=concat_ws(' ',t->>'date',t->>'time'); tooth:=coalesce(nullif(t->>'tooth',''),'not specified');
 select string_agg(key,', ' order by key) into fields from jsonb_object_keys(b||n) key;
 fields:=coalesce(fields,(select string_agg(value,', ') from jsonb_array_elements_text(coalesce(d->'fields','[]'))),'details');
 outcome:=case lower(coalesce(e->>'outcome','')) when 'success' then 'Success' when 'failed' then 'Failed' when 'denied' then 'Denied' else case when coalesce(d->>'httpStatus','') ~ '^\d+$' then case when (d->>'httpStatus')::int in (401,403) then 'Denied' when (d->>'httpStatus')::int>=400 then 'Failed' when (d->>'httpStatus')::int between 200 and 299 then 'Success' else 'Logged' end else 'Logged' end end;
 if outcome='Success' and (a='clinic.sync' and d->>'description' like '%no appointment or service changes%' or a like 'Updated %' and b=n and b<>'{}') then reason:='No actual data change'; end if;
 if a='clinic.sync' and outcome='Success' and b=n and fields='details' then reason:='Legacy sync contains no evidence of a data change'; end if;
 result:=case
 when a like 'Merged patient accounts:%' then a
 when a='Account history merged — old account archived' then 'Merged patient accounts: '||coalesce(d->>'sourceEmail',d->>'oldEmail','old account')||' — '||coalesce(d->>'destinationEmail',d->>'newEmail','new account')
 when a in ('Changed Account Password','Reset Account Password') then case when role_name='admin' then 'Reset user password: '||account_name else 'Changed password' end
 when a in ('Created User Account','Created Account','Created Staff Account','Created Dentist','account.created') then case when role_name='patient' then 'Created account: '||account_name else 'Created user account: '||account_name||' ('||coalesce(t->>'role','role not recorded')||')' end
 when a in ('Updated User Account','Updated Account','Updated Profile','Updated Staff Account','Updated Dentist') then case when n->>'archived'='true' then 'Archived/deactivated user: '||account_name when role_name='patient' then 'Updated own profile: '||fields else 'Updated user account: '||account_name||' — changed '||fields end
 when a in ('Created Service','service.created') then 'Created new service: '||coalesce(t->>'name',d->>'name',e->>'resource')
 when a in ('Deleted Service') then 'Deleted service: '||coalesce(t->>'name',e->>'resource')
 when a in ('Updated Service','Updated Service Price','service.updated') then 'Updated service: '||coalesce(t->>'name',d->>'name',e->>'resource')||case when n ? 'price' or d->'fields' ? 'price' then ' — price changed' else ' — changed '||fields end
 when a in ('Updated Dentist Schedule','Created Dentist Schedule','Deleted Dentist Schedule') then case when role_name='system' then 'Updated dentist schedule (cron/sync)' when role_name='dentist' then 'Updated own schedule / availability' else 'Updated clinic settings / schedule' end
 when a in ('Updated Clinic Settings','Updated Website Content','Created Website Content','Updated Website Settings','Created Website Settings') then 'Updated clinic settings / schedule'
 when a in ('Created Patient','Created Patient Record') then case when t->>'walkIn'='true' then 'Added walk-in patient: ' else 'Created patient record: ' end||person
 when a in ('Updated Patient','Updated Patient Record') then case when role_name='staff' and (n ? 'contact' or n ? 'mobile' or n ? 'address') then 'Updated patient contact info: '||person when role_name='patient' then 'Updated own profile: '||fields else 'Updated patient record: '||person||' — '||fields end
 when a in ('Created Tooth Record','Created Clinical Note','Created Treatment History','Created Treatment Record') then 'Recorded treatment: '||person||' — '||service||', Tooth #'||tooth
 when a in ('Updated Tooth Record','Updated Clinical Note','Updated Treatment History','Updated Treatment Record') then 'Updated odontogram: '||person||' — Tooth #'||tooth
 when a in ('Created Appointment','appointment.created','POST /api/appointments/book') then case when role_name='patient' then 'Booked appointment: '||service||' — '||schedule when t->>'walkIn'='true' then 'Added walk-in patient: '||person else 'Scheduled appointment: '||person||' — '||service||' — '||schedule end
 when a in ('Updated Appointment','appointment.updated') then case
 when n ? 'reminderEmailsSent' then 'Auto-sent appointment reminder: '||person||' — '||coalesce(t->>'date','date not recorded')
 when lower(coalesce(n->>'status',n->>'lifecycleStatus',d->>'status',''))='completed' then 'Marked appointment complete: '||person||' — '||service
 when lower(coalesce(n->>'status',n->>'lifecycleStatus',d->>'status',''))='cancelled' then case role_name when 'patient' then 'Cancelled own appointment' when 'dentist' then 'Marked appointment cancelled: '||person else 'Cancelled appointment: '||person||case when t ? 'cancellationReason' then ' — '||(t->>'cancellationReason') else '' end end
 when n ? 'arrivedAt' then 'Checked patient in: '||person
 when n ? 'date' or n ? 'time' or n ? 'rescheduleHistory' then case when role_name='patient' then 'Rescheduled own appointment → '||schedule else 'Rescheduled appointment: '||person||' — '||schedule end
 when n ? 'paid' or n ? 'totalCollected' or n ? 'paymentStatus' then case when role_name='staff' then 'Collected payment: '||person||' — '||coalesce(t->>'totalCollected',t->>'paid','amount not recorded')||' — '||coalesce(t->>'paymentMethod','method not recorded') else 'Modified payment/billing record: '||person||' — '||coalesce(t->>'totalCollected',t->>'paid','amount not recorded') end
 else 'Updated appointment: '||person||' — changed '||fields end
 when a in ('Created Payment','Updated Payment','billing.bulk_mark_paid') then case when role_name='staff' then 'Collected payment: '||person||' — '||coalesce(t->>'amount',t->>'amountPaid','amount not recorded')||' — '||coalesce(t->>'method','method not recorded') else 'Modified payment/billing record: '||person||' — '||coalesce(t->>'amount',t->>'amountPaid','amount not recorded') end
 when a='clinic.sync' then case when outcome in ('Failed','Denied') then 'Attempted clinic record update: '||coalesce(e->>'resource','legacy request') else 'Legacy record update: '||fields end
 when a='Created Reschedule Request' then 'Rescheduled own appointment → '||coalesce(t->>'newDate',t->>'date','date not recorded')||' '||coalesce(t->>'newTime',t->>'time','')
 when a='Created Notification' then 'Sent notification: '||coalesce(t->>'recipient',t->>'user_id','recipient not recorded')
 when a='account.login' then 'Signed In'
 when a='Viewed Patient Record' or a='Viewed Tooth Record' then case when role_name='patient' then 'Viewed own treatment records' else 'Viewed patient medical history: '||person end
 else a end;
 if result is null or result='' then result:='Recorded event: '||coalesce(e->>'module','legacy audit')||' — '||coalesce(e->>'resource','target not recorded'); end if;
 return e||jsonb_build_object('action',result,'outcome',outcome,'actor_email',case when role_name in ('system','maintenance') or e->>'actor_email' like 'system:%' then 'System' else e->>'actor_email' end,'actor_role',case when role_name='maintenance' then 'system' else role_name end,'suppressed_reason',reason);
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
 values(clock_timestamp(),coalesce(ctx->>'id',ctx->>'email','System'),coalesce(ctx->>'email','System'),coalesce(ctx->>'role','system'),coalesce(ctx->>'ip','unavailable'),coalesce(ctx->>'agent','database process'),verb,TG_ARGV[0],coalesce(rid,TG_TABLE_NAME),old_values,new_values,'Success',ctx->>'requestId',ctx->>'location',jsonb_build_object('description',verb||' '||coalesce(rid,TG_TABLE_NAME)||case when array_length(changed,1)>0 then ': '||array_to_string(changed,', ') else '' end,'fields',changed,'target',jsonb_build_object('name',coalesce(a->>'name',b->>'name'),'email',coalesce(a->>'email',b->>'email'),'patientName',coalesce(a->>'patientName',a->>'patient',b->>'patientName',b->>'patient'),'service',coalesce(a->>'service',b->>'service'),'treatment',coalesce(a->>'treatment',b->>'treatment'),'tooth',coalesce(a->>'tooth',b->>'tooth'),'role',coalesce(a->>'role',b->>'role'),'date',coalesce(a->>'date',b->>'date'),'time',coalesce(a->>'time',b->>'time'),'walkIn',coalesce(a->>'walkIn',b->>'walkIn'),'paymentMethod',coalesce(a->>'paymentMethod',b->>'paymentMethod'))));
 if TG_OP='DELETE' then return old;else return new;end if;
end;$$;

-- Original rows remain available for accountability; only the feed is cleaned.
update public.clinic_audit_log set original_event=to_jsonb(clinic_audit_log)-'original_event' where original_event is null;
update public.clinic_audit_log l set action=x.e->>'action',outcome=x.e->>'outcome',actor_email=x.e->>'actor_email',actor_role=x.e->>'actor_role',suppressed_reason=x.e->>'suppressed_reason'
from (select id,public.audit_specific_event(to_jsonb(a)) e from public.clinic_audit_log a) x where l.id=x.id;
update public.clinic_audit_log set event_fingerprint=md5(jsonb_build_array(actor_id,actor_email,actor_role,action,resource,outcome,before_state,after_state,error_reason)::text);
with ranked as (select id,created_at,lag(created_at) over(partition by event_fingerprint order by created_at,id) previous_time from public.clinic_audit_log where suppressed_reason is null)
update public.clinic_audit_log l set suppressed_reason='Exact repeated event within 10 seconds' from ranked r where r.id=l.id and r.created_at-r.previous_time<=interval '10 seconds';
create or replace function public.audit_standardize_insert() returns trigger language plpgsql security invoker set search_path='' as $$
declare e jsonb;
begin
 e:=public.audit_specific_event(to_jsonb(new));
 if e->>'suppressed_reason' is not null then return null; end if;
 new.action:=e->>'action';new.outcome:=e->>'outcome';new.actor_email:=e->>'actor_email';new.actor_role:=e->>'actor_role';
 new.event_fingerprint:=md5(jsonb_build_array(new.actor_id,new.actor_email,new.actor_role,new.action,new.resource,new.outcome,new.before_state,new.after_state,new.error_reason)::text);
 perform pg_advisory_xact_lock(hashtextextended(new.event_fingerprint,0));
 if exists(select 1 from public.clinic_audit_log where event_fingerprint=new.event_fingerprint and suppressed_reason is null and created_at between new.created_at-interval '10 seconds' and new.created_at) then return null; end if;
 return new;
end;$$;
drop trigger if exists clinic_audit_standardize on public.clinic_audit_log;
create trigger clinic_audit_standardize before insert on public.clinic_audit_log for each row execute function public.audit_standardize_insert();
create or replace view public.clinic_audit_feed with (security_invoker=true) as select id,created_at,actor_email,actor_role,action,resource,outcome,details,actor_id,ip_address,user_agent,module,before_state,after_state,error_reason,security_event,request_id,location from public.clinic_audit_log where suppressed_reason is null;
revoke all on public.clinic_audit_feed from public,anon,authenticated;
grant select on public.clinic_audit_feed to service_role;
revoke all on function public.audit_specific_event(jsonb),public.audit_standardize_insert() from public,anon,authenticated;
grant execute on function public.audit_specific_event(jsonb),public.audit_standardize_insert() to service_role;
