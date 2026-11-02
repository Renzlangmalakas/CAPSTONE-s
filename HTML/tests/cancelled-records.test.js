const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { preserveCompletion } = require('../api/_appointments');
test('clinic cleanup cancellation survives stale approved snapshots without changing payments', () => {
  const saved = { status: 'Cancelled', cancelledBy: 'clinic_cleanup', updatedAt: '2026-10-07T12:00:00Z' };
  const result = preserveCompletion({ status: 'Approved', totalCollected: 50 }, saved);
  assert.equal(result.status, 'Cancelled');
  assert.equal(result.visitStatus, 'Cancelled');
  assert.equal(result.totalCollected, 50);
});
test('patient canonical records override stale legacy approval', () => {
  const source = fs.readFileSync(require.resolve('../Patient/patient.js'), 'utf8');
  const c = { safeArray: value => Array.isArray(value) ? value : [],
    buildAppointmentIdentityKey: r => r.id, ensureClinicDbShape: x => x,
    getClinicDb: () => ({ appointments: [{ id: 'a', patient: 'Test', status: 'Cancelled', visitStatus: 'Cancelled' }] }),
    getClinicData: () => [{ id: 'a', patient: 'Test', status: 'Approved', visitStatus: 'Approved' }],
    getLegacyLocalArray: () => [], CLINIC_SYNC_KEYS: {}, isUsableAppointmentRecord: () => true,
    normalizeAppointmentFinancials: x => x };
  for (const [start, end] of [['function mergeAppointmentRecordCollections(', 'function deriveServicePaymentStatus('], ['function buildCanonicalAppointmentCollections(', 'function isUsableAppointmentRecord(']]) {
    vm.runInNewContext(source.slice(source.indexOf(start), source.indexOf(end)), c);
  }
  const records = c.buildCanonicalAppointmentCollections();
  assert.equal(records.length, 1);
  assert.equal(records[0].status, 'Cancelled');
});
