create table if not exists public.additional_fees (
  id uuid primary key default gen_random_uuid(), fee_name text not null, description text not null default '',
  price numeric(12,2) not null check (price >= 0), min_price numeric(12,2) not null default 0 check (min_price >= 0),
  max_price numeric(12,2) not null default 0 check (max_price >= min_price),
  status text not null default 'Active' check (status in ('Active', 'Inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists additional_fees_fee_name_key on public.additional_fees (lower(fee_name));
create table if not exists public.invoice_additional_fees (
  id uuid primary key default gen_random_uuid(), invoice_id text not null, additional_fee_id uuid not null references public.additional_fees(id),
  fee_name text not null, quantity integer not null check (quantity >= 1), unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) generated always as (quantity * unit_price) stored, created_at timestamptz not null default now()
);
create index if not exists invoice_additional_fees_invoice_idx on public.invoice_additional_fees (invoice_id);
create table if not exists public.clinic_additional_fees (
  id text primary key, data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.additional_fees (fee_name, description, price, min_price, max_price) values
('Anesthesia Fee', 'Local or general anesthesia used during treatment.', 200, 200, 200),
('Dental Materials Fee', 'Additional dental materials used during treatment.', 100, 100, 500),
('Laboratory Fee', 'External laboratory processing and fabrication.', 500, 500, 3000),
('Medication Fee', 'Medication dispensed or prescribed by the clinic.', 100, 100, 500),
('Temporary Restoration Fee', 'Temporary restoration placed before final treatment.', 300, 300, 300),
('Suture Fee', 'Sutures placed as part of a procedure.', 200, 200, 200),
('Suture Removal Fee', 'Removal of previously placed sutures.', 150, 150, 150),
('Impression Fee', 'Dental impression taking and processing.', 500, 500, 500),
('Bite Registration Fee', 'Bite registration for restorative or prosthetic work.', 300, 300, 300),
('Denture Adjustment Fee', 'Adjustment of an existing denture.', 200, 200, 200),
('Appliance Adjustment Fee', 'Adjustment of an existing dental appliance.', 200, 200, 200),
('Emergency Fee', 'Urgent, unscheduled dental visit.', 500, 500, 500),
('Follow-up Visit Fee', 'Follow-up evaluation after treatment.', 200, 200, 200),
('Additional Chairside Procedure Fee', 'Additional procedure performed chairside.', 300, 300, 300),
('Special Material Fee', 'Special or custom material required for treatment.', 300, 300, 1000)
on conflict do nothing;