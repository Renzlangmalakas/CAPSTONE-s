const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../Shared/shared-supabase-sync'), 'utf8');
function implementation(name) {
  const start = source.indexOf(`  async function ${name}(`);
  return source.slice(start, source.indexOf('\n  }', start) + 4);
}
test('polling skips hidden tabs and coalesces overlapping reads', async () => {
  let reads = 0, finish;
  const context = { pullInFlight: false, nextPullAt: 0, document: { visibilityState: 'hidden' },
    sessionToken: () => 'session', performPull: () => { reads++; return new Promise(resolve => { finish = resolve; }); } };
  vm.runInNewContext(implementation('pullClinicDb'), context);
  await context.pullClinicDb();
  assert.equal(reads, 0);
  context.document.visibilityState = 'visible';
  const first = context.pullClinicDb();
  await context.pullClinicDb();
  assert.equal(reads, 1);
  finish(); await first;
  assert.equal(context.pullInFlight, false);
  context.nextPullAt = Date.now() + 60000;
  await context.pullClinicDb();
  assert.equal(reads, 1);
});
test('failed reads back off instead of hammering an unavailable database', async () => {
  const context = { pullFailures: 0, nextPullAt: 0, hasUnpushedChanges: () => false,
    getLocalChangeStamp: () => 0, apiUrl: x => x, console: { warn() {} },
    window: { GmDentalApiFetch: async () => ({ ok: false, status: 503 }) } };
  vm.runInNewContext(implementation('performPull'), context);
  await context.performPull();
  assert.equal(context.pullFailures, 1);
  assert.ok(context.nextPullAt >= Date.now() + 59000);
  await context.performPull();
  assert.ok(context.nextPullAt >= Date.now() + 119000);
});
test('flushing a clean snapshot makes no write request', async () => {
  const context = { localStorage: { getItem: () => null }, CONFLICT_PAUSE_KEY: 'pause', isApplyingRemote: false, conflictPaused: false, hasUnpushedChanges: () => false };
  vm.runInNewContext(implementation('pushClinicDb'), context);
  assert.equal(await context.pushClinicDb(), true);
});

test('edits queued during a successful save resume promptly without overlapping writes', async () => {
  let dirty = true, reads = 0, finish, delay;
  const context = {
    localStorage: { getItem: () => null }, CONFLICT_PAUSE_KEY: 'pause',
    isApplyingRemote: false, conflictPaused: false, pushInFlight: null,
    nextPushAt: 0, pushFailures: 0, consecutiveConflicts: 0, recoveredConflictIds: new Set(),
    hasUnpushedChanges: () => dirty, getLocalClinicDb: () => ({ appointments: [] }),
    getLocalChangeStamp: () => 2, markLastPushed: () => {}, apiUrl: x => x,
    schedulePush: value => { delay = value; },
    window: { GmDentalApiFetch: () => { reads++; return new Promise(resolve => { finish = resolve; }); } }
  };
  vm.runInNewContext(implementation('pushClinicDb'), context);
  const first = context.pushClinicDb();
  const second = context.pushClinicDb();
  assert.equal(reads, 1);
  finish({ok: true, json: async () => ({})});
  assert.equal(await first, true); assert.equal(await second, true);
  assert.equal(delay, 100);
});

test('acknowledged records merge locally without losing unrelated dirty edits', () => {
 const start=source.indexOf('  function acceptRecord('),end=source.indexOf('\n  window.GmDentalSupabaseSync',start);
 for(const dirty of [false,true]) {
  let stamp=5,pushed=dirty?4:5,stored;
  const db={appointments:[{id:'draft'}],patientClinicalNotes:[{id:'other',text:'Other'}]};
  const context={window:{dispatchEvent(){}},StorageEvent:class{},SYNC_STAMP_KEY:"stamp",hasUnpushedChanges:()=>stamp>pushed,pushInFlight:null,getLocalClinicDb:()=>db,isApplyingRemote:false,CLINIC_DB_KEY:'db',originalSetItem:(_key,value)=>{stored=JSON.parse(value);},markLocalDirty:()=>stamp++,markLastPushed:value=>{pushed=value;},getLocalChangeStamp:()=>stamp};
  vm.runInNewContext(source.slice(start,end),context);context.acceptRecord('patientClinicalNotes',{id:'new',text:'Saved'});
  assert.equal(stored.patientClinicalNotes.length,2);assert.equal(stored.appointments[0].id,'draft');assert.equal(stamp>pushed,dirty);assert.equal(stamp,6);
 }
});
