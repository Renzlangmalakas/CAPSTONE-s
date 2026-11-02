(function (root) {
  'use strict';
  const clinicRecipientName = 'XA\u2022\u2022\u2022R LO\u2022\u2022\u2022ZZ.';
  const money = value => Math.round(Number(value) * 100) / 100;
  const rows = db => [...(db.appointments || []), ...(db.archivedAppointments || []), ...(db.treatmentPlans || [])];
  const normalizeName = value => String(value || '').normalize('NFKC').toUpperCase().replace(/[\u2022\u25cf\u00b7]/g, '*').replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
  const recipientKey = value => normalizeName(value).replace(/\s/g, '');
  function parseRecipient(text) {
    const lines = String(text).replace(/[\u2022\u25cf\u00b7]/g, '*').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const names = new Set();
    for (let i = 0; i < lines.length; i++) {
      const label = lines[i].match(/^(?:recipient(?: name)?|receiver(?: name)?|sent to|send to|paid to|to)\b\s*:?\s*(.*)$/i);
      if (!label) {
        // GCash can show the masked recipient above its mobile number without a label.
        if (/^[\p{L} .'*\u2019-]+$/u.test(lines[i]) && lines[i].includes('*') && /\p{L}/u.test(lines[i]) && /^(?:\+?63|0)[\d *-]{8,15}$/.test(lines[i + 1] || '')) names.add(normalizeName(lines[i]));
        continue;
      }
      const name = label[1] || lines[i + 1] || '';
      if (/^[\p{L}\p{M} .'*\u2019-]+$/u.test(name) && /\p{L}/u.test(name) && !/^(amount|reference|gcash|successfully|total|ref\b)/i.test(name)) names.add(normalizeName(name));
    }
    return names.size === 1 ? [...names][0] : null;
  }
  function compare(proof) {
    const extracted = { ...parse(proof?.ocrText || ''), recipient: parseRecipient(proof?.ocrText || '') };
    const submitted = { reference: String(proof?.reference || '').replace(/[\s-]/g, ''), amount: proof?.amount, recipient: clinicRecipientName };
    return ['reference', 'amount', 'recipient'].map(field => {
      const actual = extracted[field], entered = submitted[field];
      const valid = value => field === 'amount' ? Number.isFinite(value) && value > 0 : field === 'reference' ? /^\d{8,20}$/.test(value || '') : /^[\p{L}\p{M} .'*\u2019-]+$/u.test(normalizeName(value)) && /\p{L}/u.test(normalizeName(value));
      const status = proof?.ocrStatus !== 'read' || !valid(actual) ? 'unreadable' : !valid(entered) ? 'missing' : (field === 'amount' ? money(actual) === money(entered) : field === 'recipient' ? recipientKey(actual) === recipientKey(entered) : actual === entered) ? 'matched' : 'mismatch';
      return { field, extracted: actual, submitted: entered, status };
    });
  }
  function parse(text) {
    const reference = String(text).match(/(?:reference|ref\.?)(?:\s*(?:no\.?|number))?\s*[:#.]?\s*([\d][\d \t-]{7,24})/i);
    const amount = String(text).match(/(?:total\s+amount|amount\s+sent|amount|PHP|₱)\s*[:₱]?\s*(?:PHP\s*)?([\d,]+\.\d{2})/i);
    return { reference: reference ? reference[1].replace(/\D/g, '') : '', amount: amount ? Number(amount[1].replace(/,/g, '')) : null };
  }
  function assess(proof, expectedAmount, db = {}) {
    const text = String(proof?.ocrText || '');
    const extracted = parse(text);
    const issues = [], missing = [];
    const checks = compare(proof);
    for (const check of checks) {
      if (check.status === 'mismatch') issues.push(check.field === 'recipient' ? 'The receipt recipient does not match the clinic GCash recipient.' : `Submitted ${check.field} does not match the image.`);
      if (check.status === 'missing') missing.push(`Enter the payment ${check.field}.`);
      if (check.status === 'unreadable') missing.push(`The image ${check.field} could not be read reliably.`);
    }
    if (!text.trim() || proof?.ocrStatus !== 'read') missing.push('OCR could not read this receipt.');
    if (!/\bgcash\b/i.test(text)) missing.push('GCash branding was not detected.');
    if (!/\b(sent|successful|successfully|completed)\b/i.test(text)) missing.push('A completed transfer was not detected.');
    if (/\b(failed|unsuccessful|cancelled|canceled|pending)\b/i.test(text)) issues.push('Receipt indicates an incomplete or failed transfer.');
    if (!/^\d{8,20}$/.test(extracted.reference)) missing.push('A valid reference number could not be read.');
    else if (proof.reference && extracted.reference !== proof.reference) issues.push('Entered reference does not match the receipt.');
    if (!Number.isFinite(extracted.amount) || extracted.amount <= 0) missing.push('A valid amount could not be read.');
    else {
      if (Number.isFinite(proof.amount) && money(extracted.amount) !== money(proof.amount)) issues.push('Entered amount does not match the receipt.');
      if (Number.isFinite(expectedAmount) && money(extracted.amount) !== money(expectedAmount)) issues.push('Receipt amount does not match the payment total.');
    }
    if (Number.isFinite(proof?.ocrConfidence) && proof.ocrConfidence < 70) missing.push('Image text confidence is low; upload a clearer receipt.');
    const references = [proof?.reference, extracted.reference].filter(Boolean);
    if (rows(db).some(row => (row.paymentProofs || []).some(p => (!proof?.id || p.id !== proof.id) && references.includes(p.reference) && p.status !== 'rejected'))) issues.push('This reference number has already been submitted.');
    const status = issues.length ? 'suspicious' : missing.length ? 'unverifiable' : 'passed';
    return { status, label: { suspicious: 'Suspicious receipt', unverifiable: 'Unable to verify', passed: 'Passed receipt checks' }[status], reasons: [...issues, ...missing], note: 'Receipt checks cannot prove authenticity. The clinic can confirm the transfer in its’s GCash transaction history.' };
  }
  function validate(proof, amount, db) {
    const checks = compare(proof);
    if (checks.some(check => check.status !== 'matched')) throw new Error('Receipt reference, amount and clinic recipient must all match the image. Check your entries or upload a clearer receipt.');
    if (!proof || !proof.image || !/^\d{8,20}$/.test(proof.reference)) throw new Error('Upload a receipt and enter its 8–20 digit reference number.');
    if (!Number.isFinite(proof.amount) || proof.amount <= 0 || money(proof.amount) !== money(amount)) throw new Error('Receipt amount must match the selected payment total.');
    if (rows(db).some(row => (row.paymentProofs || []).some(p => p.reference === proof.reference && p.status !== 'rejected'))) throw new Error('This reference number has already been submitted.');
  }
  function autoReview(record, submission, expectedAmount, db) {
    if (!submission?.image || !/^\d{8,20}$/.test(submission.reference || '') ||
        !Number.isFinite(submission.amount) || submission.amount <= 0 || money(submission.amount) !== money(expectedAmount)) {
      throw new Error('Upload a receipt and enter its reference number and the matching payment amount.');
    }
    const proof = { ...submission, status: 'pending' };
    const assessment = assess(proof, expectedAmount, db);
    let reason = assessment.reasons.join(' ');
    try { validate(proof, expectedAmount, db); } catch (error) { reason = reason || error.message; }
    if (assessment.status !== 'passed' && !reason) reason = 'Receipt could not be verified. Upload a clearer image.';
    proof.automaticCheck = { ...assessment, checks: compare(proof), expectedAmount };
    const next = { ...record, paymentProofs: [...(record.paymentProofs || []), proof] };
    if (!reason) {
      try { return approve(next, proof.id, 'system:ocr'); } catch (error) { reason = error.message; }
    }
    Object.assign(proof, { status: 'rejected', rejectionReason: reason, reviewedAt: new Date().toISOString(), reviewedBy: 'system:ocr' });
    return next;
  }
  function approve(record, proofId, reviewer) {
    const next = JSON.parse(JSON.stringify(record));
    const proof = (next.paymentProofs || []).find(p => p.id === proofId);
    if (!proof || proof.status !== 'pending') throw new Error('This receipt is no longer pending.');
    const cash = proof.method === 'cash';
    const total = Number(next.totalCost ?? next.price ?? next.total);
    const paid = Number(next.amountPaid ?? next.totalCollected ?? next.paid ?? 0);
    if (!Number.isFinite(total) || !Number.isFinite(paid) || money(total - paid) !== money(proof.balanceAtSubmission)) throw new Error('The balance changed since submission. Reject and request a new submission.');
    if (!Number.isFinite(proof.amount) || proof.amount <= 0 || money(proof.amount) > money(total - paid)) throw new Error('The balance changed. Reject this submission and request a corrected payment allocation.');
    if (money(proof.allocations.reduce((sum, a) => sum + a.amount, 0)) !== money(proof.amount)) throw new Error('Invalid payment allocation.');
    for (const allocation of proof.allocations) {
      if (!Number.isFinite(allocation.amount) || allocation.amount <= 0) throw new Error('Invalid allocation amount.');
      if (next.totalCost != null) continue;
      if (allocation.isAdditionalFee) {
        const fees = (root.GMAdditionalFees || require('./additional-fees')).paymentSummary(next);
        if (money(allocation.amount) > money(fees.remaining)) throw new Error('Additional fee balance changed.');
        next.additionalFeesPaid = money(fees.paid + allocation.amount);
        continue;
      }
      // Store normalized legacy services only when their original financial snapshot still matches.
      if (!next.services?.length) next.services = proof.services;
      const service = next.services?.[allocation.serviceIndex];
      if (!service || service.serviceName !== allocation.serviceName || money(allocation.amount) > money(Number(service.price) - Number(service.totalPaid || 0))) throw new Error('Service balance changed. Reject and request a new submission.');
      service.paymentMode = allocation.paymentMode;
      service.totalPaid = money(Number(service.totalPaid || 0) + allocation.amount);
      service.remainingBalance = money(Number(service.price) - service.totalPaid);
      const down = allocation.paymentMode === 'full' ? 0 : Math.min(allocation.amount, Math.max(0, Number(service.requiredDownpayment || 0) - Number(service.paidDownpayment || 0)));
      service.paidDownpayment = money(Number(service.paidDownpayment || 0) + down);
      service.additionalPayments = [...(service.additionalPayments || []), { amount: allocation.amount - down, method: cash ? 'cash' : 'gcash', source: cash ? 'clinic' : 'online', paidAt: new Date().toISOString(), note: cash ? 'Cash received and approved' : `Verified GCash ${proof.reference}` }].filter(p => p.amount > 0);
      service.paymentStatus = service.remainingBalance <= 0 ? 'Paid' : allocation.paymentMode === 'installment' ? 'Installment Ongoing' : allocation.paymentMode === 'downpayment' ? 'Downpayment Paid' : 'Partially Paid';
    }
    next.totalCollected = money(paid + proof.amount);
    next.paid = next.totalCollected;
    if (next.totalCost != null) {
      next.amountPaid = next.totalCollected;
      next.downPayment = Math.max(Number(next.downPayment || 0), Math.min(next.totalCollected, Number(proof.services?.[0]?.requiredDownpayment || 0)));
    } else next.downPayment = (next.services || []).reduce((sum, s) => sum + Number(s.paidDownpayment || 0), 0);
    const paidField = cash ? 'amountPaidInClinic' : 'amountPaidOnline';
    next[paidField] = money(Number(next[paidField] || 0) + proof.amount);
    next.remainingBalance = money(total - next.totalCollected);
    next.paymentStatus = next.remainingBalance <= 0 ? 'Paid' : 'Partial';
    next.paymentMethod = cash ? 'cash' : 'gcash';
    next.updatedAt = new Date().toISOString();
    Object.assign(proof, { status: 'verified', reviewedAt: next.updatedAt, reviewedBy: reviewer });
    return next;
  }
  function submitCash(record, submission) {
    if ((record.paymentProofs || []).some(p => p.status === 'pending')) throw new Error('A payment for this bill is already awaiting review.');
    if (!Number.isFinite(submission.amount) || submission.amount <= 0 || submission.amount > Number(record.remainingBalance)) throw new Error('Enter a valid cash amount within the remaining balance.');
    const proof = { ...submission, method: 'cash', status: 'pending', submittedAt: new Date().toISOString() };
    return { ...record, paymentProofs: [...(record.paymentProofs || []), proof], paymentStatus: 'Pending', paymentMethod: 'cash', updatedAt: proof.submittedAt };
  }
  root.GMPaymentReceipts = { clinicRecipientName, parse, parseRecipient, compare, assess, validate, approve, autoReview, submitCash };
  if (typeof module !== 'undefined') module.exports = root.GMPaymentReceipts;
})(typeof window !== 'undefined' ? window : globalThis);
