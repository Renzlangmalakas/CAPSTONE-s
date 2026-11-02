// Re-read older pending uploads with the focused recipient reader.
(function () {
  const attempted = new Set();
  let running = false;
  const key = 'gm_dental_db_v1';
  async function recheck() {
    if (running || !window.Tesseract || !window.GMReceiptRecipientOCR) return;
    if (JSON.parse(sessionStorage.getItem('gm_dental_current_user') || '{}').role !== 'staff') return;
    const db = JSON.parse(localStorage.getItem(key) || '{}');
    for (const collection of ['appointments', 'treatmentPlans']) for (const record of db[collection] || []) for (const proof of record.paymentProofs || []) {
      const id = `${collection}:${record.id}:${proof.id}`;
      if (proof.status !== 'pending' || proof.method === 'cash' || attempted.has(id) || !/^data:image\/(jpeg|png|webp);base64,/.test(proof.image || '')) continue;

      attempted.add(id); running = true;
      let worker, bitmap;
      try {
        const blob = await (await fetch(proof.image)).blob();
        worker = await Tesseract.createWorker('eng');
        const result = await worker.recognize(blob, {}, { blocks: true });
        const extraction = { ocrText: result.data.text.slice(0, 4000), ocrStatus: 'read', ocrConfidence: result.data.confidence };
        if (!GMPaymentReceipts.parseRecipient(extraction.ocrText) && /gcash/i.test(extraction.ocrText)) {
          bitmap = await createImageBitmap(blob);
          const lines = (result.data.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
          const recipient = await GMReceiptRecipientOCR.read(bitmap, lines, worker);
          if (recipient) { extraction.recipientOcr = recipient; extraction.ocrText += `\nRecipient Name: ${recipient.text}`; }
        }
        const latest = JSON.parse(localStorage.getItem(key) || '{}');
        const current = (latest[collection] || []).find(r => String(r.id) === String(record.id));
        const pending = current?.paymentProofs?.find(p => p.id === proof.id);
        if (pending?.status === 'pending' && pending.image === proof.image) {
          Object.assign(pending, extraction);
          pending.automaticCheck = GMPaymentReceipts.assess(pending, pending.amount, latest);
          const expected = (pending.allocations || []).reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
          const assessment = GMPaymentReceipts.assess(pending, expected, latest);
          pending.automaticCheck = assessment;
          if (assessment.status === 'passed') {
            try { Object.assign(current, GMPaymentReceipts.approve(current, pending.id, 'system:ocr')); }
            catch (error) { Object.assign(pending, { status: 'rejected', rejectionReason: error.message, reviewedAt: new Date().toISOString(), reviewedBy: 'system:ocr' }); }
          } else {
            Object.assign(pending, { status: 'rejected', rejectionReason: assessment.reasons.join(' ') + ' Upload a clearer or corrected receipt.', reviewedAt: new Date().toISOString(), reviewedBy: 'system:ocr' });
          }
          current.updatedAt = new Date().toISOString();
          const serialized = JSON.stringify(latest);
          localStorage.setItem(key, serialized);
          window.dispatchEvent(new StorageEvent('storage', { key, newValue: serialized }));
          await window.GmDentalSupabaseSync?.flushNow?.();
        }
      } catch (_) { /* Unreadable uploads remain available for staff review. */ }
      finally { bitmap?.close(); if (worker) await worker.terminate(); running = false; }
    }
  }
  document.addEventListener('DOMContentLoaded', recheck);
  window.addEventListener('storage', event => { if (event.key === key) recheck(); });
})();
