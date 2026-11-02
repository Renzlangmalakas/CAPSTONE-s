const test = require('node:test');
const assert = require('node:assert/strict');
const accounts = require('../Shared/default-accounts');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function deletionRoute({ fail = false, role = 'admin' } = {}) {
  let route;
  let written;
  const source = fs.readFileSync(path.join(__dirname, '../api/_app.js'), 'utf8');
  const start = source.indexOf('app.delete("/api/admin/patients/:id"');
  const end = source.indexOf('\napp.get("/api/clinic-db"', start);
  vm.runInNewContext(source.slice(start, end), {
    app: { delete: (_path, handler) => { route = handler; } }, console,
    requireSupabase: () => true, requireServiceRoleKey: () => true,
    stableRowId: row => row.id,
    supabase: { from(table) {
      assert.equal(table, 'patients');
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'p1', name: 'Patient' } }) }) }),
        update: values => ({ eq: async (_field, id) => {
          assert.equal(id, 'p1');
          if (fail) return { error: { code: 'TEST_WRITE_FAILURE' } };
          written = values; return {};
        } }),
      };
    } },
  });
  return {
    async run() {
      const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await route({ params: { id: 'p1' }, user: { role } }, res);
      return res;
    },
    get written() { return written; },
  };
}

test('patient deletion persists a marker in the actual patient table before reporting success', async () => {
  const f = deletionRoute();
  const result = await f.run();
  assert.equal(result.code, 200);
  assert.equal(f.written.archived, true);
  assert.ok(f.written.deleted_at);
  assert.equal(result.body.deletedPatient.deletedAt, f.written.deleted_at);
});

test('failed or unauthorized patient deletion does not report success', async () => {
  for (const role of ['patient', 'dentist', 'staff']) {
    const f = deletionRoute({ role });
    assert.equal((await f.run()).code, 403);
    assert.equal(f.written, undefined);
  }
  const f = deletionRoute({ fail: true });
  assert.equal((await f.run()).code, 500);
  assert.equal(f.written, undefined);
});

test('server deletion markers prevent stale patient records from returning after reload', () => {
  const marker = { id: 'p1', name: 'Deleted Patient', email: 'deleted@example.test', deletedAt: '2026-10-06T00:00:00Z' };
  const db = { patients: [marker, { id: 'p2', name: 'Retained Patient' }], appointments: [] };
  accounts.normalizeDb(db);
  assert.deepEqual(db.patients.map(row => row.id), ['p2']);
  assert.equal(db.deletedPatients.length, 1);
  db.patients.push({ id: 'p1', name: 'Deleted Patient' });
  accounts.normalizeDb(db);
  assert.deepEqual(db.patients.map(row => row.id), ['p2']);
  assert.equal(accounts.isDeletedPatient(db, { patientId: 'p1' }), true);
  assert.equal(accounts.isDeletedPatient(db, { patientName: 'Deleted Patient' }), true);
  assert.equal(accounts.isDeletedPatient(db, { patientName: 'Deleted Patient', patientEmail: 'different@example.test' }), false);
});
