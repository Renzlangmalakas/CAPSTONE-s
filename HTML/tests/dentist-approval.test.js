const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../Dentist/dentist_page.js'), 'utf8');
function fixture(sync) {
  let appointment = { id: 'visit', status: 'Pending', visitStatus: 'Pending', patient: 'Test', service: 'Consultation' };
  const messages = [];
  const context = {
    getAppointments: () => [appointment], normalizeAppointmentStatus: value => value,
    normalizeAppointmentFinancials: value => ({ ...value, status: value.visitStatus || value.status }),
    hasAppointmentConflict: () => false,
    updateDentistAppointment: (id, update) => appointment = context.normalizeAppointmentFinancials(update(appointment)),
    pushPatientNotification() {}, pushDentistNotification() {}, refreshDentistUI() {},
    showToast: message => messages.push(message),
    window: { GmDentalSupabaseSync: { flushNow: sync } }
  };
  vm.runInNewContext(source.slice(source.indexOf('async function approveAppointment('), source.indexOf('function canUseDentistActiveAppointmentActions')), context);
  return { context, messages, appointment: () => appointment };
}
test('approval updates both statuses and waits for server confirmation', async () => {
  let finish;
  const f = fixture(() => new Promise(resolve => { finish = resolve; }));
  const pending = f.context.approveAppointment('visit');
  assert.equal(f.appointment().status, 'Approved');
  assert.equal(f.appointment().visitStatus, 'Approved');
  assert.equal(f.appointment().invoiceUnlocked, true);
  assert.deepEqual(f.messages, []);
  finish(true);
  await pending;
  assert.deepEqual(f.messages, ['Appointment approved.']);
});
test('failed sync never reports approval success', async () => {
  for (const sync of [async () => false, async () => { throw Error('offline'); }]) {
    const f = fixture(sync);
    await f.context.approveAppointment('visit');
    assert.equal(f.appointment().visitStatus, 'Approved');
    assert.equal(f.messages.includes('Appointment approved.'), false);
    assert.match(f.messages[0], /sync/);
  }
});
