const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { uniqueRecords } = require('../api/_sync-records');

test('timestamp-only appointment differences are not conflicting edits', () => {
  const { sameAppointment } = require('../api/_sync-records');
  assert.equal(sameAppointment({ id: 'a', status: 'Approved', updatedAt: 'old' }, { id: 'a', status: 'Approved', updatedAt: 'new' }), true);
  assert.equal(sameAppointment({ id: 'a', status: 'Approved' }, { id: 'a', status: 'Cancelled' }), false);
});
test('record equality ignores JSON key order but detects changed values', () => {
  const { sameRecord } = require('../api/_sync-records');
  assert.equal(sameRecord({ id: 'a', nested: { x: 1, y: 2 } }, { nested: { y: 2, x: 1 }, id: 'a' }), true);
  assert.equal(sameRecord({ paid: 100 }, { paid: 200 }), false);
});
test('notification sync sends each conflict ID only once', async () => {
  const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
  const start = source.indexOf('async function writeClinicDbToSupabase(');
  const end = source.indexOf('\nfunction generateOtp', start);
  let rows;
  const context = { defaultAccounts: require("../Shared/default-accounts"), clinicTableMap: {}, notificationTargets: ['admin', 'dentist'], rawTableColumns: { notifications: [] },
    buildHistoryRecords: () => [], ensureId: item => item.id, buildRawRow: item => item,
    require: name => require('../api/' + name.slice(2)),
    supabase: { from() { return { delete() { return { not: async () => ({}) }; }, upsert: async value => { rows = value; return {}; } }; } } };
  vm.runInNewContext(source.slice(start, end), context);
  await context.writeClinicDbToSupabase({ notifications: { admin: [{ id: 'same', text: 'Notice' }], dentist: [{ id: 'same', text: 'Notice' }] } });
  assert.equal(rows.length, 1);
});
test('duplicate IDs keep the newer record without dropping unrelated records', () => {
  const newer = { id: 'a', updatedAt: '2026-09-24', status: 'Completed' };
  assert.deepEqual(uniqueRecords([newer, { id: 'a', updatedAt: '2026-09-23' }, { id: 'b' }]), [newer, { id: 'b' }]);
  assert.equal(uniqueRecords([{ id: 'a', value: 1 }, { id: 'a', value: 2 }])[0].value, 2);
});
test('appointment duplicate snapshot writes each ID once and skips unchanged records', async () => {
  const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
  const start = source.indexOf('async function replaceJsonTable(');
  const end = source.indexOf('\nfunction normalizeHistoryStatus', start);
  const record = { id: 'a', status: 'Approved', updatedAt: '2026-09-24' };
  let writes = 0;
  const supabase = { from() { return {
    select: async () => ({ data: [{ id: 'a', data: record, updated_at: 'old' }] }),
    update() { writes++; return { eq() { return this; }, select() { return this; }, async maybeSingle() { return { data: { id: 'a' } }; } }; }
  }; } };
  const context = { supabase, require: name => require('../api/' + name.slice(2)), ensureId: row => row.id };
  vm.runInNewContext(source.slice(start, end), context);
  await context.replaceJsonTable('clinic_appointments', [record, record], 'id');
  assert.equal(writes, 0);
  await context.replaceJsonTable('clinic_appointments', [{ ...record, status: 'Ongoing' }, { ...record, status: 'Ongoing' }], 'id');
  assert.equal(writes, 1);
});

test('concurrent identical appointment saves succeed, different changes remain conflicts', async () => {
  const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
  const code = source.slice(source.indexOf('async function replaceJsonTable('), source.indexOf('\nfunction normalizeHistoryStatus'));
  const incoming = { id: 'a', status: 'Ongoing' };
  for (const identical of [true, false]) {
    let count = 0;
    const context = { ensureId: row => row.id, require: name => require('../api/' + name.slice(2)), supabase: { from() {
      count++;
      if (count === 1) return { select: async () => ({ data: [{ id: 'a', data: { id: 'a', status: 'Approved' }, updated_at: 'before' }] }) };
      if (count === 2) return { update() { return this; }, eq() { return this; }, select() { return this; }, maybeSingle: async () => ({ data: null }) };
      return { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { data: identical ? incoming : { ...incoming, notes: 'Another edit' } } }) };
    } } };
    vm.runInNewContext(code, context);
    if (identical) await assert.doesNotReject(() => context.replaceJsonTable('clinic_appointments', [{ ...incoming }], 'id'));
    else await assert.rejects(() => context.replaceJsonTable('clinic_appointments', [{ ...incoming }], 'id'), { code: 'SYNC_CONFLICT' });
  }
});

test('empty and stale catalog snapshots cannot erase or overwrite imported fees', async () => {
  const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
  const code = source.slice(source.indexOf('async function replaceJsonTable('), source.indexOf('\nfunction normalizeHistoryStatus'));
  let writes = 0;
  const context = { ensureId: row => row.id, require: name => require('../api/' + name.slice(2)), supabase: { from() { return {
    select: async () => ({ data: [{ id: 'fee', data: { updatedAt: '2026-09-25' }, updated_at: '2026-09-25' }] }),
    delete() { throw new Error('Catalog must never be cleared by snapshot sync'); },
    update() { writes++; return { eq() { return this; } }; }
  }; } } };
  vm.runInNewContext(code, context);
  await context.replaceJsonTable('clinic_additional_fees', [], 'id');
  await context.replaceJsonTable('clinic_additional_fees', [{ id: 'fee', updatedAt: '2026-09-24' }], 'id');
  assert.equal(writes, 0);
  await context.replaceJsonTable('clinic_additional_fees', [{ id: 'fee', updatedAt: '2026-09-26', archived: true }], 'id');
  assert.equal(writes, 1);
});

test('scoped dentist sync never deletes findings belonging to other dentists', async () => {
  const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
  const code = source.slice(source.indexOf('async function replaceJsonTable('), source.indexOf('\nfunction normalizeHistoryStatus'));
  let written = [];
  const context = { rawTableColumns: {}, ensureId: row => row.id, require: name => require('../api/' + name.slice(2)), supabase: { from() { return {
    delete() { throw new Error('Scoped sync cannot delete a shared table'); },
    async select() { return { data: [{ id: 'other-note', data: { id: 'other-note', text: 'Existing history' } }] }; },
    async insert(row) { written.push(row); return {}; }
  }; } } };
  vm.runInNewContext(code, context);
  await context.replaceJsonTable('clinic_patient_clinical_notes', [], 'id', undefined, true);
  await context.replaceJsonTable('clinic_patient_clinical_notes', [{id:'own-note',patientKey:'own-patient'}], 'id', undefined, true);
  assert.equal(written.length, 1);
  assert.equal(written[0].id, 'own-note');
  await context.replaceJsonTable('clinic_patient_clinical_notes', [], 'id');
  await context.replaceJsonTable('clinic_patient_clinical_notes', [{id:'other-note',text:'Stale copy'}], 'id');
  assert.equal(written.length, 1, 'empty and stale non-dentist snapshots cannot erase or overwrite history');
});
