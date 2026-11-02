const test = require('node:test');
const assert = require('node:assert/strict');
const { preservePaymentState } = require('../api/_payment-state');
test('stale snapshots cannot reopen an approved receipt or undo its credit', () => {
  const saved = { totalCollected: 500, remainingBalance: 0, paymentStatus: 'Paid', services: [{ totalPaid: 500 }], paymentProofs: [{ id: 'p', status: 'verified', reviewedAt: 'now' }] };
  for (const proofs of [[], [{ id: 'p', status: 'pending' }]]) {
    const result = preservePaymentState({ date: '2026-10-08', totalCollected: 0, remainingBalance: 500, paymentProofs: proofs }, saved);
    assert.equal(result.paymentProofs[0].status, 'verified');
    assert.equal(result.totalCollected, 500);
    assert.equal(result.remainingBalance, 0);
    assert.equal(result.date, '2026-10-08');
  }
});
test('current snapshots may add subsequent payments while keeping previous reviews', () => {
  const saved = { paymentProofs: [{ id: 'p', status: 'verified', reviewedAt: 'now' }] };
  const incoming = { totalCollected: 700, paymentProofs: [...saved.paymentProofs, { id: 'next', status: 'pending' }] };
  assert.equal(preservePaymentState(incoming, saved), incoming);
});
test('rejected requests also cannot reappear as pending', () => {
  const result = preservePaymentState({ paymentProofs: [{ id: 'p', status: 'pending' }] }, { paymentProofs: [{ id: 'p', status: 'rejected', reviewedAt: 'now' }], totalCollected: 0 });
  assert.equal(result.paymentProofs[0].status, 'rejected');
  assert.equal(result.totalCollected, 0);
});


test('bulk settlement is preserved when an old browser sends unpaid balances', () => {
 const {preservePaymentState}=require('../api/_payment-state');
 const saved={billingSettlement:{id:'bulk'},totalCollected:500,paid:500,remainingBalance:0,paymentStatus:'Paid'};
 const result=preservePaymentState({totalCollected:0,remainingBalance:500},saved);
 assert.equal(result.totalCollected,500);
 assert.equal(result.paymentStatus,'Paid');
});
