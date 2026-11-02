const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Admin billing is read-only; covered by admin-read-only.test.js.
for (const role of ['Staff']) {
  function fixture(value) {
    const file = role === 'Admin' ? '../Admin/admin.js' : '../Staff/staff.js';
    const source = fs.readFileSync(require.resolve(file), 'utf8');
    const start = source.indexOf('function openPaymentModal(');
    const end = source.indexOf(role === 'Admin' ? 'function openRefundModal(' : 'function openPatientModal(', start);
    let click, html = '', saves = 0;
    const item = { id: 'bill', total: 500, price: 500, paid: 200, totalCollected: 200 };
    const elements = { '#paymentAmount': { value }, '#paymentMethod': { value: 'Cash' },
      '#savePaymentBtn': { addEventListener: (_, callback) => { click = callback; } } };
    const c = { state: { appointments: [item] }, qs: key => elements[key],
      safeOn: (el, event, callback) => el.addEventListener(event, callback),
      openSharedModal: (_, body) => { html = body; }, showToast() {}, closeSharedModal() {}, addNotification() {}, renderAll() {},
      afterStateChange: () => { saves++; }, saveState: () => { saves++; },
      escapeHtml: String, formatDate: String, formatTime: String, formatMoney: String };
    vm.runInNewContext(source.slice(source.indexOf("function isCancelledBill("), source.indexOf("function sortStaffBilling(")) + source.slice(start, end), c);
    c.openPaymentModal('bill');
    assert.match(html, /max="300.00"/);
    return { item, c, click: () => click(), saves: () => saves };
  }
  test(`${role} blocks payment after cancellation`, () => {
    const f = fixture('100');
    f.item.status = 'Cancelled';
    f.click();
    assert.equal(f.saves(), 0);
    assert.equal(f.item.paid, 200);
  });
  test(`${role} refuses overpayments and invalid amounts without changing billing`, () => {
    for (const amount of ['300.01', '900', 'Infinity', 'NaN', '0', '-1', '1.001']) {
      const f = fixture(amount); const before = JSON.stringify(f.item);
      f.click(); assert.equal(f.saves(), 0); assert.equal(JSON.stringify(f.item), before);
    }
  });
  test(`${role} accepts partial and exact-balance payments`, () => {
    for (const [amount, paid, status] of [['100.25', 300.25, 'Partial'], ['300', 500, 'Paid']]) {
      const f = fixture(amount); f.click(); assert.equal(f.saves(), 1);
      assert.equal(role === 'Admin' ? f.item.totalCollected : f.item.paid, paid);
      assert.equal(f.item.paymentStatus, status);
    }
  });
  test(`${role} rechecks the balance after the appointment state is replaced`, () => {
    const f = fixture('300');
    f.c.state.appointments = [{ ...f.item, paid: 450, totalCollected: 450 }];
    f.click(); assert.equal(f.saves(), 0);
    assert.equal(f.c.state.appointments[0].paid, 450);
  });
}
