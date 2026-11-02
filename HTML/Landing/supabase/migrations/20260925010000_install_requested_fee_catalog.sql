-- Run in the SQL Editor for project lnpatfboxmqcictodxgv.
-- Creates the storage already expected by the existing Additional Fees screens.
-- Preserves other tables, existing fee IDs and historical bill snapshots.
begin;
create table if not exists public.clinic_additional_fees (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.clinic_additional_fees enable row level security;
revoke all on public.clinic_additional_fees from anon, authenticated;
grant select, insert, update, delete on public.clinic_additional_fees to service_role;
lock table public.clinic_additional_fees in share row exclusive mode;
do $catalog$
declare fee jsonb; existing_id text; existing_data jsonb; alias_name text;
begin
  for fee in select value from jsonb_array_elements('[{"id":"default-local-anesthesia-fee","name":"Local Anesthesia Fee","description":"Additional anesthesia used to numb the treatment area during a dental procedure.","price":200,"pricingType":"fixed","minPrice":200,"maxPrice":200,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.331Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-medication-fee","name":"Medication Fee","description":"Medicines provided by the clinic after treatment, when applicable.","price":100,"pricingType":"range","minPrice":100,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-suture-fee","name":"Suture Fee","description":"Charge for suturing materials used after surgical dental procedures.","price":200,"pricingType":"fixed","minPrice":200,"maxPrice":200,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-temporary-filling-fee","name":"Temporary Filling Fee","description":"Temporary filling placed to protect a tooth before the permanent treatment is completed.","price":300,"pricingType":"fixed","minPrice":300,"maxPrice":300,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-dental-impression-fee","name":"Dental Impression Fee","description":"Impression or mold of the patient''s teeth needed for certain dental appliances or restorations.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-laboratory-fee","name":"Laboratory Fee","description":"Additional laboratory charge for dental work that needs to be fabricated or processed outside the clinic.","price":500,"pricingType":"from","minPrice":500,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-denture-adjustment-fee","name":"Denture Adjustment Fee","description":"Adjustment of an existing denture to improve its fit and comfort.","price":200,"pricingType":"range","minPrice":200,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-orthodontic-bracket-replacement-fee","name":"Orthodontic Bracket Replacement Fee","description":"Replacement of a damaged or detached orthodontic bracket.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-orthodontic-wire-replacement-fee","name":"Orthodontic Wire Replacement Fee","description":"Replacement of a damaged or lost orthodontic archwire.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-lost-damaged-appliance-fee","name":"Lost/Damaged Appliance Fee","description":"Charge for replacement or repair of a lost or damaged removable dental appliance.","price":0,"pricingType":"variable","minPrice":0,"maxPrice":0,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"},{"id":"default-emergency-same-day-fee","name":"Emergency/Same-Day Fee","description":"Additional charge for an unscheduled dental case requiring urgent attention.","price":300,"pricingType":"range","minPrice":300,"maxPrice":500,"archived":false,"active":true,"createdAt":"2026-09-25T02:21:06.332Z","updatedAt":"2026-09-25T02:21:06.332Z"}]'::jsonb) loop
    alias_name := case fee->>'name'
      when 'Local Anesthesia Fee' then 'Anesthesia Fee'
      when 'Temporary Filling Fee' then 'Temporary Restoration Fee'
      when 'Dental Impression Fee' then 'Impression Fee'
      when 'Emergency/Same-Day Fee' then 'Emergency Fee'
      else fee->>'name' end;
    select id, data into existing_id, existing_data
    from public.clinic_additional_fees
    where lower(regexp_replace(trim(data->>'name'), '\s+', ' ', 'g')) in (lower(fee->>'name'), lower(alias_name))
       or id = fee->>'id'
    order by (lower(trim(data->>'name')) = lower(fee->>'name')) desc nulls last, created_at, id
    limit 1;
    if existing_id is null then
      insert into public.clinic_additional_fees(id,data)
      values (fee->>'id', fee || jsonb_build_object('createdAt',now(),'updatedAt',now()));
    else
      update public.clinic_additional_fees
      set data = existing_data || fee || jsonb_build_object('id',existing_id,'createdAt',coalesce(existing_data->'createdAt',to_jsonb(now())),'updatedAt',now()),
          updated_at = now()
      where id = existing_id;
    end if;
  end loop;
end;
$catalog$;
notify pgrst, 'reload schema';
commit;
select data->>'name' as fee_name, data->>'pricingType' as pricing_type,
       data->>'price' as starting_price, data->>'maxPrice' as maximum_price
from public.clinic_additional_fees order by fee_name;
