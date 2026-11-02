const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function staffMappers() {
  const source = fs.readFileSync(path.join(__dirname, '../Staff/staff.js'), 'utf8');
  const context = { uid: () => 'new-id' };
  for (const name of ['clinicPatientToStaff', 'staffPatientToClinic', 'clinicAppointmentToStaff', 'staffAppointmentToClinic', 'sameStaffFields']) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\nfunction ', start + 1);
    vm.runInNewContext(source.slice(start, end), context);
  }
  return context;
}

test('staff patient saves do not reference appointment variables', () => {
  const c = staffMappers();
  assert.equal(c.staffPatientToClinic({ id: 'p', name: 'Patient' }).name, 'Patient');
});

test('staff round trips leave unchanged patients and appointments untouched', () => {
  const c = staffMappers();
  const patient = { id: 'p', name: 'Patient', updatedAt: '2026-09-01' };
  const appointment = { id: 'a', patient: 'Patient', price: 100, updatedAt: '2026-09-01' };
  assert.equal(c.staffPatientToClinic(c.clinicPatientToStaff(patient), patient), patient);
  assert.equal(c.staffAppointmentToClinic(c.clinicAppointmentToStaff(appointment), appointment), appointment);
  const edited = c.clinicAppointmentToStaff(appointment);
  edited.additionalFees = [{ id: 'fee', amount: 20 }];
  edited.grandTotal = 120;
  const saved = c.staffAppointmentToClinic(edited, appointment);
  assert.equal(saved.additionalFees[0].amount, 20);
  assert.equal(saved.grandTotal, 120);
  assert.notEqual(saved.updatedAt, appointment.updatedAt);
});

test('raw table payloads omit blank timestamps and preserve valid dates', () => {
  const source = fs.readFileSync(path.join(__dirname, '../api/_app.js'), 'utf8');
  const start = source.indexOf('function buildRawRow(');
  const end = source.indexOf('\nfunction ', start + 1);
  const c = { rawTableColumns: { patients: ['id', 'created_at', 'updated_at'] },
    stableRowId: row => row.id, snakeToCamel: value => value.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase()) };
  vm.runInNewContext(source.slice(start, end), c);
  for (const empty of ['', '  ', null]) {
    const row = c.buildRawRow({ id: 'p', createdAt: empty, updated_at: empty }, 'patients');
    assert.equal('created_at' in row, false);
    assert.equal('updated_at' in row, false);
  }
  assert.equal(c.buildRawRow({ updatedAt: '2026-09-01T00:00:00Z' }, 'patients').updated_at, '2026-09-01T00:00:00Z');
});

test('failed sync polling respects retry backoff and keeps local edits', async () => {
  let calls = 0;
  const c = browser('Shared/shared-supabase-sync.js', async () => {
    calls++;
    return { ok: false, status: 504, json: async () => ({}) };
  });
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{ id: 'a' }] }));
  await c.window.GmDentalSupabaseSync.flushNow();
  await c.window.GmDentalSupabaseSync.pull();
  assert.equal(calls, 1);
  assert.ok(c.localStorage.getItem('gm_dental_db_v1').includes('a'));
});

test('staff saves preserve clinic collections outside the staff view', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Staff/staff.js'), 'utf8');
  const snapshot = { patients: [], appointments: [], services: [{ id: 'service' }], additionalFees: [{ id: 'fee' }], payments: [{ id: 'payment' }] };
  const c = { CLINIC_DB_KEY: 'db', localStorage: { getItem: () => JSON.stringify(snapshot) } };
  const start = source.indexOf('function getClinicDb(');
  vm.runInNewContext(source.slice(start, source.indexOf('\nfunction ', start + 1)), c);
  const saved = c.getClinicDb();
  for (const key of ['services', 'additionalFees', 'payments']) assert.equal(saved[key][0].id, snapshot[key][0].id);
});

test('a tab waiting for the sync lock skips a snapshot another tab saved', async () => {
  let calls = 0;
  const c = browser('Shared/shared-supabase-sync.js', async () => { calls++; });
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{ id: 'a' }] }));
  c.navigator.locks = { request: async (name, callback) => {
    assert.equal(name, 'gm-dental-clinic-sync');
    c.localStorage.setItem('gm_dental_last_pushed_stamp', c.localStorage.getItem('gm_dental_local_change_stamp'));
    return callback();
  } };
  assert.equal(await c.window.GmDentalSupabaseSync.flushNow(), true);
  assert.equal(calls, 0);
});

test('dentist and patient snapshots retain staff notifications required by the API', () => {
  for (const file of ['Dentist/dentist_page.js', 'Patient/patient.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const context = { safeArray: value => Array.isArray(value) ? value : [] };
    for (const name of ['buildDefaultClinicDb', 'ensureClinicDbShape']) {
      const start = source.indexOf(`function ${name}(`);
      const end = source.indexOf('\nfunction ', start + 1);
      vm.runInNewContext(source.slice(start, end), context);
    }
    assert.equal(context.ensureClinicDbShape({}).notifications.staff.length, 0);
    assert.equal(context.ensureClinicDbShape({ notifications: { staff: [{ id: 'keep' }] } }).notifications.staff[0].id, 'keep');
  }
});

test('an older archived copy cannot undo a completed appointment', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Dentist/dentist_page.js'), 'utf8');
  const start = source.indexOf('function dedupeAppointments(');
  const end = source.indexOf('\nlet pendingNextAdjustmentSourceId', start);
  const context = { safeArray: value => value };
  vm.runInNewContext(source.slice(start, end), context);
  const completed = { id: 'same', status: 'Completed', updatedAt: '2026-09-22T12:00:00Z' };
  const stale = { id: 'same', status: 'Approved', updatedAt: '2026-09-21T12:00:00Z' };
  for (const records of [[completed, stale], [stale, completed]]) {
    assert.equal(context.dedupeAppointments(records)[0].status, 'Completed');
  }
});

test('flush reports rejected saves without clearing unsynced changes', async () => {
  const c = browser('Shared/shared-supabase-sync.js', async () => ({ ok: false, status: 400, json: async () => ({ message: 'Invalid snapshot' }) }));
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{ id: 'test', status: 'Completed' }] }));
  assert.equal(await c.window.GmDentalSupabaseSync.flushNow(), false);
  assert.ok(Number(c.localStorage.getItem('gm_dental_local_change_stamp')) > Number(c.localStorage.getItem('gm_dental_last_pushed_stamp')));
});

test('dentist dashboard counts dated appointments, sorts the queue and excludes archives', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Dentist/dentist_page.js'), 'utf8');
  const context = { Date, normalizeAppointmentStatus: value => value,
    normalizeDateValue: item => item.date || String(item.schedule || '').split(' • ')[0],
    normalizeTimeValue: item => item.time || '',
    getPatientClinicalKey: item => item.patientId || item.patientName };
  for (const name of ['isTodayDate', 'getDashboardSummary']) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\nfunction ', start + 1);
    vm.runInNewContext(source.slice(start, end), context);
  }
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const records = [
    { id: 'late', patientId: 'one', patientName: 'Same Name', date, time: '14:00', status: 'Approved' },
    { id: 'early', patientId: 'two', patientName: 'Same Name', date, time: '09:00', status: 'Pending' },
    { id: 'archived', patientId: 'three', date, status: 'Approved', archivedForDentist: 'true' },
    { id: 'cancelled', patientId: 'one', date, status: 'Cancelled' },
    { id: 'future', patientId: 'one', date: '2099-01-01', status: 'Approved' }
  ];
  const summary = context.getDashboardSummary(records);
  assert.deepEqual(Array.from(summary.todayAppointments, item => item.id), ['early', 'late']);
  assert.equal(summary.patientCount, 2);
  assert.equal(context.isTodayDate('invalid'), false);
});

function browser(file, fetch = async () => ({ ok: false })) {
  class Storage {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.get(key) ?? null; }
    setItem(key, value) { this.data.set(key, String(value)); }
    removeItem(key) { this.data.delete(key); }
  }
  const storage = new Storage();
  const context = { Storage, localStorage: storage, sessionStorage: new Storage(), Headers, fetch, console, Blob,
    navigator: { sendBeacon: () => true },
    document: { readyState: 'loading', addEventListener() {} },
    window: { location: { hostname: 'example.com', protocol: 'https:', origin: 'https://example.com' },
      addEventListener() {}, dispatchEvent() {}, clearTimeout() {}, setTimeout() {}, setInterval() {} },
    StorageEvent: class {}, CustomEvent: class {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context);
  return context;
}

test('admin sync preserves booking identity, services and reserved duration', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Admin/admin.js'), 'utf8');
  const start = source.indexOf('function syncAdminStateToClinicDb()');
  const end = source.indexOf('\nfunction qs(', start);
  const original = { id: 'a', patientId: 'p', patientEmail: 'p@example.com', dentistId: 'd',
    dentistEmail: 'd@example.com', services: [{ serviceName: 'Consultation' }], durationMinutes: 20,
    endTime: '09:20', clinicalNotes: 'Keep this' };
  const db = { appointments: [original] };
  const context = { state: { appointments: [{ id: 'a', patient: 'Patient', dentist: 'Dentist',
    service: 'Consultation', date: '2026-10-02', time: '09:00', status: 'Approved' }] },
    getClinicDb: () => db, saveClinicDb() {}, touchClinicSync() {}, triggerGlobalSync() {},
    uid: () => 'new', buildSchedule: (date, time) => `${date} ${time}` };
  vm.runInNewContext(source.slice(start, end), context);
  context.syncAdminStateToClinicDb();
  for (const field of ['patientId', 'patientEmail', 'dentistId', 'dentistEmail', 'services', 'durationMinutes', 'endTime', 'clinicalNotes']) {
    assert.deepEqual(db.appointments[0][field], original[field]);
  }
  assert.equal(db.appointments[0].status, 'Approved');
});

test('conflict notice can be dismissed without deleting saved drafts', () => {
  const c = browser('Shared/shared-supabase-sync.js');
  let notice;
  c.document.body = { appendChild: node => { notice = node; } };
  c.document.getElementById = () => notice;
  c.document.createElement = () => ({ style: {}, children: [], setAttribute() {},
    appendChild(node) { this.children.push(node); }, remove() { notice = null; } });
  c.localStorage.setItem('gm_dental_sync_conflict_drafts', '[{"appointmentId":"a"}]');
  const source = fs.readFileSync(path.join(__dirname, '../Shared/shared-supabase-sync.js'), 'utf8');
  vm.runInNewContext(source.slice(source.indexOf('  function showSyncConflict('), source.indexOf('  async function recoverAppointmentConflict(')), c);
  c.showSyncConflict('Appointment a: overlap');
  assert.equal(notice.children[0].textContent, 'Download saved changes');
  const dismiss = notice.children[1];
  assert.equal(dismiss.textContent, 'Dismiss');
  dismiss.onclick();
  assert.equal(notice, null);
  assert.equal(c.localStorage.getItem('gm_dental_sync_conflict_drafts'), '[{"appointmentId":"a"}]');
});

test('deleting or renaming default fees persists, including an empty catalog', () => {
  const c = browser('Shared/additional-fees.js'); const api = c.window.GMAdditionalFees;
  const db = api.getDb(); assert.equal(db.additionalFees.length, 11);
  db.additionalFees.shift(); db.additionalFees[0].name = 'Renamed'; api.saveDb(db);
  assert.equal(api.getDb().additionalFees.length, 10);
  db.additionalFees = []; api.saveDb(db); assert.equal(api.getDb().additionalFees.length, 0);
});

test('requested fee catalog supports ranges, starting prices and required variable quotes', () => {
  const api = browser('Shared/additional-fees.js').window.GMAdditionalFees;
  const fees = api.defaultCatalog();
  assert.equal(fees.length, 11);
  const medicine = fees.find(f => f.name === 'Medication Fee');
  assert.equal(api.selectedPrice(medicine, '350'), 350);
  assert.throws(() => api.selectedPrice(medicine, '501'));
  const laboratory = fees.find(f => f.name === 'Laboratory Fee');
  assert.equal(api.priceLabel(laboratory).slice(-1), '+');
  assert.equal(api.selectedPrice(laboratory, '5000'), 5000);
  assert.throws(() => api.selectedPrice(laboratory, '499'));
  const variable = fees.find(f => f.name === 'Lost/Damaged Appliance Fee');
  assert.equal(api.priceLabel(variable), 'Varies');
  assert.throws(() => api.selectedPrice(variable, ''));
  assert.throws(() => api.selectedPrice(variable, '0'));
  assert.equal(api.selectedPrice(variable, '750'), 750);
});

test('fee import reuses existing and renamed catalog IDs without deleting other fees', () => {
  const { plan } = require('./import-fee-catalog.cjs');
  const existing = [{ id: 'old-anesthesia', data: { name: 'Anesthesia Fee' } }, { id: 'custom', data: { name: 'Custom Fee' } }];
  const rows = plan(existing);
  assert.equal(rows.length, 11);
  assert.equal(rows.find(row => row.data.name === 'Local Anesthesia Fee').id, 'old-anesthesia');
  assert.equal(existing.length, 2);
  assert.equal(new Set(rows.map(row => row.id)).size, 11);
});

function patientBilling(appointment, method = 'gcash') {
  const c = browser('Shared/additional-fees.js');
  Object.assign(c, {
    globalBillingPaymentMode: 'full', billingSubmitLocked: false,
    normalizeAppointmentFinancials: item => item,
    normalizeBillingServiceRecord: item => item,
    isOrthodonticBillingService: () => false,
    getBillingSelectionKey: (_item, index) => String(index),
    getPendingBillingItem: () => appointment,
    resolveBillingTargetRecord: () => appointment,
    canOpenBillingForAppointment: () => true,
    getNormalizedAppointmentServices: item => item.services,
    updateAppointmentById: (_id, updater) => { appointment = updater(appointment); c.updated = appointment; return appointment; },
    document: { getElementById: () => ({ value: method }) },
    showToast() {}, addNotification() {}, pushDentistNotification() {}, renderAllPatientUI() {}, showSection() {}, openInvoiceModal() {}
  });
  c.window.GmDentalSupabaseSync = { flushNow: async () => true };
  const source = fs.readFileSync(path.join(__dirname, '../Patient/patient.js'), 'utf8');
  for (const name of ['summarizeAppointmentServices', 'isRemainingBalanceOnlyService', 'getBillingSelectionsFromPending', 'getBillingStageLabel', 'handleServiceLevelPaymentSubmit']) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\nfunction ', start + 1);
    // The submit handler has separate state declarations immediately before it.
    let code = source.slice(source.slice(start - 6, start) === "async " ? start - 6 : start, end < 0 ? undefined : end);
    vm.runInNewContext(code, c);
  }
  return c;
}

test('dentist renders legacy paid appointments without an out-of-scope appointment variable', () => {
  const c = browser('Shared/additional-fees.js');
  c.window.GMDentistAccess = require('../Shared/dentist-access');
  c.sessionStorage = { getItem: () => JSON.stringify({ id: 'dentist-test', role: 'dentist', name: 'Dr. Test' }) };
  c.console = { log() {}, warn() {} };
  c.GMAdditionalFees = c.window.GMAdditionalFees;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../Dentist/dentist_page.js'), 'utf8'), c);
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{
    id: 'paid-test', patientName: 'Test Patient', patientId: 'patient-test', dentistId: 'dentist-test',
    service: 'Tooth Extraction', price: 1000, amountPaidOnline: 1000, totalCollected: 1000,
    status: 'Approved', date: '2026-09-24', time: '10:00 AM',
    services: [{ serviceName: 'Tooth Extraction', price: 1000, totalPaid: 0 }]
  }] }));
  const appointments = c.getMyAppointments();
  assert.equal(appointments.length, 1);
  assert.equal(appointments[0].services[0].totalPaid, 1000);
  assert.equal(appointments[0].remainingBalance, 0);
  assert.equal(c.getDashboardSummary(appointments).patientCount, 1);
  assert.doesNotThrow(() => c.normalizeBillingServiceRecord({ serviceName: 'Consultation', price: 500 }));
});

test('GCash submission rejects an unreadable receipt without crediting the bill', async () => {
  const item = { id: 'test', recordType: 'appointment', price: 1200, serviceTotal: 1000,
    additionalFeesTotal: 200, totalCollected: 1000, amountPaidOnline: 1000,
    remainingBalance: 200, services: [{ serviceName: 'Cleaning', price: 1000, totalPaid: 1000, remainingBalance: 0, paymentStatus: 'Paid' }] };
  const c = patientBilling(item, 'gcash');
  c.crypto = { randomUUID: () => 'receipt-test' };
  c.getClinicDb = () => ({ appointments: [c.updated || item] });
  c.window.GMPaymentReceipts = require('../Shared/payment-receipts');
  let uploadedReceipt = { image: 'data:image/jpeg;base64,AA', reference: '1234567890123', amount: 200 };
  c.window.GMReceiptUpload = { get: () => uploadedReceipt, reset() { uploadedReceipt = null; } };
  await c.handleServiceLevelPaymentSubmit();
  assert.equal(c.updated.totalCollected, 1000);
  assert.equal(c.updated.remainingBalance, 200);
  assert.equal(c.updated.paymentProofs[0].status, 'rejected');
  assert.equal(c.updated.paymentProofs[0].automaticCheck.status, 'unverifiable');
  assert.match(c.updated.paymentProofs[0].rejectionReason, /OCR could not read this receipt/);
  assert.equal(uploadedReceipt, null);
  assert.equal(c.updated.paymentProofs[0].allocations[0].isAdditionalFee, true);
  await c.handleServiceLevelPaymentSubmit();
  assert.equal(c.updated.paymentProofs.length, 1);
});

for (const method of ['cash']) {
  test(`cash fee-only payment requires approval before settling the balance`, async () => {
    const item = { id: 'test', recordType: 'appointment', price: 1200, serviceTotal: 1000,
      additionalFeesTotal: 200, totalCollected: 1000, amountPaidOnline: 1000,
      remainingBalance: 200, services: [{ serviceName: 'Oral Prophylaxis', price: 1000, totalPaid: 1000, remainingBalance: 0, paymentStatus: 'Paid' }] };
    const c = patientBilling(item, method);
    c.crypto = { randomUUID: () => 'cash-test' };
    c.window.GMPaymentReceipts = require('../Shared/payment-receipts');
    c.refreshBillingWorkspace = () => {};
    const selections = c.getBillingSelectionsFromPending(item);
    assert.equal(selections.reduce((sum, entry) => sum + entry.amountToPay, 0), 200);
    assert.equal(c.getBillingStageLabel(selections), 'Full Payment');
    await c.handleServiceLevelPaymentSubmit();
    assert.equal(c.updated.paymentStatus, 'Pending');
    assert.equal(c.updated.remainingBalance, 200);
    assert.equal(c.updated.totalCollected, 1000);
    global.GMAdditionalFees = c.window.GMAdditionalFees;
    c.updated = c.window.GMPaymentReceipts.approve(c.updated, 'cash-test', 'staff@example.com');
    assert.equal(c.updated.additionalFeesPaid, 200);
    assert.equal(c.updated.totalCollected, 1200);
    assert.equal(c.updated.price, 1200);
    assert.equal(c.updated.services[0].totalPaid, 1000);
    assert.equal(c.updated.remainingBalance, 0);
    assert.equal(c.updated.paymentStatus, 'Paid');
    assert.equal(c.window.GMAdditionalFees.paymentSummary(c.updated).remaining, 0);
    assert.equal(c.getBillingSelectionsFromPending(c.updated).reduce((sum, entry) => sum + entry.amountToPay, 0), 0);
    await c.handleServiceLevelPaymentSubmit();
    assert.equal(c.updated.totalCollected, 1200);
  });
}

test('previous partial fee payments and later charges retain their allocation', () => {
  const api = browser('Shared/additional-fees.js').window.GMAdditionalFees;
  assert.equal(api.paymentSummary({ serviceTotal: 1000, additionalFeesTotal: 200, totalCollected: 1100 }).remaining, 100);
  const appointment = { serviceTotal: 1000, additionalFeesTotal: 200, additionalFeesPaid: 200, totalCollected: 300 };
  assert.equal(api.paymentSummary(appointment).remaining, 0);
  api.attachToAppointment(appointment, [{ unitPrice: 350 }]);
  assert.equal(api.paymentSummary(appointment).remaining, 150);
});

test('invalid numbers stay finite and monetary totals round to cents', () => {
  const api = browser('Shared/additional-fees.js').window.GMAdditionalFees;
  assert.equal(api.calculate([{ quantity: 'bad', unitPrice: Infinity }]).total, 0);
  assert.equal(api.calculate([{ quantity: 3, unitPrice: 0.1 }]).total, 0.3);
  assert.equal(api.normalizeFee({ price: 'bad', maxPrice: 'bad' }).maxPrice, 0);
});

test('editing legacy fees preserves the base service price without double counting', () => {
  const api = browser('Shared/additional-fees.js').window.GMAdditionalFees;
  const appointment = { price: 1200, additionalFeesTotal: 200 };
  api.attachToAppointment(appointment, [{ unitPrice: 300 }]);
  assert.equal(appointment.serviceTotal, 1000); assert.equal(appointment.price, 1300);
  api.attachToAppointment(appointment, []); assert.equal(appointment.price, 1000);
});

test('storage changes are tracked through the Storage prototype', () => {
  const c = browser('Shared/shared-supabase-sync.js');
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ patients: [{ id: 'one' }] }));
  const first = Number(c.localStorage.getItem('gm_dental_local_change_stamp'));
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ patients: [{ id: 'two' }] }));
  assert.ok(Number(c.localStorage.getItem('gm_dental_local_change_stamp')) > first);
});

test('a delayed pull cannot overwrite a local edit', async () => {
  let resolve;
  const c = browser('Shared/shared-supabase-sync.js', () => new Promise(r => { resolve = r; }));
  c.sessionStorage.setItem('gm_dental_current_user', JSON.stringify({ sessionToken: 'test-session' }));
  const pending = c.window.GmDentalSupabaseSync.pull();
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ patients: [{ id: 'new' }] }));
  resolve({ ok: true, json: async () => ({ db: { patients: [{ id: 'old' }] } }) });
  await pending;
  assert.equal(JSON.parse(c.localStorage.getItem('gm_dental_db_v1')).patients[0].id, 'new');
});

test('a delayed push cannot overwrite edits made during the request', async () => {
  let resolve;
  const c = browser('Shared/shared-supabase-sync.js', () => new Promise(r => { resolve = r; }));
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ patients: [{ id: 'old' }] }));
  const pending = c.window.GmDentalSupabaseSync.push();
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ patients: [{ id: 'new' }] }));
  resolve({ ok: true, json: async () => ({ db: { patients: [{ id: 'old' }] } }) });
  await pending;
  assert.equal(JSON.parse(c.localStorage.getItem('gm_dental_db_v1')).patients[0].id, 'new');
  assert.ok(Number(c.localStorage.getItem('gm_dental_local_change_stamp')) > Number(c.localStorage.getItem('gm_dental_last_pushed_stamp')));
});

test('an intentionally empty collection is still pushed', async () => {
  let body;
  const c = browser('Shared/shared-supabase-sync.js', async (_url, options) => {
    body = JSON.parse(options.body); return { ok: true, json: async () => ({ db: body.db }) };
  });
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ additionalFees: [] }));
  await c.window.GmDentalSupabaseSync.push();
  assert.deepEqual(body, { db: { additionalFees: [] } });
});

test('sessions reject tampering, wrong keys and expired tokens', () => {
  const { createSessions } = require('../api/_session');
  const sessions = createSessions('test-only-secret');
  const token = sessions.issue({ email: 'test@example.com', role: 'patient' });
  assert.equal(sessions.verify(token).role, 'patient');
  assert.equal(sessions.verify(token + '.extra'), null);
  assert.equal(createSessions('other-secret').verify(token), null);
  const [payload, signature] = token.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url'));
  claims.role = 'admin';
  assert.equal(sessions.verify(Buffer.from(JSON.stringify(claims)).toString('base64url') + '.' + signature), null);
  claims.exp = 1;
  const expiredPayload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const expiredSignature = require('node:crypto').createHmac('sha256', 'test-only-secret').update(expiredPayload).digest('base64url');
  assert.equal(sessions.verify(expiredPayload + '.' + expiredSignature), null);
});

test('API requires signed sessions and limits administration to admins', async () => {
  const appPath = path.join(__dirname, '../api/_app.js');
  const realRequire = require('node:module').createRequire(appPath);
  const context = { require: name => name === 'dotenv' ? { config() {} } : realRequire(name),
    process: { env: { SESSION_SECRET: 'test-only-secret' } }, module: { exports: {} },
    Buffer, console, URL, setInterval, setTimeout, clearTimeout };
  vm.runInNewContext(fs.readFileSync(appPath, 'utf8'), context);
  vm.runInNewContext('users.find(u => u.role === "admin").password = bcrypt.hashSync("TestAdmin1!", 4)', context);
  const server = context.module.exports.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(base + '/api/clinic-db')).status, 401);
    assert.equal((await fetch(base + '/api/admin/site-content')).status, 401);
    assert.equal((await fetch(base + '/api/site-content')).status, 503); // Public route; database is intentionally absent in this fixture.
    assert.equal((await fetch(base + '/api/site-content', { method: 'PUT' })).status, 401);
    const sessions = require('../api/_session').createSessions('test-only-secret');
    const patientHeaders = { Authorization: `Bearer ${sessions.issue({ email: 'patient@example.com', role: 'patient' })}` };
    assert.equal((await fetch(base + '/api/admin/users', { headers: patientHeaders })).status, 403);
    assert.equal((await fetch(base + '/api/admin/site-content', { headers: patientHeaders })).status, 403);
    const login = await fetch(base + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'gannalmappaladentallclinic@gmail.com', password: 'TestAdmin1!' }) });
    assert.equal(login.status, 200);
    const result = await login.json();
    assert.equal(sessions.verify(result.sessionToken).role, 'admin');
    const headers = { Authorization: `Bearer ${result.sessionToken}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/api/admin/users', { headers })).status, 200);
    assert.equal((await fetch(base + '/api/clinic-db', { method: 'PUT', headers, body: '{}' })).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});


test('requested billing example and staff roundtrip preserve fee snapshots', () => {
  const c = browser('Shared/additional-fees.js');
  const fees = c.window.GMAdditionalFees;
  const catalog = fees.defaultCatalog();
  const lines = ['Local Anesthesia Fee', 'Suture Fee', 'Medication Fee'].map(name => {
    const fee = catalog.find(item => item.name === name);
    return { additionalFeeId: fee.id, feeName: name, description: fee.description, quantity: 1, unitPrice: fees.selectedPrice(fee, name === 'Medication Fee' ? 150 : 200) };
  });
  const bill = fees.attachToAppointment({ id: 'fixture', price: 1000 }, lines);
  assert.equal(bill.additionalFeesTotal, 550);
  assert.equal(bill.grandTotal, 1550);
  const source = fs.readFileSync(path.join(__dirname, '../Staff/staff.js'), 'utf8');
  const ctx = {};
  for (const name of ['clinicAppointmentToStaff', 'staffAppointmentToClinic', 'sameStaffFields']) {
    const start = source.indexOf('function ' + name + '(');
    const end = source.indexOf('\n}', start) + 2;
    vm.runInNewContext(source.slice(start, end), ctx);
  }
  const staff = ctx.clinicAppointmentToStaff(bill);
  fees.attachToAppointment(staff, staff.additionalFees);
  const saved = ctx.staffAppointmentToClinic(staff, bill);
  assert.equal(saved.price, 1550);
  assert.equal(saved.additionalFees[2].unitPrice, 150);
  assert.equal(saved.additionalFees[2].description, lines[2].description);
  catalog[2].price = 999;
  catalog[2].description = 'Changed catalog';
  assert.equal(saved.additionalFees[1].unitPrice, 200);
  assert.equal(saved.additionalFees[1].description, lines[1].description);
});

test('fixed fee cannot accept a different price even with a stale maximum', () => {
  const fees = browser('Shared/additional-fees.js').window.GMAdditionalFees;
  assert.throws(() => fees.selectedPrice({ price: 200, maxPrice: 500, pricingType: 'fixed' }, 300));
  assert.equal(fees.selectedPrice({ price: 200, maxPrice: 500, pricingType: 'fixed' }, 200), 200);
});

test('fee import matches names ignoring case and extra whitespace', () => {
  const { plan } = require('./import-fee-catalog.cjs');
  const rows = plan([{ id: 'original', data: { name: '  medication   FEE ', createdAt: '2020-01-01' } }]);
  const row = rows.find(item => item.data.name === 'Medication Fee');
  assert.equal(row.id, 'original');
  assert.equal(row.data.createdAt, '2020-01-01');
});


test('missing legacy service dropdown does not stop patient initialization', () => {
  const source = fs.readFileSync(path.join(__dirname, '../Patient/patient.js'), 'utf8');
  const start = source.indexOf('function populateServiceDropdown()');
  const end = source.indexOf('\n}', start) + 2;
  const context = { document: { getElementById: () => null } };
  vm.runInNewContext(source.slice(start, end), context);
  assert.doesNotThrow(() => context.populateServiceDropdown());
});

for (const existsOnServer of [true, false]) {
  test(`appointment conflict preserves draft and unrelated edits (server copy: ${existsOnServer})`, async () => {
    let puts = 0;
    const saved = { id: 'conflict', time: '09:00', status: 'Approved' };
    const c = browser('Shared/shared-supabase-sync.js', async (url, options = {}) => {
      if (options.method === 'PUT') {
        puts++;
        if (puts === 1) return { ok: false, status: 409, json: async () => ({ code: '23P01', appointmentId: 'conflict', message: 'Overlap' }) };
        return { ok: true, json: async () => ({ db: JSON.parse(options.body).db }) };
      }
      return { ok: true, json: async () => ({ db: { appointments: existsOnServer ? [saved] : [] } }) };
    });
    const rejected = { id: 'conflict', time: '10:00', status: 'Approved' };
    c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [rejected, { id: 'keep' }], patients: [{ id: 'unsaved-patient' }] }));
    c.localStorage.setItem('appointments', JSON.stringify([rejected]));
    c.localStorage.setItem('archivedAppointments', JSON.stringify([rejected]));
    assert.equal(await c.window.GmDentalSupabaseSync.flushNow(), false);
    const db = JSON.parse(c.localStorage.getItem('gm_dental_db_v1'));
    assert.equal(db.patients[0].id, 'unsaved-patient');
    assert.ok(db.appointments.some(a => a.id === 'keep'));
    assert.equal(db.appointments.find(a => a.id === 'conflict')?.time, existsOnServer ? '09:00' : undefined);
    const drafts = JSON.parse(c.localStorage.getItem('gm_dental_sync_conflict_drafts'));
    assert.equal(drafts[0].data.time, '10:00');
    assert.ok(!c.localStorage.getItem('appointments').includes('10:00'));
    assert.ok(!c.localStorage.getItem('archivedAppointments').includes('10:00'));
    c.Date = class extends Date { static now() { return Date.now() + 3000; } };
    assert.equal(await c.window.GmDentalSupabaseSync.flushNow(), true);
    assert.equal(puts, 2);
  });
}

test('unidentified conflict pauses repeated writes without clearing local data', async () => {
  let calls = 0;
  const c = browser('Shared/shared-supabase-sync.js', async () => {
    calls++; return { ok: false, status: 409, json: async () => ({ message: 'Conflict' }) };
  });
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{ id: 'unsaved' }] }));
  await c.window.GmDentalSupabaseSync.flushNow();
  for (let i = 0; i < 5; i++) await c.window.GmDentalSupabaseSync.pull();
  assert.equal(calls, 1);
  assert.ok(c.localStorage.getItem('gm_dental_db_v1').includes('unsaved'));
  assert.ok(c.localStorage.getItem('gm_dental_sync_conflict_drafts').includes('unsaved'));
});

test('different conflicting appointments cannot produce an endless snapshot retry loop', async () => {
  let puts = 0, now = Date.now();
  const c = browser('Shared/shared-supabase-sync.js', async (_url, options = {}) => {
    if (options.method === 'PUT') {
      puts++;
      return { ok: false, status: 409, json: async () => ({ appointmentId: puts === 1 ? 'a' : 'b', message: 'Concurrent save' }) };
    }
    return { ok: true, json: async () => ({ db: { appointments: [{ id: 'a' }, { id: 'b' }] } }) };
  });
  c.Date = class extends Date { static now() { return now; } };
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{ id: 'a', notes: 'draft a' }, { id: 'b', notes: 'draft b' }] }));
  await c.window.GmDentalSupabaseSync.flushNow();
  now += 60000;
  await c.window.GmDentalSupabaseSync.flushNow();
  now += 60000;
  for (let i = 0; i < 5; i++) await c.window.GmDentalSupabaseSync.pull();
  assert.equal(puts, 2);
  assert.equal(c.localStorage.getItem('gm_dental_sync_conflict_paused'), 'true');
  assert.equal(JSON.parse(c.localStorage.getItem('gm_dental_sync_conflict_drafts')).length, 2);
});

test('edits during conflict recovery cannot retry the same appointment indefinitely', async () => {
  let puts = 0, reads = 0, now = Date.now();
  let c;
  c = browser('Shared/shared-supabase-sync.js', async (_url, options = {}) => {
    if (options.method === 'PUT') {
      puts++;
      return { ok: false, status: 409, json: async () => ({ appointmentId: 'a', message: 'Conflict' }) };
    }
    reads++;
    c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{ id: 'a', notes: 'New edit' }] }));
    return { ok: true, json: async () => ({ db: { appointments: [{ id: 'a', notes: 'Server' }] } }) };
  });
  c.Date = class extends Date { static now() { return now; } };
  c.localStorage.setItem('gm_dental_db_v1', JSON.stringify({ appointments: [{ id: 'a', notes: 'First edit' }] }));
  assert.equal(await c.window.GmDentalSupabaseSync.flushNow(), false);
  await c.window.GmDentalSupabaseSync.pull();
  assert.equal(puts, 1, 'recovery retains retry backoff');
  now += 3000;
  await c.window.GmDentalSupabaseSync.flushNow();
  now += 60000;
  for (let i = 0; i < 5; i++) await c.window.GmDentalSupabaseSync.pull();
  assert.equal(puts, 2);
  assert.equal(reads, 1);
  assert.ok(c.localStorage.getItem('gm_dental_db_v1').includes('New edit'));
  const drafts = JSON.parse(c.localStorage.getItem('gm_dental_sync_conflict_drafts'));
  assert.equal(drafts[0].data.notes, 'First edit');
  assert.equal(drafts[1].data.notes, 'New edit');
});
