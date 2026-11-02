// Reviewed proofs and their accounting must never be rolled back by stale tabs.
function preservePaymentState(incoming, saved) {
  if (!saved) return incoming;
  const reviewed = (saved.paymentProofs || []).filter(p => ['verified', 'rejected'].includes(p.status));
  const stale = (saved.billingSettlement && incoming.billingSettlement?.id !== saved.billingSettlement.id) || reviewed.some(p => {
    const candidate = (incoming.paymentProofs || []).find(q => q.id === p.id);
    return !candidate || candidate.status !== p.status || candidate.reviewedAt !== p.reviewedAt;
  });
  if (!stale) return incoming;
  const next = { ...incoming };
  for (const field of ['billingSettlement', 'paymentProofs', 'services', 'totalCollected', 'paid', 'amountPaid', 'amountPaidInClinic', 'amountPaidOnline', 'remainingBalance', 'paymentStatus', 'paymentMethod', 'downPayment', 'additionalFeesPaid']) {
    if (Object.hasOwn(saved, field)) next[field] = structuredClone(saved[field]);
    else delete next[field];
  }
  return next;
}
module.exports = { preservePaymentState };
