const test = require('node:test');
const assert = require('node:assert/strict');
const fees = require('../Shared/additional-fees');
const { validateDiscount } = require('../api/_discounts');

test('server checks discount authority, dentist identity and unpaid balance', () => {
  const dentists = [{ id: 'd1', name: 'Dr. Example' }];
  const record = { serviceTotal: 500, additionalFees: [], discount: { amount: 100, dentistId: 'd1', dentistName: 'Untrusted' } };
  assert.throws(() => validateDiscount(record, {}, 'patient', dentists));
  assert.throws(() => validateDiscount(record, { totalCollected: 450 }, 'staff', dentists));
  assert.throws(() => validateDiscount(record, {}, 'staff', []));
  validateDiscount(record, { totalCollected: 50 }, 'staff', dentists);
  assert.equal(record.discount.dentistName, 'Dr. Example');
});

test('discount reduces fees-inclusive bill and preserves granting dentist', () => {
  const appointment = { serviceTotal: 500, paid: 50, total: 500,
    discount: { amount: 100, dentistId: 'd1', dentistName: 'Dr. Example' } };
  const lines = [{ feeName: 'Laboratory', quantity: 1, unitPrice: 500 }];
  fees.attachToAppointment(appointment, lines);
  assert.equal(appointment.total, 900);
  assert.equal(appointment.remainingBalance, 850);
  assert.equal(appointment.discount.dentistName, 'Dr. Example');
  fees.attachToAppointment(appointment, lines);
  assert.equal(appointment.total, 900);
});

test('removing discount restores gross total and fully discounted bill is paid', () => {
  const appointment = { serviceTotal: 500, discount: { amount: 500 } };
  fees.attachToAppointment(appointment, []);
  assert.equal(appointment.remainingBalance, 0);
  assert.equal(appointment.paymentStatus, 'Paid');
  appointment.discount = null;
  fees.attachToAppointment(appointment, []);
  assert.equal(appointment.price, 500);
  assert.equal(appointment.paymentStatus, 'Unpaid');
});
