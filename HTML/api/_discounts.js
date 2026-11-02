function validateDiscount(record, saved, role, dentists) {
  const discount = record.discount || null;
  if (JSON.stringify(discount) === JSON.stringify(saved?.discount || null)) return;
  if (!['staff', 'dentist'].includes(role)) throw new Error('Only clinic staff or dentists can change discounts.');
  if (!discount) return;
  const value = Number(discount.amount);
  const dentist = dentists.find(item => String(item.id) === String(discount.dentistId) && !item.archived);
  const gross = Number(record.serviceTotal) + (record.additionalFees || []).reduce((sum, fee) => sum + Number(fee.quantity) * Number(fee.unitPrice), 0);
  const paid = Number(saved?.totalCollected ?? saved?.paid ?? 0);
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(gross) || value > gross - paid || !dentist) {
    throw new Error('Choose a valid granting dentist and a discount within the unpaid bill amount.');
  }
  record.discount = { amount: Math.round(value * 100) / 100, dentistId: dentist.id,
    dentistName: dentist.name, reason: String(discount.reason || '').slice(0, 300), recordedAt: discount.recordedAt || new Date().toISOString() };
}
module.exports = { validateDiscount };
