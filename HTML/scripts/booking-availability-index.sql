create index if not exists clinic_appointments_booking_date_idx on public.clinic_appointments ((data->>'date'));
