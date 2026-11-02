(() => {
  let receipt = null;
  let generation = 0;
  const byId = id => document.getElementById(id);
  function showAssessment() {
    if (!receipt) return;
    let db = {};
    try { db = JSON.parse(localStorage.getItem('gm_dental_db_v1') || '{}'); } catch (_) { /* Review remains available without local records. */ }
    const result = GMPaymentReceipts.assess(window.GMReceiptUpload.get(), undefined, db);
    byId('receiptMatches').replaceChildren(...GMPaymentReceipts.compare(window.GMReceiptUpload.get()).map(check => {
      const item = document.createElement('li');
      item.textContent = `${check.field}: ${check.status} — image: ${check.extracted ?? 'not read'}; ${check.field === 'recipient' ? 'clinic recipient' : 'entered'}: ${check.submitted || 'not entered'}`;
      return item;
    }));
    byId('receiptStatus').textContent = `${result.label}. ${result.reasons.join(' ')} ${result.note}`;
  }
  window.GMReceiptUpload = {
    reset() { generation++; receipt = null; const input = byId('receiptFile'); if (input) input.value = ''; ['receiptReference', 'receiptAmount'].forEach(id => { if (byId(id)) byId(id).value = ''; }); byId('receiptMatches')?.replaceChildren(); if (byId('receiptStatus')) byId('receiptStatus').textContent = 'Upload your GCash receipt after paying.'; if (byId('receiptPreview')) byId('receiptPreview').hidden = true; },
    get() { return receipt ? { ...receipt, reference: byId('receiptReference').value.replace(/[\s-]/g, ''), amount: Number(byId('receiptAmount').value) } : null; }
  };
  document.addEventListener('DOMContentLoaded', () => {
    ['receiptReference', 'receiptAmount'].forEach(id => byId(id).addEventListener('input', showAssessment));
    byId('receiptFile').addEventListener('change', async event => {
      const file = event.target.files[0];
      const token = ++generation;
      receipt = null;
      byId('receiptMatches').replaceChildren(); byId('receiptPreview').hidden = true;
      const status = message => { if (token === generation) byId('receiptStatus').textContent = message; };
      if (!file) return status('Choose a receipt image.');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) return status('Choose a PNG, JPG or WebP image up to 5 MB.');
      let worker;
      try {
        status('Reading receipt…');
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
        const image = canvas.toDataURL('image/jpeg', 0.8);
        if (image.length > 600000) throw new Error('Image is too large. Crop to the receipt and try again.');
        if (token !== generation) return;
        receipt = { image, ocrText: '', ocrStatus: 'unavailable' };
        byId('receiptPreview').src = image; byId('receiptPreview').hidden = false;
        if (!window.Tesseract) throw new Error('OCR could not load. Enter receipt details manually for staff review.');
        worker = await Tesseract.createWorker('eng');
        // Read the original pixels, not the compressed preview. Tall receipts
        // otherwise shrink small reference digits and masked names excessively.
        const result = await worker.recognize(file, {}, { blocks: true });
        if (token !== generation) return;
        receipt.ocrText = result.data.text.slice(0, 4000); receipt.ocrStatus = 'read'; receipt.ocrConfidence = result.data.confidence;
        if (!GMPaymentReceipts.parseRecipient(receipt.ocrText) && window.GMReceiptRecipientOCR && /gcash/i.test(receipt.ocrText)) {
          const original = await createImageBitmap(file);
          try {
            const lines = (result.data.blocks || []).flatMap(block => (block.paragraphs || []).flatMap(paragraph => paragraph.lines || []));
            const recipient = await GMReceiptRecipientOCR.read(original, lines, worker);
            if (token !== generation) return;
            if (recipient) {
              receipt.recipientOcr = recipient;
              receipt.ocrText += `\nRecipient Name: ${recipient.text}`;
            }
          } finally { original.close(); }
        }
        showAssessment();
      } catch (error) { status('Automatic reading is unavailable. Enter the receipt amount and reference number to submit it for staff review.'); }
      finally { if (worker) await worker.terminate(); }
    });
  });
})();
