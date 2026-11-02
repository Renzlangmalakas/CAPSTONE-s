// Reconstruct the current app schema and default catalogs, not historical data.
const fs = require('node:fs');
const path = require('node:path');
const dir = path.join(__dirname, '../Landing/supabase/migrations');
const read = name => fs.readFileSync(path.join(dir, name), 'utf8');
let sql = read('20260414154621_create_users_tables.sql').split('create table if not exists public.patients')[0];
sql += read('20260930170008_account_profile_title.sql');
const raw = {
  patients: "name text, contact text, address text, age integer, gender text, archived boolean not null default false",
  dentists: "name text, specialty text, contact text, email text, archived boolean not null default false",
  staffs: "position text",
  dentist_schedules: "dentist_id uuid, day_of_week integer check(day_of_week between 0 and 6), start_time time, end_time time, is_active boolean not null default true",
  services: "name text not null, price numeric not null default 0 check(price >= 0), duration text, description text, archived boolean not null default false",
  payments: "amount numeric",
  notifications: "title text, body text"
};
for (const [table, columns] of Object.entries(raw)) sql += `
create table public.${table} (id uuid primary key default gen_random_uuid(), ${columns}, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
`;
const jsonTables = ['clinic_appointments','clinic_archived_appointments','clinic_reschedule_requests','clinic_patient_clinical_notes','clinic_treatment_plans','clinic_additional_fees','clinic_history','treatment_logs'];
for (const table of jsonTables) sql += `
create table public.${table} (id text primary key, data jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
`;
sql += read('20260923000000_create_site_content.sql');
sql += read('20261001033952_appointment_duration_reservations.sql');
sql += `
create index users_email_lower_idx on public.users(lower(email));
create index users_verification_token_idx on public.users(verification_token) where verification_token is not null;
create index dentist_schedules_dentist_idx on public.dentist_schedules(dentist_id);
`;
for (const table of ['users', ...Object.keys(raw), ...jsonTables, 'clinic_site_content']) sql += `
alter table public.${table} enable row level security;
revoke all on public.${table} from public, anon, authenticated;
grant select, insert, update, delete on public.${table} to service_role;
`;
for (const signature of ['booking_duration(jsonb)','booking_start(jsonb)','booking_active(jsonb)','booking_identity(jsonb,text)','enforce_booking_interval()']) sql += `
revoke all on function public.${signature} from public, anon, authenticated;
grant execute on function public.${signature} to service_role;
`;
sql += require('./import-service-catalog.cjs').sql();
const quote = value => "'" + value.replace(/'/g, "''") + "'";
for (const fee of require('./import-fee-catalog.cjs').catalog()) sql += `
insert into public.clinic_additional_fees(id,data) values(${quote(fee.id)},${quote(JSON.stringify(fee))}::jsonb) on conflict(id) do nothing;
`;
sql += "\nnotify pgrst, 'reload schema';\n";
if (require.main === module) process.stdout.write(sql);
module.exports = sql;
