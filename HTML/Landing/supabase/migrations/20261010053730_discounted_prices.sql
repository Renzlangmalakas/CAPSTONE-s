create table public.discounted_prices (
 appointment_id text primary key,
 patient_name text not null default '',
 service text not null default '',
 appointment_date text,
 status text,
 service_total numeric(14,2) not null,
 additional_fees numeric(14,2) not null,
 original_price numeric(14,2) not null,
 discount_amount numeric(14,2) not null check (discount_amount > 0),
 discounted_price numeric(14,2) not null check (discounted_price >= 0),
 dentist_id text,
 dentist_name text,
 reason text,
 discount_recorded_at text,
 updated_at timestamptz not null default now()
);
create index discounted_prices_date_idx on public.discounted_prices(appointment_date desc);
alter table public.discounted_prices enable row level security;
revoke all on public.discounted_prices from public, anon, authenticated;
grant select, insert, update, delete on public.discounted_prices to service_role;

-- Appointment records remain authoritative. Prefer the active record when a
-- legacy copy exists in both active and archived collections.
create function public.refresh_discounted_price(target_id text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
 record_data jsonb;
 discount_value numeric;
 fee_value numeric;
 service_value numeric;
begin
 select data into record_data from public.clinic_appointments where id = target_id;
 if not found then
   select data into record_data from public.clinic_archived_appointments where id = target_id;
 end if;
 discount_value := coalesce((record_data->'discount'->>'amount')::numeric, 0);
 if discount_value <= 0 then
   delete from public.discounted_prices where appointment_id = target_id;
   return;
 end if;
 fee_value := coalesce((record_data->>'additionalFeesTotal')::numeric,
   (select sum(coalesce((f->>'quantity')::numeric,1) * coalesce((f->>'unitPrice')::numeric,0))
    from jsonb_array_elements(case when jsonb_typeof(record_data->'additionalFees') = 'array'
      then record_data->'additionalFees' else '[]'::jsonb end) f), 0);
 service_value := coalesce((record_data->>'serviceTotal')::numeric,
   coalesce((record_data->>'grandTotal')::numeric, (record_data->>'total')::numeric,
   (record_data->>'price')::numeric, 0) + discount_value - fee_value);
 insert into public.discounted_prices (
   appointment_id, patient_name, service, appointment_date, status,
   service_total, additional_fees, original_price, discount_amount, discounted_price,
   dentist_id, dentist_name, reason, discount_recorded_at, updated_at
 ) values (
   target_id, coalesce(record_data->>'patient',record_data->>'patientName',''),
   coalesce(record_data->>'service',''), record_data->>'date', record_data->>'status',
   service_value, fee_value, service_value + fee_value, discount_value,
   greatest(0, service_value + fee_value - discount_value),
   record_data->'discount'->>'dentistId', record_data->'discount'->>'dentistName',
   record_data->'discount'->>'reason', record_data->'discount'->>'recordedAt', now()
 ) on conflict (appointment_id) do update set
   patient_name=excluded.patient_name, service=excluded.service,
   appointment_date=excluded.appointment_date, status=excluded.status,
   service_total=excluded.service_total, additional_fees=excluded.additional_fees,
   original_price=excluded.original_price, discount_amount=excluded.discount_amount,
   discounted_price=excluded.discounted_price, dentist_id=excluded.dentist_id,
   dentist_name=excluded.dentist_name, reason=excluded.reason,
   discount_recorded_at=excluded.discount_recorded_at, updated_at=excluded.updated_at;
end;
$$;
create function public.sync_discounted_price_trigger()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
 if tg_op = 'DELETE' then
   perform public.refresh_discounted_price(old.id);
 else
   if tg_op = 'UPDATE' and old.id is distinct from new.id then
     perform public.refresh_discounted_price(old.id);
   end if;
   perform public.refresh_discounted_price(new.id);
 end if;
 return null;
end;
$$;
revoke all on function public.refresh_discounted_price(text) from public, anon, authenticated;
revoke all on function public.sync_discounted_price_trigger() from public, anon, authenticated;
grant execute on function public.refresh_discounted_price(text) to service_role;
grant execute on function public.sync_discounted_price_trigger() to service_role;
create trigger sync_discounted_prices after insert or update or delete on public.clinic_appointments
for each row execute function public.sync_discounted_price_trigger();
create trigger sync_archived_discounted_prices after insert or update or delete on public.clinic_archived_appointments
for each row execute function public.sync_discounted_price_trigger();
select public.refresh_discounted_price(id) from (
 select id from public.clinic_appointments
 union select id from public.clinic_archived_appointments
) records;
notify pgrst, 'reload schema';
