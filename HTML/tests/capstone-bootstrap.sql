create table if not exists public.users (
  id text primary key,
  name text not null,
  email text not null unique,
  password text not null,
  is_verified boolean not null default true,
  sex text default '',
  dob text default '',
  mobile text default '',
  address text default '',
  condition text default '',
  verification_token text,
  profile_image text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users add column if not exists role text default 'patient';

-- Display-only job title. The existing role column still controls access.
alter table public.users add column if not exists profile_title text not null default '';

create table public.patients (id uuid primary key default gen_random_uuid(), name text, contact text, address text, age integer, gender text, archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.dentists (id uuid primary key default gen_random_uuid(), name text, specialty text, contact text, email text, archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.staffs (id uuid primary key default gen_random_uuid(), position text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.dentist_schedules (id uuid primary key default gen_random_uuid(), dentist_id uuid, day_of_week integer check(day_of_week between 0 and 6), start_time time, end_time time, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.services (id uuid primary key default gen_random_uuid(), name text not null, price numeric not null default 0 check(price >= 0), duration text, description text, archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.payments (id uuid primary key default gen_random_uuid(), amount numeric, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.notifications (id uuid primary key default gen_random_uuid(), title text, body text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinic_appointments (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinic_archived_appointments (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinic_reschedule_requests (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinic_patient_clinical_notes (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinic_treatment_plans (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinic_additional_fees (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.clinic_history (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());

create table public.treatment_logs (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.clinic_site_content (
  id text primary key check (id = 'website'),
  draft jsonb not null default '{}'::jsonb,
  published jsonb not null default '{}'::jsonb,
  revision integer not null default 0,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  updated_by text
);
alter table public.clinic_site_content enable row level security;
revoke all on public.clinic_site_content from anon, authenticated;
grant select, insert, update on public.clinic_site_content to service_role;
insert into public.clinic_site_content (id) values ('website') on conflict (id) do nothing;
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

create index users_email_lower_idx on public.users(lower(email));
create index users_verification_token_idx on public.users(verification_token) where verification_token is not null;
create index dentist_schedules_dentist_idx on public.dentist_schedules(dentist_id);

alter table public.users enable row level security;
revoke all on public.users from public, anon, authenticated;
grant select, insert, update, delete on public.users to service_role;

alter table public.patients enable row level security;
revoke all on public.patients from public, anon, authenticated;
grant select, insert, update, delete on public.patients to service_role;

alter table public.dentists enable row level security;
revoke all on public.dentists from public, anon, authenticated;
grant select, insert, update, delete on public.dentists to service_role;

alter table public.staffs enable row level security;
revoke all on public.staffs from public, anon, authenticated;
grant select, insert, update, delete on public.staffs to service_role;

alter table public.dentist_schedules enable row level security;
revoke all on public.dentist_schedules from public, anon, authenticated;
grant select, insert, update, delete on public.dentist_schedules to service_role;

alter table public.services enable row level security;
revoke all on public.services from public, anon, authenticated;
grant select, insert, update, delete on public.services to service_role;

alter table public.payments enable row level security;
revoke all on public.payments from public, anon, authenticated;
grant select, insert, update, delete on public.payments to service_role;

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select, insert, update, delete on public.notifications to service_role;

alter table public.clinic_appointments enable row level security;
revoke all on public.clinic_appointments from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_appointments to service_role;

alter table public.clinic_archived_appointments enable row level security;
revoke all on public.clinic_archived_appointments from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_archived_appointments to service_role;

alter table public.clinic_reschedule_requests enable row level security;
revoke all on public.clinic_reschedule_requests from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_reschedule_requests to service_role;

alter table public.clinic_patient_clinical_notes enable row level security;
revoke all on public.clinic_patient_clinical_notes from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_patient_clinical_notes to service_role;

alter table public.clinic_treatment_plans enable row level security;
revoke all on public.clinic_treatment_plans from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_treatment_plans to service_role;

alter table public.clinic_additional_fees enable row level security;
revoke all on public.clinic_additional_fees from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_additional_fees to service_role;

alter table public.clinic_history enable row level security;
revoke all on public.clinic_history from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_history to service_role;

alter table public.treatment_logs enable row level security;
revoke all on public.treatment_logs from public, anon, authenticated;
grant select, insert, update, delete on public.treatment_logs to service_role;

alter table public.clinic_site_content enable row level security;
revoke all on public.clinic_site_content from public, anon, authenticated;
grant select, insert, update, delete on public.clinic_site_content to service_role;

revoke all on function public.booking_duration(jsonb) from public, anon, authenticated;
grant execute on function public.booking_duration(jsonb) to service_role;

revoke all on function public.booking_start(jsonb) from public, anon, authenticated;
grant execute on function public.booking_start(jsonb) to service_role;

revoke all on function public.booking_active(jsonb) from public, anon, authenticated;
grant execute on function public.booking_active(jsonb) to service_role;

revoke all on function public.booking_identity(jsonb,text) from public, anon, authenticated;
grant execute on function public.booking_identity(jsonb,text) to service_role;

revoke all on function public.enforce_booking_interval() from public, anon, authenticated;
grant execute on function public.enforce_booking_interval() to service_role;
WITH wanted(name,price,duration,description,names) AS (VALUES ('Consultation', 500, '20 min', 'A thorough evaluation of your current oral health, including a visual exam and professional advice on necessary treatments or preventive care.', ARRAY['consultation']),
('Oral Prophylaxis', 1000, '45 min', 'A professional cleaning session to remove stubborn plaque and tartar buildup that regular brushing cannot reach, finished with a high-shine polish.', ARRAY['oral prophylaxis','oral prophylaxis teeth cleaning','teeth cleaning','cleaning']),
('Restorative Treatment', 800, '1 hr', 'Commonly known as a filling, this procedure repairs a decayed or damaged tooth using tooth-colored composite resin to restore its strength and appearance.', ARRAY['restorative treatment','dental fillings']),
('Tooth Extraction', 1000, '2 hrs', 'Safe and gentle removal of a damaged or problematic tooth under local anesthesia to prevent further pain or infection.', ARRAY['tooth extraction','extraction']),
('Odontectomy', 10000, '2.5 hrs', 'A specialized surgical procedure typically used for impacted wisdom teeth that are trapped under the gum line or bone.', ARRAY['odontectomy']),
('Root Canal Treatment', 6000, '2 hrs', 'An advanced procedure designed to save a severely decayed or infected tooth by removing the damaged pulp and sealing the internal canal.', ARRAY['root canal treatment']),
('Complete Denture', 15000, '2 hrs', 'A full-coverage prosthetic solution for patients missing all teeth in an arch, custom-molded for a natural look and comfortable fit.', ARRAY['complete denture']),
('Partial Denture (Stayplate)', 6500, '1.5 hrs', 'An affordable, removable acrylic plate used to replace one or several missing teeth, ideal for temporary or budget-friendly restoration.', ARRAY['partial denture stayplate']),
('Partial Denture (Casted)', 12000, '2 hrs', 'A high-durability partial denture featuring a metal framework for superior strength, stability, and a thinner, more comfortable profile.', ARRAY['partial denture casted']),
('Flexible Denture', 16000, '2 hrs', 'The most comfortable denture option, made from a premium nylon material that adapts to the shape of your gums and lacks visible metal clasps.', ARRAY['flexible denture']),
('Crowns and Bridges', 6000, '2 hrs', 'Fixed prosthetic devices used to cover a damaged tooth (Crown) or bridge the gap created by one or more missing teeth.', ARRAY['crowns and bridges']),
('Orthodontic Treatment', 60000, '1 hr', 'Comprehensive alignment correction using traditional braces. This price typically covers the installation and start of your journey to a perfect smile.', ARRAY['orthodontic treatment','orthodontic treatment braces']),
('Retainers', 6000, '30 min', 'Custom-made appliances worn after orthodontic treatment to prevent teeth from shifting back to their original positions.', ARRAY['retainers']),
('Mouth Guard', 6000, '30 min', 'A custom-fitted protective device for athletes or patients who grind their teeth (bruxism) at night to prevent dental wear and injury.', ARRAY['mouth guard']),
('Whitening', 12000, '1.5 hrs', 'A high-strength professional bleaching treatment that removes deep stains caused by food, coffee, or smoking, brightening your smile by several shades.', ARRAY['whitening','teeth whitening']),
('Periapical X-Ray', 500, '10 min', 'A focused X-ray that shows the entire tooth from the crown to the end of the root, essential for diagnosing infections or root issues.', ARRAY['periapical x ray']),
('Panoramic X-Ray', 1000, '15 min', 'A wide-angle X-ray of the entire jaw, providing a comprehensive view of all teeth, jawbones, and sinuses in a single image.', ARRAY['panoramic x ray']))
INSERT INTO public.services (name,price,duration,description,archived)
SELECT w.name,w.price,w.duration,w.description,false FROM wanted w
WHERE NOT EXISTS (SELECT 1 FROM public.services s
  WHERE trim(regexp_replace(lower(s.name),'[^a-z0-9]+',' ','g')) = ANY(w.names))
RETURNING name;
insert into public.clinic_additional_fees(id,data) values('default-local-anesthesia-fee','{"id":"default-local-anesthesia-fee","name":"Local Anesthesia Fee","description":"Additional anesthesia used to numb the treatment area during a dental procedure.","price":200,"pricingType":"fixed","minPrice":200,"maxPrice":200,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.701Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-medication-fee','{"id":"default-medication-fee","name":"Medication Fee","description":"Medicines provided by the clinic after treatment, when applicable.","price":100,"pricingType":"range","minPrice":100,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-suture-fee','{"id":"default-suture-fee","name":"Suture Fee","description":"Charge for suturing materials used after surgical dental procedures.","price":200,"pricingType":"fixed","minPrice":200,"maxPrice":200,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-temporary-filling-fee','{"id":"default-temporary-filling-fee","name":"Temporary Filling Fee","description":"Temporary filling placed to protect a tooth before the permanent treatment is completed.","price":300,"pricingType":"fixed","minPrice":300,"maxPrice":300,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-dental-impression-fee','{"id":"default-dental-impression-fee","name":"Dental Impression Fee","description":"Impression or mold of the patient''s teeth needed for certain dental appliances or restorations.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-laboratory-fee','{"id":"default-laboratory-fee","name":"Laboratory Fee","description":"Additional laboratory charge for dental work that needs to be fabricated or processed outside the clinic.","price":500,"pricingType":"from","minPrice":500,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-denture-adjustment-fee','{"id":"default-denture-adjustment-fee","name":"Denture Adjustment Fee","description":"Adjustment of an existing denture to improve its fit and comfort.","price":200,"pricingType":"range","minPrice":200,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-orthodontic-bracket-replacement-fee','{"id":"default-orthodontic-bracket-replacement-fee","name":"Orthodontic Bracket Replacement Fee","description":"Replacement of a damaged or detached orthodontic bracket.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-orthodontic-wire-replacement-fee','{"id":"default-orthodontic-wire-replacement-fee","name":"Orthodontic Wire Replacement Fee","description":"Replacement of a damaged or lost orthodontic archwire.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-lost-damaged-appliance-fee','{"id":"default-lost-damaged-appliance-fee","name":"Lost/Damaged Appliance Fee","description":"Charge for replacement or repair of a lost or damaged removable dental appliance.","price":0,"pricingType":"variable","minPrice":0,"maxPrice":0,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

insert into public.clinic_additional_fees(id,data) values('default-emergency-same-day-fee','{"id":"default-emergency-same-day-fee","name":"Emergency/Same-Day Fee","description":"Additional charge for an unscheduled dental case requiring urgent attention.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-10-03T08:44:23.702Z","updatedAt":"2026-10-03T08:44:23.702Z"}'::jsonb) on conflict(id) do nothing;

notify pgrst, 'reload schema';
