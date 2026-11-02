(() => {
  'use strict';
  const key = 'gm_dental_db_v1';
  const read = () => JSON.parse(localStorage.getItem(key) || '{}');
  const reviewsInFlight = new Set();
  const savedReviews = new Set();
  const node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
  function render() {
    const host = document.getElementById('paymentReceiptReviews');
    if (!host) return;
    const currentUser = JSON.parse(sessionStorage.getItem('gm_dental_current_user') || 'null');
    if (currentUser?.role !== 'staff') { host.replaceChildren(); host.hidden = true; return; }
    host.hidden = false;
    host.replaceChildren(node('h2', 'Payment approval'));
    const intro = node('p', "Confirm cash was received before approving a cash request. Match GCash receipts with the clinic's transaction history.");
    intro.className = 'receipt-review-intro'; host.append(intro);
    const db = read(); let count = 0;
    let automaticallyApproved = false;
    for (const collection of ['appointments', 'treatmentPlans']) {
      db[collection] = (db[collection] || []).map(record => {
        let current = record;
        for (const proof of record.paymentProofs || []) {
          if (proof.status !== 'pending' || proof.method === 'cash') continue;
          const expected = (proof.allocations || []).reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
          if (GMPaymentReceipts.assess(proof, expected, db).status !== 'passed') continue;
          try {
            current = GMPaymentReceipts.approve(current, proof.id, 'system:ocr');
            automaticallyApproved = true;
          } catch (_) { /* A changed balance requires staff review. */ }
        }
        return current;
      });
    }
    if (automaticallyApproved) {
      const serialized = JSON.stringify(db);
      localStorage.setItem(key, serialized);
      window.dispatchEvent(new StorageEvent('storage', { key, newValue: serialized }));
      window.GmDentalSupabaseSync?.flushNow?.();
      return;
    }
    for (const collection of ['appointments', 'treatmentPlans']) {
      for (const record of db[collection] || []) {
        for (const proof of record.paymentProofs || []) {
          const reviewKey = `${collection}:${record.id}:${proof.id}`;
          if (proof.status !== 'pending' || savedReviews.has(reviewKey)) continue;
          const cash = proof.method === 'cash';
          count++;
          const card = node('article', ''); card.className = 'receipt-review-card';
          const heading = node('header', ''); heading.className = 'receipt-review-heading';
          const identity = node('div', ''); identity.append(node('h3', record.patientName || record.patient || 'Patient'), node('p', record.serviceName || record.service || 'Treatment'));
          const badge = node('span', 'Awaiting review'); badge.className = 'receipt-review-badge';
          heading.append(identity, badge); card.append(heading);
          const body = node('div', ''); body.className = 'receipt-review-body';
          const preview = node('div', ''); preview.className = 'receipt-review-preview';
          if (/^data:image\/(jpeg|png|webp);base64,/.test(proof.image || '')) {
            const image = document.createElement('img'); image.src = proof.image; image.alt = 'Submitted GCash receipt'; preview.append(image);
          } else preview.append(node('p', cash ? 'Cash payment: confirm receipt at the clinic.' : 'Receipt image unavailable.'));
          const panel = node('div', ''); panel.className = 'receipt-review-controls';
          const date = new Date(proof.submittedAt);
          const facts = node('dl', ''); facts.className = 'receipt-review-facts';
          for (const [title, value] of [
            ['Submitted amount', new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(proof.amount) || 0)],
            ['Payment method', cash ? 'Cash' : 'GCash'],
            ['Reference number', cash ? 'Not required for cash' : proof.reference || 'Not provided'],
            ['Submitted', Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' }).format(date) + ' (PHT)']
          ]) { const row = node('div', ''); row.append(node('dt', title), node('dd', value)); facts.append(row); }
          panel.append(facts);
          if (!cash) {
          const assessment = GMPaymentReceipts.assess(proof, proof.amount, db);
          const screening = node('div', ''); screening.className = 'receipt-review-ocr';
          screening.append(node('strong', assessment.label));
          for (const check of GMPaymentReceipts.compare(proof)) screening.append(node('p', `${check.field}: ${check.status} — image: ${check.extracted ?? 'not read'}; ${check.field === 'recipient' ? 'clinic recipient' : 'submitted'}: ${check.submitted || 'not entered'}`));
          for (const reason of assessment.reasons) screening.append(node('p', reason));
          screening.append(node('p', assessment.note)); panel.append(screening);
          const details = node('details', ''); details.className = 'receipt-review-ocr'; details.append(node('summary', 'View extracted receipt text'), node('pre', proof.ocrText || 'OCR unavailable; patient entered receipt details manually.')); panel.append(details);
          }
          if (!cash) {
            panel.append(node('p', 'Automatic verification is processing this receipt. Matching receipts are credited automatically; unreadable or mismatched receipts must be uploaded again.'));
            body.append(preview, panel); card.append(body); host.append(card);
            continue;
          }
          const label = node('label', ''); label.className = 'receipt-review-confirm';
          const check = document.createElement('input'); check.type = 'checkbox';
          label.append(check, node('span', cash ? 'I confirm the clinic received this cash amount.' : "I verified the recipient, amount and reference in the clinic's GCash transaction history.")); panel.append(label);
          const reasonLabel = node('label', 'Rejection reason'); reasonLabel.className = 'receipt-review-reason';
          const reason = document.createElement('textarea'); reason.placeholder = 'Explain why this receipt cannot be accepted'; reason.maxLength = 250; reason.rows = 3; reason.className = 'input'; reasonLabel.append(reason); panel.append(reasonLabel);
          const actions = node('div', ''); actions.className = 'receipt-review-actions';
          const status = node('p', ''); status.className = 'receipt-review-status'; status.setAttribute('role', 'status');
          for (const action of ['Approve', 'Reject']) {
            const button = node('button', action); button.type = 'button'; button.className = action === 'Approve' ? 'btn receipt-review-approve' : 'btn receipt-review-reject';
            button.disabled = reviewsInFlight.has(reviewKey);
            button.addEventListener('click', async () => {
              if (reviewsInFlight.has(reviewKey)) return;
              try {
                const user = JSON.parse(sessionStorage.getItem('gm_dental_current_user') || 'null');
                if (!user || String(user.role).toLowerCase() !== 'staff') throw new Error('Please sign in as staff.');
                if (action === 'Approve' && !check.checked) throw new Error(cash ? 'Confirm cash was received first.' : 'Confirm the transfer in GCash first.');
                if (action === 'Reject' && !reason.value.trim()) throw new Error('Enter a reason for rejecting the receipt.');
                if (cash) {
                  reviewsInFlight.add(reviewKey);
                  actions.querySelectorAll('button').forEach(item => { item.disabled = true; });
                  status.textContent = 'Saving payment review…';
                  const base = window.GmDentalSupabaseSync?.apiBaseUrl || window.GM_DENTAL_API_BASE || '';
                  const response = await window.GmDentalApiFetch(`${base}/api/payments/cash-review`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ collection, recordId: record.id, proofId: proof.id,
                      action: action.toLowerCase(), confirmed: check.checked, reason: reason.value.trim() })
                  });
                  if(response.status===304){await window.GmDentalSupabaseSync.pull();render();return;}
                  const result = await response.json();
                  if (!response.ok) throw new Error(result.message || 'Could not save payment review.');
                  const reviewed = result.record?.paymentProofs?.find(item => item.id === proof.id);
                  if (reviewed?.status !== (action === 'Approve' ? 'verified' : 'rejected')) throw new Error('The server did not confirm the review. Please refresh and try again.');
                  const latest = read();
                  latest[collection] = (latest[collection] || []).map(item => String(item.id) === String(record.id) ? result.record : item);
                  const serialized = JSON.stringify(latest);
                  localStorage.setItem(key, serialized);
                  savedReviews.add(reviewKey);
                  window.dispatchEvent(new StorageEvent('storage', { key, newValue: serialized }));
                  render();
                  return;
                }
                const current = read();
                const index = (current[collection] || []).findIndex(r => String(r.id) === String(record.id));
                if (index < 0) throw new Error('Billing record no longer exists.');
                const fresh = current[collection][index];
                const receipt = (fresh.paymentProofs || []).find(p => p.id === proof.id);
                if (!receipt || receipt.status !== 'pending') throw new Error('This receipt has already been reviewed. Refresh the page.');
                if (action === 'Approve') {
                  const duplicate = ['appointments', 'archivedAppointments', 'treatmentPlans'].some(c => (current[c] || []).some(r => (r.paymentProofs || []).some(p => p.id !== proof.id && p.reference === receipt.reference && p.status === 'verified')));
                  if (!cash && duplicate) throw new Error('This reference has already been credited.');
                  current[collection][index] = GMPaymentReceipts.approve(fresh, proof.id, user.email || user.id || user.name);
                } else {
                  Object.assign(receipt, { status: 'rejected', rejectionReason: reason.value.trim(), reviewedAt: new Date().toISOString(), reviewedBy: user.email || user.id || user.name });
                  if (cash) {
                    const balance = Number(fresh.remainingBalance);
                    fresh.paymentStatus = balance <= 0 ? 'Paid' : Number(fresh.amountPaid ?? fresh.totalCollected ?? 0) > 0 ? 'Partial' : 'Unpaid';
                    fresh.updatedAt = receipt.reviewedAt;
                  }
                }
                localStorage.setItem(key, JSON.stringify(current));
                // Refresh each page's in-memory mirror before it can write an older snapshot.
                window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(current) }));
                const synced = await window.GmDentalSupabaseSync?.flushNow?.();
                if (!synced) throw new Error("Payment review has not synced. Reconnect and refresh to confirm its status.");
                savedReviews.add(reviewKey);
                render();
              } catch (error) { status.textContent = error.message; }
              finally {
                reviewsInFlight.delete(reviewKey);
                actions.querySelectorAll('button').forEach(item => { item.disabled = false; });
              }
            });
            actions.append(button);
          }
          panel.append(actions, status); body.append(preview, panel); card.append(body); host.append(card);
        }
      }
    }
    if (!count) host.append(node('p', 'No payments awaiting approval.'));
  }
  document.addEventListener('DOMContentLoaded', render);
  window.addEventListener('storage', event => { if (event.key === key) render(); });
})();
