require('../node_modules/dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const { createClient } = require('../node_modules/@supabase/supabase-js');
async function main() {
  if (!process.env.SUPABASE_URL.includes('lnpatfboxmqcictodxgv')) throw Error('Unexpected project');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const id = 'apt-1790924145974-do3j5u', proofId = '0d523b2d-6772-4e41-b4a9-bd95111632ab';
  const { data: row, error } = await db.from('clinic_appointments').select('id,data,updated_at').eq('id', id).single();
  if (error) throw Error(error.message);
  const proof = row.data.paymentProofs.find(p => p.id === proofId);
  if (proof?.status === 'verified') { console.log('Already approved; no extra credit applied.'); return; }
  if (proof?.method !== 'cash' || proof.amount !== 500 || proof.status !== 'pending' || Number(row.data.totalCollected) !== 0) throw Error('Unexpected payment state; no changes made.');
  const updated = require('../Shared/payment-receipts').approve(row.data, proofId, 'clinic:confirmed-approval-restoration');
  updated.paymentProofs.find(p => p.id === proofId).reviewReason = 'Restored the cash approval confirmed by the clinic owner.';
  const result = await db.from('clinic_appointments').update({ data: updated, updated_at: updated.updatedAt }).eq('id', id).eq('updated_at', row.updated_at).select('id').maybeSingle();
  if (result.error || !result.data) throw Error('Concurrent update or save failure; verify before retry.');
  console.log(JSON.stringify({ id, status: 'verified', credited: updated.totalCollected, remaining: updated.remainingBalance }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
