require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { createClient } = require('@supabase/supabase-js');
const { defaults, key } = require('../Shared/service-catalog');
(async () => {
  if (new URL(process.env.SUPABASE_URL).hostname !== 'lnpatfboxmqcictodxgv.supabase.co') throw new Error('Unexpected project');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
    global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(30000) }) }
  });
  const { data, error } = await db.from('services').select('id,name,price,archived');
  if (error) throw error;
  const existing = new Set(data.map(row => key(row.name)));
  const missing = defaults.filter(row => !existing.has(key(row.name))).map(row => ({
    name: row.name, price: row.price, description: row.description, duration: row.displayDuration, archived: false
  }));
  console.log('Missing services:', missing.map(row => row.name));
  if (process.argv.includes('--apply') && missing.length) {
    const { error: insertError } = await db.from('services').insert(missing);
    if (insertError) throw insertError;
  }
  const { data: saved, error: readError } = await db.from('services').select('id,name,price,archived');
  if (readError) throw readError;
  console.log(JSON.stringify({ rows: saved.length, covered: defaults.filter(row => saved.some(s => key(s.name) === key(row.name))).length,
    preservedExisting: data.every(row => saved.some(s => s.id === row.id && s.price === row.price && s.archived === row.archived)) }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
