-- Reserve the maximum duration in each service range. Historical records are
-- interpreted on read; no appointment data is rewritten by this migration.
create or replace function public.booking_duration(a jsonb) returns integer
language plpgsql immutable set search_path = public as $$
declare services jsonb; s jsonb; name text; total integer := 0;
begin
  services := a->'services';
  if jsonb_typeof(services) is distinct from 'array' or services = '[]'::jsonb then
    select jsonb_agg(v) into services from regexp_split_to_table(coalesce(nullif(a->>'service',''), a->>'serviceName', 'Consultation'), '\s*\+\s*') v;
  end if;
  for s in select value from jsonb_array_elements(services) loop
    name := trim(regexp_replace(lower(coalesce(s->>'serviceName', s->>'name', s->>'service', s#>>'{}')), '[^a-z0-9]+', ' ', 'g'));
    total := total + case
      when name = 'consultation' then 20
      when name in ('oral prophylaxis','oral prophylaxis teeth cleaning','teeth cleaning') then 45
      when name in ('tooth extraction','root canal treatment','root canal','complete denture','partial denture casted','flexible denture','crowns and bridges') then 120
      when name = 'odontectomy' then 150
      when name in ('partial denture stayplate','whitening','teeth whitening') then 90
      when name in ('retainers','mouth guard') then 30
      when name in ('periapical x ray','x ray','xray') then 10
      when name = 'panoramic x ray' then 15
      else 60 end;
  end loop;
  return greatest(total, case when a->>'durationMinutes' ~ '^\d+$' then (a->>'durationMinutes')::integer else 0 end);
end $$;

create or replace function public.booking_start(a jsonb) returns timestamp
language plpgsql immutable set search_path = public as $$
declare d text; t text;
begin
  d := coalesce(nullif(a->>'date',''), substring(a->>'schedule' from '^\d{4}-\d{1,2}-\d{1,2}'));
  t := coalesce(nullif(a->>'time',''), nullif(a->>'timeDisplay',''), substring(a->>'schedule' from '\d{1,2}:\d{2}\s*(?:AM|PM)?'));
  return d::date + t::time;
exception when others then return null;
end $$;

create or replace function public.booking_active(a jsonb) returns boolean
language sql immutable set search_path = public as $$
  select lower(coalesce(nullif(a->>'lifecycleStatus',''), nullif(a->>'status',''), 'Pending'))
    in ('pending','approved','ongoing','reschedule requested','reschedule rejected');
$$;

create or replace function public.booking_identity(a jsonb, kind text) returns text[]
language sql immutable set search_path = public as $$
  select array_agg(distinct lower(trim(regexp_replace(v, '^Dr\.?\s+', '', 'i'))))
  from unnest(case when kind = 'dentist' then
    array[a->>'dentistId',a->>'dentistEmail',a->>'dentist',a->>'dentistName'] else
    array[a->>'patientId',a->>'patientEmail',case when coalesce(a->>'patientEmail','') = '' then coalesce(a->>'patientName',a->>'patient') end] end) v
  where coalesce(trim(v),'') <> '';
$$;

create or replace function public.enforce_booking_interval() returns trigger
language plpgsql volatile security invoker set search_path = public as $$
declare starts timestamp; ends timestamp; old_starts timestamp;
begin
  -- Shared transaction lock covers simultaneous API requests from all instances.
  perform pg_advisory_xact_lock(714025610);
  if not public.booking_active(new.data) then return new; end if;
  starts := public.booking_start(new.data);
  ends := starts + make_interval(mins => public.booking_duration(new.data));
  if TG_OP = 'UPDATE' then
    old_starts := public.booking_start(old.data);
    -- Financial/visibility updates must not be blocked by historical conflicts.
    if public.booking_active(old.data) and starts is not distinct from old_starts
      and public.booking_duration(new.data) = public.booking_duration(old.data)
      and public.booking_identity(new.data,'dentist') is not distinct from public.booking_identity(old.data,'dentist')
      and public.booking_identity(new.data,'patient') is not distinct from public.booking_identity(old.data,'patient')
    then return new; end if;
  end if;
  if starts is null then
    raise exception 'A valid appointment date and time are required.' using errcode = '22007';
  end if;
  if exists (
    select 1 from public.clinic_appointments other
    where other.id <> new.id and public.booking_active(other.data)
      and (public.booking_identity(new.data,'dentist') && public.booking_identity(other.data,'dentist')
        or public.booking_identity(new.data,'patient') && public.booking_identity(other.data,'patient'))
      and public.booking_start(other.data) < ends
      and public.booking_start(other.data) + make_interval(mins => public.booking_duration(other.data)) > starts
  ) then
    raise exception 'Appointment overlaps an existing reservation.' using errcode = '23P01';
  end if;
  new.data := new.data || jsonb_build_object('durationMinutes',public.booking_duration(new.data),'endTime',to_char(ends,'HH24:MI'));
  return new;
end $$;

revoke all on function public.enforce_booking_interval() from public, anon, authenticated;
drop trigger if exists enforce_booking_interval on public.clinic_appointments;
create trigger enforce_booking_interval before insert or update on public.clinic_appointments
for each row execute function public.enforce_booking_interval();
