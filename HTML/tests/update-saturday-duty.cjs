require('../node_modules/dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { createClient } = require('../node_modules/@supabase/supabase-js');
async function main() {
  if (!process.env.SUPABASE_URL.includes('lnpatfboxmqcictodxgv')) throw Error('Unexpected project');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: dentists, error } = await db.from('dentists').select('id,name,email,archived').in('email', ['imelda.mappala@gmdental.com', 'sofia.ramirez@gmdental.com']).order('id');
  if (error) throw Error(error.code);
  for (const email of ['imelda.mappala@gmdental.com', 'sofia.ramirez@gmdental.com']) {
    const dentist = dentists.find(d => d.email === email && !d.archived);
    if (!dentist) throw Error('Dentist not found: ' + email);
    if (email.startsWith('imelda')) {
      const result = await db.from('dentists').update({ specialty: 'All Services', updated_at: new Date().toISOString() }).in('id', dentists.filter(d => d.email === email).map(d => d.id));
      if (result.error) throw Error(result.error.code);
    }
    const { data: existing, error: readError } = await db.from('dentist_schedules').select('id').eq('dentist_id', dentist.id).eq('day_of_week', 6);
    if (readError) throw Error(readError.code);
    const values = { start_time: '09:00', end_time: '17:00', is_active: true, updated_at: new Date().toISOString() };
    const result = existing.length
      ? await db.from('dentist_schedules').update(values).in('id', existing.map(r => r.id))
      : await db.from('dentist_schedules').insert({ ...values, dentist_id: dentist.id, day_of_week: 6 });
    if (result.error) throw Error(result.error.code);
    const { data: verified, error: verifyError } = await db.from('dentist_schedules').select('day_of_week,start_time,end_time,is_active').eq('dentist_id', dentist.id).eq('day_of_week', 6);
    if (verifyError || !verified.some(r => r.start_time === '09:00:00' && r.end_time === '17:00:00' && r.is_active)) throw Error('Schedule verification failed');
    console.log(JSON.stringify({ dentist: dentist.name, saturday: verified }));
  }
  const { data: imelda } = await db.from('dentists').select('specialty').eq('email', 'imelda.mappala@gmdental.com');
  if (!imelda?.length || !imelda.every(d => d.specialty === 'All Services')) throw Error('Specialty verification failed');
  console.log('Imelda all-services capability verified.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
