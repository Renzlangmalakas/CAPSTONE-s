const test = require('node:test');
const assert = require('node:assert/strict');
const { validateCashReview } = require('../api/_cash-payments');
const proof = { id: 'cash', method: 'cash', status: 'pending', amount: 100 };
const saved = { id: 'a', totalCollected: 0, remainingBalance: 100, paymentProofs: [proof] };

test('patient can submit a pending cash request without crediting money', () => {
  assert.doesNotThrow(() => validateCashReview(saved, { id: 'a', totalCollected: 0 }, 'patient'));
  assert.doesNotThrow(() => validateCashReview(saved, saved, 'patient'));
  assert.throws(() => validateCashReview({ ...saved, totalCollected: 100 }, saved, 'patient'), { status: 403 });
});

test('only staff can review cash requests', () => {
  const reviewed = { ...saved, totalCollected: 100, paymentProofs: [{ ...proof, status: 'verified', reviewedBy: 'staff' }] };
  for (const role of ['patient', 'dentist', 'admin']) {
    assert.throws(() => validateCashReview(reviewed, saved, role), { status: 403 });
    assert.throws(() => validateCashReview({ ...saved, paymentProofs: [] }, saved, role), { status: 403 });
  }
  for (const role of ['staff']) assert.doesNotThrow(() => validateCashReview(reviewed, saved, role));
  assert.doesNotThrow(() => validateCashReview(reviewed, reviewed, 'patient'));
});
