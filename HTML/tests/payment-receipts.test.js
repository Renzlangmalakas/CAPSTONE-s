const test = require('node:test');
const assert = require('node:assert/strict');
const receipts = require('../Shared/payment-receipts');

test('focused recipient OCR completes the actual receipt checks without bypassing amount or reference checks', () => {
  const receipt = { ...proof(), amount: 50, reference: '5045833972749', ocrConfidence: 82,
    ocrText: 'XAeeeR [OeeeZ Z.\n+63 947 551 8396\nSent via GCash\nAmount 50.00\nRef No. 5045 833 972749\nRecipient Name: XA***R LO***ZZ.' };
  assert.equal(receipts.assess(receipt, 50).status, 'passed');
  assert.equal(receipts.assess(receipt, 100).status, 'suspicious');
  assert.equal(receipts.assess({ ...receipt, reference: '1111111111111' }, 50).status, 'suspicious');
  assert.equal(receipts.assess({ ...receipt, ocrText: receipt.ocrText.replace('Recipient Name: XA***R LO***ZZ.', 'Recipient Name: XA***R LO***ZY.') }, 50).status, 'suspicious');
});

test('configured GCash recipient matches masking and spacing variants without changing visible letters', () => {
  assert.equal(receipts.clinicRecipientName, 'XA•••R LO•••ZZ.');
  for (const name of ['XA•••R LO•••ZZ.', 'XA***R LO***ZZ.', 'XA***R LO***Z Z.']) {
    const candidate = { ...proof(), ocrText: proof().ocrText.replace('XA***R LO***Z Z.', name) };
    assert.deepEqual(receipts.compare(candidate).map(check => check.status), ['matched', 'matched', 'matched']);
    assert.equal(receipts.assess(candidate, 200).status, 'passed');
  }
  for (const name of ['XA***R LO***ZY.', 'XB***R LO***ZZ.', 'XA**R LO***ZZ.']) {
    const candidate = { ...proof(), ocrText: proof().ocrText.replace('XA***R LO***Z Z.', name) };
    assert.equal(receipts.compare(candidate)[2].status, 'mismatch');
  }
});
global.GMAdditionalFees = { paymentSummary: row => ({ paid: row.additionalFeesPaid || 0, remaining: 200 - (row.additionalFeesPaid || 0) }) };
const proof = () => ({ id: 'proof', reference: '1234567890123', image: 'data:image/jpeg;base64,AA', amount: 200, ocrStatus: 'read', ocrText: 'GCash Successfully sent\nAmount Sent PHP 200.00\nRef. No. 1234567890123\nSent to\nXA***R LO***Z Z.', balanceAtSubmission: 200, status: 'pending', allocations: [{ isAdditionalFee: true, amount: 200 }] });

test('cash submission remains pending without crediting money and rejects duplicate requests', () => {
  const record = { price: 200, totalCollected: 0, remainingBalance: 200 };
  const request = { ...proof(), method: 'cash' };
  const pending = receipts.submitCash(record, request);
  assert.equal(pending.paymentStatus, 'Pending');
  assert.equal(pending.totalCollected, 0);
  assert.equal(pending.remainingBalance, 200);
  assert.equal(pending.amountPaidInClinic, undefined);
  assert.equal(record.paymentProofs, undefined);
  assert.throws(() => receipts.submitCash(pending, request), /awaiting review/);
  assert.throws(() => receipts.submitCash(record, { ...request, amount: 201 }), /valid cash amount/);
});

test('cash approval credits clinic revenue once and produces paid or partial status', () => {
  for (const amount of [100, 200]) {
    const pending = receipts.submitCash({ price: 200, totalCollected: 0, remainingBalance: 200 },
      { ...proof(), amount, method: 'cash', allocations: [{ isAdditionalFee: true, amount }] });
    const approved = receipts.approve(pending, 'proof', 'staff@example.com');
    assert.equal(approved.totalCollected, amount);
    assert.equal(approved.amountPaidInClinic, amount);
    assert.equal(approved.amountPaidOnline, undefined);
    assert.equal(approved.paymentStatus, amount === 200 ? 'Paid' : 'Partial');
    assert.equal(approved.paymentProofs[0].reviewedBy, 'staff@example.com');
    assert.throws(() => receipts.approve(approved, 'proof', 'admin@example.com'), /no longer pending/);
  }
});

test('cash approval preserves treatment installment accounting', () => {
  const pending = receipts.submitCash({ totalCost: 1000, amountPaid: 200, totalCollected: 200, remainingBalance: 800, amountPaidOnline: 200 },
    { id: 'cash', amount: 300, balanceAtSubmission: 800, services: [{ requiredDownpayment: 100 }], allocations: [{ amount: 300 }] });
  const approved = receipts.approve(pending, 'cash', 'admin@example.com');
  assert.equal(approved.amountPaid, 500);
  assert.equal(approved.remainingBalance, 500);
  assert.equal(approved.amountPaidInClinic, 300);
  assert.equal(approved.amountPaidOnline, 200);
  assert.equal(approved.paymentStatus, 'Partial');
});
test('OCR extracts GCash reference and amount', () => {
  assert.deepEqual(receipts.parse('Amount Sent PHP 1,250.00\nRef. No. 1234 567 890123'), { amount: 1250, reference: '1234567890123' });
  assert.deepEqual(receipts.parse('unreadable receipt'), { amount: null, reference: '' });
});

test('receipt screening distinguishes consistent, suspicious and unreadable receipts', () => {
  const readable = { ...proof(), ocrConfidence: 95 };
  assert.equal(receipts.assess(readable, 200).status, 'passed');
  assert.equal(receipts.assess({ ...readable, reference: '9999999999999' }, 200).status, 'suspicious');
  assert.equal(receipts.assess({ ...readable, amount: 300 }, 300).status, 'suspicious');
  assert.equal(receipts.assess(readable, 300).status, 'suspicious');
  assert.equal(receipts.assess({ ...readable, ocrText: readable.ocrText + '\nFailed' }, 200).status, 'suspicious');
  assert.equal(receipts.assess({ ...proof(), ocrText: '' }, 200).status, 'unverifiable');
  assert.equal(receipts.assess({ ...readable, ocrConfidence: 40 }, 200).status, 'unverifiable');
  assert.equal(receipts.assess({ ...readable, ocrText: 'Random image' }, 200).status, 'unverifiable');
  const db = { appointments: [{ paymentProofs: [readable] }] };
  assert.equal(receipts.assess(readable, 200, db).status, 'passed');
  assert.equal(receipts.assess({ ...readable, id: 'other' }, 200, db).status, 'suspicious');
  assert.equal(receipts.assess({ ...readable, id: undefined }, 200, db).status, 'suspicious');
});

test('recipient extraction uses recipient labels and preserves masked names', () => {
  assert.equal(receipts.parseRecipient('Sent to\nXA***R LO***Z Z.'), 'XA***R LO***Z Z');
  assert.equal(receipts.parseRecipient('Recipient Name: Maria Santos'), 'MARIA SANTOS');
  assert.equal(receipts.parseRecipient('Sender: Maria Santos'), null);
  assert.equal(receipts.parseRecipient('Sent to\nAmount Sent PHP 200.00'), null);
  assert.equal(receipts.parseRecipient('To: Maria Santos\nTo: Another Person'), null);
  assert.equal(receipts.compare({ ...proof(), recipientName: '  xa***r   lo***z z ' })[2].status, 'matched');
  assert.equal(receipts.compare({ ...proof(), recipientName: 'Different Person' })[2].status, 'matched');
});

test('automatic comparison requires reference, amount and the configured clinic recipient to match', () => {
  assert.deepEqual(receipts.compare(proof()).map(c => c.status), ['matched', 'matched', 'matched']);
  for (const change of [{ reference: '9999999999999' }, { amount: 201 }, { ocrText: proof().ocrText.replace('XA***R LO***Z Z.', 'MA***A SA***S') }, { ocrText: proof().ocrText.replace('XA***R LO***Z Z.', '') }, { ocrStatus: 'unavailable' }, { ocrText: '' }]) {
    assert.throws(() => receipts.validate({ ...proof(), ...change }, 200, {}), /must all match/);
  }
  assert.equal(receipts.assess({ ...proof(), ocrText: proof().ocrText.replace('XA***R LO***Z Z.', 'MA***A SA***S'), recipientName: 'MA***A SA***S' }, 200).status, 'suspicious');
});
test('submission rejects missing proof, amount mismatches and reused references', () => {
  assert.throws(() => receipts.validate(null, 200, {}));
  assert.throws(() => receipts.validate(proof(), 201, {}));
  assert.throws(() => receipts.validate(proof(), 200, { treatmentPlans: [{ paymentProofs: [proof()] }] }));
  assert.doesNotThrow(() => receipts.validate(proof(), 200, {}));
});
test('staff approval credits fee-only receipt exactly once without changing service payment', () => {
  const original = { price: 1200, totalCollected: 1000, amountPaidOnline: 1000, services: [{ serviceName: 'Cleaning', price: 1000, totalPaid: 1000 }], paymentProofs: [proof()] };
  const saved = receipts.approve(original, 'proof', 'staff');
  assert.equal(original.totalCollected, 1000);
  assert.equal(saved.totalCollected, 1200);
  assert.equal(saved.additionalFeesPaid, 200);
  assert.equal(saved.services[0].totalPaid, 1000);
  assert.equal(saved.paymentStatus, 'Paid');
  assert.equal(saved.paymentProofs[0].reviewedBy, 'staff');
  assert.throws(() => receipts.approve(saved, 'proof', 'staff'));
});
test('changed balances and rejected receipts cannot be credited', () => {
  assert.throws(() => receipts.approve({ price: 1200, totalCollected: 1100, paymentProofs: [proof()] }, 'proof', 'staff'));
  assert.throws(() => receipts.approve({ price: 200, paymentProofs: [{ ...proof(), status: 'rejected' }] }, 'proof', 'staff'));
});
test('service downpayment and treatment installments retain balances', () => {
  const p = { ...proof(), amount: 100, balanceAtSubmission: 1000, allocations: [{ serviceIndex: 0, serviceName: 'Cleaning', amount: 100, paymentMode: 'downpayment' }] };
  const saved = receipts.approve({ price: 1000, services: [{ serviceName: 'Cleaning', price: 1000, totalPaid: 0, requiredDownpayment: 100 }], paymentProofs: [p] }, 'proof', 'staff');
  assert.equal(saved.services[0].paidDownpayment, 100);
  assert.equal(saved.services[0].remainingBalance, 900);
  assert.equal(saved.remainingBalance, 900);
  const plan = receipts.approve({ totalCost: 1000, amountPaid: 0, paymentProofs: [{ ...p, services: [{ requiredDownpayment: 100 }] }] }, 'proof', 'staff');
  assert.equal(plan.amountPaid, 100);
  assert.equal(plan.remainingBalance, 900);
});

test('unlabelled masked GCash recipient is checked against the clinic', () => {
  const receipt = { ...proof(), ocrText: proof().ocrText.replace('Sent to\n', '') + '\n09475518396' };
  assert.equal(receipts.compare(receipt)[2].status, 'matched');
  assert.equal(receipts.compare({ ...receipt, ocrText: receipt.ocrText.replace('XA***R LO***Z Z.', 'MA***A SA***S') })[2].status, 'mismatch');
});


test('automatic review credits matches once and records rejected attempts without credit', () => {
  const record = { price: 200, totalCollected: 0 };
  const accepted = receipts.autoReview(record, proof(), 200, {});
  assert.equal(accepted.totalCollected, 200);
  assert.equal(accepted.paymentProofs[0].reviewedBy, 'system:ocr');
  assert.equal(accepted.paymentProofs[0].status, 'verified');
  assert.throws(() => receipts.autoReview(record, { ...proof(), amount: 201 }, 200, {}), /matching payment amount/);
  for (const change of [{ reference: '999999999' }, { ocrText: proof().ocrText.replace('XA***R LO***Z Z.', 'Someone Else') }, { ocrText: proof().ocrText + '\nFailed' }]) {
    const rejected = receipts.autoReview(record, { ...proof(), ...change }, 200, {});
    assert.equal(rejected.totalCollected, 0);
    assert.equal(rejected.paymentProofs[0].status, 'rejected');
    assert.ok(rejected.paymentProofs[0].rejectionReason);
  }
  const duplicate = receipts.autoReview(record, { ...proof(), id: 'new' }, 200, { appointments: [accepted] });
  assert.equal(duplicate.paymentProofs[0].status, 'rejected');
  assert.equal(record.paymentProofs, undefined);
});

test('uncertain OCR requires a corrected upload without crediting the bill', () => {
  const record = { price: 200, totalCollected: 0 };
  for (const change of [{ ocrConfidence: 30 }, { ocrStatus: 'unavailable' }, { ocrText: '' }]) {
    const result = receipts.autoReview(record, { ...proof(), ...change }, 200, {});
    assert.equal(result.paymentProofs[0].status, 'rejected');
    assert.equal(result.totalCollected, 0);
    assert.ok(result.paymentProofs[0].rejectionReason);
  }
});

test('actual October 6 GCash OCR matches 50 pesos and reference despite unreadable masking', () => {
  const ocrText = 'XAeeeR [OeeeZ Z.\n+63 947 551 8396\nSent via GCash\nAmount 50.00\nTotal Amount Sent £50.00\nRef No. 5045 833 972749\nOct 06,2026 7:13 PM';
  const submission = { ...proof(), amount: 50, reference: '5045833972749', ocrConfidence: 82, ocrText, balanceAtSubmission: 200, allocations: [{ isAdditionalFee: true, amount: 50 }] };
  const record = { price: 200, totalCollected: 0 };
  const result = receipts.autoReview(record, submission, 50, {});
  assert.deepEqual(receipts.parse(ocrText), { amount: 50, reference: '5045833972749' });
  assert.equal(result.paymentProofs[0].status, 'rejected');
  assert.equal(result.totalCollected, 0);
  assert.throws(() => receipts.approve(result, 'proof', 'staff'), /no longer pending/);
  const duplicate = receipts.autoReview(record, { ...submission, id: 'other' }, 50, { appointments: [result] });
  assert.equal(duplicate.paymentProofs[0].status, 'rejected');
});

test('example Express Send layout extracts receipt fields, ignoring the reward amount', () => {
  const text = 'Express Send\nXA\u2022\u2022\u2022R LO\u2022\u2022\u2022Z Z.\n+63 947 551 8396\nSent via GCash\nAmount 1.00\nTotal Amount Sent \u20b11.00\nRef No. 4045 372 829081\nSep 23, 2026 11:51 PM\nCongratulations!\n100';
  const sample = { ...proof(), amount: 1, reference: '4045372829081', ocrText: text };
  assert.deepEqual(receipts.compare(sample).map(c => c.status), ['matched', 'matched', 'matched']);
  assert.equal(receipts.assess(sample, 1).status, 'passed');
});
