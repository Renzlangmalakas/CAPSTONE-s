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
