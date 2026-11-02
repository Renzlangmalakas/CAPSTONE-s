(function () {
  const CLINIC_DB_KEY = "gm_dental_db_v1";
  const defaultFees = [
    ["Local Anesthesia Fee", "Additional anesthesia used to numb the treatment area during a dental procedure.", 200],
    ["Medication Fee", "Medicines provided by the clinic after treatment, when applicable.", 100, 500],
    ["Suture Fee", "Charge for suturing materials used after surgical dental procedures.", 200],
    ["Temporary Filling Fee", "Temporary filling placed to protect a tooth before the permanent treatment is completed.", 300],
    ["Dental Impression Fee", "Impression or mold of the patient's teeth needed for certain dental appliances or restorations.", 300, 500],
    ["Laboratory Fee", "Additional laboratory charge for dental work that needs to be fabricated or processed outside the clinic.", 500, 500, "from"],
    ["Denture Adjustment Fee", "Adjustment of an existing denture to improve its fit and comfort.", 200, 500],
    ["Orthodontic Bracket Replacement Fee", "Replacement of a damaged or detached orthodontic bracket.", 300, 500],
    ["Orthodontic Wire Replacement Fee", "Replacement of a damaged or lost orthodontic archwire.", 300, 500],
    ["Lost/Damaged Appliance Fee", "Charge for replacement or repair of a lost or damaged removable dental appliance.", 0, 0, "variable"],
    ["Emergency/Same-Day Fee", "Additional charge for an unscheduled dental case requiring urgent attention.", 300, 500]
  ];

  function uid() { return `fee-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
  function amount(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.round(number * 100) / 100) : fallback;
  }
  function currency(value) { return `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
  function normalizeFee(fee = {}) {
    const price = amount(fee.price ?? fee.unitPrice ?? 0);
    return { id: fee.id || fee.additionalFeeId || uid(), name: String(fee.name || fee.feeName || "").trim(), description: String(fee.description || "").trim(), price, pricingType: ["fixed", "range", "from", "variable"].includes(fee.pricingType) ? fee.pricingType : Number(fee.maxPrice) > price ? "range" : "fixed", minPrice: price, maxPrice: Math.max(price, amount(fee.maxPrice ?? price)), archived: fee.archived === true, active: fee.active !== false && fee.status !== "Inactive", createdAt: fee.createdAt || new Date().toISOString(), updatedAt: fee.updatedAt || new Date().toISOString() };
  }
  function defaultCatalog() { return defaultFees.map(([name, description, price, maxPrice, pricingType]) => normalizeFee({ id: `default-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name, description, price, pricingType, maxPrice: maxPrice || price })); }
  function getDb() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CLINIC_DB_KEY) || "{}");
      const db = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      const existing = Array.isArray(db.additionalFees) ? db.additionalFees.filter(Boolean).map(normalizeFee) : defaultCatalog();
      db.additionalFees = existing;
      db.invoiceAdditionalFees = Array.isArray(db.invoiceAdditionalFees) ? db.invoiceAdditionalFees : [];
      const serialized = JSON.stringify(db);
      if (serialized !== localStorage.getItem(CLINIC_DB_KEY)) localStorage.setItem(CLINIC_DB_KEY, serialized);
      return db;
    } catch { return { additionalFees: defaultCatalog(), invoiceAdditionalFees: [] }; }
  }
  function saveDb(db) { localStorage.setItem(CLINIC_DB_KEY, JSON.stringify(db)); localStorage.setItem("gm_dental_sync_stamp", String(Date.now())); localStorage.setItem("gm_dental_global_sync", String(Date.now())); }
  function activeFees() { return getDb().additionalFees.filter(fee => fee.active && !fee.archived); }
  function priceLabel(fee) {
    if (fee.pricingType === 'variable') return 'Varies';
    if (fee.pricingType === 'from') return currency(fee.price) + '+';
    return currency(fee.price) + (fee.maxPrice > fee.price ? ' - ' + currency(fee.maxPrice) : '');
  }
  function selectedPrice(fee, value) {
    if (String(value).trim() === '') throw new Error('Enter the agreed unit price for this fee.');
    const price = Number(value);
    if (!Number.isFinite(price) || price < 0) throw new Error('Enter a valid unit price.');
    if (fee.pricingType === 'variable') { if (price <= 0) throw new Error('Enter a price greater than zero for this variable fee.'); }
    else if ((fee.pricingType === 'fixed' && price !== fee.price) || price < fee.price || (fee.pricingType !== 'from' && price > fee.maxPrice)) throw new Error('Unit price must match the catalog price or range: ' + priceLabel(fee));
    return amount(price);
  }
  function bindPriceInput(select, input, description, quantity) {
    const preview = document.createElement("p");
    preview.className = "mt-2";
    preview.setAttribute("aria-live", "polite");
    input.insertAdjacentElement("afterend", preview);
    const updateTotal = () => {
      const count = Number(quantity?.value || 1);
      const price = Number(input.value);
      preview.textContent = input.value !== "" && Number.isInteger(count) && count > 0 && Number.isFinite(price)
        ? currency(price) + " per unit x " + count + " = " + currency(price * count)
        : "Select a fee and enter a valid quantity.";
    };
    const refresh = () => {
      const fee = activeFees().find(item => item.id === select.value);
      input.value = !fee || fee.pricingType === 'variable' ? '' : fee.price;
      input.disabled = !fee;
      input.readOnly = !!fee && fee.pricingType !== 'variable';
      input.placeholder = fee?.pricingType === 'variable' ? 'Enter the agreed amount' : 'Automatically filled';
      input.min = fee?.pricingType === 'variable' ? '0.01' : String(fee?.price || 0);
      if (fee && !['from', 'variable'].includes(fee.pricingType)) input.max = fee.maxPrice; else input.removeAttribute('max');
      if (description) description.textContent = fee ? fee.description + ' Sample fee: ' + priceLabel(fee) : 'Select a fee to see its description and price.';
      updateTotal();
    };
    select.addEventListener('change', refresh);
    quantity?.addEventListener('input', updateTotal);
    input.addEventListener('input', updateTotal);
    refresh();
  }
  function checkboxPickerHtml(fees = activeFees()) {
    const escape = value => String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    return `<fieldset style="border:0;padding:0;min-width:0"><legend>Select additional fees</legend><p>Check one or more fees, then click Add Selected Fees.</p><div style="max-height:340px;overflow:auto">${fees.map(fee => `<div data-fee-choice="${escape(fee.id)}" style="border-bottom:1px solid #ddd;padding:12px 0"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-fee-check style="width:18px;height:18px;flex-shrink:0"><strong>${escape(fee.name)} (${escape(priceLabel(fee))})</strong></label><p>${escape(fee.description)}</p><div style="display:flex;flex-wrap:wrap;gap:12px"><label>Quantity<input class="input form-control" data-fee-quantity aria-label="${escape(fee.name)} quantity" type="number" min="1" step="1" value="1" disabled></label><label>Unit price (PHP)<input class="input form-control" data-fee-price aria-label="${escape(fee.name)} unit price" type="number" min="${fee.pricingType === 'variable' ? '0.01' : fee.price}" step="0.01" value="${fee.pricingType === 'variable' ? '' : fee.price}" ${fee.pricingType === 'fixed' ? 'readonly' : ''} ${['fixed', 'range'].includes(fee.pricingType) ? `max="${fee.maxPrice}"` : ''} disabled></label></div></div>`).join('') || '<p>No active additional fees available.</p>'}</div></fieldset>`;
  }
  function bindCheckboxPicker(container) {
    container.querySelectorAll('[data-fee-choice]').forEach(row => {
      row.querySelector('[data-fee-check]').addEventListener('change', event => {
        row.querySelectorAll('[data-fee-quantity], [data-fee-price]').forEach(input => { input.disabled = !event.target.checked; });
      });
    });
  }
  function addCheckedFees(container, selected) {
    const catalog = activeFees();
    const rows = Array.from(container.querySelectorAll('[data-fee-choice]')).filter(row => row.querySelector('[data-fee-check]').checked);
    if (!rows.length) throw new Error('Check at least one additional fee.');
    // Validate the whole batch before changing the bill.
    const additions = rows.map(row => {
      const fee = catalog.find(item => item.id === row.dataset.feeChoice);
      if (!fee) throw new Error('A selected fee is no longer available. Reopen this bill.');
      const quantity = Number(row.querySelector('[data-fee-quantity]').value);
      if (!Number.isInteger(quantity) || quantity < 1) throw new Error(fee.name + ': enter a whole-number quantity of at least 1.');
      const unitPrice = selectedPrice(fee, row.querySelector('[data-fee-price]').value);
      return { additionalFeeId: fee.id, feeName: fee.name, description: fee.description, quantity, unitPrice };
    });
    additions.forEach(addition => {
      const existing = selected.find(line => line.additionalFeeId === addition.additionalFeeId && line.unitPrice === addition.unitPrice);
      if (existing) existing.quantity += addition.quantity; else selected.push(addition);
    });
    rows.forEach(row => {
      row.querySelector('[data-fee-check]').checked = false;
      row.querySelectorAll('[data-fee-quantity], [data-fee-price]').forEach(input => { input.disabled = true; });
    });
  }
  function validateFee(fee, existingId = "") {
    const name = String(fee.name || "").trim();
    const price = Number(fee.price);
    if (!name) throw new Error("Fee name is required.");
    if (!Number.isFinite(price) || price < 0) throw new Error("Price cannot be negative.");
    if (getDb().additionalFees.some(item => item.id !== existingId && item.name.toLowerCase() === name.toLowerCase())) throw new Error("An additional fee with this name already exists.");
    return { name, price };
  }
  function calculate(lines = []) {
    const normalized = (Array.isArray(lines) ? lines : []).filter(Boolean).map(line => { const quantity = Math.max(1, Math.floor(amount(line.quantity, 1))); const unitPrice = amount(line.unitPrice ?? line.price ?? 0); return { ...line, quantity, unitPrice, subtotal: amount(quantity * unitPrice) }; });
    return { lines: normalized, total: amount(normalized.reduce((sum, line) => sum + line.subtotal, 0)) };
  }
  function serviceTotal(appointment = {}) {
    if (appointment.serviceTotal != null) return amount(appointment.serviceTotal);
    const fees = appointment.additionalFeesTotal != null ? amount(appointment.additionalFeesTotal) : calculate(appointment.additionalFees).total;
    return amount(amount(appointment.price ?? appointment.total ?? 0) - fees);
  }
  function paymentSummary(appointment = {}) {
    const total = appointment.additionalFeesTotal != null ? amount(appointment.additionalFeesTotal) : calculate(appointment.additionalFees).total;
    const collected = amount(appointment.totalCollected ?? (amount(appointment.amountPaidOnline) + amount(appointment.amountPaidInClinic)));
    const paid = Math.min(total, appointment.additionalFeesPaid != null
      ? amount(appointment.additionalFeesPaid)
      : amount(collected - serviceTotal(appointment)));
    return { total, paid, remaining: amount(total - paid) };
  }
  function attachToAppointment(appointment, lines) {
    const baseTotal = serviceTotal(appointment);
    const calculated = calculate(lines);
    appointment.additionalFees = calculated.lines.map(line => ({ id: line.id || uid(), additionalFeeId: line.additionalFeeId || line.id, feeName: line.feeName || line.name, description: String(line.description || ""), quantity: line.quantity, unitPrice: line.unitPrice, subtotal: line.subtotal }));
    appointment.additionalFeesTotal = calculated.total;
    appointment.serviceTotal = baseTotal;
    appointment.grandTotal = amount(baseTotal + calculated.total - amount(appointment.discount?.amount));
    appointment.price = appointment.grandTotal;
    if (Object.prototype.hasOwnProperty.call(appointment, "total")) appointment.total = appointment.grandTotal;
    const paid = amount(appointment.totalCollected ?? appointment.paid ?? 0);
    appointment.remainingBalance = amount(appointment.grandTotal - paid);
    appointment.paymentStatus = appointment.remainingBalance <= 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid";
    return appointment;
  }
  const api = { checkboxPickerHtml, bindCheckboxPicker, addCheckedFees, priceLabel, selectedPrice, bindPriceInput, CLINIC_DB_KEY, defaultCatalog, getDb, saveDb, activeFees, normalizeFee, validateFee, calculate, serviceTotal, paymentSummary, attachToAppointment, currency };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.GMAdditionalFees = api;
})();
