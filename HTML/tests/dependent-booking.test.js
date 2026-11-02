const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../Patient/patient.js'), 'utf8');
function setup(main, dependents) {
  const context = vm.createContext({ selectedBookingServices: main, bookingDependents: dependents,
    selectedDentistObj: { id: 'dentist' }, BookingTime: require('../Shared/booking-time') });
  for (const name of ['getBookingServices', 'getSelectedServicesTotalPrice', 'selectedBookingDuration', 'isStep1Complete']) {
    const start = source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start, source.indexOf('\n}', start) + 2), context);
  }
  return context;
}
test('dependent-only booking is schedulable and only charges their selected services', () => {
  const c = setup([], [{ id: 'child', name: 'Child', services: [{ name: 'Consultation', price: 500 }] }]);
  assert.equal(c.isStep1Complete(), true);
  assert.equal(c.getSelectedServicesTotalPrice(), 500);
  assert.equal(c.selectedBookingDuration(), 20);
  assert.equal(c.getBookingServices()[0].participantId, 'child');
  assert.equal(c.selectedBookingServices.length, 0);
});
test('same service for two people remains two separately assigned billable services', () => {
  const service = { name: 'Oral Prophylaxis', price: 1000 };
  const c = setup([service], [{ id: 'child', name: 'Child', services: [service] }]);
  assert.equal(c.getBookingServices().length, 2);
  assert.equal(c.getSelectedServicesTotalPrice(), 2000);
  assert.equal(c.selectedBookingDuration(), 90);
  assert.equal(c.getBookingServices()[0].participantId, 'main');
  assert.equal(c.getBookingServices()[1].participantId, 'child');
  c.bookingDependents = [];
  assert.equal(c.getSelectedServicesTotalPrice(), 1000);
  assert.equal(c.selectedBookingDuration(), 45);
});
test('empty booking stays locked', () => {
  assert.equal(setup([], []).isStep1Complete(), false);
});
