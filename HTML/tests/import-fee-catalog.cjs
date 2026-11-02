// Maintenance command (excluded from deployment):
// node tests/import-fee-catalog.cjs --apply
// Without --apply, reports only the proposed insert/update counts.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const aliases = {
  'Local Anesthesia Fee': 'Anesthesia Fee',
  'Temporary Filling Fee': 'Temporary Restoration Fee',
  'Dental Impression Fee': 'Impression Fee',
  'Emergency/Same-Day Fee': 'Emergency Fee'
};
function catalog() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../Shared/additional-fees.js'), 'utf8'), context);
  return JSON.parse(JSON.stringify(context.window.GMAdditionalFees.defaultCatalog()));
}
function plan(existing) {
  const key = value => String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  return catalog().map(fee => {
    const found = existing.find(row => key(row.data?.name) === key(fee.name))
      || existing.find(row => aliases[fee.name] && key(row.data?.name) === key(aliases[fee.name]));
    const id = found?.id || fee.id;
    return { id, data: { ...fee, id, createdAt: found?.data?.createdAt || fee.createdAt }, updated_at: fee.updatedAt };
  });
}
async function main() {
  require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
  const { createClient } = require('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from('clinic_additional_fees').select('id,data');
  if (error) throw new Error('Fee catalog read failed: ' + error.code);
  const rows = plan(data || []);
  const updates = rows.filter(row => data.some(old => old.id === row.id)).length;
  if (!process.argv.includes('--apply')) { console.log(JSON.stringify({ insert: rows.length - updates, update: updates, deletes: 0 })); return; }
  const saved = await db.from('clinic_additional_fees').upsert(rows, { onConflict: 'id' }).select('id');
  if (saved.error) throw new Error('Fee catalog import failed: ' + saved.error.code);
  console.log(JSON.stringify({ saved: saved.data.length, inserted: rows.length - updates, updated: updates, deleted: 0 }));
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { plan, catalog };
