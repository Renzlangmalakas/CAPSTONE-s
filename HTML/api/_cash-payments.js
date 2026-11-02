const { sameRecord } = require('./_sync-records');

function validateCashReview(incoming, existing, role) {
  if (role === 'staff') return;
  for (const proof of incoming.paymentProofs || []) {
    if (proof.method !== 'cash') continue;
    const saved = (existing?.paymentProofs || []).find(p => p.id === proof.id);
    if (sameRecord(proof, saved) && proof.status !== 'pending') continue;
    const unchangedPending = sameRecord(proof, saved);
    if ((!unchangedPending && saved) || proof.status !== 'pending' || proof.reviewedAt || proof.reviewedBy) {
      const error = new Error('Only Staff can approve or reject cash payments.');
      error.status = 403;
      throw error;
    }
    for (const field of ['amountPaidInClinic', 'totalCollected', 'amountPaid']) {
      if (Number(incoming[field] || 0) !== Number(existing?.[field] || 0)) {
        const error = new Error('Cash payments must be approved before crediting the balance.');
        error.status = 403;
        throw error;
      }
    }
  }
  for (const saved of existing?.paymentProofs || []) {
    if (saved.method === 'cash' && !(incoming.paymentProofs || []).some(p => sameRecord(p, saved))) {
      const error = new Error('Only Staff can change a submitted cash payment.');
      error.status = 403;
      throw error;
    }
  }
}

function createCashReviewHandler({ supabase }) {
  const tables = { appointments: 'clinic_appointments', treatmentPlans: 'clinic_treatment_plans' };
  return async (req, res) => {
    if (req.user.role !== 'staff') return res.status(403).json({ message: 'Only Staff can review cash payments.' });
    const { collection, recordId, proofId, action, reason, confirmed } = req.body || {};
    if (!tables[collection] || !recordId || !proofId || !['approve', 'reject'].includes(action)) return res.status(400).json({ message: 'A valid payment review is required.' });
    if (action === 'approve' && confirmed !== true) return res.status(400).json({ message: 'Confirm cash was received first.' });
    if (action === 'reject' && (typeof reason !== 'string' || !reason.trim() || reason.length > 250)) return res.status(400).json({ message: 'Enter a rejection reason of up to 250 characters.' });
    if (!supabase) return res.status(503).json({ message: 'The clinic database is not configured.' });
    try {
      const { data: row, error } = await supabase.from(tables[collection]).select('id,data,updated_at').eq('id', recordId).maybeSingle();
      if (error) throw error;
      if (!row) return res.status(404).json({ message: 'Payment record not found on the server. Wait for the submission to sync.' });
      const record = { ...row.data, id: row.id };
      const proof = (record.paymentProofs || []).find(p => p.id === proofId);
      if (!proof || proof.method !== 'cash') return res.status(400).json({ message: 'Cash request not found.' });
      const target = action === 'approve' ? 'verified' : 'rejected';
      if (proof.status === target) return res.status(304).end();
      if (proof.status !== 'pending') return res.status(409).json({ message: 'This payment has already been reviewed.' });
      let updated;
      if (action === 'approve') {
        try { updated = require('../Shared/payment-receipts').approve(record, proofId, req.user.email); }
        catch (error) { return res.status(409).json({ message: error.message }); }
      } else {
        updated = structuredClone(record);
        const now = new Date().toISOString();
        Object.assign(updated.paymentProofs.find(p => p.id === proofId), { status: 'rejected', rejectionReason: reason.trim(), reviewedAt: now, reviewedBy: req.user.email });
        updated.paymentStatus = Number(updated.remainingBalance) <= 0 ? 'Paid' : Number(updated.amountPaid ?? updated.totalCollected ?? 0) > 0 ? 'Partial' : 'Unpaid';
        updated.updatedAt = now;
      }
      let query = supabase.from(tables[collection]).update({ data: updated, updated_at: updated.updatedAt }).eq('id', row.id);
      query = row.updated_at ? query.eq('updated_at', row.updated_at) : query.is('updated_at', null);
      const { data: saved, error: saveError } = await query.select('data').maybeSingle();
      if (saveError) throw saveError;
      if (!saved) return res.status(409).json({ message: 'The bill changed while saving. Refresh and review it again.' });
      return res.json({ record: saved.data });
    } catch (error) {
      console.error('Cash review failed:', error.message);
      return res.status(500).json({ message: 'Could not save the payment review. Please try again.' });
    }
  };
}

module.exports = { validateCashReview, createCashReviewHandler };
