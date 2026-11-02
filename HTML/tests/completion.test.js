const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createCompleteAppointmentHandler, preserveCompletion } = require('../api/_appointments');

function fixture({ role = 'dentist', failSave = false, assigned = true } = {}) {
  const state = { row: { id: 'appointment-one', updated_at: '2026-09-22T10:00:00Z', data: {
    id: 'appointment-one', status: 'Approved', dentistId: assigned ? 'dentist-one' : 'different', dentist: assigned ? 'Dr. Test' : 'Dr. Other', price: 1200, totalCollected: 1200
  } }, writes: 0, tables: [] };
  const db = { from(table) {
    state.tables.push(table); let update;
    return { select() { return this; }, eq() { return this; }, update(value) { update = value; return this; },
      async maybeSingle() {
        if (update && failSave) return { error: { message: 'Simulated database failure' } };
        if (update) { state.row = { ...state.row, ...update }; state.writes++; }
        return { data: structuredClone(state.row) };
      }
    };
  } };
  const handler = createCompleteAppointmentHandler({ supabase: db, findUser: async () => ({ id: 'dentist-one', name: 'Dr. Test', email: 'test@example.com' }) });
  const req = { user: { email: 'test@example.com', role }, params: { id: state.row.id } };
  const res = { code: 200, status(code) { this.code = code; return this; }, end(){return this;}, json(value) { this.body = value; return this; } };
  return { state, handler, req, res };
}

test('completion saves only the appointment, preserves billing, and is idempotent', async () => {
  const f = fixture();
  await f.handler(f.req, f.res);
  assert.equal(f.res.code, 200);
  assert.equal(f.res.body.appointment.status, 'Completed');
  assert.equal(f.state.row.data.totalCollected, 1200);
  assert.ok(f.state.tables.every(name => name === 'clinic_appointments'));
  await f.handler(f.req, f.res);
  assert.equal(f.state.writes, 1);
});

test('failed completion does not report success or change the appointment', async () => {
  const f = fixture({ failSave: true });
  await f.handler(f.req, f.res);
  assert.equal(f.res.code, 500);
  assert.equal(f.state.row.data.status, 'Approved');
});

test('patients and other dentists cannot complete an appointment', async () => {
  for (const options of [{ role: 'patient' }, { assigned: false }]) {
    const f = fixture(options); await f.handler(f.req, f.res);
    assert.equal(f.res.code, 403); assert.equal(f.state.writes, 0);
  }
});

test('stale full sync cannot reopen a completed appointment', () => {
  const result = preserveCompletion({ status: 'Approved', price: 1300, updatedAt: '2026-09-22T13:00:00Z' }, { status: 'Completed', completedAt: '2026-09-22T12:00:00Z' });
  assert.equal(result.status, 'Completed');
  assert.equal(result.price, 1300);
  assert.equal(result.completedAt, '2026-09-22T12:00:00Z');
});

test('dentist completion removes the schedule row and adds it to treatment history', async () => {
  const storage = new Map();
  const elements = { scheduleTableBody: { innerHTML: '' }, historyTableBody: { innerHTML: '' } };
  const appointment = { id: 'appointment-one', patientName: 'Test Patient', dentistId: 'dentist-one',
    dentist: 'Dr. Test', service: 'Consultation', status: 'Approved', visitStatus: 'Approved',
    date: '2026-10-05', time: '11:00', schedule: '2026-10-05 • 11:00 AM', price: 500, totalCollected: 0 };
  storage.set('gm_dental_db_v1', JSON.stringify({ appointments: [appointment] }));
  const c = vm.createContext({ console,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    sessionStorage: { getItem: () => JSON.stringify({ id: 'dentist-one', role: 'dentist', name: 'Dr. Test' }) },
    document: { addEventListener() {}, querySelector: () => null, getElementById: id => elements[id] || null },
    window: { GMDentistAccess: require("../Shared/dentist-access"), addEventListener() {}, GmDentalSupabaseSync: { apiBaseUrl: '' },
      GmDentalApiFetch: async () => ({ ok: true, json: async () => ({ appointment: { ...appointment,
        status: 'Completed', visitStatus: 'Completed', lifecycleStatus: 'Completed', completedAt: '2026-10-02T07:00:00Z' } }) }) }
  });
  vm.runInContext(fs.readFileSync(require.resolve('../Shared/additional-fees'), 'utf8'), c);
  vm.runInContext(fs.readFileSync(require.resolve('../Dentist/dentist_page'), 'utf8'), c);
  c.showToast = () => {};
  c.renderScheduleTable();
  assert.match(elements.scheduleTableBody.innerHTML, /appointment-one/);
  await c.completeAppointment('appointment-one');
  assert.doesNotMatch(elements.scheduleTableBody.innerHTML, /appointment-one/);
  assert.match(elements.historyTableBody.innerHTML, /Test Patient/);
  assert.match(elements.historyTableBody.innerHTML, /Completed/);
  // A delayed sync or another tab can still deliver the old Approved snapshot.
  storage.set('gm_dental_db_v1', JSON.stringify({ appointments: [appointment] }));
  c.refreshDentistUI();
  assert.doesNotMatch(elements.scheduleTableBody.innerHTML, /appointment-one/);
  assert.match(elements.historyTableBody.innerHTML, /Completed/);
  // Reload recovery reads the server even when write-sync cannot pull.
  vm.runInContext('confirmedDentistCompletions.clear()', c);
  c.window.GmDentalSupabaseSync.pull = () => { throw new Error('Sync paused'); };
  c.window.GmDentalApiFetch = async (url, options) => {
    assert.equal(url, '/api/clinic-db');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ db: { appointments: [{ ...appointment,
      status: 'Completed', completedAt: '2026-10-02T07:00:00Z' }] } }) };
  };
  assert.equal(await c.refreshConfirmedDentistCompletions(), true);
  assert.doesNotMatch(elements.scheduleTableBody.innerHTML, /appointment-one/);
  assert.match(elements.historyTableBody.innerHTML, /Completed/);
  // A later billing update remains visible without reopening the visit.
  storage.set('gm_dental_db_v1', JSON.stringify({ appointments: [{ ...appointment, totalCollected: 500 }] }));
  assert.equal(c.getMyAppointments()[0].totalCollected, 500);
  assert.equal(c.getMyAppointments()[0].status, 'Completed');
});


test('completion accepts staff status names but rejects inactive visits despite stale approval fields', async () => {
  for (const status of ['Confirmed', 'In Progress', 'Approved', 'Ongoing']) {
    const f = fixture();
    f.state.row.data.status = status;
    f.state.row.data.visitStatus = 'Approved';
    await f.handler(f.req, f.res);
    assert.equal(f.res.code, 200, status);
    assert.equal(f.res.body.appointment.status, 'Completed');
  }
  for (const status of ['Pending', 'Waiting', 'Cancelled', 'Rejected']) {
    const f = fixture();
    f.state.row.data.status = status;
    f.state.row.data.visitStatus = 'Approved';
    await f.handler(f.req, f.res);
    assert.equal(f.res.code, 409, status);
    assert.equal(f.state.writes, 0);
  }
});

test('stale snapshots cannot reopen staff or dentist cancellations', () => {
  for (const cancelledBy of ['staff', 'dentist', undefined]) {
    const result = preserveCompletion({status:'In Progress', visitStatus:'Approved', updatedAt:'2026-10-10T05:00:00Z'},
      {status:'Cancelled', cancelledBy, cancelledAt:'2026-10-10T04:00:00Z', updatedAt:'2026-10-10T04:00:00Z'});
    assert.equal(result.status, 'Cancelled');
    assert.equal(result.visitStatus, 'Cancelled');
    assert.equal(result.cancelledAt, '2026-10-10T04:00:00Z');
  }
});
