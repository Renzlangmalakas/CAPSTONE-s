const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const fees = require('../Shared/additional-fees');

test('staff discount loads dentists from clinic data and saves the selected dentist', () => {
  const source = fs.readFileSync(require.resolve('../Staff/staff.js'), 'utf8');
  const start = source.indexOf('function openStaffAdditionalFeeModal(');
  const end = source.indexOf('function addNotification(', start);
  const elements = new Map();
  const qs = key => {
    if (!elements.has(key)) elements.set(key, { value: '', innerHTML: '', textContent: '',
      addEventListener(event, fn) { this[event] = fn; }, querySelectorAll() { return []; } });
    return elements.get(key);
  };
  const appointment = { id: 'bill', patient: 'Test', serviceTotal: 500, total: 500, paid: 0 };
  let html = '', saves = 0;
  const c = { state: { appointments: [appointment] },
    getClinicDb: () => ({ dentists: [{ id: 'd1', name: 'Dr. Test' }, { id: 'd2', name: 'Archived Dentist', archived: true }] }),
    GMAdditionalFees: { ...fees, activeFees: () => [], bindPriceInput() {} },
    window: { GMAdditionalFees: fees }, qs, escapeHtml: String, escapeAttr: String,
    formatMoney: String, openSharedModal: (_, content) => { html = content; },
    saveState: () => saves++, closeSharedModal() {}, renderAll() {}, showToast() {} };
  vm.runInNewContext(source.slice(source.indexOf("function isCancelledBill("), source.indexOf("function sortStaffBilling(")) + source.slice(start, end), c);
  c.openStaffAdditionalFeeModal('bill');
  assert.match(html, /value="d1"[^>]*>Dr\. Test/);
  assert.doesNotMatch(html, /Archived Dentist/);
  qs('#staffDiscountAmount').value = '100';
  qs('#staffDiscountDentist').value = 'd1';
  qs('#staffPaymentReceived').value = '400';
  qs('#staffPaidMethod').value = 'Cash';
  qs('#saveStaffFeesBtn').click();
  assert.equal(saves, 1);
  assert.equal(appointment.amountPaidInClinic, 400);
  assert.equal(appointment.remainingBalance, 0);
  assert.equal(appointment.paid, 400);
  assert.equal(appointment.paymentStatus, 'Paid');
  assert.equal(appointment.discount.dentistId, 'd1');
  assert.equal(appointment.discount.dentistName, 'Dr. Test');
  assert.equal(appointment.total, 400);
});
