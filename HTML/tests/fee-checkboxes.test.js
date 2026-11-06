const test = require('node:test');
const assert = require('node:assert/strict');
const fees = require('../Shared/additional-fees');
function row(fee, quantity, price, checked = true) {
  const inputs = { '[data-fee-check]': { checked }, '[data-fee-quantity]': { value: quantity }, '[data-fee-price]': { value: price } };
  return { dataset: { feeChoice: fee.id }, querySelector: key => inputs[key], querySelectorAll: () => [inputs['[data-fee-quantity]'], inputs['[data-fee-price]']] };
}
test('checked fees add together, merge existing quantities, skip unchecked fees and update billing', () => {
  const catalog = fees.defaultCatalog();
  const rows = [row(catalog[0], '2', '300'), row(catalog[1], '1', '500'), row(catalog[2], '1', '300', false)];
  const selected = [{ additionalFeeId: catalog[0].id, quantity: 1, unitPrice: 300 }];
  fees.addCheckedFees({ querySelectorAll: () => rows }, selected);
  assert.equal(selected.length, 2);
  assert.equal(selected[0].quantity, 3);
  assert.equal(fees.calculate(selected).total, 1400);
  assert.equal(rows[0].querySelector('[data-fee-check]').checked, false);
  const bill = { serviceTotal: 1000, discount: { amount: 100 }, paid: 200 };
  fees.attachToAppointment(bill, selected);
  assert.equal(bill.grandTotal, 2300);
  assert.equal(bill.remainingBalance, 2100);
});
test('invalid quantity or price rejects the whole batch without partial additions', () => {
  const catalog = fees.defaultCatalog();
  for (const invalid of [row(catalog[1], '0', '100'), row(catalog[1], '1', '999')]) {
    const selected = [];
    const rows = [row(catalog[0], '1', '300'), invalid];
    assert.throws(() => fees.addCheckedFees({ querySelectorAll: () => rows }, selected));
    assert.deepEqual(selected, []);
    assert.equal(rows[0].querySelector('[data-fee-check]').checked, true);
  }
});
test('empty selection is rejected and catalog names are HTML escaped', () => {
  assert.throws(() => fees.addCheckedFees({ querySelectorAll: () => [] }, []), /Check at least one/);
  const html = fees.checkboxPickerHtml([{ ...fees.defaultCatalog()[0], name: '<script>bad</script>' }]);
  assert.ok(html.includes('type="checkbox"'));
  assert.ok(!html.includes('<script>'));
});
