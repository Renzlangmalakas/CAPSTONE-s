const adminDiscountReport = { rows: [], loaded: false, loading: false };
const adminAuditReport = { rows: [], key: "", loading: false, hasMore: false, error: "" };
﻿const SESSION_KEY = "gm_dental_current_user";

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

function clearCurrentUser() {
  sessionStorage.removeItem("gm_dental_current_user");
}

const currentAdminUser = getCurrentUser();

if (!currentAdminUser) {
  window.location.replace("../Landing/landing.html");
} else if (currentAdminUser.role !== "admin") {
  window.location.replace("../Landing/landing.html");
}

const STORAGE_KEY = "dental-admin-ui-v3";
const API_BASE_URL =
  window.GM_DENTAL_API_BASE ||
  localStorage.getItem("gm_dental_api_base") ||
  (window.GmDentalSupabaseSync && window.GmDentalSupabaseSync.apiBaseUrl) ||
  (window.location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:3000"
    : "");

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

const CLINIC_DB_KEY = "gm_dental_db_v1";

function getClinicDb() {
  try {
    const raw = localStorage.getItem(CLINIC_DB_KEY);
    if (raw) return window.GMDefaultAccounts.normalizeDb(JSON.parse(raw));
  } catch { /* Recover an invalid local cache. */ }
  return window.GMDefaultAccounts.normalizeDb({
    appointments: [], patients: [], dentists: [], staff: [],
    archivedAppointments: [], rescheduleRequests: [], patientClinicalNotes: [],
    treatmentPlans: [], history: [],
    notifications: { admin: [], dentist: [], patient: [], staff: [] }
  });
}

function saveClinicDb(db) {
  const original = getClinicDb();
  for (const key of ["appointments","archivedAppointments","treatmentPlans","payments","rescheduleRequests","history"]) {
    if (key in original) db[key] = original[key]; else delete db[key];
  }
  localStorage.setItem(CLINIC_DB_KEY, JSON.stringify(db));
  localStorage.setItem("gm_dental_sync_stamp", String(Date.now()));
}
const defaultData = {
  theme: "dark",
  clinic: {
    name: "Ganal-Mappala Dental Clinic",
    phone: "09228724320",
    email: "ganalmappaladentalclinic@gmail.com",
    address: "Antipolo City, Philippines",
    openingTime: "09:00",
    closingTime: "18:00",
    workingDays: "Monday - Saturday"
  },
  admin: {
    username: "Administrator",
    email: "gannalmappaladentallclinic@gmail.com",
    profileImage: "https://i.pravatar.cc/60?img=12"
  },
  services: [
    { id: uid(), name: "Consultation", price: 500, archived: false },
    { id: uid(), name: "Oral Prophylaxis (Teeth Cleaning)", price: 1000, archived: false },
    { id: uid(), name: "Tooth Extraction", price: 1000, archived: false },
    { id: uid(), name: "Teeth Whitening", price: 3000, archived: false },
    { id: uid(), name: "Dental Fillings", price: 800, archived: false },
    { id: uid(), name: "Root Canal Treatment", price: 6000, archived: false },
    { id: uid(), name: "Orthodontic Treatment (Braces)", price: 60000, archived: false }
  ],
  dentists: window.GMDefaultAccounts.merge([], "dentist"),
  staff: window.GMDefaultAccounts.merge([], "staff"),
  patients: [],
  appointments: [],
  accounts: [
    {
      id: uid(),
      name: "Dr. Juan Dela Cruz",
      role: "dentist",
      email: "juan@email.com",
      username: "drjuan",
      contact: "09123456789",
      archived: false
    }
  ],
  notifications: []
};
const CLINIC_SYNC_KEYS = {
  patientNotifications: "patientNotifications",
  dentistNotifications: "dentistNotifications",
  clinicSyncStamp: "clinicSyncStamp"
};

function touchClinicSync() {
  localStorage.setItem(
    CLINIC_SYNC_KEYS.clinicSyncStamp,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      stamp: Date.now()
    })
  );
}

// ==============================
// GLOBAL REALTIME SYNC ENGINE
// ==============================
const GLOBAL_SYNC_KEY = "gm_dental_global_sync";

function triggerGlobalSync() {
  localStorage.setItem(GLOBAL_SYNC_KEY, Date.now());
}

function listenGlobalSync(callback) {
  window.addEventListener("storage", (e) => {
    if (e.key === GLOBAL_SYNC_KEY) {
      if (typeof callback === "function") callback();
    }
  });
}

function getClinicAppointments() {
  const db = getClinicDb();
  return Array.isArray(db.appointments) ? db.appointments : [];
}

function saveClinicAppointments(list) {
  return; // Appointments are maintained by authorized clinical staff.
  const db = getClinicDb();
  db.appointments = Array.isArray(list) ? list : [];
  saveClinicDb(db);
  touchClinicSync();
}

function getClinicRescheduleRequests() {
  const db = getClinicDb();
  return Array.isArray(db.rescheduleRequests) ? db.rescheduleRequests : [];
}

function saveClinicRescheduleRequests(list) {
  const db = getClinicDb();
  db.rescheduleRequests = Array.isArray(list) ? list : [];
  saveClinicDb(db);
  touchClinicSync();
}

function getPatientNotificationsShared() {
  const list = getJson(CLINIC_SYNC_KEYS.patientNotifications, []);
  return Array.isArray(list) ? list : [];
}

function savePatientNotificationsShared(list) {
  localStorage.setItem(CLINIC_SYNC_KEYS.patientNotifications, JSON.stringify(list));
  touchClinicSync();
}

function getDentistNotificationsShared() {
  const list = getJson(CLINIC_SYNC_KEYS.dentistNotifications, []);
  return Array.isArray(list) ? list : [];
}

function saveDentistNotificationsShared(list) {
  localStorage.setItem(CLINIC_SYNC_KEYS.dentistNotifications, JSON.stringify(list));
  touchClinicSync();
}

function pushPatientNotification(text) {
  const list = getPatientNotificationsShared();
  list.unshift({
    id: uid(),
    text,
    createdAt: new Date().toISOString(),
    read: false
  });
  savePatientNotificationsShared(list);
}

function pushDentistNotification(text) {
  const list = getDentistNotificationsShared();
  list.unshift({
    id: uid(),
    text,
    createdAt: new Date().toISOString(),
    read: false
  });
  saveDentistNotificationsShared(list);
}

function getJson(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}



function lockPageHistory() {
  history.replaceState({ pageLocked: true }, "", location.href);
  history.pushState({ pageLocked: true }, "", location.href);

  window.addEventListener("popstate", () => {
    history.pushState({ pageLocked: true }, "", location.href);
  });
}
let state = loadState();
let currentSection = "home";

let billingFilter = "all";
let billingSearch = "";

const pageMeta = {
  cms: { title: "Content Management", subtitle: "Manage clinic information, schedule, appearance, website and payment content." },
  home: { title: "Dashboard", subtitle: "Welcome back, Admin" },
  services: { title: "Services", subtitle: "Manage dental clinic services." },
  appointments: { title: "Appointments", subtitle: "View appointment details and booking status." },
  billing: { title: "Billing", subtitle: "Manage invoices, track payments and outstanding balances." },
  revenue: { title: "Revenue", subtitle: "Track collected payments by year, month, week, or day." },
  dentists: { title: "Dentists", subtitle: "Manage dentist profiles and schedules." },
  staff: { title: "Staff", subtitle: "Manage clinic staff and support team." },
  patients: { title: "Patients", subtitle: "Manage patient records and details." },
  users: { title: "Users", subtitle: "Manage user roles, accounts, and archived users." },
  settings: { title: "Settings", subtitle: "Configure clinic details and preferences." }
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  lockPageHistory();
  applyTheme();
  bindNavigation();
  bindTopbarMenus();
  bindSidebar();
  bindSettings();
  bindSectionButtons();
  bindRestoreModal();
  bindSharedModal();
  bindProfileUploadUI();
  fillSettingsForms();
  fillAdminForm();
  renderAdminProfile();
  renderAdminName();
  cleanupBrokenProfileOnlyRecords();

  fullAdminSync();
  void refreshAdminServiceCatalog();
  renderAll();
  setupResponsiveTables();
  syncAccountsFromDatabase().catch(err => console.warn("DB account sync failed:", err));

  safeOn(qs("#addPaymentBtn"), "click", () => openPaymentModal());

  safeOn(qs("#billingSearch"), "input", (e) => {
    billingSearch = e.target.value.trim().toLowerCase();
    renderBilling();
  });
  qsa("[data-billing-filter]").forEach(btn => {
    safeOn(btn, "click", () => {
      qsa("[data-billing-filter]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      billingFilter = btn.dataset.billingFilter;
      renderBilling();
    });
  });

  listenGlobalSync(() => {
    fullAdminSync();
    renderAll();
  });

  window.addEventListener("storage", (event) => {
    const watchedKeys = [
      CLINIC_DB_KEY,
      "gm_dental_sync_stamp",
      CLINIC_SYNC_KEYS.clinicSyncStamp,
      CLINIC_SYNC_KEYS.patientNotifications,
      CLINIC_SYNC_KEYS.dentistNotifications
    ];

    if (watchedKeys.includes(event.key)) {
      fullAdminSync();
      renderAll();
    }
  });

  setInterval(refreshNotificationTimes, 60000);
}

  // NEW: Full Billing Implementation (mirrors staff billing)
  function paymentBadge(status) {
    const safeStatus = String(status || "Unpaid");
    const key = safeStatus.toLowerCase();
    let cls = "payment-unpaid";
    if (key === "paid") cls = "payment-paid";
    else if (key === "partial") cls = "payment-partial";
    return `<span class="payment-pill ${cls}">${escapeHtml(safeStatus)}</span>`;
  }

  function getTotalRefunded(appointment) {
    return (Array.isArray(appointment?.refunds) ? appointment.refunds : [])
      .reduce((sum, refund) => sum + Number(refund?.amount || 0), 0);
  }

  function getRefundableAmount(appointment) {
    const paid = Number(appointment?.totalCollected ?? appointment?.paid ?? 0);
    return Math.max(0, paid - getTotalRefunded(appointment));
  }

  function isRefundableAppointment(appointment) {
    const status = statusClassName(normalizedStatus(appointment?.status));
    return status === "cancelled" && getRefundableAmount(appointment) > 0;
  }

  function renderBilling() {
  const tbody = qs("#billingTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  const items = (state.appointments || [])
    .filter(item => !item.archived)
    .map(item => {
      const total = Number(item.price ?? item.total ?? 0);
      const paid = Number(item.totalCollected ?? item.paid ?? 0);
      const balance = Number(item.remainingBalance ?? Math.max(0, total - paid));
      const method = item.paymentMethod || item.method || "-";
      const paymentStatus =
        item.paymentStatus ||
        (paid <= 0 ? "Unpaid" : balance <= 0 ? "Paid" : "Partial");

      return {
        ...item,
        total,
        paid,
        balance,
        method,
        paymentStatus
      };
    });

  if (!items.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">
          <div class="empty-state rich-empty">
            <i class="bi bi-receipt-cutoff"></i>
            <strong>No billing records found</strong>
            <span>Appointments with billing data will appear here.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  items
    .sort((a, b) => dateTimeValue(b.date, b.time) - dateTimeValue(a.date, a.time))
    .forEach(item => {
      const tr = document.createElement("tr");
      const totalRefunded = getTotalRefunded(item);
      const refundable = isRefundableAppointment(item);

      tr.innerHTML = `
        <td>
          <div class="table-identity">
            <strong>${escapeHtml(item.patient || "Unknown Patient")}</strong>
            <span>Patient Record</span>
          </div>
        </td>
        <td>
          <div class="table-service">
            <span class="service-mark"><i class="bi bi-shield-plus"></i></span>
            <span>${escapeHtml(item.service || "Service")}</span>
          </div>
        </td>
        <td>${formatMoney(item.total)}</td>
        <td>${formatMoney(item.paid)}</td>
        <td>
          ${formatMoney(totalRefunded)}
          ${item.refundMethodPending === true ? `<div class="table-cell-muted">Awaiting choice</div>` : ""}
        </td>
        <td>${formatMoney(item.balance)}</td>
        <td>${escapeHtml(item.method)}</td>
        <td>${paymentBadge(item.paymentStatus)}</td>
        <td>
          <div class="inline-actions">
            <button class="action-btn success" type="button" title="View">
              <i class="bi bi-eye"></i>
            </button>
          </div>
        </td>
      `;

      safeOn(tr.querySelector(".edit"), "click", () => openPaymentModal(item.id));
      safeOn(tr.querySelector(".refund"), "click", () => openRefundModal(item.id));
      safeOn(tr.querySelector(".success"), "click", () => showInvoiceView(item.id));

      tbody.appendChild(tr);
    });
}

  function openPaymentModal(id = null) {
  return; // Admin appointment and billing access is read-only.
    const list = (state.appointments || []).filter(item => !item.archived);
    const item = id ? list.find(x => String(x.id) === String(id)) : list[0];
    if (!item) {
      showToast("No appointment available for payment.", "error");
      return;
    }

    const total = Number(item.price ?? item.total ?? 0);
    const paid = Number(item.totalCollected ?? item.paid ?? 0);
    const balance = Math.max(0, total - paid);
    const preferredMethod = item.paymentMethod || item.method || "Cash";

    openSharedModal("Record Payment", `
      <div class="form-grid one">
        <div class="detail-box">
          <strong>${escapeHtml(item.patient || "Unknown Patient")}</strong>
          <div>${escapeHtml(item.service || "Service")} &bull; ${escapeHtml(item.dentist || "Unassigned")}</div>
          <div>${formatDate(item.date)} &bull; ${formatTime(item.time)}</div>
        </div>
        <div class="form-grid two">
          <div>
            <label class="label">Total</label>
            <input class="input" type="text" value="${formatMoney(total)}" disabled />
          </div>
          <div>
            <label class="label">Current Balance</label>
            <input class="input" type="text" value="${formatMoney(balance)}" disabled />
          </div>
        </div>
        <div>
          <label class="label" for="paymentAmount">Amount Received</label>
          <input class="input" id="paymentAmount" type="number" min="0.01" max="${balance.toFixed(2)}" step="0.01" value="${balance.toFixed(2)}" />
        </div>
        <div>
          <label class="label" for="paymentMethod">Payment Method</label>
          <select class="input select" id="paymentMethod">
            <option ${preferredMethod === "Cash" ? "selected" : ""}>Cash</option>
            <option ${preferredMethod === "GCash" ? "selected" : ""}>GCash</option>
          </select>
        </div>
        <div class="form-actions-inline">
          <button class="btn primary" type="button" id="savePaymentBtn">Save Payment</button>
        </div>
      </div>
    `);

    safeOn(qs("#savePaymentBtn"), "click", () => {
      const currentItem = (state.appointments || []).find(x => String(x.id) === String(item.id));
      if (!currentItem) { showToast("Appointment no longer exists. Refresh billing.", "error"); return; }
      const amount = Number(qs("#paymentAmount")?.value || 0);
      const method = qs("#paymentMethod")?.value || "Cash";

      if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
        showToast("Enter a valid payment amount.", "error");
        return;
      }

      const currentTotal = Number(currentItem.price ?? currentItem.total ?? 0);
      const currentPaid = Number(currentItem.totalCollected ?? currentItem.paid ?? 0);
      const remainingCents = Math.max(0, Math.round(currentTotal * 100) - Math.round(currentPaid * 100));
      if (!Number.isFinite(remainingCents) || Math.round(amount * 100) > remainingCents) {
        showToast(`Amount received cannot exceed the remaining balance of ${formatMoney(remainingCents / 100)}.`, "error");
        return;
      }
      const nextPaid = (Math.round(currentPaid * 100) + Math.round(amount * 100)) / 100;
      const isOnline = method === "GCash" || method === "Card";

      currentItem.totalCollected = nextPaid;
      currentItem.remainingBalance = Math.max(0, Math.round(currentTotal * 100) - Math.round(nextPaid * 100)) / 100;
      currentItem.paymentMethod = method;
      currentItem.method = method;
      currentItem.paymentStatus = currentItem.remainingBalance === 0 ? "Paid" : "Partial";

      if (isOnline) {
        currentItem.amountPaidOnline = Math.round((Number(currentItem.amountPaidOnline || 0) + amount) * 100) / 100;
      } else {
        currentItem.amountPaidInClinic = Math.round((Number(currentItem.amountPaidInClinic || 0) + amount) * 100) / 100;
      }

      currentItem.updatedAt = new Date().toISOString();

      afterStateChange();
      closeSharedModal();
      addNotification("Payment Recorded", `Payment for ${item.patient || "patient"} was recorded.`);
      showToast("Payment recorded successfully.", "success");
    });
  }

  function openRefundModal(id) {
  return; // Admin appointment and billing access is read-only.
    const item = (state.appointments || []).find(x => String(x.id) === String(id));
    if (!item) {
      showToast("Appointment record not found.", "error");
      return;
    }

    if (!isRefundableAppointment(item)) {
      showToast("Only cancelled paid appointments can be refunded.", "error");
      return;
    }

    const totalPaid = Number(item.totalCollected ?? item.paid ?? 0);
    const alreadyRefunded = getTotalRefunded(item);
    const refundable = getRefundableAmount(item);
    const preferredMethod = String(item.preferredRefundMethod || "").trim();
    const preferredGcash = String(item.refundGcashNumber || "").trim();
    const preferredLabel = preferredMethod
      ? `${preferredMethod}${preferredGcash ? ` (${preferredGcash})` : ""}`
      : "No patient choice yet";

    openSharedModal("Process Refund", `
      <div class="form-grid one">
        <div class="detail-box">
          <strong>${escapeHtml(item.patient || "Unknown Patient")}</strong>
          <div>${escapeHtml(item.service || "Appointment")} &bull; ${escapeHtml(item.dentist || "Unassigned")}</div>
          <div>${formatDate(item.date)} &bull; ${formatTime(item.time)}</div>
        </div>
        <div class="form-grid three">
          <div class="detail-box"><strong>Total Paid</strong>${formatMoney(totalPaid)}</div>
          <div class="detail-box"><strong>Already Refunded</strong>${formatMoney(alreadyRefunded)}</div>
          <div class="detail-box"><strong>Refundable</strong>${formatMoney(refundable)}</div>
        </div>
        <div class="detail-box">
          <strong>Patient Preferred Method</strong>
          ${escapeHtml(preferredLabel)}
        </div>
        <div>
          <label class="label" for="refundAmount">Refund Amount</label>
          <input class="input" id="refundAmount" type="number" min="0.01" max="${refundable}" step="0.01" value="${refundable}" />
        </div>
        <div>
          <label class="label" for="refundMethod">Refund Method</label>
          <select class="input select" id="refundMethod">
            <option value="">Select method</option>
            <option value="Cash" ${preferredMethod === "Cash" ? "selected" : ""}>Cash</option>
            <option value="GCash" ${preferredMethod === "GCash" ? "selected" : ""}>GCash</option>
          </select>
        </div>
        <div>
          <label class="label" for="refundNote">Note</label>
          <textarea class="input" id="refundNote" rows="3" placeholder="Reason or additional notes"></textarea>
        </div>
        <div class="form-actions-inline">
          <button class="btn primary" type="button" id="saveRefundBtn">Confirm Refund</button>
        </div>
      </div>
    `);

    safeOn(qs("#saveRefundBtn"), "click", () => {
      const amount = Number(qs("#refundAmount")?.value || 0);
      const method = qs("#refundMethod")?.value || "";
      const note = (qs("#refundNote")?.value || "").trim();

      if (amount <= 0) {
        showToast("Enter a valid refund amount.", "error");
        return;
      }

      if (amount > refundable + 0.001) {
        showToast(`Refund amount cannot exceed ${formatMoney(refundable)}.`, "error");
        return;
      }

      if (!method) {
        showToast("Select a refund method.", "error");
        return;
      }

      processRefund(id, amount, method, note);
    });
  }

  function processRefund(id, amount, method, note = "") {
  return; // Admin appointment and billing access is read-only.
    const item = (state.appointments || []).find(x => String(x.id) === String(id));
    if (!item) {
      showToast("Appointment record not found.", "error");
      return;
    }

    const refundable = getRefundableAmount(item);
    if (amount > refundable + 0.001) {
      showToast(`Refund amount cannot exceed ${formatMoney(refundable)}.`, "error");
      return;
    }

    const refundRecord = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      amount: Number(amount),
      method,
      note,
      refundedAt: new Date().toISOString(),
      refundedBy: "admin"
    };

    item.refunds = [...(Array.isArray(item.refunds) ? item.refunds : []), refundRecord];
    item.refundMethodPending = false;
    item.preferredRefundMethod = method;
    item.updatedAt = new Date().toISOString();

    afterStateChange();
    closeSharedModal();
    addNotification("Refund Processed", `Refund of ${formatMoney(amount)} for ${item.patient || "patient"} was processed.`);
    showToast("Refund processed successfully.", "success");
  }

  function showInvoiceView(id) {
    const inv = state.appointments?.find(a => a.id === id);
    if (!inv) return showToast('Invoice not found', 'error');

    const pt = state.patients?.find(p => p.name === inv.patient);
    openViewModal(`${inv.patient} Invoice`, `
      <div class="detail-list">
        <div class="detail-box"><strong>Service:</strong> ${escapeHtml(inv.service)} (${formatMoney(inv.price)})</div>
        <div class="detail-box"><strong>Patient:</strong> ${escapeHtml(inv.patient)}${pt ? `<br>${escapeHtml(pt.contact || '')}` : ''}</div>
        <div class="detail-box"><strong>Date:</strong> ${formatDate(inv.date)} ${formatTime(inv.time)}</div>
        <div class="detail-box"><strong>Status:</strong> ${statusBadge(inv.status)}</div>
        <div class="detail-box"><strong>Payment:</strong> ${statusBadge(inv.paymentStatus || 'Unpaid')} ${Math.round((inv.totalCollected/inv.price||0)*100)}%</div>
        ${inv.discount?.amount ? `<div class="detail-box"><strong>Discount:</strong> ${formatMoney(inv.discount.amount)} - ${escapeHtml(inv.discount.dentistName || "Dentist")}</div>` : ""}
        <div class="detail-box"><strong>Balance Due:</strong> <strong>${formatMoney(inv.remainingBalance)}</strong></div>
        ${inv.paymentMethod ? `<div class="detail-box"><strong>Method:</strong> ${escapeHtml(inv.paymentMethod)}</div>` : ''}
      </div>
    `);
  }


  function afterStateChange() {
    syncAdminStateToClinicDb?.();
    triggerGlobalSync();
    renderAll();
  }

 listenGlobalSync(() => {
  fullAdminSync();
  renderAll();
});

  window.addEventListener("storage", (event) => {
    const watchedKeys = [
      CLINIC_DB_KEY,
      "gm_dental_sync_stamp",
      CLINIC_SYNC_KEYS.clinicSyncStamp,
      CLINIC_SYNC_KEYS.patientNotifications,
      CLINIC_SYNC_KEYS.dentistNotifications
    ];

    if (watchedKeys.includes(event.key)) {
      fullAdminSync();
      renderAll();
    }
  });

  setInterval(refreshNotificationTimes, 60000);

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultData);
    const parsed = JSON.parse(raw);
    return mergeDefaults(window.GMDefaultAccounts.removeLegacySamplePatients(parsed));
    } catch {
    return structuredClone(defaultData);
  }
}

function mergeDefaults(saved) {
  const base = structuredClone(defaultData);

  const normalizeNotifications = (items) =>
    (Array.isArray(items) ? items : base.notifications).map(item => ({
      read: true,
      ...item
    }));

  return {
    ...base,
    ...saved,
    clinic: { ...base.clinic, ...(saved.clinic || {}) },
    admin: { ...base.admin, ...(saved.admin || {}) },
    services: Array.isArray(saved.services) && saved.services.length ? saved.services : base.services,
    dentists: window.GMDefaultAccounts.merge(saved.dentists || [], "dentist"),
    staff: window.GMDefaultAccounts.merge(saved.staff || [], "staff"),
    patients: Array.isArray(saved.patients) && saved.patients.length ? saved.patients : base.patients,
    appointments: Array.isArray(saved.appointments) && saved.appointments.length ? saved.appointments : base.appointments,
    accounts: window.GMDefaultAccounts.merge(saved.accounts || [], null, false),
    notifications: normalizeNotifications(saved.notifications)
  };
}

function saveState(skipClinicMirror = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

  if (
    !skipClinicMirror &&
    typeof syncAdminStateToClinicDb === "function"
  ) {
    syncAdminStateToClinicDb();
  }
}
function syncAdminPatientsFromClinicDb() {
  const db = getClinicDb();
  const sharedPatients = Array.isArray(db.patients) ? db.patients : [];
  const clinicAppointments = getClinicAppointments();
  const patientMap = new Map();

  sharedPatients.forEach(p => {
    const name = String(p.name || "").trim();
    if (!name || window.GMDefaultAccounts.isUnknownPatient(name)) return;

    patientMap.set(name.toLowerCase(), {
      ...p,
      id: p.id || uid(),
      name,
      age: p.age || "",
      gender: p.gender || "",
      condition: p.condition || "",
      address: p.address || "",
      contact: p.contact || p.phone || p.mobile || "",
      email: p.email || "",
      archived: !!p.archived
    });
  });

  clinicAppointments.forEach(a => {
    if (window.GMDefaultAccounts.isDeletedPatient(db, a)) return;
    if (window.GMDefaultAccounts.isRemovedSamplePatient(a)) return;
    const name = String(a.patientName || a.patient || "").trim();
    const status = String(a.status || "").trim();

    if (!name || window.GMDefaultAccounts.isUnknownPatient(name)) return;
    if (a.archived === true) return;
    if (status === "Profile Only") return;
    if (!a.service && !a.date && !a.time && !a.schedule) return;

    const key = name.toLowerCase();

    if (!patientMap.has(key)) {
      patientMap.set(key, {
        id: a.patientId || uid(),
        name,
        age: a.age || "",
        gender: a.gender || "",
        condition: a.patientCondition || a.condition || "",
        address: a.patientAddress || a.address || "",
        contact: a.patientPhone || a.contact || "",
        email: a.patientEmail || "",
        archived: false
      });
    }
  });

  state.patients = Array.from(patientMap.values()).map(p => GMAdminPatientDetails.enrich(p, state.registeredPatientAccounts || state.accounts));
  saveState(true);
}

function syncAdminStateToClinicDb() {
  const db = getClinicDb();
  const existingAppointments = new Map((db.appointments || []).map(a => [String(a.id), a]));

  db.patients = (state.patients || []).map(p => ({
    ...p,
    id: p.id || uid(),
    name: p.name || "",
    age: p.age || "",
    gender: p.gender || "",
    condition: p.condition || "",
    address: p.address || "",
    contact: p.contact || "",
    email: p.email || "",
    archived: !!p.archived,
    updatedAt: new Date().toISOString()
  }));

  db.dentists = (state.dentists || []).map(d => ({
    id: d.id || uid(),
    accountId: d.accountId || "",
    name: d.name || "",
    email: d.email || "",
    specialty: d.specialty || "",
    contact: d.contact || "",
    schedules: Array.isArray(d.schedules) ? d.schedules : [],
    archived: !!d.archived,
    updatedAt: new Date().toISOString()
  }));

  db.appointments = (state.appointments || []).map(a => ({
    // Retain booking identity, service duration, and clinical fields that the
    // admin view does not expose. Dropping them changes the reserved interval.
    ...(existingAppointments.get(String(a.id)) || {}),
    id: a.id || uid(),
    patientName: a.patient || "",
    patient: a.patient || "",
    dentist: a.dentist || "",
    service: a.service || "",

    // KEEP FINANCIAL DATA
    price: Number(a.price || 0),
    paid: !!a.paid,
    downPayment: Number(a.downPayment || 0),
    amountPaidOnline: Number(a.amountPaidOnline || 0),
    amountPaidInClinic: Number(a.amountPaidInClinic || 0),
    totalCollected: Number(a.totalCollected || 0),
    remainingBalance: Number(a.remainingBalance || 0),
    paymentMethod: a.paymentMethod || "",
    paymentStatus: a.paymentStatus || "Unpaid",
    requiresDownPayment: !!a.requiresDownPayment,
    minimumDownPayment: Number(a.minimumDownPayment || 0),
    invoiceUnlocked: !!a.invoiceUnlocked,
    revenueCountedOnline: Number(a.revenueCountedOnline || 0),
    revenueCountedClinic: Number(a.revenueCountedClinic || 0),

    // KEEP SCHEDULE DATA
    date: a.date || "",
    time: a.time || "",
    schedule: buildSchedule(
      a.date || "",
      a.time || normalizeTimeDisplay(
        String(a.schedule || "").split("-")[1] || ""
      )
    ),

    status: a.status || "Pending",
    archived: !!a.archived,
    archivedForDentist: !!a.archivedForDentist,
    archivedForPatient: !!a.archivedForPatient,
    discount: a.discount || null,
    review: a.review || null,
    rating: a.rating || null,
    updatedAt: new Date().toISOString()
  }));

  db.staff = (state.staff || []).map(s => ({
    id: s.id || uid(),
    name: s.name || "",
    position: s.position || "",
    email: s.email || "",
    contact: s.contact || "",
    archived: !!s.archived,
    updatedAt: new Date().toISOString()
  }));

  db.services = (state.services || []).map(service => ({
    ...service,
    id: service.id || uid(),
    name: service.name || "",
    price: Number(service.price || 0),
    archived: !!service.archived,
    updatedAt: service.updatedAt || service.createdAt
  }));

  const previousSchedules = db.dentistSchedules || [];
  db.dentistSchedules = (state.dentists || []).flatMap(dentist =>
    (Array.isArray(dentist.schedules) ? dentist.schedules : []).map(schedule => {
      const existing = previousSchedules.find(row => String(row.dentistId || row.dentist_id) === String(dentist.id) && String(row.day || '').toLowerCase() === String(schedule.day || '').toLowerCase());
      return {
        id: existing?.id || `${dentist.id}-${String(schedule.day).toLowerCase()}`,
        dentistId: dentist.id || '', dentist: dentist.name || '',
        day: schedule.day || '', start: schedule.start || '', end: schedule.end || '',
        archived: !!dentist.archived,
        updatedAt: existing && existing.start === schedule.start && existing.end === schedule.end && !!existing.archived === !!dentist.archived ? existing.updatedAt : new Date().toISOString()
      };
    })
  );

  db.payments = (state.appointments || [])
    .filter(a => Number(a.totalCollected || a.paid || 0) > 0 || a.paymentStatus)
    .map(a => ({
      id: `payment-${a.id || uid()}`,
      appointmentId: a.id || "",
      patient: a.patient || "",
      dentist: a.dentist || "",
      service: a.service || "",
      amount: Number(a.totalCollected || a.paid || 0),
      balance: Number(a.remainingBalance || 0),
      method: a.paymentMethod || a.method || "",
      status: a.paymentStatus || "Unpaid",
      date: a.date || "",
      updatedAt: new Date().toISOString()
    }));

  saveClinicDb(db);
  touchClinicSync();
  triggerGlobalSync();
}
function qs(selector, root = document) {
  return root.querySelector(selector);
}

function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

// UI helpers + defensive guards
function byId(id) {
  return document.getElementById(id);
}

function safeOn(target, eventName, handler, options) {
  if (!target || typeof target.addEventListener !== "function") return null;
  target.addEventListener(eventName, handler, options);
  return target;
}

function safeValue(element, fallback = "") {
  return element ? String(element.value ?? fallback) : fallback;
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizedStatus(status, fallback = "Pending") {
  const raw = String(status ?? "").trim();
  if (!raw) return fallback;

  const key = raw.toLowerCase();
  const aliasMap = {
    waiting: "Pending",
    confirmed: "Approved",
    "in progress": "Approved",
    paid: "Completed",
    complete: "Completed",
    reschedule: "Rescheduled"
  };

  return aliasMap[key] || raw;
}

function statusClassName(status) {
  return normalizedStatus(status).toLowerCase().replace(/\s+/g, "-");
}

function isTerminalAppointmentStatus(status) {
  return ["completed", "cancelled", "rejected", "archived"].includes(statusClassName(status));
}

function tableEmptyRow(colspan, title, text, icon = "bi-inbox") {
  return `
    <tr>
      <td colspan="${colspan}">
        <div class="empty-state rich-empty">
          <i class="bi ${icon}"></i>
          <strong>${escapeHtml(title)}</strong>
          <span>${escapeHtml(text)}</span>
        </div>
      </td>
    </tr>
  `;
}

function bindNavigation() {
  qsa(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      showSection(btn.dataset.section);
      closeMobileSidebar();
    });
  });

  qsa("[data-section-jump]").forEach(btn => {
    btn.addEventListener("click", () => {
      closeFloatingMenus();
      showSection(btn.dataset.sectionJump);
      closeMobileSidebar();
    });
  });
}

function addNotification(title, body, time = "Just now") {
  state.notifications.unshift({
    id: uid(),
    title,
    body,
    time,
    read: false,
    createdAt: new Date().toISOString()
  });

  state.notifications = state.notifications.slice(0, 20);

  saveState(true);
  renderNotifications();
}

function fullAdminSync() {
  syncAdminServicesFromClinicDb();
  syncAdminAppointmentsFromClinicDb();
  syncAdminPatientsFromClinicDb();
  syncAdminDentistsFromClinicDb();
  syncAdminNotificationsFromShared();

  saveState(true);
}

function syncAdminServicesFromClinicDb() {
  const saved = getClinicDb().services;
  if (Array.isArray(saved) && saved.length && window.GMServiceCatalog) {
    state.services = window.GMServiceCatalog.merge([...(state.services || []), ...saved]);
  }
}

async function refreshAdminServiceCatalog() {
  try {
    const base = window.GmDentalSupabaseSync?.apiBaseUrl || '';
    const response = await window.GmDentalApiFetch(`${base}/api/clinic-db`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load saved services.');
    const { db } = await response.json();
    if (!Array.isArray(db?.services)) throw new Error('Invalid service catalog response.');
    state.services = window.GMServiceCatalog.merge(db.services);
    saveState(true);
    renderServices();
  } catch (error) { showToast(error.message, 'error'); }
}



function syncAdminDentistsFromClinicDb() {
  const db = window.GMDefaultAccounts.normalizeDb(getClinicDb());
  const savedDentists = db.dentists || [];
  const localOnly = (state.dentists || []).filter(local => !savedDentists.some(saved =>
    window.GMDefaultAccounts.key(saved.name) === window.GMDefaultAccounts.key(local.name)));
  state.dentists = window.GMDefaultAccounts.merge([...savedDentists, ...localOnly], "dentist");
  state.staff = window.GMDefaultAccounts.merge([...(db.staff || []), ...(state.staff || [])], "staff");
  saveState(true);
}

function syncAdminNotificationsFromShared() {
  const dentistNotifs = getDentistNotificationsShared().map(n => ({
    id: `dent-${n.id}`,
    title: "Dentist Update",
    body: n.text,
    time: formatNotificationTime(n.createdAt),
    read: !!n.read,
    createdAt: n.createdAt
  }));

  const patientNotifs = getPatientNotificationsShared().map(n => ({
    id: `pat-${n.id}`,
    title: "Patient Update",
    body: n.text,
    time: formatNotificationTime(n.createdAt),
    read: !!n.read,
    createdAt: n.createdAt
  }));

  const localAdminNotifs = (state.notifications || []).map(n => ({
    ...n,
    createdAt: n.createdAt || new Date().toISOString()
  }));

  const merged = [...localAdminNotifs, ...dentistNotifs, ...patientNotifs]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 40);

  state.notifications = merged;
  saveState(true);
}

function syncAdminAllFromClinicDb() {
  syncAdminServicesFromClinicDb();
  syncAdminAppointmentsFromClinicDb();
  syncAdminPatientsFromClinicDb();
  syncAdminDentistsFromClinicDb();
  syncAdminNotificationsFromShared();
}

function formatNotificationTime(iso) {
  if (!iso) return "Just now";
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);

  if (mins <= 0) return "Just now";
  if (mins === 1) return "1 min ago";
  if (mins < 60) return `${mins} mins ago`;

  const hours = Math.floor(mins / 60);
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;

  return date.toLocaleDateString();
}

function convertDisplayTimeTo24(time12) {
  if (!time12) return "";
  const match = String(time12).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return time12;

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function convert24ToDisplayTime(time24) {
  if (!time24) return "";
  const [hourStr, min] = String(time24).split(":");
  let hour = Number(hourStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${min} ${suffix}`;
}

function refreshNotificationTimes() {
  if (!Array.isArray(state.notifications)) return;

  state.notifications = state.notifications.map((item, index) => {
    if (index === 0) return { ...item, time: "Just now" };
    if (index === 1) return { ...item, time: "1 min ago" };
    if (index === 2) return { ...item, time: "2 mins ago" };
    return item;
  });

  saveState();
  renderNotifications();
}

function showSection(sectionId) {
  if (sectionId === "settings") sectionId = "cms";
  currentSection = sectionId;

  qsa(".section").forEach(section => section.classList.remove("active"));
  qsa(".nav-item").forEach(btn => btn.classList.remove("active"));

  const isReport = ["discounts", "audit"].includes(sectionId);
  const targetSection = qs(`#${isReport ? "patients" : sectionId}`);
  qs("#patients")?.classList.toggle("dedicated-report", isReport);
  if (isReport || sectionId === "patients") {
    qs("#reportExportType").value = isReport ? sectionId : "patients";
    if (sectionId === "discounts") adminDiscountReport.loaded = false;
    renderPatients();
  }
  const targetNav = qs(`.nav-item[data-section="${sectionId}"]`);

  if (targetSection) targetSection.classList.add("active");
  if (targetNav) targetNav.classList.add("active");

  const meta = sectionId === "discounts"
    ? { title: "Discounted Prices", subtitle: "Review discounts, final prices and granting dentists." }
    : sectionId === "audit"
      ? { title: "User Audit Log", subtitle: "Review recorded user actions and outcomes." }
      : pageMeta[sectionId];
  if (meta) {
    qs("#pageTitle").textContent = meta.title;
    qs("#pageSubtitle").textContent = meta.subtitle;
  }

  closeFloatingMenus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function bindTopbarMenus() {
  const notifToggle = qs("#notifToggle");
  const notifPanel = qs("#notifPanel");
  const profileToggle = qs("#profileToggle");
  const profilePanel = qs("#profilePanel");
  const logoutBtn = qs("#logoutBtn");

  if (!notifToggle || !notifPanel || !profileToggle || !profilePanel) return;
  if (profileToggle.dataset.boundTopbar === "true") return;
  profileToggle.dataset.boundTopbar = "true";
  notifToggle.dataset.boundTopbar = "true";
  if (logoutBtn) logoutBtn.dataset.boundTopbar = "true";

  function hidePanels() {
    notifPanel.classList.remove("show");
    profilePanel.classList.remove("show");
  }

  safeOn(notifToggle, "click", (e) => {
    e.stopPropagation();
    const open = notifPanel.classList.contains("show");
    hidePanels();
    if (!open) {
      notifPanel.classList.add("show");
      state.notifications = (state.notifications || []).map(item => ({ ...item, read: true }));
      saveState(true);
      renderNotifications();
    }
  });

  safeOn(profileToggle, "click", (e) => {
    e.stopPropagation();
    const open = profilePanel.classList.contains("show");
    hidePanels();
    if (!open) profilePanel.classList.add("show");
  });

  safeOn(notifPanel, "click", (e) => e.stopPropagation());
  safeOn(profilePanel, "click", (e) => e.stopPropagation());
  safeOn(document, "click", hidePanels);
  safeOn(window, "resize", hidePanels);
  safeOn(window, "scroll", hidePanels);

  safeOn(logoutBtn, "click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hidePanels();
    clearCurrentUser();
    if (typeof showToast === "function") {
      showToast("Logged out successfully.", "info");
    }
    setTimeout(() => {
      window.location.replace("../Landing/landing.html");
    }, 120);
  });
}

function closeFloatingMenus() {
  qsa(".menu-panel").forEach(p => p.classList.remove("show"));
  closeAllDropdowns();
}

function isMobileSidebarLayout() {
  return window.matchMedia("(max-width: 1024px)").matches;
}

function setMobileSidebar(open) {
  const sidebar = qs("#sidebar");
  const backdrop = qs("#sidebarBackdrop");
  const mobileToggle = qs("#mobileSidebarToggle");
  if (!sidebar) return;

  sidebar.classList.toggle("collapsed", open);
  backdrop?.classList.toggle("show", open);
  mobileToggle?.setAttribute("aria-expanded", String(open));
  document.body.classList.toggle("sidebar-open", open);
}

function closeMobileSidebar() {
  if (isMobileSidebarLayout()) setMobileSidebar(false);
}

function bindSidebar() {
  safeOn(qs("#sidebarToggle"), "click", () => {
    const sidebar = qs("#sidebar");
    if (!sidebar) return;

    if (isMobileSidebarLayout()) {
      setMobileSidebar(!sidebar.classList.contains("collapsed"));
    } else {
      sidebar.classList.toggle("collapsed");
    }
    closeFloatingMenus();
  });

  safeOn(qs("#mobileSidebarToggle"), "click", () => {
    const sidebar = qs("#sidebar");
    setMobileSidebar(!sidebar?.classList.contains("collapsed"));
    closeFloatingMenus();
  });

  safeOn(qs("#sidebarBackdrop"), "click", closeMobileSidebar);
  safeOn(window, "resize", () => {
    if (!isMobileSidebarLayout()) {
      qs("#sidebarBackdrop")?.classList.remove("show");
      qs("#mobileSidebarToggle")?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("sidebar-open");
    }
  });
}

function bindSettings() {
  safeOn(qs("#themeToggle"), "click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveState(true);
    applyTheme();
  });

  safeOn(qs("#saveClinicBtn"), "click", saveClinicInfo);
  safeOn(qs("#saveScheduleBtn"), "click", saveClinicSchedule);
  safeOn(qs("#saveAdminBtn"), "click", saveAdminAccount);
  safeOn(qs("#createAccountBtn"), "click", createDentistAccount);
  safeOn(qs("#sendDentistCredentialsBtn"), "click", sendDentistCredentials);
  safeOn(qs("#accUserRole"), "change", updateCreateUserRole);
  updateCreateUserRole();
}

function bindSectionButtons() {
  safeOn(qs("#addServiceBtn"), "click", () => openServiceModal());
  safeOn(qs("#addAdditionalFeeBtn"), "click", () => openAdditionalFeeModal());
  safeOn(qs("#addDentistBtn"), "click", () => openDentistModal());
  safeOn(qs("#addStaffBtn"), "click", () => openStaffModal());
  safeOn(qs("#addPatientBtn"), "click", () => openPatientModal());
  safeOn(qs("#addUserBtn"), "click", () => openAccountModal());
  safeOn(qs("#clearPatientsBtn"), "click", () => clearActiveSection("patients", "patient"));
  safeOn(qs("#clearDentistsBtn"), "click", () => clearActiveSection("dentists", "dentist"));
  safeOn(qs("#clearStaffBtn"), "click", () => clearActiveSection("staff", "staff"));
  safeOn(qs("#clearAccountsBtn"), "click", () => clearActiveSection("accounts", "user account"));
  safeOn(qs("#toggleArchivedUsersBtn"), "click", toggleArchivedUsersPanel);
  safeOn(qs("#clearArchivedUsersBtn"), "click", clearArchivedUsers);

  safeOn(qs("#dentistSearch"), "input", renderDentists);
  safeOn(qs("#dentistSort"), "change", renderDentists);
  safeOn(qs("#staffSearch"), "input", renderStaff);
  safeOn(qs("#staffSort"), "change", renderStaff);
  safeOn(qs("#patientSearch"), "input", renderPatients);
  safeOn(qs("#patientSort"), "change", renderPatients);
  safeOn(qs("#appointmentSearch"), "input", renderAppointments);
  safeOn(qs("#appointmentDateFilter"), "change", () => {
    syncAdminDateFilterInput();
    renderAppointments();
  });
  safeOn(qs("#appointmentDateSpecific"), "change", renderAppointments);
  safeOn(qs("#reportExportType"), "change", renderPatients);
  safeOn(qs("#reportDateFilter"), "change", () => {
    syncAdminReportDateFilterInput();
    renderPatients();
  });
  safeOn(qs("#reportDateSpecific"), "change", renderPatients);
  safeOn(qs("#exportPatientRecordsBtn"), "click", exportPatientRecordsCsv);
  safeOn(qs("#exportAppointmentsBtn"), "click", exportAppointmentsCsv);
  safeOn(qs("#exportBillingBtn"), "click", exportBillingCsv);
  safeOn(qs("#revenueDateFilter"), "change", () => {
    syncAdminRevenueDateFilterInput();
    renderRevenue();
  });
  safeOn(qs("#revenueDateSpecific"), "change", renderRevenue);
  safeOn(qs("#revenueStartDate"), "change", renderRevenue);
  safeOn(qs("#revenueEndDate"), "change", renderRevenue);
  safeOn(qs("#exportRevenueBtn"), "click", exportRevenueCsv);
  safeOn(qs("#userSearch"), "input", renderAccounts);
  safeOn(qs("#userRoleFilter"), "change", renderAccounts);

  qsa("[data-restore-type]").forEach(btn => {
    safeOn(btn, "click", () => openRestoreModal(btn.dataset.restoreType));
  });
}

function bindSharedModal() {
  safeOn(qs("#closeModalBtn"), "click", closeSharedModal);
  safeOn(qs("#modalBackdrop"), "click", e => {
    if (e.target?.id === "modalBackdrop") closeSharedModal();
  });

  safeOn(qs("#closeViewBtn"), "click", closeViewModal);
  safeOn(qs("#viewBackdrop"), "click", e => {
    if (e.target?.id === "viewBackdrop") closeViewModal();
  });
}

function bindRestoreModal() {
  safeOn(qs("#closeRestoreBtn"), "click", closeRestoreModal);
  safeOn(qs("#restoreBackdrop"), "click", e => {
    if (e.target?.id === "restoreBackdrop") closeRestoreModal();
  });
}

function applyTheme() {
  document.body.classList.toggle("dark", state.theme === "dark");
}

function fillSettingsForms() {
  qs("#clinicName").value = state.clinic.name;
  qs("#clinicPhone").value = state.clinic.phone;
  qs("#clinicEmail").value = state.clinic.email;
  qs("#clinicAddress").value = state.clinic.address;
  qs("#openingTime").value = state.clinic.openingTime;
  qs("#closingTime").value = state.clinic.closingTime;
  qs("#workingDays").value = state.clinic.workingDays;
}

function fillAdminForm() {
  const user = getCurrentUser() || {};
  qs("#adminUsername").value = user.name || state.admin.username;
  qs("#adminEmail").value = user.email || state.admin.email;
  qs("#adminPhone").value = user.mobile || "";
  qs("#adminRole").value = user.profileTitle || "Administrator";
}

function renderAdminProfile() {
  const img = qs("#topbarProfileImage");
  if (img) {
    img.src = state.admin.profileImage || "https://i.pravatar.cc/60?img=12";
  }
}

function renderAdminName() {
  const nameEl = qs("#topbarAdminName");
  if (nameEl) {
    nameEl.textContent = state.admin.username || "Admin";
  }
}

function saveClinicInfo() {
  state.clinic.name = qs("#clinicName").value.trim();
  state.clinic.phone = qs("#clinicPhone").value.trim();
  state.clinic.email = qs("#clinicEmail").value.trim();
  state.clinic.address = qs("#clinicAddress").value.trim();
  saveState();
  addNotification("Clinic Updated", "Clinic information was updated.");
  alert("Clinic information saved.");
}

function saveClinicSchedule() {
  state.clinic.openingTime = qs("#openingTime").value;
  state.clinic.closingTime = qs("#closingTime").value;
  state.clinic.workingDays = qs("#workingDays").value;
  saveState();
  addNotification("Schedule Updated", "Clinic schedule was updated.");
  alert("Clinic schedule saved.");
}

async function saveAdminAccount() {
  const username = qs("#adminUsername").value.trim();
  const email = qs("#adminEmail").value.trim();
  const password = qs("#adminPassword").value;
  const confirm = qs("#adminConfirm").value;
  const fileInput = qs("#adminProfileImage");
  const uploadName = qs("#profileUploadName");
  const uploadBox = qs("#profileUploadBox");

  if (uploadName) uploadName.textContent = "No file selected";
  if (uploadBox) uploadBox.classList.remove("is-active");

  const file = fileInput ? fileInput.files[0] : null;

  if (!username || !email) {
    alert("Username and email are required.");
    return;
  }

  if (password || confirm) {
    if (password !== confirm) {
      alert("Passwords do not match.");
      return;
    }
  }

  const verified = await window.GmAccountSecurity.update({ name: username,
    mobile: qs("#adminPhone").value.trim(), profileTitle: qs("#adminRole").value.trim(), newPassword: password });
  if (!verified) return;
  Object.assign(currentAdminUser, verified);
  state.admin.username = verified.name;
  state.admin.email = verified.email;

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      state.admin.profileImage = e.target.result;
      saveState();
      renderAdminProfile();
      renderAdminName();

      qs("#adminPassword").value = "";
      qs("#adminConfirm").value = "";
      fileInput.value = "";

      addNotification("Admin Updated", `${username} updated the admin account.`);
      alert("Admin account updated.");
    };
    reader.readAsDataURL(file);
  } else {
    saveState();
    renderAdminProfile();
    renderAdminName();

    qs("#adminPassword").value = "";
    qs("#adminConfirm").value = "";

    addNotification("Admin Updated", `${username} updated the admin account.`);
    alert("Admin account updated.");
  }
}

async function saveUserAccountToDatabase(account) {

  const response = await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      role: account.role,
      name: account.name,
      email: account.email,
      password: account.password,
      contact: account.contact,
      mobile: account.contact
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "Could not save user account to the database.");
  }

  if (result.persisted && result.persisted !== "supabase") {
    throw new Error(
      `Server accepted the user but did not persist to Supabase (persisted=${result.persisted}). ` +
      `Check the backend logs and Supabase credentials in HTML/Landing/.env.`
    );
  }

  return { ...(result.user || {}), db: result.db || null };
}

async function fetchUsersFromDatabase() {
  try {
    const response = await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/users`);
    if (!response.ok) return null;
    const result = await response.json().catch(() => ({}));
    return result;
  } catch (err) {
    console.warn("Could not fetch users from database:", err);
    return null;
  }
}

async function syncAccountsFromDatabase({ skipClinicMirror = false } = {}) {
  const result = await fetchUsersFromDatabase();
  if (!result || !Array.isArray(result.users)) return;
  state.registeredPatientAccounts = result.users.filter(row => row.role === "patient").map(row => ({
    id: row.id, name: row.name, role: "patient", email: row.email,
    sex: row.sex, dob: row.dob, address: row.address,
    contact: row.mobile || row.contact || "", createdAt: row.created_at || row.createdAt || ""
  }));

  state.accounts = window.GMDefaultAccounts.merge(state.accounts || [], null, false);
  result.users.forEach((row) => {
    const email = String(row.email || "").trim().toLowerCase();
    if (!email) return;
    upsertLocalAccount({
      id: row.id,
      name: row.name || "",
      role: row.role || "patient",
      email,
      contact: row.mobile || row.contact || "",
      createdAt: row.created_at || row.createdAt || "",
      username: row.username || email, archived: Boolean(row.archived), mergedInto: row.merged_into || null
    });
  });

  state.accounts = window.GMDefaultAccounts.merge(state.accounts, null, false);
  state.patients = (state.patients || []).map(p => GMAdminPatientDetails.enrich(p, state.registeredPatientAccounts || state.accounts));
  saveState(skipClinicMirror);
  if (typeof renderAccounts === "function") renderAccounts();
  if (typeof renderPatients === "function") renderPatients();
  if (typeof renderArchivedUsers === "function") renderArchivedUsers();
}

function upsertLocalAccount(account) {
  const email = String(account.email || "").trim().toLowerCase();
  const existing = state.accounts.find(item => String(item.email || "").trim().toLowerCase() === email);
  const localAccount = {
    id: account.id || existing?.id || uid(),
    name: account.name,
    role: account.role || "dentist",
    email,
    contact: account.contact || "",
    username: account.username || email,
    createdAt: account.createdAt || existing?.createdAt || "",
    archived: Boolean(account.archived),
    mergedInto: account.mergedInto || null
  };

  if (existing) {
    Object.assign(existing, localAccount);
    return existing;
  }

  state.accounts.push(localAccount);
  return localAccount;
}

function updateCreateUserRole() {
  const role = qs("#accUserRole").value;
  const dentist = ["dentist", "staff"].includes(role);
  qs("#dentistCredentialsControls p").textContent = `Enter only the new ${role} email. They will receive a secure invitation to enter their name, contact details and password. The link expires in 24 hours.`;
  qs("#sendDentistCredentialsBtn").textContent = `Send ${role} invitation`;
  for (const id of ["accDentistName","accDentistContact","accDentistUsername","accDentistPassword"]) qs("#"+id).parentElement.hidden = dentist;
  qs("#createAccountBtn").hidden = dentist;
  qs("#dentistCredentialsControls").hidden = !dentist;
  qs("#accDentistPassword").value = "";
  qs("#dentistCredentialsStatus").textContent = "";
}

async function sendDentistCredentials() {
  const input=qs("#accDentistEmail"), status=qs("#dentistCredentialsStatus"), button=qs("#sendDentistCredentialsBtn");
  const role = qs("#accUserRole").value;
  if(!["dentist", "staff"].includes(role)) return;
  if(!input.value.trim() || !input.reportValidity()) { status.textContent="Enter the new account email address."; return; }
  button.disabled=true;
  status.textContent="Sending invitation...";
  try {
    const response=await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/users/invite-dentist`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:input.value.trim(),role})});
    const result=await response.json();
    if(!response.ok) throw new Error(result.message || "Could not send invitation.");
    status.textContent=result.message;
  } catch(error) { status.textContent=error.message || "Could not send invitation. Please try again."; }
  finally { button.disabled=false; }
}

async function createDentistAccount(sendAfterCreation = false) {
  if (["dentist", "staff"].includes(qs("#accUserRole").value)) return sendDentistCredentials();
  const role = qs("#accUserRole").value;
  const name = qs("#accDentistName").value.trim();
  const email = qs("#accDentistEmail").value.trim().toLowerCase();
  const contact = qs("#accDentistContact").value.trim();
  const username = qs("#accDentistUsername").value.trim();
  const password = qs("#accDentistPassword").value;
  const submitBtn = qs("#createAccountBtn");

  if (!name || !email || !username || !password) {
    alert("Please fill all account fields.");
    qs("#dentistCredentialsStatus").textContent = "Enter the new dentist name, email, username and password first.";
    return false;
  }

  if (!qs("#accDentistEmail").reportValidity()) return false;

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      qs("#sendDentistCredentialsBtn").disabled = true;
      submitBtn.textContent = "Creating...";
    }

    const dbUser = await saveUserAccountToDatabase({
      role: role || "dentist",
      name,
      email,
      contact,
      username,
      password
    });

    upsertLocalAccount({
      id: dbUser.id,
      name,
      role: dbUser.role || role || "dentist",
      email: dbUser.email || email,
      contact,
      username
    });


    saveState();
    renderAccounts();

    qs("#accUserRole").value = "dentist";
    qs("#accDentistName").value = "";
    if (role !== "dentist") qs("#accDentistEmail").value = "";
    qs("#accDentistContact").value = "";
    qs("#accDentistUsername").value = "";
    if (role !== "dentist") qs("#accDentistPassword").value = "";
    updateCreateUserRole();
    qs("#dentistCredentialsStatus").textContent = "Account created.";

    addNotification("New User Account", `${name} account was created.`);
    if (sendAfterCreation !== true) alert("User account created. You can now send the new dentist their login credentials.");
    return true;
  } catch (error) {
    console.error("Create account error:", error);
    qs("#dentistCredentialsStatus").textContent = error.message || "Could not create user account.";
    if (sendAfterCreation !== true) alert(error.message || "Could not create user account.");
    return false;
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      qs("#sendDentistCredentialsBtn").disabled = false;
      submitBtn.textContent = "Create Account";
    }
  }
}

function openAccountModal(id = null) {
  const account = id ? state.accounts.find(a => a.id === id) : null;

  openSharedModal(
    account ? "Edit User Account" : "Add User Account",
    `
      <div class="form-grid one">
        <div>
          <label class="label" for="modalAccountRole">Role</label>
          <select class="input select" id="modalAccountRole">
            <option value="dentist" ${account?.role === "dentist" ? "selected" : ""}>Dentist</option>
            <option value="staff" ${account?.role === "staff" ? "selected" : ""}>Staff</option>
            <option value="admin" ${account?.role === "admin" ? "selected" : ""}>Admin</option>
          </select>
        </div>
        <div>
          <label class="label" for="modalAccountName">Full Name</label>
          <input class="input" id="modalAccountName" type="text" value="${account ? escapeAttr(account.name) : ""}" />
        </div>
        <div>
          <label class="label" for="modalAccountEmail">Email</label>
          <input class="input" id="modalAccountEmail" type="email" value="${account ? escapeAttr(account.email) : ""}" />
        </div>
        <div>
          <label class="label" for="modalAccountContact">Contact</label>
          <input class="input" id="modalAccountContact" type="text" value="${account ? escapeAttr(account.contact || "") : ""}" />
        </div>
        <div>
          <label class="label" for="modalAccountUsername">Username</label>
          <input class="input" id="modalAccountUsername" type="text" value="${account ? escapeAttr(account.username) : ""}" />
        </div>
        ${account ? "" : `
        <div>
          <label class="label" for="modalAccountPassword">Password</label>
          <input class="input" id="modalAccountPassword" type="password" />
        </div>
        `}
        <button class="btn primary" type="button" id="saveAccountModalBtn">${account ? "Save Changes" : "Save Account"}</button>
      </div>
    `
  );

  qs("#saveAccountModalBtn").addEventListener("click", async () => {
    const role = qs("#modalAccountRole").value;
    const name = qs("#modalAccountName").value.trim();
    const email = qs("#modalAccountEmail").value.trim().toLowerCase();
    const contact = qs("#modalAccountContact").value.trim();
    const username = qs("#modalAccountUsername").value.trim();
    const password = qs("#modalAccountPassword")?.value.trim() || "";
    const submitBtn = qs("#saveAccountModalBtn");

    if (!role || !name || !email || !username || (!account && !password)) {
      alert("Please fill all account fields.");
      return;
    }

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = account ? "Saving..." : "Creating...";
      }

      if (account) {
        Object.assign(account, { role, name, email, contact, username });
        addNotification("User Account Updated", `${name} account was updated.`);
      } else {
        const dbUser = await saveUserAccountToDatabase({ role, name, email, contact, username, password });
        upsertLocalAccount({
          id: dbUser.id,
          role: dbUser.role || role,
          name,
          email: dbUser.email || email,
          contact,
          username
        });
        addNotification("New User Account", `${name} account was created.`);
      }

      saveState();
      closeSharedModal();
      renderAll();
    } catch (error) {
      console.error("Save account error:", error);
      alert(error.message || "Could not save user account.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = account ? "Save Changes" : "Save Account";
      }
    }
  });
}

function renderAll() {
  renderNotifications();
  renderDashboard();
  renderServices();
  renderAppointments();
  renderBilling();
  renderAdditionalFees();
  renderRevenue();
  renderDentists();
  renderStaff();
  renderPatients();
  renderAccounts();
  renderArchivedUsers();
  fillSettingsForms();
  fillAdminForm();
  renderAdminProfile();
  renderAdminName();
  enhanceResponsiveTables();
}

function setupResponsiveTables() {
  enhanceResponsiveTables();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(enhanceResponsiveTables);
  });

  qsa(".table-wrap table").forEach(table => {
    const target = table.querySelector("tbody") || table;
    observer.observe(target, { childList: true, subtree: true });
  });
}

function enhanceResponsiveTables() {
  qsa(".table-wrap table").forEach(table => {
    const headers = Array.from(table.querySelectorAll("thead th")).map(th => th.textContent.trim());
    if (!headers.length) return;

    table.classList.add("mobile-card-table");
    table.querySelectorAll("tbody tr").forEach(row => {
      const cells = Array.from(row.children).filter(cell => cell.tagName === "TD");
      cells.forEach((cell, index) => {
        if (cell.colSpan && cell.colSpan > 1) return;
        const label = headers[index] || "";
        if (label) cell.dataset.label = label;
      });
    });
  });
}

function renderAdditionalFees() {
  const tbody = qs("#additionalFeesTable");
  if (!tbody || !window.GMAdditionalFees) return;
  const fees = GMAdditionalFees.getDb().additionalFees.filter(fee => !fee.archived);
  tbody.innerHTML = fees.length ? fees.map(fee => `
    <tr>
      <td data-label="Fee Name"><strong>${escapeHtml(fee.name)}</strong></td>
      <td data-label="Description">${escapeHtml(fee.description || "-")}</td>
      <td data-label="Price">${escapeHtml(GMAdditionalFees.priceLabel(fee))}</td>
      <td data-label="Status"><span class="status-badge ${fee.active ? "status-approved" : "status-rejected"}">${fee.active ? "Active" : "Inactive"}</span></td>
      <td data-label="Actions"><div class="inline-actions"><button class="action-btn edit" data-fee-action="edit" data-fee-id="${escapeAttr(fee.id)}" title="Edit"><i class="bi bi-pencil"></i></button><button class="action-btn" data-fee-action="toggle" data-fee-id="${escapeAttr(fee.id)}" title="Activate or deactivate"><i class="bi bi-power"></i></button><button class="action-btn danger" data-fee-action="delete" data-fee-id="${escapeAttr(fee.id)}" title="Delete"><i class="bi bi-trash"></i></button></div></td>
    </tr>`).join("") : `<tr><td colspan="5" class="empty-state">No additional fees found.</td></tr>`;
  tbody.querySelectorAll("[data-fee-action]").forEach(button => button.addEventListener("click", () => {
    const id = button.dataset.feeId;
    const db = GMAdditionalFees.getDb();
    const fee = db.additionalFees.find(item => item.id === id);
    if (!fee) return;
    if (button.dataset.feeAction === "edit") openAdditionalFeeModal(id);
    if (button.dataset.feeAction === "toggle") { fee.active = !fee.active; fee.updatedAt = new Date().toISOString(); GMAdditionalFees.saveDb(db); renderAdditionalFees(); }
    if (button.dataset.feeAction === "delete" && confirm(`Delete ${fee.name}?`)) { fee.archived = true; fee.active = false; fee.updatedAt = new Date().toISOString(); GMAdditionalFees.saveDb(db); renderAdditionalFees(); }
  }));
}

function openAdditionalFeeModal(id = "") {
  const db = GMAdditionalFees.getDb();
  const item = db.additionalFees.find(fee => fee.id === id);
  openSharedModal(item ? "Edit Additional Fee" : "Add Additional Fee", `
    <div class="form-grid one"><div><label class="label" for="additionalFeeName">Fee Name</label><input class="input" id="additionalFeeName" value="${escapeAttr(item?.name || "")}" /></div>
    <div><label class="label" for="additionalFeeDescription">Description</label><textarea class="input" id="additionalFeeDescription">${escapeHtml(item?.description || "")}</textarea></div>
    <div><label class="label" for="additionalFeePricingType">Pricing</label><select class="input select" id="additionalFeePricingType">${[['fixed','Fixed'],['range','Price range'],['from','Starting price'],['variable','Varies - quote per patient']].map(([value,label]) => `<option value="${value}" ${(item?.pricingType || 'fixed') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div>
    <div class="form-grid two"><div><label class="label" for="additionalFeePrice">Base / minimum price</label><input class="input" id="additionalFeePrice" type="number" min="0" step="0.01" value="${escapeAttr(String(item?.price ?? 0))}" /></div><div><label class="label" for="additionalFeeMaxPrice">Maximum Price</label><input class="input" id="additionalFeeMaxPrice" type="number" min="0" step="0.01" value="${escapeAttr(String(item?.maxPrice ?? item?.price ?? 0))}" /></div></div>
    <div class="form-actions-inline"><button class="btn primary" type="button" id="saveAdditionalFeeBtn">Save Fee</button></div></div>`);
  qs("#saveAdditionalFeeBtn").addEventListener("click", () => {
    try {
      const values = GMAdditionalFees.validateFee({ name: qs("#additionalFeeName").value, price: qs("#additionalFeePrice").value }, id);
      const pricingType = qs("#additionalFeePricingType").value;
      const maxPrice = pricingType === "range" ? Number(qs("#additionalFeeMaxPrice").value || values.price) : values.price;
      if (!Number.isFinite(maxPrice) || maxPrice < values.price) throw new Error("Maximum price must be at least the current price.");
      const next = { ...(item || { id: `fee-${uid()}`, active: true, createdAt: new Date().toISOString() }), ...values, pricingType, minPrice: values.price, maxPrice, description: qs("#additionalFeeDescription").value.trim(), updatedAt: new Date().toISOString() };
      if (item) Object.assign(item, next); else db.additionalFees.push(next);
      GMAdditionalFees.saveDb(db); closeSharedModal(); renderAdditionalFees(); showToast("Additional fee saved.", "success");
    } catch (error) { showToast(error.message, "error"); }
  });
}

function renderNotifications() {
  const list = qs("#notifList");
  const dot = qs("#notifDot");
  let hasUnread = false;

  list.innerHTML = "";

  state.notifications.forEach(item => {
    if (item.read === false) hasUnread = true;

    const div = document.createElement("div");
    div.className = "notification-item";
    div.innerHTML = `
      <strong>${escapeHtml(item.title)}</strong>
      <p>${escapeHtml(item.body)}</p>
      <span>${escapeHtml(item.time)}</span>
    `;
    list.appendChild(div);
  });

  if (dot) {
    dot.classList.toggle("hidden", !hasUnread);
  }

  const count = qs("#notifCount");
  if (count) {
    count.textContent = String(state.notifications.length);
  }

  const seeAllBtn = qs("#seeAllNotificationsBtn");
  if (seeAllBtn) {
    seeAllBtn.onclick = () => {
      closeFloatingMenus();

      openViewModal(
        "All Notifications",
        state.notifications.length
          ? state.notifications.map(item => `
              <div class="detail-box">
                <strong>${escapeHtml(item.title)}</strong>
                <div>${escapeHtml(item.body)}</div>
                <div style="margin-top:6px;color:var(--muted);">${escapeHtml(item.time)}</div>
              </div>
            `).join("")
          : `<div class="empty-state">No notifications available.</div>`
      );
    };
  }
}

function renderDashboard() {
  const activeAppointments = state.appointments.filter(a => !a.archived);
  const pending = activeAppointments.filter(a => a.status === "Pending").length;
  const approved = activeAppointments.filter(a =>
  ["Approved", "Paid", "Completed"].includes(a.status)
).length;
  const paid = activeAppointments.filter(a => a.status === "Paid").length;
  const completed = activeAppointments.filter(a => a.status === "Completed").length;

  const servicePriceMap = new Map(
    state.services.filter(s => !s.archived).sort(window.GMServiceCatalog.compareNames).map(s => [s.name, Number(s.price)])
  );

const revenue = activeAppointments.reduce((sum, a) => {
  const online = Number(a.amountPaidOnline || 0);
  const clinic = Number(a.amountPaidInClinic || 0);
  return sum + online + clinic;
}, 0);

  qs("#statAppointments").textContent = String(activeAppointments.length);
  qs("#statPending").textContent = String(pending);
  qs("#statApproved").textContent = String(approved);
  qs("#statRevenue").textContent = formatMoney(revenue);

  // New billing stats
  const pendingPayments = activeAppointments.filter(a => a.paymentStatus === "Unpaid" || a.paymentStatus === "Partial").reduce((sum, a) => sum + Number(a.remainingBalance || 0), 0);
  const todayPayments = activeAppointments.filter(a => a.date === todayISO()).reduce((sum, a) => {
    const online = Number(a.amountPaidOnline || 0);
    const clinic = Number(a.amountPaidInClinic || 0);
    return sum + online + clinic;
  }, 0);
  const activePatientsCount = state.patients ? state.patients.filter(p => !p.archived).length : 0;

  qs("#statPendingPayments").textContent = formatMoney(pendingPayments);
  qs("#todayRevenue").textContent = formatMoney(todayPayments);
  qs("#outstandingBalance").textContent = formatMoney(pendingPayments);
  qs("#statActivePatients").textContent = String(activePatientsCount);

  const recentBody = qs("#dashboardRecentAppointments");
  recentBody.innerHTML = "";

  const recent = [...activeAppointments]
    .sort((a, b) => dateTimeValue(b.date, b.time) - dateTimeValue(a.date, a.time))
    .slice(0, 12);

  if (!recent.length) {
    recentBody.innerHTML = `<tr><td colspan="5" class="empty-state">No appointments yet.</td></tr>`;
  } else {
    recent.forEach(item => {
      recentBody.insertAdjacentHTML(
        "beforeend",
        `
        <tr>
          <td>${escapeHtml(item.patient)}</td>
          <td>${escapeHtml(item.dentist)}</td>
          <td>${escapeHtml(item.service)}</td>
          <td>${formatDate(item.date)}</td>
          <td>${statusBadge(item.status)}</td>
        </tr>
        `
      );
    });
  }

  const todayBox = qs("#todaySchedule");
  todayBox.innerHTML = "";

  const todayKey = todayISO();
  const allTodayItems = activeAppointments
  .filter(a => a.date === todayKey)
  .sort((a, b) => a.time.localeCompare(b.time));

const todayItems = allTodayItems.slice(0, 3);


  if (!todayItems.length) {
    todayBox.innerHTML = `<div class="empty-state">No appointments today.</div>`;
  } else {
    todayItems.forEach(a => {
      todayBox.insertAdjacentHTML(
        "beforeend",
        `
        <div class="list-item">
          <strong>${formatTime(a.time)} - ${escapeHtml(a.patient)}</strong>
          <span>${escapeHtml(a.service)} with ${escapeHtml(a.dentist)}</span>
        </div>
        `
      );
    });
  }

  const allAlerts = [
  {
    title: `${pending} pending appointments`,
    text: "Waiting for review or approval."
  },
  {
    title: `${paid} paid appointments`,
    text: "Payments recorded successfully."
  },
  {
    title: `${completed} completed appointments`,
    text: "Treatments marked as finished."
  },
  {
    title: `${state.patients.filter(p => !p.archived).length} active patients`,
    text: "Patient records currently visible."
  }
];

const alertsBox = qs("#alertsBox");
alertsBox.innerHTML = "";

allAlerts.slice(0, 3).forEach(alert => {
  alertsBox.insertAdjacentHTML(
    "beforeend",
    `
    <div class="list-item">
      <strong>${escapeHtml(alert.title)}</strong>
      <p>${escapeHtml(alert.text)}</p>
    </div>
    `
  );
});

  bindDashboardSeeMore(allTodayItems);
}

function bindDashboardSeeMore(todayItems) {
  const scheduleBtn = qs("#seeMoreScheduleBtn");
  const alertsBtn = qs("#seeMoreAlertsBtn");

  if (scheduleBtn) {
    scheduleBtn.onclick = () => {
      openViewModal(
        "Today's Schedule",
        todayItems.length
          ? todayItems.map(a => `
              <div class="detail-box">
                <strong>${formatTime(a.time)} - ${escapeHtml(a.patient)}</strong>
                <div>${escapeHtml(a.service)}</div>
                <div>${escapeHtml(a.dentist)}</div>
              </div>
            `).join("")
          : `<div class="empty-state">No appointments today.</div>`
      );
    };
  }

  if (alertsBtn) {
    alertsBtn.onclick = () => {
      const activeAppointments = state.appointments.filter(a => !a.archived);
      const pending = activeAppointments.filter(a => a.status === "Pending").length;
      const paid = activeAppointments.filter(a => a.status === "Paid").length;
      const completed = activeAppointments.filter(a => a.status === "Completed").length;

      openViewModal(
        "All Alerts",
        `
          <div class="detail-list">
            <div class="detail-box"><strong>${pending} pending appointments</strong>Waiting for review or approval.</div>
            <div class="detail-box"><strong>${paid} paid appointments</strong>Payments recorded successfully.</div>
            <div class="detail-box"><strong>${completed} completed appointments</strong>Treatments marked as finished.</div>
            <div class="detail-box"><strong>${state.patients.filter(p => !p.archived).length} active patients</strong>Patient records currently visible.</div>
            <div class="detail-box"><strong>${state.dentists.filter(d => !d.archived).length} active dentists</strong>Dentists available in the system.</div>
          </div>
        `
      );
    };
  }
}

function renderServices() {
  const tbody = qs("#servicesTable");
  tbody.innerHTML = "";

  const items = state.services.filter(s => !s.archived).sort(window.GMServiceCatalog.compareNames);

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="empty-state">No services found.</td></tr>`;
    return;
  }

  items.forEach(service => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(service.name)}</td>
      <td>${formatMoney(service.price)}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="action-btn delete" type="button" title="Archive">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".edit").addEventListener("click", () => openServiceModal(service.id));
    tr.querySelector(".delete").addEventListener("click", () => archiveItem("services", service.id));
    tbody.appendChild(tr);
  });
}

function renderAppointments() {
  const tbody = qs("#appointmentsTable");
  tbody.innerHTML = "";

  const items = state.appointments.filter(a => !a.archived && isUsableAppointmentRecord(a));

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No appointments found.</td></tr>`;
    return;
  }

  items
    .sort((a, b) => dateTimeValue(a.date, a.time) - dateTimeValue(b.date, b.time))
    .forEach(item => {
      const tr = document.createElement("tr");
      tr.className = `appointment-table-row${item.date === todayISO() ? " is-today" : ""}`;
      tr.innerHTML = `
        <td>
          <div class="table-identity">
            <strong>${escapeHtml(item.patient)}</strong>
            <span>${item.date === todayISO() ? "Today" : "Patient Record"}</span>
          </div>
        </td>
        <td>
          <div class="table-identity">
            <strong>${escapeHtml(item.dentist)}</strong>
            <span>Dentist</span>
          </div>
        </td>
        <td>
          <div class="table-service">
            <span class="service-mark"><i class="bi bi-shield-plus"></i></span>
            <span>${escapeHtml(item.service)}</span>
          </div>
        </td>
        <td><span class="table-muted">${formatDate(item.date)}</span></td>
        <td><span class="table-muted">${formatTime(item.time)}</span></td>
        <td>${statusBadge(item.status)}</td>
        <td class="action-menu-cell">
          <button class="kebab-btn" type="button">
            <i class="bi bi-three-dots-vertical"></i>
          </button>
          <div class="dropdown">
            <button type="button">Edit</button>
            <button type="button" class="danger-text">Archive</button>
          </div>
        </td>
      `;

      const kebab = tr.querySelector(".kebab-btn");
      const menu = tr.querySelector(".dropdown");
      const [editBtn, archiveBtn] = menu.querySelectorAll("button");

      kebab.addEventListener("click", e => {
        e.stopPropagation();
        toggleDropdown(menu, kebab);
      });

      editBtn.addEventListener("click", () => {
        closeAllDropdowns();
        openAppointmentModal(item.id);
      });

      archiveBtn.addEventListener("click", () => {
        closeAllDropdowns();
        archiveItem("appointments", item.id);
      });

      tbody.appendChild(tr);
    });
}

function isUsableAppointmentRecord(item = {}) {
  const patient = String(item.patientName || item.patient || item.patientId || "").trim();
  const service = String(item.service || "").trim();
  const schedule = String(item.schedule || "").trim();
  const date = String(item.date || "").trim();
  return Boolean(patient && (service || schedule || date) && service.toLowerCase() !== "no appointment yet" && item.recordType !== "profile");
}

function renderDentists() {
  const tbody = qs("#dentistsTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  const search = safeValue(qs("#dentistSearch")).trim().toLowerCase();
  const sort = safeValue(qs("#dentistSort"));

  let items = (state.dentists || []).filter(d => !d.archived);

  if (search) {
    items = items.filter(d =>
      safeText(d.name, "").toLowerCase().includes(search) ||
      safeText(d.specialty, "").toLowerCase().includes(search) ||
      safeText(d.email, "").toLowerCase().includes(search)
    );
  }

  if (sort === "name") {
    items.sort((a, b) => safeText(a.name, "").localeCompare(safeText(b.name, "")));
  } else if (sort === "specialty") {
    items.sort((a, b) => safeText(a.specialty, "").localeCompare(safeText(b.specialty, "")));
  }

  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(
      6,
      "No dentists found",
      "Add a dentist or adjust your search.",
      "bi-person-badge"
    );
    return;
  }

  items.forEach(dentist => {
    const tr = document.createElement("tr");

    const email = dentist.email || "-";
    const status = dentist.archived ? "Archived" : "Active";
    const scheduleText = Array.isArray(dentist.schedules) && dentist.schedules.length
      ? dentist.schedules.map(s => `${s.day} ${s.start}-${s.end}`).join(", ")
      : "-";

    tr.innerHTML = `
      <td>${escapeHtml(dentist.name || "-")}</td>
      <td>${escapeHtml(dentist.specialty || "-")}</td>
      <td>${escapeHtml(email)}</td>
      <td>${statusBadge(status)}</td>
      <td>${escapeHtml(scheduleText)}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="action-btn archive" type="button" title="Archive">
            <i class="bi bi-archive"></i>
          </button>
          <button class="action-btn success" type="button" title="View">
            <i class="bi bi-eye"></i>
          </button>
        </div>
      </td>
    `;

    safeOn(tr.querySelector(".edit"), "click", () => openDentistModal(dentist.id));
    safeOn(tr.querySelector(".archive"), "click", () => archiveItem("dentists", dentist.id));
    safeOn(tr.querySelector(".success"), "click", () => showDentistView(dentist.id));

    tbody.appendChild(tr);
  });
}

function renderPatients() {
  const tbody = qs("#patientsTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  const search = safeValue(qs("#patientSearch")).trim().toLowerCase();
  const sort = safeValue(qs("#patientSort"));

  let items = (state.patients || []).filter(p => !p.archived);

  if (search) {
    items = items.filter(p =>
      safeText(p.name, "").toLowerCase().includes(search) ||
      safeText(p.email, "").toLowerCase().includes(search) ||
      safeText(p.contact, "").toLowerCase().includes(search)
    );
  }

  if (sort === "name") {
    items.sort((a, b) => safeText(a.name, "").localeCompare(safeText(b.name, "")));
  } else if (sort === "age") {
    items.sort((a, b) => Number(a.age || 0) - Number(b.age || 0));
  }

  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(
      6,
      "No patients found",
      "Add a patient or adjust your search.",
      "bi-people"
    );
    return;
  }

  items.forEach(patient => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${escapeHtml(patient.name || "-")}</td>
      <td>${escapeHtml(patient.email || "-")}</td>
      <td>${escapeHtml(patient.contact || "-")}</td>
      <td>${statusBadge(patient.archived ? "Archived" : "Active")}</td>
      <td>${escapeHtml(patient.createdAt ? formatDate(patient.createdAt) : "-")}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="action-btn archive" type="button" title="Archive">
            <i class="bi bi-archive"></i>
          </button>
          <button class="action-btn success" type="button" title="View">
            <i class="bi bi-eye"></i>
          </button>
        </div>
      </td>
    `;

    safeOn(tr.querySelector(".edit"), "click", () => openPatientModal(patient.id));
    safeOn(tr.querySelector(".archive"), "click", () => archiveItem("patients", patient.id));
    safeOn(tr.querySelector(".success"), "click", () => showPatientView(patient.id));

    tbody.appendChild(tr);
  });
}

function renderAccounts() {
  const tbody = qs("#accountsTable");
  tbody.innerHTML = "";

  const searchTerm = qs("#userSearch")?.value.trim().toLowerCase() || "";
  const roleFilter = qs("#userRoleFilter")?.value || "";
  let accounts = [...state.accounts].filter(acc => !acc.archived);

  if (searchTerm) {
    accounts = accounts.filter(acc =>
      acc.name.toLowerCase().includes(searchTerm) ||
      acc.email.toLowerCase().includes(searchTerm) ||
      acc.username.toLowerCase().includes(searchTerm)
    );
  }

  if (roleFilter) {
    accounts = accounts.filter(acc => String(acc.role || "").toLowerCase() === roleFilter.toLowerCase());
  }

  if (!accounts.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">No user accounts found.</td></tr>`;
    return;
  }

  accounts.forEach(acc => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(acc.name)}</td>
      <td>${escapeHtml(acc.role || "Dentist")}</td>
      <td>${escapeHtml(acc.email)}</td>
      <td>${escapeHtml(acc.contact || "-")}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Edit">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="action-btn archive" type="button" title="Archive">
            <i class="bi bi-archive"></i>
          </button>
          <button class="action-btn delete" type="button" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".edit").addEventListener("click", () => openAccountModal(acc.id));
    tr.querySelector(".archive").addEventListener("click", () => archiveItem("accounts", acc.id));
    tr.querySelector(".delete").addEventListener("click", () => deleteItem("accounts", acc.id));

    tbody.appendChild(tr);
  });
}

function renderArchivedUsers() {
  const table = qs("#archivedUsersTable");
  if (!table) return;

  const archivedItems = [
    ...state.accounts.filter(item => item.archived).map(item => ({
      id: item.id,
      name: item.name,
      role: item.role || "dentist",
      source: "Account",
      type: "accounts"
    })),
    ...state.dentists.filter(item => item.archived).map(item => ({
      id: item.id,
      name: item.name,
      role: "dentist",
      source: "Dentist",
      type: "dentists"
    })),
    ...((state.staff || []).filter(item => item.archived).map(item => ({
      id: item.id,
      name: item.name,
      role: "staff",
      source: "Staff",
      type: "staff"
    }))),
    ...state.patients.filter(item => item.archived).map(item => ({
      id: item.id,
      name: item.name,
      role: "patient",
      source: "Patient",
      type: "patients"
    }))
  ];

  if (!archivedItems.length) {
    table.innerHTML = `<tr><td colspan="4" class="empty-state">No archived users.</td></tr>`;
    return;
  }

  table.innerHTML = "";

  archivedItems.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.role)}</td>
      <td>${escapeHtml(item.source)}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Restore">
            <i class="bi bi-arrow-counterclockwise"></i>
          </button>
          <button class="action-btn delete" type="button" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    `;

    tr.querySelector(".edit").addEventListener("click", () => {
      recoverItem(item.type, item.id);
    });

    tr.querySelector(".delete").addEventListener("click", () => {
      deleteArchivedItem(item.type, item.id);
    });

    table.appendChild(tr);
  });
}

function deletePatientPermanently(id) {
  const patient = state.patients.find(row => String(row.id) === String(id));
  if (!patient) return;
  openConfirmModal("Delete Patient", `Permanently remove "${patient.name}" from patient records?`, "Delete", "Cancel", async () => {
    try {
      const response = await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/patients/${encodeURIComponent(id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Patient could not be deleted.");
      const db = getClinicDb();
      db.deletedPatients = [...(db.deletedPatients || []), result.deletedPatient];
      window.GMDefaultAccounts.normalizeDb(db);
      saveClinicDb(db);
      state.patients = state.patients.filter(row => !window.GMDefaultAccounts.isDeletedPatient(db, row));
      saveState(true);
      addNotification("Patient Deleted", `${patient.name} was removed from patient records.`);
      renderAll();
    } catch (error) {
      alert(error.message || "Patient could not be deleted. Please try again.");
    }
  });
}

function deleteItem(type, id) {
  if (type === "patients") return deletePatientPermanently(id);
  const item = state[type].find(x => x.id === id);
  if (!item) return;

  openConfirmModal(
    "Confirm Delete",
    `Are you sure you want to permanently delete "${item.name || "this item"}"? This action cannot be undone.`,
    "Delete",
    "Cancel",
    () => {
      state[type] = state[type].filter(x => x.id !== id);
      saveState();

      if (type === "patients") {
        removeBrokenPatientCompletely(item.name);
      }

      if (type === "dentists") {
        const targetName = String(item.name || "").trim().toLowerCase();
        const db = getClinicDb();
        db.appointments = (Array.isArray(db.appointments) ? db.appointments : []).filter(a => {
          const dentistName = String(a.dentist || "").trim().toLowerCase();
          return dentistName !== targetName;
        });
        saveClinicDb(db);
      }

      addNotification("Item Deleted", `${item.name || "Record"} was permanently deleted.`);
      renderAll();
    }
  );
}

function clearActiveSection(type, label) {
  if (type === "appointments") return;
  openConfirmModal(
    "Confirm Clear All",
    `This will remove all active ${label} records from the system. Continue?`,
    "Clear All",
    "Cancel",
    () => {
      state[type] = state[type].filter(item => !!item.archived);
      saveState();
      renderAll();
      addNotification("Cleared Records", `All active ${label} records were cleared.`);
    }
  );
}

function toggleArchivedUsersPanel() {
  const panel = qs("#archivedUsersPanel");
  if (!panel) return;

  panel.classList.toggle("hidden");
  const button = qs("#toggleArchivedUsersBtn");
  if (button) {
    button.textContent = panel.classList.contains("hidden") ? "Show Archived Users" : "Hide Archived Users";
  }

  if (!panel.classList.contains("hidden")) {
    renderArchivedUsers();
  }
}

function clearArchivedUsers() {
  openConfirmModal(
    "Confirm Clear Archived",
    "Permanently delete all archived user records? This cannot be undone.",
    "Clear Archived",
    "Cancel",
    () => {
      state.accounts = state.accounts.filter(item => !item.archived);
      state.dentists = state.dentists.filter(item => !item.archived);
      state.staff = (state.staff || []).filter(item => !item.archived);
      state.patients = state.patients.filter(item => !item.archived);

      saveState();
      renderAll();
      addNotification("Archived Cleared", "All archived user records were removed.");
    }
  );
}

function toggleDropdown(menu, anchor) {
  const isOpen = menu.classList.contains("show");
  closeAllDropdowns();
  if (isOpen) return;

  menu.classList.add("show");
  menu.classList.remove("up");

  const menuHeight = menu.offsetHeight || 120;
  const anchorRect = anchor.getBoundingClientRect();
  const bottomSpace = window.innerHeight - (anchorRect.bottom + menuHeight + 8);

  if (bottomSpace < 0) {
    menu.classList.add("up");
  }
}

function closeAllDropdowns() {
  qsa(".dropdown").forEach(d => d.classList.remove("show", "up"));
}

document.addEventListener("click", e => {
  if (!e.target.closest(".menu-wrap") && !e.target.closest(".action-menu-cell")) {
    closeAllDropdowns();
  }
});

function archiveItem(type, id) {
  if (type === "appointments") return;
  const item = state[type].find(x => x.id === id);
  if (!item) return;

  const label = type === "staff" ? "staff" : type.slice(0, -1);
  const message = `Are you sure you want to archive "${item.name || "this item"}"?`;

  openConfirmModal(
    "Confirm Archive",
    message,
    "Archive",
    "Cancel",
    () => {
      item.archived = true;
      if (type === 'services') item.updatedAt = new Date().toISOString();

      if (type === "patients") {
        const targetName = String(item.name || "").trim().toLowerCase();

        const db = getClinicDb();
        db.appointments = (Array.isArray(db.appointments) ? db.appointments : []).filter(a => {
          const patientName = String(a.patientName || a.patient || "").trim().toLowerCase();
          const isProfileOnly = String(a.status || "").trim() === "Profile Only";
          return !(patientName === targetName && isProfileOnly);
        });
        saveClinicDb(db);
      }

      if (type === "dentists") {
        const targetName = String(item.name || "").trim().toLowerCase();

        const db = getClinicDb();
        db.appointments = (Array.isArray(db.appointments) ? db.appointments : []).filter(a => {
          const dentistName = String(a.dentist || "").trim().toLowerCase();
          const isProfileOnly = String(a.status || "").trim() === "Profile Only";
          return !(dentistName === targetName && isProfileOnly);
        });
        saveClinicDb(db);
      }

      saveState();

      addNotification("Item Archived", `${label.charAt(0).toUpperCase() + label.slice(1)} was archived.`);

      fullAdminSync();
      renderAll();
    }
  );
}

function cleanupBrokenProfileOnlyRecords() {
  const db = getClinicDb();
  const list = Array.isArray(db.appointments) ? db.appointments : [];

  db.appointments = list.filter(a => {
    const status = String(a.status || "").trim();
    const patientName = String(a.patientName || a.patient || "").trim();
    const dentistName = String(a.dentist || "").trim();
    const hasRealAppointmentData = !!(a.service || a.date || a.time || a.schedule);

    if (status !== "Profile Only") return true;

    if (!patientName && !dentistName) return false;
    if (!hasRealAppointmentData) return false;

    return true;
  });

  saveClinicDb(db);
}

function openRestoreModal(type) {
  const body = qs("#restoreBody");
  const title = qs("#restoreTitle");

  const labelMap = {
    services: "Restore Services",
    appointments: "Restore Appointments",
    dentists: "Restore Dentists",
    staff: "Restore Staff",
    patients: "Restore Patients",
    accounts: "Restore Users"
  };

  title.textContent = labelMap[type] || "Restore Items";
  body.innerHTML = "";

  const items = state[type].filter(item => item.archived);

  if (!items.length) {
    body.innerHTML = `<div class="empty-state">No archived items.</div>`;
  } else {
    const wrap = document.createElement("div");
    wrap.className = "restore-list";

    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "restore-item";
      row.innerHTML = `
        <div>${escapeHtml(restoreItemLabel(type, item))}</div>
        <div class="inline-actions">
          <button class="btn success" type="button">Recover</button>
          <button class="btn danger" type="button">Delete</button>
        </div>
      `;

      const [recoverBtn, deleteBtn] = row.querySelectorAll("button");
      recoverBtn.addEventListener("click", () => recoverItem(type, item.id));
      deleteBtn.addEventListener("click", () => deleteArchivedItem(type, item.id));

      wrap.appendChild(row);
    });

    body.appendChild(wrap);
  }

  qs("#restoreBackdrop").classList.remove("hidden");
}

function closeRestoreModal() {
  qs("#restoreBackdrop").classList.add("hidden");
}

function restoreItemLabel(type, item) {
  if (type === "services") return item.name;
  if (type === "appointments") return `${item.patient} - ${item.service}`;
  return item.name;
}

function recoverItem(type, id) {
  if (type === "appointments") return;
  const item = state[type].find(x => x.id === id);
  if (!item) return;

  const label = type === "staff" ? "staff" : type.slice(0, -1);
  const message = `Do you want to restore "${item.name || "this item"}"?`;

  openConfirmModal(
    "Confirm Restore",
    message,
    "Restore",
    "Cancel",
    () => {
      item.archived = false;
      if (type === 'services') item.updatedAt = new Date().toISOString();
      saveState();
      openRestoreModal(type);

      addNotification("Item Restored", `${label.charAt(0).toUpperCase() + label.slice(1)} was restored.`);

      renderAll();
    }
  );
}

function deleteArchivedItem(type, id) {
  if (type === "appointments") return;
  if (type === "patients") return deletePatientPermanently(id);
  const item = state[type].find(x => x.id === id);
  if (!item) return;

  const message = `Are you sure you want to permanently delete "${item.name || item.title || "item"}"? This action cannot be undone.`;

  openConfirmModal(
    "Confirm Permanent Delete",
    message,
    "Delete",
    "Cancel",
    () => {
      state[type] = state[type].filter(x => x.id !== id);
      saveState();
      openRestoreModal(type);

      const label = type.slice(0, -1);
      addNotification("Item Deleted", `${label.charAt(0).toUpperCase() + label.slice(1)} was permanently deleted.`);

      renderAll();
    }
  );
}

function openSharedModal(title, html) {
  qs("#modalTitle").textContent = title;
  qs("#modalBody").innerHTML = html;
  qs("#modalBackdrop").classList.remove("hidden");
}

function closeSharedModal() {
  qs("#modalBackdrop").classList.add("hidden");
  qs("#modalBody").innerHTML = "";
}

function openConfirmModal(title, message, confirmText, cancelText, onConfirm) {
  openSharedModal(title, `
    <div class="confirm-modal">
      <p>${message}</p>
      <div class="modal-actions">
        <button class="btn secondary" id="confirmCancelBtn">${cancelText}</button>
        <button class="btn danger" id="confirmOkBtn">${confirmText}</button>
      </div>
    </div>
  `);

  qs("#confirmCancelBtn").addEventListener("click", closeSharedModal);
  qs("#confirmOkBtn").addEventListener("click", () => {
    closeSharedModal();
    onConfirm();
  });
}

function openViewModal(title, html) {
  qs("#viewTitle").textContent = title;
  qs("#viewBody").innerHTML = html;
  qs("#viewBackdrop").classList.remove("hidden");
}

function closeViewModal() {
  qs("#viewBackdrop").classList.add("hidden");
  qs("#viewBody").innerHTML = "";
}

function openServiceModal(id = null) {
  const item = id ? state.services.find(s => s.id === id) : null;

  openSharedModal(
    item ? "Edit Service" : "Add Service",
    `
      <div class="form-grid one">
        <div>
          <label class="label" for="modalServiceName">Service Name</label>
          <input class="input" id="modalServiceName" type="text" value="${item ? escapeAttr(item.name) : ""}" />
        </div>
        <div>
          <label class="label" for="modalServicePrice">Price</label>
          <input class="input" id="modalServicePrice" type="number" min="0" value="${item ? escapeAttr(item.price) : ""}" />
        </div>
        <button class="btn primary" type="button" id="saveServiceModalBtn">${item ? "Save Changes" : "Save Service"}</button>
      </div>
    `
  );

  qs("#saveServiceModalBtn").addEventListener("click", () => {
    const name = qs("#modalServiceName").value.trim();
    const price = Number(qs("#modalServicePrice").value);

    if (!name || Number.isNaN(price) || price < 0) {
      alert("Please enter a valid service name and price.");
      return;
    }

    if (item) {
      item.name = name;
      item.price = price;
      item.updatedAt = new Date().toISOString();
      addNotification("Service Updated", `${name} was updated.`);
    } else {
      state.services.push({ id: uid(), name, price, archived: false, updatedAt: new Date().toISOString() });
      addNotification("New Service", `${name} was added.`);
    }

    saveState();
    closeSharedModal();
    renderAll();
  });
}
function pushAdminAppointmentsToClinicDb() {
  return; // Admin appointment and billing access is read-only.
  const clinicAppointments = state.appointments.map(a => ({
    id: a.id || uid(),
    patientName: a.patient,
    patient: a.patient,
    dentist: a.dentist,
    service: a.service,
    date: a.date,
    time: a.time,
    schedule: `${a.date} - ${convert24ToDisplayTime(a.time)}`,
    status: a.status,
    archived: !!a.archived,
    archivedForDentist: !!a.archived,
    archivedForPatient: !!a.archived,
    updatedAt: new Date().toISOString()
  }));

  saveClinicAppointments(clinicAppointments);
}
function openAppointmentModal(id = null) {
  const item = state.appointments.find(a => String(a.id) === String(id));
  if (!item) return;
  const details = {Patient:item.patient, Dentist:item.dentist, Service:item.service, Date:formatDate(item.date), Time:formatTime(item.time), Status:item.status, Notes:item.notes || "-"};
  openViewModal("Appointment details", `<div class="form-grid one">${Object.entries(details).map(([label,value]) => `<div class="detail-box"><strong>${escapeHtml(label)}</strong><p>${escapeHtml(String(value || "-"))}</p></div>`).join("")}</div>`);
}

function pushAdminPatientsToClinicState() {
  const clinicAppointments = getClinicAppointments();

  state.patients.forEach(p => {
    const exists = clinicAppointments.some(a => (a.patientName || a.patient || "").trim() === p.name.trim());
    if (!exists) {
      clinicAppointments.push({
        id: uid(),
        patientName: p.name,
        patient: p.name,
        patientPhone: p.contact || "",
        patientAddress: p.address || "",
        age: p.age || "",
        gender: p.gender || "",
        patientCondition: p.condition || "",
        service: "No appointment yet",
        schedule: "",
        status: "Profile Only",
        archived: !!p.archived,
        createdAt: new Date().toISOString()
      });
    }
  });

  saveClinicAppointments(clinicAppointments);
}

function pushAdminDentistsToClinicState() {
  const clinicAppointments = getClinicAppointments();

  state.dentists.forEach(d => {
    const exists = clinicAppointments.some(a => (a.dentist || "").trim() === d.name.trim());
    if (!exists) {
      clinicAppointments.push({
        id: uid(),
        patientName: "",
        dentist: d.name,
        service: "",
        schedule: "",
        status: "Profile Only",
        archived: !!d.archived,
        createdAt: new Date().toISOString()
      });
    }
  });

  saveClinicAppointments(clinicAppointments);
}
function openDentistModal(id = null) {
  const item = id ? state.dentists.find(d => d.id === id) : null;
  let schedules = item ? structuredClone(item.schedules) : [];
  const initialAccount = item
    ? (state.accounts || []).find(a =>
        String(a.id || "") === String(item.accountId || "") ||
        String(a.name || "").trim().toLowerCase() === String(item.name || "").trim().toLowerCase()
      )
    : null;
  const draft = {
    accountId: initialAccount?.id || item?.accountId || "",
    specialty: item?.specialty || "",
    contact: item?.contact || initialAccount?.contact || ""
  };

  const specialtyOptions = [
    "All Services",
    "General Dentist",
    "Orthodontist",
    "Pediatric Dentist",
    "Prosthodontist",
    "Endodontist",
    "Oral Surgeon",
    "Periodontist",
    "Cosmetic Dentist"
  ];

  // Every dentist-role user account is selectable. Picking an account whose
  // name already matches an existing dentist record updates that record in
  // place instead of creating a duplicate (see save handler below).
  const dentistAccounts = (state.accounts || []).filter(a =>
    String(a.role || "").toLowerCase() === "dentist" && !a.archived
  );
  const dentistsByName = new Map(
    (state.dentists || [])
      .filter(d => !d.archived)
      .map(d => [String(d.name || "").trim().toLowerCase(), d])
  );

  // Pre-select the account whose name matches the dentist being edited.
  function renderModal() {
    const accountOptions = dentistAccounts
      .map(a => {
        const linkedDentist = dentistsByName.get(String(a.name || "").trim().toLowerCase());
        const isCurrentItem = item && linkedDentist && linkedDentist.id === item.id;
        const suffix = linkedDentist && !isCurrentItem ? " — already added" : "";
        return `<option value="${escapeAttr(a.id)}" ${draft.accountId === a.id ? "selected" : ""}>${escapeHtml(a.name)}${a.email ? ` (${escapeHtml(a.email)})` : ""}${suffix}</option>`;
      })
      .join("");

    const emptyDropdown = !dentistAccounts.length
      ? `<div class="empty-state" style="margin-top:6px;">No dentist accounts available. Create one in <strong>Create User Account</strong> first (role = Dentist).</div>`
      : "";

    openSharedModal(
      item ? "Edit Dentist" : "Add Dentist",
      `
        <div class="form-grid one">
          <div>
            <label class="label" for="modalDentistName">Dentist Accounts</label>
            <select class="input select" id="modalDentistName">
              <option value="">Select a dentist account…</option>
              ${accountOptions}
            </select>
            ${emptyDropdown}
          </div>

          <div>
            <label class="label" for="modalDentistSpecialty">Specialties (select one or more)</label>
            <select class="input select" id="modalDentistSpecialty" multiple size="5" aria-label="Specializations (select one or more)">

              ${specialtyOptions.map(spec => `
                <option value="${escapeAttr(spec)}" ${String(draft.specialty).split(/[,;|]/).map(value => value.trim()).includes(spec) ? "selected" : ""}>
                  ${escapeHtml(spec)}
                </option>
              `).join("")}
            </select>
          </div>

          <div>
            <label class="label" for="modalDentistContact">Contact</label>
            <input class="input" id="modalDentistContact" type="text" maxlength="11" value="${escapeAttr(draft.contact)}" />
          </div>

          <div class="form-grid three">
            <select class="input select" id="schedDay">
              <option value="">Select day</option>
              ${["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map(day => `<option>${day}</option>`).join("")}
            </select>
            <input class="input" id="schedStart" type="time" />
            <input class="input" id="schedEnd" type="time" />
          </div>

          <button class="btn secondary" type="button" id="addScheduleBtn">Add Schedule</button>

          <div id="schedListWrap">
            ${renderScheduleListHtml(schedules)}
          </div>

          <button class="btn primary" type="button" id="saveDentistModalBtn">${item ? "Save Changes" : "Save Dentist"}</button>
        </div>
      `
    );

    // Auto-fill the contact field from the chosen account when none is set yet.
    qs("#modalDentistName").addEventListener("change", (e) => {
      draft.accountId = e.target.value;
      const account = dentistAccounts.find(a => a.id === e.target.value);
      const contactInput = qs("#modalDentistContact");
      if (account && contactInput && !contactInput.value.trim()) {
        contactInput.value = account.contact || "";
        draft.contact = contactInput.value;
      }
    });

    qs("#addScheduleBtn").addEventListener("click", () => {
      draft.accountId = qs("#modalDentistName").value;
      draft.specialty = Array.from(qs("#modalDentistSpecialty").selectedOptions, option => option.value).filter(Boolean).join(", ");
      draft.contact = qs("#modalDentistContact").value.trim();
      const day = qs("#schedDay").value;
      const start = qs("#schedStart").value;
      const end = qs("#schedEnd").value;

      if (!day || !start || !end) {
        alert("Please complete the schedule fields.");
        return;
      }

      if (schedules.some(s => s.day === day)) {
        alert("That day is already added.");
        return;
      }

      schedules.push({ day, start, end });
      renderModal();
    });

    qsa("[data-remove-schedule]").forEach(btn => {
      btn.addEventListener("click", () => {
        draft.accountId = qs("#modalDentistName").value;
        draft.specialty = Array.from(qs("#modalDentistSpecialty").selectedOptions, option => option.value).filter(Boolean).join(", ");
        draft.contact = qs("#modalDentistContact").value.trim();
        schedules.splice(Number(btn.dataset.removeSchedule), 1);
        renderModal();
      });
    });

    qs("#saveDentistModalBtn").addEventListener("click", () => {
      const accountId = qs("#modalDentistName").value;
      const account = dentistAccounts.find(a => a.id === accountId);
      const name = account?.name?.trim() || "";
      const specialty = Array.from(qs("#modalDentistSpecialty").selectedOptions, option => option.value).filter(Boolean).join(", ");
      const contact = qs("#modalDentistContact").value.trim();
      const email = account?.email || item?.email || "";

      if (!name) {
        alert("Please choose a dentist account from the dropdown.");
        return;
      }

      if (!specialty || !contact) {
        alert("Please fill all dentist fields.");
        return;
      }

      if (!/^[0-9]{11}$/.test(contact)) {
        alert("Contact number must be exactly 11 digits.");
        return;
      }

      if (!schedules.length) {
        alert("Please add at least one schedule.");
        return;
      }

      const existingByName = dentistsByName.get(name.toLowerCase());

      if (item) {
        Object.assign(item, { name, specialty, contact, email, schedules, accountId: account?.id || item.accountId });
        addNotification("Dentist Updated", `${name} profile was updated.`);
      } else if (existingByName) {
        // The chosen account already has a dentist record — update it in place
        // instead of creating a duplicate row.
        Object.assign(existingByName, { specialty, contact, email, schedules, accountId: account?.id, archived: false });
        addNotification("Dentist Updated", `${name} profile was updated.`);
      } else {
        state.dentists.push({ id: uid(), name, specialty, contact, email, schedules, accountId: account?.id, archived: false });
        addNotification("New Dentist", `${name} was added.`);
      }

      saveState();
      closeSharedModal();
      renderAll();
    });
  }

  renderModal();
}

function renderScheduleListHtml(schedules) {
  if (!schedules.length) {
    return `<div class="empty-state">No schedules added yet.</div>`;
  }

  return schedules.map((s, index) => `
    <div class="restore-item">
      <div>${escapeHtml(s.day)} - ${formatTime(s.start)} - ${formatTime(s.end)}</div>
      <button class="btn danger" type="button" data-remove-schedule="${index}">Remove</button>
    </div>
  `).join("");
}

function openPatientModal(id = null) {
  if (!id) return window.GMPatientCreation.open();
  const item = id ? state.patients.find(p => p.id === id) : null;


  openSharedModal(
    item ? "Edit Patient" : "Add Patient",
    `
      <div class="form-grid one">
        <div>
          <label class="label" for="modalPatientName">Name</label>
          <input class="input" id="modalPatientName" type="text" value="${item ? escapeAttr(item.name) : ""}" />
        </div>

        <div>
          <label class="label" for="modalPatientAge">Age</label>
          <input class="input" id="modalPatientAge" type="number" min="0" value="${item ? escapeAttr(item.age) : ""}" />
        </div>

        <div>
          <label class="label" for="modalPatientGender">Gender</label>
          <select class="input select" id="modalPatientGender">
            <option value="">Select gender</option>
            ${["Male", "Female"].map(g => `
              <option value="${g}" ${item?.gender === g ? "selected" : ""}>${g}</option>
            `).join("")}
          </select>
        </div>

        <div>
          <label class="label" for="modalPatientAddress">Address</label>
          <input class="input" id="modalPatientAddress" type="text" value="${item ? escapeAttr(item.address) : ""}" />
        </div>

        <div>
          <label class="label" for="modalPatientContact">Contact</label>
          <input class="input" id="modalPatientContact" type="tel" inputmode="numeric" pattern="[0-9]{11}" maxlength="11" autocomplete="tel-national" value="${item ? escapeAttr(item.contact) : ""}" />
        </div>

        <button class="btn primary" type="button" id="savePatientModalBtn">${item ? "Save Changes" : "Save Patient"}</button>
      </div>
    `
  );

  const patientContactInput = qs("#modalPatientContact");
  patientContactInput.addEventListener("input", () => {
    patientContactInput.value = GMAdminPatientDetails.cleanContact(patientContactInput.value);
  });
  patientContactInput.addEventListener("paste", event => {
    event.preventDefault();
    const start = patientContactInput.selectionStart ?? patientContactInput.value.length;
    const end = patientContactInput.selectionEnd ?? start;
    patientContactInput.value = GMAdminPatientDetails.cleanContact(patientContactInput.value.slice(0, start) + event.clipboardData.getData("text").replace(/[^0-9]/g, "") + patientContactInput.value.slice(end));
  });
  qs("#savePatientModalBtn").addEventListener("click", () => {
    const name = qs("#modalPatientName").value.trim();
    const age = Number(qs("#modalPatientAge").value);
    const gender = qs("#modalPatientGender").value;
    const address = qs("#modalPatientAddress").value.trim();
    const contact = qs("#modalPatientContact").value.trim();

    if (!name || Number.isNaN(age) || !gender || !address || !contact) {
      alert("Please fill all patient fields.");
      return;
    }

    if (!/^[0-9]{11}$/.test(contact)) {
      alert("Contact number must be exactly 11 digits.");
      return;
    }

    if (item) {
      Object.assign(item, { name, age, gender, address, contact });
      addNotification("Patient Updated", `${name} record was updated.`);
    } else {
      state.patients.push({ id: uid(), name, age, gender, address, contact, archived: false, createdAt: new Date().toISOString() });
      addNotification("New Patient", `${name} was added.`);
    }

    saveState();
    closeSharedModal();
    renderAll();
  });
}

function showPatientView(id) {
  const patient = state.patients.find(x => x.id === id);
  if (!patient) return;
  const db = getClinicDb();
  const p = GMAdminPatientDetails.view(patient, db.patients || [], db.appointments || [], state.registeredPatientAccounts || state.accounts || []);

  openViewModal(
    p.name,
    `
      <div class="detail-list">
        <div class="detail-box"><strong>Age</strong>${p.age !== '' && p.age != null ? escapeHtml(String(p.age)) + ' yrs old' : 'Not recorded'}</div>
        <div class="detail-box"><strong>Gender</strong>${escapeHtml(p.gender ? capitalize(p.gender) : 'Not recorded')}</div>
        <div class="detail-box"><strong>Address</strong>${escapeHtml(p.address || 'Not recorded')}</div>
        <div class="detail-box"><strong>Contact</strong>${escapeHtml(p.contact || 'Not recorded')}</div>
      </div>
    `
  );
}

function showDentistView(id) {
  const d = state.dentists.find(x => x.id === id);
  if (!d) return;

  openViewModal(
    d.name,
    `
      <div class="detail-list">
        <div class="detail-box"><strong>Specialty</strong>${escapeHtml(d.specialty)}</div>
        <div class="detail-box"><strong>Contact</strong>${escapeHtml(d.contact)}</div>
        <div class="detail-box">
          <strong>Schedules</strong>
          ${d.schedules.map(s => `<div>${escapeHtml(s.day)} - ${formatTime(s.start)} - ${formatTime(s.end)}</div>`).join("")}
        </div>
      </div>
    `
  );
}

function formatMoney(value) {
  return "PHP " + Number(value || 0).toLocaleString();
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = Number(h);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${suffix}`;
}

function dateTimeValue(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr || "00:00"}`).getTime();
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function statusBadge(status) {
  const key = String(status).toLowerCase();
  let cls = "status-pending";

  if (key === "approved") cls = "status-approved";
  else if (key === "paid") cls = "status-paid";
  else if (key === "completed") cls = "status-completed";
  else if (key === "cancelled") cls = "status-cancelled";
  else if (key === "rejected") cls = "status-rejected";

  return `<span class="status-pill ${cls}">${escapeHtml(status)}</span>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function bindProfileUploadUI() {
  const input = qs("#adminProfileImage");
  const trigger = qs("#profileUploadTrigger");
  const nameEl = qs("#profileUploadName");
  const box = qs("#profileUploadBox");

  if (!input || !trigger || !nameEl || !box) return;

  trigger.addEventListener("click", () => input.click());

  input.addEventListener("change", () => {
    const file = input.files && input.files[0];

    if (file) {
      nameEl.textContent = file.name;
      box.classList.add("is-active");
    } else {
      nameEl.textContent = "No file selected";
      box.classList.remove("is-active");
    }
  });
}
function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}
function cleanDuplicateMeridiem(value = "") {
  return String(value)
    .replace(/\b(AM)\s+\1\b/gi, "AM")
    .replace(/\b(PM)\s+\1\b/gi, "PM")
    .replace(/AMAM/gi, "AM")
    .replace(/PMPM/gi, "PM")
    .replace(/\bAM\s*PM\b/gi, "PM")
    .replace(/\bPM\s*AM\b/gi, "AM")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTimeDisplay(value = "") {
  const cleaned = cleanDuplicateMeridiem(value);
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);

  if (!match) return cleaned;

  let hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();

  if (hour < 1) hour = 12;
  if (hour > 12) hour = ((hour - 1) % 12) + 1;

  return `${hour}:${minute} ${meridiem}`;
}

function convertDisplayTimeTo24(time12) {
  const normalized = normalizeTimeDisplay(time12);
  const match = normalized.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return normalized;

  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const meridiem = match[3].toUpperCase();

  if (meridiem === "PM" && hour !== 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function convert24ToDisplayTime(time24) {
  if (!time24) return "";
  const [hourStr, min] = String(time24).split(":");
  let hour = Number(hourStr);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${min} ${suffix}`;
}

function buildSchedule(dateValue = "", timeValue = "") {
  const safeDate = String(dateValue || "").trim();
  const safeTime = String(timeValue || "").includes(":") && !/[AP]M/i.test(String(timeValue || ""))
    ? convert24ToDisplayTime(timeValue)
    : normalizeTimeDisplay(timeValue);

  return safeDate && safeTime ? `${safeDate} - ${safeTime}` : safeDate || safeTime;
}
function syncAdminAppointmentsFromClinicDb() {
  const clinicAppointments = getClinicAppointments();

  state.appointments = clinicAppointments
    .filter(item => String(item.status || "").trim() !== "Profile Only" && isUsableAppointmentRecord(item))
    .map(item => {
      const schedule = String(item.schedule || "");
      const [scheduleDate = "", rawScheduleTime = ""] = schedule.split("-").map(s => s.trim());
      const scheduleTime = normalizeTimeDisplay(rawScheduleTime);

      const price = Number(item.price || 0);
      const amountPaidOnline = Number(item.amountPaidOnline || 0);
      const amountPaidInClinic = Number(item.amountPaidInClinic || 0);
      const totalCollected = Number(
        item.totalCollected != null
          ? item.totalCollected
          : amountPaidOnline + amountPaidInClinic
      );

      const requiresDownPayment =
        item.requiresDownPayment != null
          ? !!item.requiresDownPayment
          : price >= 5000;

      const minimumDownPayment =
        Number(item.minimumDownPayment || 0) > 0
          ? Number(item.minimumDownPayment)
          : (requiresDownPayment ? Math.min(price, 1000) : 0);

      let paymentStatus = item.paymentStatus || "Unpaid";
      if (totalCollected <= 0) paymentStatus = "Unpaid";
      else if (totalCollected >= price) paymentStatus = "Paid";
      else paymentStatus = "Partial";
      if ((item.paymentProofs || []).some(p => p.method === "cash" && p.status === "pending")) paymentStatus = "Pending";

      return {
        id: item.id || uid(),
        patient: item.patientName || item.patient || "Unknown Patient",
        dentist: item.dentist || "Assigned Dentist",
        service: item.service || "Consultation",

        date: item.date || scheduleDate || "",
        time: item.time
          ? convertDisplayTimeTo24(item.time)
          : convertDisplayTimeTo24(scheduleTime) || "",

        schedule: buildSchedule(
          item.date || scheduleDate || "",
          item.time || scheduleTime || ""
        ),

        status: item.status || "Pending",
        archived: item.archived === true || item.archived === "true",
        archivedForDentist: item.archivedForDentist === true || item.archivedForDentist === "true",
        archivedForPatient: item.archivedForPatient === true || item.archivedForPatient === "true",

        // keep ALL financial fields
        price,
        paid: totalCollected >= price,
        downPayment: Number(item.downPayment || 0),
        amountPaidOnline,
        amountPaidInClinic,
        totalCollected,
        remainingBalance: Math.max(0, price - totalCollected),
        paymentMethod: item.paymentMethod || "",
        paymentStatus,
        requiresDownPayment,
        minimumDownPayment,
        invoiceUnlocked: !!item.invoiceUnlocked,
        revenueCountedOnline: Number(item.revenueCountedOnline || 0),
        revenueCountedClinic: Number(item.revenueCountedClinic || 0),

        discount: item.discount || null,
        review: item.review || null,
        rating: item.rating || null,
        updatedAt: item.updatedAt || "",
        completedAt: item.completedAt || ""
      };
    });
}
function getSharedPatients() {
  const db = getClinicDb();
  return Array.isArray(db.patients) ? db.patients : [];
}
function removeBrokenPatientCompletely(targetName) {
  const safeName = String(targetName || "").trim().toLowerCase();
  if (!safeName) return;

  state.patients = (state.patients || []).filter(
    p => String(p.name || "").trim().toLowerCase() !== safeName
  );

  const db = getClinicDb();

  db.appointments = (Array.isArray(db.appointments) ? db.appointments : []).filter(a => {
    const patientName = String(a.patientName || a.patient || "").trim().toLowerCase();
    return patientName !== safeName;
  });

  db.archivedAppointments = (Array.isArray(db.archivedAppointments) ? db.archivedAppointments : []).filter(a => {
    const patientName = String(a.patientName || a.patient || "").trim().toLowerCase();
    return patientName !== safeName;
  });

  db.rescheduleRequests = (Array.isArray(db.rescheduleRequests) ? db.rescheduleRequests : []).filter(r => {
    const patientName = String(r.patientName || "").trim().toLowerCase();
    return patientName !== safeName;
  });

  db.patients = (Array.isArray(db.patients) ? db.patients : []).filter(
    p => String(p.name || "").trim().toLowerCase() !== safeName
  );

  saveClinicDb(db);
  saveState(true);
  fullAdminSync();
  renderAll();
}

// Premium/stability overrides
function renderDashboard() {
  const activeDentists = new Set((state.dentists || [])
    .filter(item => ![true, "true"].includes(item.archived) && !item.deletedAt && !item.deleted_at)
    .map(item => String(item.id || item.email || item.name || "").trim().toLowerCase()).filter(Boolean)).size;
  const totalPatients = new Set((state.patients || [])
    .filter(item => !item.deletedAt && !item.deleted_at)
    .map(item => String(item.id || item.email || item.name || "").trim().toLowerCase()).filter(Boolean)).size;
  if (qs("#statActiveDentists")) qs("#statActiveDentists").textContent = String(activeDentists);
  if (qs("#statTotalPatients")) qs("#statTotalPatients").textContent = String(totalPatients);
  const activeAppointments = (state.appointments || []).filter(a => !a.archived);
  const approved = activeAppointments.filter(a => statusClassName(a.status) === "approved").length;

  const revenue = activeAppointments.reduce((sum, item) => {
    const online = Number(item.amountPaidOnline || 0);
    const clinic = Number(item.amountPaidInClinic || 0);
    return sum + online + clinic;
  }, 0);

  if (qs("#statAppointments")) qs("#statAppointments").textContent = String(activeAppointments.length);
  if (qs("#statApproved")) qs("#statApproved").textContent = String(approved);
  if (qs("#statRevenue")) qs("#statRevenue").textContent = formatMoney(revenue);

  const recentBody = qs("#dashboardRecentAppointments");
  if (recentBody) {
    const recent = [...activeAppointments]
      .sort((a, b) => dateTimeValue(b.date, b.time) - dateTimeValue(a.date, a.time))
      .slice(0, 6);

    if (!recent.length) {
      recentBody.innerHTML = tableEmptyRow(5, "No recent appointments", "New bookings will appear here.", "bi-calendar-x");
    } else {
      recentBody.innerHTML = recent.map(item => `
        <tr>
          <td>
            <div class="table-identity">
              <strong>${escapeHtml(safeText(item.patient, "Unknown Patient"))}</strong>
              <span>Patient Record</span>
            </div>
          </td>
          <td>
            <div class="table-identity">
              <strong>${escapeHtml(safeText(item.dentist, "Unassigned"))}</strong>
              <span>Dentist</span>
            </div>
          </td>
          <td>
            <div class="table-service">
              <span class="service-mark"><i class="bi bi-shield-plus"></i></span>
              <span>${escapeHtml(safeText(item.service, "Consultation"))}</span>
            </div>
          </td>
          <td><span class="table-muted">${formatDate(item.date)}</span></td>
          <td>${statusBadge(item.status)}</td>
        </tr>
      `).join("");
    }
  }

  const todayBox = qs("#todaySchedule");
todayBox.innerHTML = "";

const todayKey = todayISO();

const allTodayItems = activeAppointments
  .filter(a => a.date === todayKey)
  .sort((a, b) => a.time.localeCompare(b.time));

const todayItems = allTodayItems.slice(0, 3);

if (!todayItems.length) {
  todayBox.innerHTML = `<div class="empty-state">No appointments today.</div>`;
} else {
  todayItems.forEach(a => {
    todayBox.insertAdjacentHTML(
      "beforeend",
      `
      <div class="list-item">
        <strong>${formatTime(a.time)} - ${escapeHtml(a.patient)}</strong>
        <span>${escapeHtml(a.service)} with ${escapeHtml(a.dentist)}</span>
      </div>
      `
    );
  });
}

bindDashboardSeeMore(allTodayItems);

  const alertsBox = qs("#alertsBox");
  if (alertsBox) {
    alertsBox.innerHTML = `
      <div class="list-item">
        <strong>${approved} approved appointments</strong>
        <span>Appointments that are already confirmed.</span>
      </div>
      <div class="list-item">
        <strong>${activeAppointments.length} total active appointments</strong>
        <span>Current visible appointments in the system.</span>
      </div>
    `;
  }
}

function bindDashboardSeeMore(todayItems, alertItems) {
  const scheduleBtn = qs("#seeMoreScheduleBtn");
  const alertsBtn = qs("#seeMoreAlertsBtn");

  if (scheduleBtn) {
    scheduleBtn.onclick = () => {
      openViewModal(
        "Today's Schedule",
        todayItems.length
          ? todayItems.map(a => `
              <div class="detail-box">
                <strong>${escapeHtml(safeText(a.patient, "Unknown Patient"))}</strong>
                <div>${escapeHtml(safeText(a.service, "Consultation"))}</div>
                <div>${escapeHtml(safeText(a.dentist, "Unassigned"))} - ${formatDate(a.date)} - ${formatTime(a.time)}</div>
                <div>${statusBadge(a.status)}</div>
              </div>
            `).join("")
          : `<div class="empty-state rich-empty"><i class="bi bi-calendar2-x"></i><strong>No schedule today</strong><span>Nothing is booked for today yet.</span></div>`
      );
    };
  }

  if (alertsBtn) {
    alertsBtn.onclick = () => {
      openViewModal(
        "All Alerts",
        alertItems.map(item => `
          <div class="detail-box">
            <strong>${escapeHtml(item.title)}</strong>
            <div>${escapeHtml(item.body)}</div>
          </div>
        `).join("")
      );
    };
  }
}

function renderServices() {
  const tbody = qs("#servicesTable");
  if (!tbody) return;
  tbody.innerHTML = "";
  const items = (state.services || []).filter(s => !s.archived).sort(window.GMServiceCatalog.compareNames);

  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(3, "No services found", "Add a service to populate this table.", "bi-tools");
    return;
  }

  items.forEach(service => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(service.name)}</td>
      <td>${formatMoney(service.price)}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="action-btn delete" type="button" title="Archive"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    `;
    safeOn(tr.querySelector(".edit"), "click", () => openServiceModal(service.id));
    safeOn(tr.querySelector(".delete"), "click", () => archiveItem("services", service.id));
    tbody.appendChild(tr);
  });
}

function renderAppointments() {
  const tbody = qs("#appointmentsTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const items = (state.appointments || []).filter(a => !a.archived);
  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(7, "No appointments found", "Create an appointment to get started.", "bi-calendar2-plus");
    return;
  }

  items.sort((a, b) => dateTimeValue(a.date, a.time) - dateTimeValue(b.date, b.time)).forEach(item => {
    const safePatient = safeText(item.patient, "Unknown Patient");
    const safeDentist = safeText(item.dentist, "Unassigned");
    const safeService = safeText(item.service, "Consultation");
    const terminal = isTerminalAppointmentStatus(item.status);

    const tr = document.createElement("tr");
    tr.className = `appointment-table-row${item.date === todayISO() ? " is-today" : ""}`;
    tr.innerHTML = `
      <td><div class="table-identity"><strong>${escapeHtml(safePatient)}</strong><span>${item.date === todayISO() ? "Today" : "Patient Record"}</span></div></td>
      <td><div class="table-identity"><strong>${escapeHtml(safeDentist)}</strong><span>Dentist</span></div></td>
      <td><div class="table-service"><span class="service-mark"><i class="bi bi-shield-plus"></i></span><span>${escapeHtml(safeService)}</span></div></td>
      <td><span class="table-muted">${formatDate(item.date)}</span></td>
      <td><span class="table-muted">${formatTime(item.time)}</span></td>
      <td>${statusBadge(item.status)}</td>
      <td class="action-menu-cell">
        <button class="kebab-btn" type="button" aria-label="Open appointment actions"><i class="bi bi-three-dots-vertical"></i></button>
        <div class="dropdown">
          <button type="button" data-action="edit">Edit</button>
          ${terminal ? "" : `<button type="button" class="danger-text" data-action="archive">Archive</button>`}
        </div>
      </td>
    `;

    const kebab = tr.querySelector(".kebab-btn");
    const menu = tr.querySelector(".dropdown");
    safeOn(kebab, "click", e => {
      e.stopPropagation();
      toggleDropdown(menu, kebab);
    });
    safeOn(menu?.querySelector('[data-action="edit"]'), "click", () => {
      closeAllDropdowns();
      openAppointmentModal(item.id);
    });
    safeOn(menu?.querySelector('[data-action="archive"]'), "click", () => {
      closeAllDropdowns();
      archiveItem("appointments", item.id);
    });

    tbody.appendChild(tr);
  });
}

function renderAccounts() {
  const tbody = qs("#accountsTable");
  if (!tbody) return;
  tbody.innerHTML = "";

  const searchTerm = safeValue(qs("#userSearch")).trim().toLowerCase();
  const roleFilter = safeValue(qs("#userRoleFilter"));
  let accounts = [...(state.accounts || [])].filter(acc => !acc.archived);

  if (searchTerm) {
    accounts = accounts.filter(acc =>
      safeText(acc.name, "").toLowerCase().includes(searchTerm) ||
      safeText(acc.email, "").toLowerCase().includes(searchTerm) ||
      safeText(acc.username, "").toLowerCase().includes(searchTerm)
    );
  }

  if (roleFilter) {
    accounts = accounts.filter(acc => String(acc.role || "").toLowerCase() === roleFilter.toLowerCase());
  }

  if (!accounts.length) {
    tbody.innerHTML = tableEmptyRow(5, "No user accounts found", "Create an account to populate this table.", "bi-people");
    return;
  }

  accounts.forEach(acc => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(safeText(acc.name, "Unnamed User"))}</td>
      <td>${statusBadge(acc.archived ? "Archived" : (acc.role || "Active"))}</td>
      <td>${escapeHtml(safeText(acc.email, "-"))}</td>
      <td>${escapeHtml(safeText(acc.contact, "-"))}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="action-btn archive" type="button" title="Archive"><i class="bi bi-archive"></i></button>
          <button class="action-btn delete" type="button" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    `;
    safeOn(tr.querySelector(".edit"), "click", () => openAccountModal(acc.id));
    safeOn(tr.querySelector(".archive"), "click", () => archiveItem("accounts", acc.id));
    safeOn(tr.querySelector(".delete"), "click", () => deleteItem("accounts", acc.id));
    tbody.appendChild(tr);
  });
}

function renderArchivedUsers() {
  const table = qs("#archivedUsersTable");
  if (!table) return;

  const archivedItems = [
    ...(state.accounts || []).filter(item => item.archived).map(item => ({ id: item.id, name: item.name, role: item.role || "dentist", source: item.mergedInto ? "Archived - History merged" : "Account", type: "accounts", mergedInto: item.mergedInto })),
    ...(state.dentists || []).filter(item => item.archived).map(item => ({ id: item.id, name: item.name, role: "dentist", source: "Dentist", type: "dentists" })),
    ...((state.staff || []).filter(item => item.archived).map(item => ({ id: item.id, name: item.name, role: "staff", source: "Staff", type: "staff" }))),
    ...(state.patients || []).filter(item => item.archived).map(item => ({ id: item.id, name: item.name, role: "patient", source: item.mergedInto ? "Archived - History merged" : "Patient", type: "patients", mergedInto: item.mergedInto }))
  ];

  if (!archivedItems.length) {
    table.innerHTML = tableEmptyRow(4, "No archived users", "Archived accounts, dentists, staff, and patients will appear here.", "bi-archive");
    return;
  }

  table.innerHTML = "";
  archivedItems.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(safeText(item.name, "Unnamed Record"))}</td>
      <td>${escapeHtml(safeText(item.role, "-"))}</td>
      <td>${escapeHtml(safeText(item.source, "-"))}</td>
      <td>
        <div class="inline-actions">
          <button class="action-btn edit" type="button" title="Restore"><i class="bi bi-arrow-counterclockwise"></i></button>
          <button class="action-btn delete" type="button" title="Delete"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    `;
    if (item.mergedInto) tr.querySelector(".inline-actions").innerHTML = '<span class="badge">Archived - Merged</span>';
    safeOn(tr.querySelector(".edit"), "click", () => recoverItem(item.type, item.id));
    safeOn(tr.querySelector(".delete"), "click", () => deleteArchivedItem(item.type, item.id));
    table.appendChild(tr);
  });
}

function openSharedModal(title, html) {
  const modalTitle = qs("#modalTitle");
  const modalBody = qs("#modalBody");
  const modalBackdrop = qs("#modalBackdrop");
  if (!modalTitle || !modalBody || !modalBackdrop) return;
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modalBackdrop.classList.remove("hidden");
  modalBody.scrollTop = 0;
  modalBackdrop.scrollTop = 0;
}

function closeSharedModal() {
  const modalBackdrop = qs("#modalBackdrop");
  const modalBody = qs("#modalBody");
  if (modalBackdrop) modalBackdrop.classList.add("hidden");
  if (modalBody) modalBody.innerHTML = "";
}

function openViewModal(title, html) {
  const viewTitle = qs("#viewTitle");
  const viewBody = qs("#viewBody");
  const viewBackdrop = qs("#viewBackdrop");
  if (!viewTitle || !viewBody || !viewBackdrop) return;
  viewTitle.textContent = title;
  viewBody.innerHTML = html;
  viewBackdrop.classList.remove("hidden");
}

function closeViewModal() {
  const viewBackdrop = qs("#viewBackdrop");
  const viewBody = qs("#viewBody");
  if (viewBackdrop) viewBackdrop.classList.add("hidden");
  if (viewBody) viewBody.innerHTML = "";
}

function openConfirmModal(title, message, confirmText, cancelText, onConfirm) {
  openSharedModal(title, `
    <div class="confirm-modal">
      <p>${escapeHtml(message)}</p>
      <div class="modal-actions">
        <button class="btn secondary" id="confirmCancelBtn" type="button">${escapeHtml(cancelText || "Cancel")}</button>
        <button class="btn danger" id="confirmOkBtn" type="button">${escapeHtml(confirmText || "Confirm")}</button>
      </div>
    </div>
  `);

  safeOn(qs("#confirmCancelBtn"), "click", closeSharedModal);
  safeOn(qs("#confirmOkBtn"), "click", () => {
    closeSharedModal();
    if (typeof onConfirm === "function") onConfirm();
  });
}

function toggleDropdown(menu, anchor) {
  if (!menu || !anchor) return;
  const isOpen = menu.classList.contains("show");
  closeAllDropdowns();
  if (isOpen) return;

  const cell = anchor.closest(".action-menu-cell");
  const row = anchor.closest("tr");
  if (cell) cell.classList.add("menu-open");
  if (row) row.classList.add("menu-open");

  menu.classList.add("show");
  menu.classList.remove("up");

  requestAnimationFrame(() => {
    const menuHeight = menu.offsetHeight || 180;
    const menuWidth = menu.offsetWidth || 196;
    const anchorRect = anchor.getBoundingClientRect();
    const viewportPadding = 12;
    let top = anchorRect.bottom + 8;
    let left = anchorRect.right - menuWidth;

    if (top + menuHeight > window.innerHeight - viewportPadding) {
      top = anchorRect.top - menuHeight - 8;
      menu.classList.add("up");
    }

    if (top < viewportPadding) top = viewportPadding;
    if (left < viewportPadding) left = viewportPadding;
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding);
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
  });
}

function closeAllDropdowns() {
  qsa(".dropdown").forEach(dropdown => {
    dropdown.classList.remove("show", "up");
    dropdown.style.top = "";
    dropdown.style.left = "";
  });
  if (floatingRowMenuEl) {
    floatingRowMenuEl.classList.remove("show", "up");
    floatingRowMenuEl.innerHTML = "";
    floatingRowMenuEl.dataset.rowId = "";
    floatingRowMenuEl.dataset.rowType = "";
    floatingRowMenuEl.style.top = "-9999px";
    floatingRowMenuEl.style.left = "-9999px";
  }
  qsa(".action-menu-cell.menu-open").forEach(cell => cell.classList.remove("menu-open"));
  qsa("tr.menu-open").forEach(row => row.classList.remove("menu-open"));
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeAllDropdowns();
    closeSharedModal();
    closeViewModal();
    closeRestoreModal();
  }
});

function statusBadge(status) {
  const normalized = normalizedStatus(status);
  const cls = statusClassName(normalized);
  return `<span class="status-pill status-${cls}">${escapeHtml(normalized)}</span>`;
}

function showToast(message, tone = "info") {
  const existing = document.querySelector(".app-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `app-toast toast-${statusClassName(tone)}`;
  toast.textContent = safeText(message, "Done");
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));

  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 220);
  }, 1800);
}

let adminTableActionDelegationBound = false;
let floatingRowMenuEl = null;

function formatCreatedDate(value) {
  const safe = String(value || "").trim();
  if (!safe) return "-";
  if (/^\d{4}-\d{2}-\d{2}/.test(safe)) return formatDate(safe.slice(0, 10));

  const parsed = new Date(safe);
  if (Number.isNaN(parsed.getTime())) return safe;

  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function buildSchedulePreview(schedules) {
  if (!Array.isArray(schedules) || !schedules.length) {
    return { primary: "No schedule set", secondary: "Update dentist schedule" };
  }

  const [first] = schedules;
  const primary = safeText(first.day, "Schedule");
  const secondary = `${formatTime(first.start || "09:00")} - ${formatTime(first.end || "17:00")}`;
  return { primary, secondary };
}

function getPatientRowStatus(patient) {
  if (patient.archived) return "Inactive";
  return "Active";
}

function getDentistRowStatus(dentist) {
  if (dentist.archived) return "Unavailable";
  return Array.isArray(dentist.schedules) && dentist.schedules.length ? "Active" : "Unavailable";
}

function buildRowMenu(type, id, actions) {
  return `
    <td class="action-menu-cell" data-row-type="${escapeAttr(type)}" data-row-id="${escapeAttr(id)}">
      <button
        class="kebab-btn"
        type="button"
        aria-label="Open ${escapeAttr(type)} actions"
        data-menu-toggle="row"
        data-row-actions="${escapeAttr(JSON.stringify(Array.isArray(actions) ? actions : []))}"
      >
        <i class="bi bi-three-dots-vertical"></i>
      </button>
    </td>
  `;
}

function ensureFloatingRowMenu() {
  if (floatingRowMenuEl?.isConnected) return floatingRowMenuEl;

  floatingRowMenuEl = document.createElement("div");
  floatingRowMenuEl.id = "floatingRowMenu";
  floatingRowMenuEl.className = "dropdown row-menu floating-row-menu";
  document.body.appendChild(floatingRowMenuEl);
  safeOn(floatingRowMenuEl, "click", event => {
    const menuAction = event.target.closest("[data-row-action]");
    if (!menuAction) return;

    event.preventDefault();
    event.stopPropagation();

    const id = floatingRowMenuEl?.dataset?.rowId || "";
    const type = floatingRowMenuEl?.dataset?.rowType || "";
    const action = menuAction.dataset.rowAction || "";

    if (!id || !type || !action) return;

    closeAllDropdowns();

    if (type === "appointment") {
      if (action === "view" || action === "edit") return openAppointmentModal(id);
      if (action === "archive") return GMAppointmentActions.archive(id);
      if (action === "reschedule") return GMAppointmentActions.reschedule(id);
    }

    if (type === "dentist") {
      if (action === "view") return showDentistView(id);
      if (action === "edit") return openDentistModal(id);
      if (action === "archive") return archiveItem("dentists", id);
      if (action === "delete") return deleteItem("dentists", id);
    }

    if (type === "staff") {
      if (action === "view") return showStaffView(id);
      if (action === "edit") return openStaffModal(id);
      if (action === "archive") return archiveItem("staff", id);
      if (action === "delete") return deleteItem("staff", id);
    }

    if (type === "patient") {
      if (action === "view") return showPatientView(id);
      if (action === "edit") return openPatientModal(id);
      if (action === "archive") return archiveItem("patients", id);
      if (action === "delete") return deleteItem("patients", id);
    }
  });
  return floatingRowMenuEl;
}

function openFloatingRowMenu(anchor, cell) {
  if (!anchor || !cell) return;

  const menu = ensureFloatingRowMenu();
  const row = anchor.closest("tr");
  let actions = [];

  try {
    actions = JSON.parse(anchor.dataset.rowActions || "[]");
  } catch {
    actions = [];
  }

  if (!actions.length) return;

  closeAllDropdowns();

  menu.dataset.rowId = cell.dataset.rowId || "";
  menu.dataset.rowType = cell.dataset.rowType || "";
  menu.innerHTML = actions.map(action => `
    <button type="button" data-row-action="${escapeAttr(action.action)}" class="${action.danger ? "danger-text" : ""}">
      <i class="bi ${escapeAttr(action.icon)}"></i>${escapeHtml(action.label)}
    </button>
  `).join("");

  cell.classList.add("menu-open");
  if (row) row.classList.add("menu-open");
  menu.classList.add("show");
  menu.classList.remove("up");
  if (typeof anchor.blur === "function") anchor.blur();

  requestAnimationFrame(() => {
    const menuRect = menu.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const viewportPadding = 12;
    let left = anchorRect.right - menuRect.width;
    let top = anchorRect.bottom + 8;

    if (left < viewportPadding) left = viewportPadding;
    if (left + menuRect.width > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuRect.width - viewportPadding;
    }

    if (top + menuRect.height > window.innerHeight - viewportPadding) {
      top = anchorRect.top - menuRect.height - 8;
      menu.classList.add("up");
    }

    if (top < viewportPadding) top = viewportPadding;

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
  });
}

function ensureAdminTableActionDelegation() {
  if (adminTableActionDelegationBound) return;
  adminTableActionDelegationBound = true;

  document.addEventListener("click", event => {
    const actionButton = event.target.closest(".action-menu-cell [data-menu-toggle='row']");
    if (actionButton) {
      event.preventDefault();
      event.stopPropagation();

      const cell = actionButton.closest(".action-menu-cell");
      const menu = ensureFloatingRowMenu();
      if (!cell) return;

      const isSameMenuOpen =
        menu.classList.contains("show") &&
        menu.dataset.rowId === (cell.dataset.rowId || "") &&
        menu.dataset.rowType === (cell.dataset.rowType || "");

      closeAllDropdowns();
      if (!isSameMenuOpen) openFloatingRowMenu(actionButton, cell);
      return;
    }

  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".action-menu-cell") && !event.target.closest("#floatingRowMenu")) {
      closeAllDropdowns();
    }
  });

  window.addEventListener("resize", closeAllDropdowns);
  window.addEventListener("scroll", closeAllDropdowns, true);
}

function parseRecordDateValue(record = {}) {
  const scheduleText = String(record.schedule || "");
  const scheduleDate = (scheduleText.match(/\d{4}-\d{2}-\d{2}/) || [])[0] ||
    scheduleText.split(/[•\u2022]/)[0]?.trim() ||
    "";
  const raw = record.date || record.appointmentDate || scheduleDate || record.createdAt || record.updatedAt || "";
  if (!raw) return null;
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) return date;
  const embeddedDate = (String(raw).match(/\d{4}-\d{2}-\d{2}/) || [])[0];
  if (!embeddedDate) return null;
  const fallback = new Date(`${embeddedDate}T00:00:00`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function isRecordInDateFilter(record, filterValue, specificDateValue) {
  const filter = filterValue || "all";
  if (filter === "all") return true;

  const date = parseRecordDateValue(record);
  if (!date) return false;

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (filter === "day") {
    if (!specificDateValue) return true;
    const selected = new Date(`${specificDateValue}T00:00:00`);
    return dateOnly.getTime() === selected.getTime();
  }

  if (filter === "month") {
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }

  if (filter === "week") {
    const weekStart = new Date(todayOnly);
    weekStart.setDate(todayOnly.getDate() - todayOnly.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return dateOnly >= weekStart && dateOnly <= weekEnd;
  }

  return true;
}

function getFilteredAppointmentsForAdmin() {
  const search = safeValue(qs("#appointmentSearch")).trim().toLowerCase();
  const dateFilter = safeValue(qs("#appointmentDateFilter")) || "all";
  const dateSpecific = safeValue(qs("#appointmentDateSpecific"));

  return (state.appointments || []).filter(a => {
    if (a.archived) return false;

    const textMatch =
      !search ||
      safeText(a.patient, "").toLowerCase().includes(search) ||
      safeText(a.service, "").toLowerCase().includes(search) ||
      safeText(a.dentist, "").toLowerCase().includes(search) ||
      safeText(a.status, "").toLowerCase().includes(search);

    return textMatch && isRecordInDateFilter(a, dateFilter, dateSpecific);
  });
}

function syncAdminDateFilterInput() {
  const select = qs("#appointmentDateFilter");
  const input = qs("#appointmentDateSpecific");
  if (!select || !input) return;
  input.classList.toggle("hidden", select.value !== "day");
}

function syncAdminReportDateFilterInput() {
  const select = qs("#reportDateFilter");
  const input = qs("#reportDateSpecific");
  if (!select || !input) return;
  input.classList.toggle("hidden", select.value !== "day");
}

function renderAppointments() {
  const tbody = qs("#appointmentsTable");
  if (!tbody) return;
  ensureAdminTableActionDelegation();
  tbody.innerHTML = "";

  const items = getFilteredAppointmentsForAdmin();
  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(7, "No appointments found", "Create an appointment to get started.", "bi-calendar2-plus");
    return;
  }

  items
    .sort((a, b) => dateTimeValue(a.date, a.time) - dateTimeValue(b.date, b.time))
    .forEach(item => {
      const safePatient = safeText(item.patient, "Unknown Patient");
      const safeDentist = safeText(item.dentist, "Unassigned");
      const safeService = safeText(item.service, "Consultation");
      const terminal = isTerminalAppointmentStatus(item.status);

      const tr = document.createElement("tr");
      tr.className = `appointment-table-row${item.date === todayISO() ? " is-today" : ""}`;
      tr.innerHTML = `
        <td><div class="table-identity"><strong>${escapeHtml(safePatient)}</strong><span>${item.date === todayISO() ? "Today" : "Patient Record"}</span></div></td>
        <td><div class="table-identity"><strong>${escapeHtml(safeDentist)}</strong><span>Dentist</span></div></td>
        <td><div class="table-service"><span class="service-mark"><i class="bi bi-shield-plus"></i></span><span>${escapeHtml(safeService)}</span></div></td>
        <td><span class="table-muted">${formatDate(item.date)}</span></td>
        <td><span class="table-muted">${formatTime(item.time)}</span></td>
        <td>${statusBadge(item.status)}</td>
        ${buildRowMenu("appointment", item.id, [
          { action: "view", label: "View", icon: "bi-eye" },
          terminal ? { action: "archive", label: "Archive", icon: "bi-archive" } : { action: "reschedule", label: "Reschedule", icon: "bi-calendar-event" }
        ])}
      `;

      tbody.appendChild(tr);
    });
}

function renderDentists() {
  const tbody = qs("#dentistsTable");
  if (!tbody) return;
  ensureAdminTableActionDelegation();
  tbody.innerHTML = "";

  const search = safeValue(qs("#dentistSearch")).trim().toLowerCase();
  const sort = safeValue(qs("#dentistSort"));

  let items = [...(state.dentists || [])].filter(d => !d.archived);

  if (search) {
    items = items.filter(d =>
      safeText(d.name, "").toLowerCase().includes(search) ||
      safeText(d.specialty, "").toLowerCase().includes(search) ||
      safeText(d.email || d.contact, "").toLowerCase().includes(search)
    );
  }

  if (sort === "name") items.sort((a, b) => safeText(a.name, "").localeCompare(safeText(b.name, "")));
  if (sort === "specialty") items.sort((a, b) => safeText(a.specialty, "").localeCompare(safeText(b.specialty, "")));

  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(6, "No dentists found", "Matching dentist records will appear here.", "bi-person-badge");
    return;
  }

  items.forEach(dentist => {
    const schedule = buildSchedulePreview(dentist.schedules);
    const status = getDentistRowStatus(dentist);

    const tr = document.createElement("tr");
    tr.className = "appointment-table-row entity-table-row";
    tr.innerHTML = `
      <td>
        <div class="table-identity">
          <strong>${escapeHtml(safeText(dentist.name, "Unnamed Dentist"))}</strong>
          <span>${escapeHtml(safeText(dentist.contact, "Contact not available"))}</span>
        </div>
      </td>
      <td><span class="table-secondary">${escapeHtml(safeText(dentist.specialty, "General Dentist"))}</span></td>
      <td><span class="table-cell-muted">${escapeHtml(safeText(dentist.email, safeText(dentist.contact, "-")))}</span></td>
      <td>${statusBadge(status)}</td>
      <td>
        <div class="table-schedule">
          <strong>${escapeHtml(schedule.primary)}</strong>
          <span>${escapeHtml(schedule.secondary)}</span>
        </div>
      </td>
      ${buildRowMenu("dentist", dentist.id, [
        { action: "view", label: "View", icon: "bi-eye" },
        { action: "edit", label: "Edit", icon: "bi-pencil-square" },
        { action: "archive", label: "Archive", icon: "bi-archive", danger: true },
        { action: "delete", label: "Delete", icon: "bi-trash", danger: true }
      ])}
    `;

    tbody.appendChild(tr);
  });
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename, headers, rows) {
  const csv = GMAdminCsv.serialize(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  window.recordAuditInteraction?.('export', filename).catch(error => showToast(error.message));
}

function reportArray(value) {
  return Array.isArray(value) ? value : [];
}

function getAdminReportDateFilter() {
  return {
    mode: safeValue(qs("#reportDateFilter")) || safeValue(qs("#appointmentDateFilter")) || "all",
    day: safeValue(qs("#reportDateSpecific")) || safeValue(qs("#appointmentDateSpecific"))
  };
}

function uniqueAdminRecords(records) {
  const seen = new Set();
  return reportArray(records).filter(item => {
    const key = String(item.id || `${item.patient || item.patientName || ""}-${item.service || ""}-${item.date || item.schedule || item.createdAt || item.time || ""}-${item.status || item.title || item.body || item.message || ""}`);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getAdminReportAppointments({ includeArchived = false, terminalOnly = false, visitsOnly = false } = {}) {
  const db = typeof getClinicDb === "function" ? getClinicDb() : {};
  const records = uniqueAdminRecords([
    ...reportArray(state.appointments),
    ...reportArray(db.appointments),
    ...(includeArchived ? reportArray(db.archivedAppointments) : [])
  ]);
  const dateFilter = getAdminReportDateFilter();

  return records.filter(item => {
    if (!includeArchived && item.archived) return false;
    if (!isRecordInDateFilter(item, dateFilter.mode, dateFilter.day)) return false;

    const status = normalizedStatus(item.status || item.lifecycleStatus || "");
    if (terminalOnly && !["Completed", "Cancelled", "Rejected", "Reschedule Rejected"].includes(status)) return false;
    if (visitsOnly && !(item.patient || item.patientName) && !(item.date || item.schedule)) return false;
    return true;
  });
}

function reportDateText(record = {}) {
  const explicit = record.date || record.appointmentDate || "";
  if (explicit) return explicit;
  const parsed = parseRecordDateValue(record);
  if (!parsed) return "";
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function reportTimeText(record = {}) {
  if (record.time) return record.time;
  const schedule = String(record.schedule || "");
  const withoutDate = schedule.replace(/^\s*\d{4}-\d{2}-\d{2}\s*(?:[•\u2022-]\s*)?/, "").trim();
  if (withoutDate && withoutDate !== schedule) return withoutDate;
  const parts = schedule.split(/[•\u2022]/).map(part => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(" - ") : "";
}

function getAdminPatientMap() {
  const patientMap = new Map();
  const db = typeof getClinicDb === "function" ? getClinicDb() : {};
  [...reportArray(state.patients), ...reportArray(db.patients)].forEach(patient => {
    [patient.id, patient.name, patient.email, patient.contact, patient.phone]
      .filter(Boolean)
      .forEach(key => patientMap.set(String(key).toLowerCase(), patient));
  });
  return patientMap;
}

function resolveAdminPatient(patientMap, item = {}) {
  return patientMap.get(String(item.patientId || "").toLowerCase()) ||
    patientMap.get(String(item.patient || "").toLowerCase()) ||
    patientMap.get(String(item.patientName || "").toLowerCase()) ||
    patientMap.get(String(item.patientEmail || "").toLowerCase()) ||
    patientMap.get(String(item.patientPhone || "").toLowerCase()) ||
    {};
}

function adminPaidAmount(item = {}) {
  if (typeof item.paid === "number") return Number(item.paid || 0);
  return Number(item.totalCollected || item.amountPaidOnline || item.amountPaidInClinic || 0);
}

function buildAdminAppointmentReportRows(records = getAdminReportAppointments()) {
  const patientMap = getAdminPatientMap();
  return records
    .sort((a, b) => dateTimeValue(a.date, a.time) - dateTimeValue(b.date, b.time))
    .map(item => {
      const patient = resolveAdminPatient(patientMap, item);
      const total = Number(item.total || item.price || item.amount || 0);
      const paid = adminPaidAmount(item);
      return {
        "Patient": item.patient || item.patientName || patient.name || "Unknown Patient",
        "Email": patient.email || item.patientEmail || "",
        "Phone": patient.contact || patient.phone || item.patientPhone || "",
        "Dentist": item.dentist || item.dentistName || "",
        "Service": item.service || item.serviceName || "",
        "Date": reportDateText(item),
        "Time": reportTimeText(item),
        "Status": normalizedStatus(item.status || item.lifecycleStatus || ""),
        "Total": total,
        "Paid": paid,
        "Balance": Math.max(0, total - paid),
        "Payment Status": item.paymentStatus || ""
      };
    });
}

function buildAdminTreatmentHistoryRows() {
  const db = typeof getClinicDb === "function" ? getClinicDb() : {};
  const appointmentRows = getAdminReportAppointments({ includeArchived: true })
    .map(item => {
      return {
        "Record Type": "Appointment Treatment Record",
        "Patient": item.patient || item.patientName || "Unknown Patient",
        "Dentist": item.dentist || item.dentistName || "",
        "Treatment/Service": item.service || item.serviceName || "",
        "Date": item.date || item.schedule || item.updatedAt || "",
        "Status": normalizedStatus(item.status || ""),
        "Notes": item.notes || item.cancelReason || item.rejectionReason || ""
      };
    });

  const planRows = reportArray(db.treatmentPlans).map(plan => ({
    "Record Type": "Treatment Plan",
    "Patient": plan.patientName || plan.patient || "Unknown Patient",
    "Dentist": plan.dentistName || plan.dentist || "",
    "Treatment/Service": plan.serviceName || plan.service || "Treatment",
    "Date": plan.startDate || plan.createdAt || plan.updatedAt || "",
    "Status": plan.status || "",
    "Notes": plan.notes || plan.discontinuationReason || plan.consultationNote || ""
  }));

  const noteRows = reportArray(db.patientClinicalNotes).map(note => ({
    "Record Type": "Clinical Note",
    "Patient": note.patientName || note.patient || "Unknown Patient",
    "Dentist": note.dentistName || note.dentist || "",
    "Treatment/Service": note.service || note.title || "Clinical Note",
    "Date": note.createdAt || note.updatedAt || "",
    "Status": note.status || "",
    "Notes": note.note || note.finding || note.notes || ""
  }));

  const historyRows = reportArray(db.history).map(item => ({
    "Record Type": item.recordType || "History",
    "Patient": item.patientName || item.patient || "Unknown Patient",
    "Dentist": item.dentistName || item.dentist || "",
    "Treatment/Service": item.serviceName || item.service || item.title || "History",
    "Date": item.date || item.schedule || item.createdAt || item.updatedAt || "",
    "Status": item.status || "",
    "Notes": item.notes || item.note || item.description || ""
  }));

  return [...appointmentRows, ...planRows, ...noteRows, ...historyRows].filter(row => {
    const dateFilter = getAdminReportDateFilter();
    return isRecordInDateFilter({ date: row["Date"] }, dateFilter.mode, dateFilter.day);
  });
}

function buildAdminActivityRows() {
  const db = typeof getClinicDb === "function" ? getClinicDb() : {};
  const notificationGroups = db.notifications || {};
  const sharedActivities = ["admin", "staff", "dentist", "patient"].flatMap(role =>
    reportArray(notificationGroups[role]).map(item => ({ ...item, role }))
  );
  const localActivities = reportArray(state.notifications).map(item => ({ ...item, role: "admin" }));
  const appointmentActivities = getAdminReportAppointments({ includeArchived: true }).map(item => ({
    id: `appointment-activity-${item.id || `${item.patient || item.patientName || ""}-${item.date || item.schedule || ""}`}`,
    role: item.createdByRole || item.updatedByRole || "clinic",
    createdAt: item.updatedAt || item.createdAt || item.date || item.schedule || "",
    title: "Appointment Record",
    body: `${item.patient || item.patientName || "Unknown Patient"} - ${item.service || "Appointment"} - ${normalizedStatus(item.status || "")}`,
    read: true
  }));
  const dateFilter = getAdminReportDateFilter();

  return uniqueAdminRecords([...localActivities, ...sharedActivities, ...appointmentActivities])
    .filter(item => isRecordInDateFilter({ date: item.createdAt || item.date || item.time }, dateFilter.mode, dateFilter.day))
    .map(item => ({
      "Date": item.createdAt || item.date || item.time || "",
      "Role": item.role || "admin",
      "Title": item.title || item.eventType || "Activity",
      "Activity": item.body || item.text || item.message || "",
      "Read": item.read === false ? "No" : "Yes"
    }));
}

function buildAdminSummaryRows() {
  const appointments = getAdminReportAppointments({ includeArchived: true });
  const visits = getAdminReportAppointments({ includeArchived: true, visitsOnly: true });
  const treatments = buildAdminTreatmentHistoryRows();
  const activities = buildAdminActivityRows();
  const revenue = appointments.reduce((sum, item) => sum + adminPaidAmount(item), 0);
  const dateFilter = getAdminReportDateFilter();
  const scope = dateFilter.mode === "day" && dateFilter.day ? dateFilter.day : dateFilter.mode;

  return [
    { "Category": "Appointments", "Metric": "Total appointment records", "Value": appointments.length, "Scope": scope },
    { "Category": "Appointments", "Metric": "Pending appointments", "Value": appointments.filter(item => normalizedStatus(item.status) === "Pending").length, "Scope": scope },
    { "Category": "Patient Visits", "Metric": "Completed or active visits", "Value": visits.length, "Scope": scope },
    { "Category": "Treatment Histories", "Metric": "Treatment/history records", "Value": treatments.length, "Scope": scope },
    { "Category": "Record Activities", "Metric": "Activity records", "Value": activities.length, "Scope": scope },
    { "Category": "Billing", "Metric": "Collected amount", "Value": revenue, "Scope": scope }
  ];
}

function buildAdminPatientDirectoryRows() {
  const db = typeof getClinicDb === "function" ? getClinicDb() : {};
  const patientMap = new Map();
  [...reportArray(state.patients), ...reportArray(db.patients)].forEach(patient => {
    const key = String(patient.id || patient.name || patient.email || patient.contact || "").toLowerCase();
    if (!key || patientMap.has(key)) return;
    patientMap.set(key, patient);
  });

  return [...patientMap.values()].map(patient => ({
    "Name": patient.name || "Unnamed Patient",
    "Email": patient.email || "",
    "Phone": patient.contact || patient.phone || patient.mobile || "",
    "Status": patient.archived ? "Inactive" : "Active",
    "Created Date": formatCreatedDate(patient.createdAt || patient.created_at || patient.dateCreated || patient.registeredAt)
  }));
}

function getAdminReportConfig(type = safeValue(qs("#reportExportType")) || "patients") {
  if (type === "discounts") return {
    filename: `discounted-prices-${todayISO()}.csv`,
    headers: ["Patient", "Service", "Date", "Status", "Service Total", "Additional Fees", "Before Discount", "Discount", "Final Total", "Granted By", "Reason", "Recorded At"],
    rows: buildAdminDiscountRows()
  };
  if (type === "audit") return {
    filename: `user-audit-log-${todayISO()}.csv`,
    headers: ["Date / Time", "Account ID", "User", "Role", "IP Address", "Device", "Action", "Module", "Record", "Before", "After", "Outcome", "Error", "Details"],
    rows: adminAuditReport.rows.map(row => ({ "Date / Time": row.created_at, "Account ID": row.actor_id, User: row.actor_email, Role: row.actor_role, "IP Address":row.ip_address, Device:row.user_agent, Action:row.action, Module:row.module, Record:row.resource, Before:JSON.stringify(row.before_state), After:JSON.stringify(row.after_state), Outcome:row.outcome, Error:row.error_reason, Details:JSON.stringify(row.details) }))
  };

  const configs = {
    patients: {
      filename: `patient-records-${todayISO()}.csv`,
      headers: ["Name", "Email", "Phone", "Status", "Created Date"],
      rows: buildAdminPatientDirectoryRows()
    },
    appointments: {
      filename: `appointments-report-${todayISO()}.csv`,
      headers: ["Patient", "Email", "Phone", "Dentist", "Service", "Date", "Time", "Status", "Total", "Paid", "Balance", "Payment Status"],
      rows: buildAdminAppointmentReportRows(getAdminReportAppointments({ includeArchived: true }))
    },
    visits: {
      filename: `patient-visits-report-${todayISO()}.csv`,
      headers: ["Patient", "Email", "Phone", "Dentist", "Service", "Date", "Time", "Status", "Total", "Paid", "Balance", "Payment Status"],
      rows: buildAdminAppointmentReportRows(getAdminReportAppointments({ includeArchived: true, visitsOnly: true }))
    },
    treatments: {
      filename: `treatment-histories-report-${todayISO()}.csv`,
      headers: ["Record Type", "Patient", "Dentist", "Treatment/Service", "Date", "Status", "Notes"],
      rows: buildAdminTreatmentHistoryRows()
    },
    activities: {
      filename: `record-activities-report-${todayISO()}.csv`,
      headers: ["Date", "Role", "Title", "Activity", "Read"],
      rows: buildAdminActivityRows()
    },
    summary: {
      filename: `all-reports-summary-${todayISO()}.csv`,
      headers: ["Category", "Metric", "Value", "Scope"],
      rows: buildAdminSummaryRows()
    }
  };

  return configs[type] || configs.patients;
}

function renderAdminReportPreviewIfNeeded() {
  const type = safeValue(qs("#reportExportType")) || "patients";
  qs('#patients')?.classList.toggle('audit-view', type === 'audit');
  qs("#patientsTable")?.closest("table")?.classList.toggle("discount-report-table", type === "discounts");
  qs("#patientsTable")?.closest(".table-wrap")?.classList.toggle("discount-report-wrap", type === "discounts");
  qs("#discountReportControls")?.classList.toggle("hidden", type !== "discounts");
  if (type === "discounts") {
    qs("#discountRefreshBtn").onclick = loadAdminDiscountedPrices;
    if (!adminDiscountReport.loaded && !adminDiscountReport.loading) loadAdminDiscountedPrices();
  }
  qs("#patientsTable")?.closest("table")?.classList.toggle("audit-log-table",type === "audit");
  const auditControls = qs("#auditReportControls");
  auditControls?.classList.toggle("hidden", type !== "audit");
  if (type === "audit") {
    const key = JSON.stringify(getAdminReportDateFilter());
    if (adminAuditReport.key !== key) {
      adminAuditReport.key = key;
      loadAdminAuditLog(false);
    }
    qs("#auditRefreshBtn").onclick = () => loadAdminAuditLog(false);
    ["auditFrom","auditTo","auditUser","auditRole","auditAction","auditOutcome"].forEach(id=>{qs("#"+id).onchange=()=>loadAdminAuditLog(false);});
    qs("#auditMoreBtn").onclick = () => loadAdminAuditLog(true);
  }
  if (type === "patients") return false;

  const table = qs("#patientsTable")?.closest("table");
  const tbody = qs("#patientsTable");
  const headerRow = table?.querySelector("thead tr");
  if (!table || !tbody || !headerRow) return false;

  if (type === 'audit') {
    headerRow.innerHTML = ['Date / time', 'Account', 'Activity', 'Outcome', 'Details'].map(label => `<th>${label}</th>`).join('');
    tbody.innerHTML = adminAuditReport.rows.length ? adminAuditReport.rows.map((row, index) => {
      const outcome = ['Success', 'Failed', 'Denied', 'Logged'].includes(row.outcome) ? row.outcome : 'Logged';
      return `<tr class="audit-event-row">
        <td data-label="Date / time"><time>${escapeHtml(row.created_at || '')}</time></td>
        <td data-label="Account"><strong>${escapeHtml(row.actor_email || 'System')}</strong><span class="audit-role">${escapeHtml(row.actor_role || 'system')}</span></td>
        <td data-label="Activity"><strong>${escapeHtml(row.action || '')}</strong><span class="audit-module">${escapeHtml(row.module || '')}</span></td>
        <td data-label="Outcome"><span class="audit-outcome" data-outcome="${escapeAttr(outcome)}">${escapeHtml(outcome)}</span>${row.security_event ? '<span class="audit-security-flag">Security event</span>' : ''}</td>
        <td data-label="Details"><button type="button" class="audit-detail-button" data-audit-detail="${index}">View details</button></td>
      </tr>`;
    }).join('') : tableEmptyRow(5, adminAuditReport.loading ? 'Loading audit events' : 'No matching events', 'Adjust the filters to review another period.', 'bi-shield-check');
    tbody.querySelectorAll('[data-audit-detail]').forEach(button => {
      button.onclick = () => window.openAuditDetails(adminAuditReport.rows[Number(button.dataset.auditDetail)], button);
    });
    return true;
  }

  const config = getAdminReportConfig(type);
  headerRow.innerHTML = config.headers.map(header => `<th>${escapeHtml(header)}</th>`).join("");
  tbody.innerHTML = "";

  if (!config.rows.length) {
    tbody.innerHTML = tableEmptyRow(config.headers.length, "No matching records", "Try another report type or date filter.", "bi-file-earmark-spreadsheet");
    return true;
  }

  config.rows.forEach(row => {
    const tr = document.createElement("tr");
    tr.className = "appointment-table-row entity-table-row";
    if(type === "audit") tr.style.cssText="white-space:normal;overflow-wrap:anywhere";
    tr.innerHTML = config.headers.map(header => {
      let value = row[header] ?? "";
      const money = type === "discounts" && ["Service Total", "Additional Fees", "Before Discount", "Discount", "Final Total"].includes(header);
      if (money) value = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value) || 0);
      if (type === "discounts" && header === "Recorded At" && value) {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) value = date.toLocaleString("en-PH", {year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
      }
      if (type === "discounts" && header === "Date" && value) value = formatDate(value);
      return `<td data-label="${escapeAttr(header)}" class="${money ? "discount-money" : ""}">${type === "discounts" && header === "Status" ? statusBadge(value) : `<span class="table-cell-muted">${escapeHtml(value)}</span>`}</td>`;
    }).join("");
    tbody.appendChild(tr);
  });

  return true;
}

function exportPatientRecordsCsv() {
  if (safeValue(qs("#reportExportType")) === "audit") { exportFullAuditCsv(); return; }
  const config = getAdminReportConfig();

  if (!config.rows.length) {
    alert("No matching records to export.");
    return;
  }

  downloadCsv(config.filename, config.headers, config.rows);
}

function syncAdminRevenueDateFilterInput() {
  const select = qs("#revenueDateFilter");
  const input = qs("#revenueDateSpecific");
  if (!select || !input) return;
  input.classList.toggle("hidden", select.value !== "day");
  qs("#revenueCustomRange")?.classList.toggle("hidden", select.value !== "custom");
}

function getAdminRevenueCustomRange() {
  const start = safeValue(qs('#revenueStartDate'));
  const end = safeValue(qs('#revenueEndDate'));
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && date.getFullYear() === Number(value.slice(0,4))
      && date.getMonth()+1 === Number(value.slice(5,7)) && date.getDate() === Number(value.slice(8,10));
  };
  const error = !start || !end ? 'Select a Start Date and End Date.'
    : !validDate(start) || !validDate(end) ? 'Enter valid start and end dates.'
    : end < start ? 'End Date cannot be before Start Date.' : '';
  return { start, end, error };
}

function updateAdminRevenueRangeSummary() {
  const custom = safeValue(qs('#revenueDateFilter')) === 'custom';
  const range = getAdminRevenueCustomRange();
  const summary = qs('#revenueRangeSummary');
  if (summary) {
    summary.textContent = custom ? range.error || `Showing revenue: ${formatDate(range.start)} to ${formatDate(range.end)} (inclusive)` : '';
    summary.classList.toggle('is-error', custom && Boolean(range.error));
  }
  const end = qs('#revenueEndDate');
  if (end) {
    end.min = range.start;
    end.setCustomValidity(custom && range.start && range.end ? range.error : '');
    end.setAttribute('aria-invalid', String(custom && Boolean(range.start && range.end && range.error)));
  }
  const button = qs('#exportRevenueBtn');
  if (button) button.disabled = custom && Boolean(range.error);
}

function exportRevenueCsv() {
  const filter = safeValue(qs('#revenueDateFilter')) || 'year';
  const range = getAdminRevenueCustomRange();
  if (filter === 'custom' && range.error) { updateAdminRevenueRangeSummary(); return; }
  const records = getAdminRevenueRecords().sort((a,b) => parseAdminRevenueDate(b) - parseAdminRevenueDate(a));
  if (!records.length) { alert('No matching revenue records to export.'); return; }
  const period = filter === 'custom' ? `${range.start}_to_${range.end}` : filter;
  downloadCsv(`revenue_${period}.csv`, ['Patient','Dentist','Service','Date','Method','Online Payments','Clinic Payments','Collected','Status','Unclassified / Reconciliation Difference'], records.map(item => [
    item.patient || item.patientName || '', item.dentist || item.dentistName || '', item.service || item.serviceName || '',
    parseAdminRevenueDate(item)?.toLocaleDateString('en-CA') || '',
    item.paymentMethod || item.method || (item.revenueOnline > 0 ? 'GCash' : item.revenueClinic > 0 ? 'Cash' : ''),
    item.revenueOnline, item.revenueClinic, item.revenueCollected, item.paymentStatus || 'Paid', item.revenueUnclassified
  ]));
}

function parseAdminRevenueDate(record = {}) {
  const raw = record.paidAt || record.paymentDate || record.lastPaymentAt || record.updatedAt || record.completedAt || record.date || record.schedule || "";
  const embedded = (String(raw).match(/\d{4}-\d{2}-\d{2}/) || [])[0];
  const date = new Date(embedded ? `${embedded}T00:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesAdminRevenueFilter(record = {}) {
  const filter = safeValue(qs("#revenueDateFilter")) || "year";
  const specific = safeValue(qs("#revenueDateSpecific"));
  const date = parseAdminRevenueDate(record);
  if (!date) return false;

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (filter === 'custom') {
    const { start, end, error } = getAdminRevenueCustomRange();
    return !error && dateOnly >= new Date(`${start}T00:00:00`) && dateOnly <= new Date(`${end}T00:00:00`);
  }
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (filter === "day") {
    if (!specific) return true;
    return dateOnly.getTime() === new Date(`${specific}T00:00:00`).getTime();
  }

  if (filter === "week") {
    const weekStart = new Date(todayOnly);
    weekStart.setDate(todayOnly.getDate() - todayOnly.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return dateOnly >= weekStart && dateOnly <= weekEnd;
  }

  if (filter === "month") {
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }

  return date.getFullYear() === today.getFullYear();
}

function reconcileAdminRevenue(item) {
  const cents = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0;
  const amount = value => value !== null && value !== undefined && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value));
  let online = Math.max(0, cents(item.amountPaidOnline));
  let clinic = Math.max(0, cents(item.amountPaidInClinic));
  // Explicit collection totals (including zero) take priority over legacy fields.
  const stored = [item.totalCollected, item.amountPaid, item.paid].find(amount);
  const collected = stored === undefined ? online + clinic : Math.max(0, cents(stored));
  let difference = collected - online - clinic;
  const method = String(item.paymentMethod || item.method || '').trim().toLowerCase();
  // Historical collections can predate the channel counters. Only use a recorded method.
  if (difference > 0 && ['gcash', 'online', 'online payment'].includes(method)) online += difference;
  else if (difference > 0 && ['cash', 'clinic', 'in-clinic', 'in clinic', 'clinic payment'].includes(method)) clinic += difference;
  difference = collected - online - clinic;
  return { ...item, revenueOnline: online / 100, revenueClinic: clinic / 100,
    revenueCollected: collected / 100, revenueUnclassified: difference / 100 };
}

function getAdminRevenueRecords() {
  const db = typeof getClinicDb === "function" ? getClinicDb() : {};
  const appointmentRecords = [...reportArray(state.appointments), ...reportArray(db.appointments)];
  const treatmentRevenueRecords = reportArray(db.treatmentPlans).map(plan => ({
    ...plan,
    id: `treatment-revenue-${plan.treatmentId || plan.id || uid()}`,
    patient: plan.patientName || plan.patient || "",
    dentist: plan.dentistName || plan.dentist || "",
    service: plan.serviceName || plan.service || "Treatment Plan",
    date: plan.lastPaymentAt || plan.paidAt || plan.updatedAt || plan.startDate || plan.createdAt || "",
    paymentMethod: plan.paymentMethod || "",
    paymentStatus: plan.paymentStatus || (Number(plan.remainingBalance || 0) <= 0 ? "Paid" : Number(plan.amountPaid || plan.totalCollected || 0) > 0 ? "Partial" : "Unpaid"),
    amountPaidOnline: Number(plan.amountPaidOnline || 0),
    amountPaidInClinic: Number(plan.amountPaidInClinic || 0),
    totalCollected: plan.totalCollected ?? plan.amountPaid
  }));

  return uniqueAdminRecords([...appointmentRecords, ...treatmentRevenueRecords])
    .map(reconcileAdminRevenue)
    .filter(item => item.revenueCollected > 0 && matchesAdminRevenueFilter(item));
}

function renderRevenue() {
  updateAdminRevenueRangeSummary();
  const tbody = qs("#revenueTable");
  if (!tbody) return;

  const records = getAdminRevenueRecords()
    .sort((left, right) => (parseAdminRevenueDate(right)?.getTime() || 0) - (parseAdminRevenueDate(left)?.getTime() || 0));
  const total = records.reduce((sum, item) => sum + Number(item.revenueCollected || 0), 0);
  const online = records.reduce((sum, item) => sum + Number(item.revenueOnline || 0), 0);
  const clinic = records.reduce((sum, item) => sum + Number(item.revenueClinic || 0), 0);

  if (qs("#revenueTotal")) qs("#revenueTotal").textContent = formatMoney(total);
  if (qs("#revenueOnline")) qs("#revenueOnline").textContent = formatMoney(online);
  if (qs("#revenueClinic")) qs("#revenueClinic").textContent = formatMoney(clinic);
  const reconciliation = qs('#revenueReconciliation');
  if (reconciliation) {
    const unresolved = records.filter(item => item.revenueUnclassified !== 0);
    const difference = unresolved.reduce((sum,item) => sum + item.revenueUnclassified, 0);
    reconciliation.textContent = unresolved.length
      ? `${unresolved.length} payment record(s) need review. Unclassified / reconciliation difference: ${formatMoney(difference)}. Total revenue equals online payments + clinic payments + this difference.` : '';
  }

  tbody.innerHTML = "";

  if (!records.length) {
    tbody.innerHTML = tableEmptyRow(7, "No revenue records", "Payments collected in the selected period will appear here.", "bi-cash-stack");
    return;
  }

  records.forEach(item => {
    const date = parseAdminRevenueDate(item);
    const dateText = date
      ? date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "-";
    const method = item.paymentMethod || item.method || (item.revenueOnline > 0 ? "GCash" : item.revenueClinic > 0 ? "Cash" : "-");
    const tr = document.createElement("tr");
    tr.className = "appointment-table-row entity-table-row";
    tr.innerHTML = `
      <td><div class="table-identity"><strong>${escapeHtml(safeText(item.patient || item.patientName, "Unknown Patient"))}</strong><span>Patient payment</span></div></td>
      <td><span class="table-cell-muted">${escapeHtml(safeText(item.dentist || item.dentistName, "-"))}</span></td>
      <td><span class="table-cell-muted">${escapeHtml(safeText(item.service || item.serviceName, "-"))}</span></td>
      <td><span class="table-muted">${escapeHtml(dateText)}</span></td>
      <td><span class="table-cell-muted">${escapeHtml(method)}</span></td>
      <td><strong>${formatMoney(item.revenueCollected)}</strong></td>
      <td>${statusBadge(item.paymentStatus || "Paid")}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStaff() {
  const tbody = qs("#staffTable");
  if (!tbody) return;
  ensureAdminTableActionDelegation();
  tbody.innerHTML = "";

  const search = safeValue(qs("#staffSearch")).trim().toLowerCase();
  const sort = safeValue(qs("#staffSort"));

  let items = [...(state.staff || [])].filter(s => !s.archived);

  if (search) {
    items = items.filter(s =>
      safeText(s.name, "").toLowerCase().includes(search) ||
      safeText(s.position, "").toLowerCase().includes(search) ||
      safeText(s.email || s.contact, "").toLowerCase().includes(search)
    );
  }

  if (sort === "name") items.sort((a, b) => safeText(a.name, "").localeCompare(safeText(b.name, "")));
  if (sort === "position") items.sort((a, b) => safeText(a.position, "").localeCompare(safeText(b.position, "")));

  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(6, "No staff found", "Matching staff records will appear here.", "bi-person-vcard");
    return;
  }

  items.forEach(staff => {
    const status = staff.archived ? "Archived" : "Active";

    const tr = document.createElement("tr");
    tr.className = "appointment-table-row entity-table-row";
    tr.innerHTML = `
      <td>
        <div class="table-identity">
          <strong>${escapeHtml(safeText(staff.name, "Unnamed Staff"))}</strong>
          <span>${escapeHtml(safeText(staff.position, "Staff member"))}</span>
        </div>
      </td>
      <td><span class="table-secondary">${escapeHtml(safeText(staff.position, "-"))}</span></td>
      <td><span class="table-cell-muted">${escapeHtml(safeText(staff.email, "-"))}</span></td>
      <td><span class="table-cell-muted">${escapeHtml(safeText(staff.contact, "-"))}</span></td>
      <td>${statusBadge(status)}</td>
      ${buildRowMenu("staff", staff.id, [
        { action: "view", label: "View", icon: "bi-eye" },
        { action: "edit", label: "Edit", icon: "bi-pencil-square" },
        { action: "archive", label: "Archive", icon: "bi-archive", danger: true },
        { action: "delete", label: "Delete", icon: "bi-trash", danger: true }
      ])}
    `;

    tbody.appendChild(tr);
  });
}

function openStaffModal(id = null) {
  const item = id ? (state.staff || []).find(s => s.id === id) : null;

  const positionOptions = [
    "All Staff Positions"
  ];

  openSharedModal(
    item ? "Edit Staff" : "Add Staff",
    `
      <div class="form-grid one">
        <div>
          <label class="label" for="modalStaffName">Full Name</label>
          <input class="input" id="modalStaffName" type="text" value="${item ? escapeAttr(item.name) : ""}" />
        </div>

        <div>
          <label class="label" for="modalStaffPosition">Position</label>
          <select class="input select" id="modalStaffPosition">
            ${positionOptions.map(pos => `
              <option value="${escapeAttr(pos)}" ${item?.position === pos ? "selected" : ""}>
                ${escapeHtml(pos)}
              </option>
            `).join("")}
          </select>
          <small>All staff share access to reception, patient queues, appointments, patient records and billing.</small>
        </div>

        <div>
          <label class="label" for="modalStaffEmail">Email</label>
          <input class="input" id="modalStaffEmail" type="email" value="${item ? escapeAttr(item.email || "") : ""}" />
        </div>

        <div>
          <label class="label" for="modalStaffContact">Contact</label>
          <input class="input" id="modalStaffContact" type="text" maxlength="11" value="${item ? escapeAttr(item.contact || "") : ""}" />
        </div>

        <button class="btn primary" type="button" id="saveStaffModalBtn">${item ? "Save Changes" : "Save Staff"}</button>
      </div>
    `
  );

  qs("#saveStaffModalBtn").addEventListener("click", () => {
    const name = qs("#modalStaffName").value.trim();
    const position = qs("#modalStaffPosition").value;
    const email = qs("#modalStaffEmail").value.trim();
    const contact = qs("#modalStaffContact").value.trim();

    if (!name || !position || !contact) {
      alert("Please fill name, position, and contact.");
      return;
    }

    if (!/^[0-9]{11}$/.test(contact)) {
      alert("Contact number must be exactly 11 digits.");
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    if (!Array.isArray(state.staff)) state.staff = [];

    if (item) {
      Object.assign(item, { name, position, email, contact });
      addNotification("Staff Updated", `${name} profile was updated.`);
    } else {
      state.staff.push({ id: uid(), name, position, email, contact, archived: false });
      addNotification("New Staff", `${name} was added.`);
    }

    saveState();
    closeSharedModal();
    renderAll();
  });
}

function showStaffView(id) {
  const s = (state.staff || []).find(x => x.id === id);
  if (!s) return;

  openViewModal(
    s.name,
    `
      <div class="detail-list">
        <div class="detail-box"><strong>Position</strong>${escapeHtml(safeText(s.position, "-"))}</div>
        <div class="detail-box"><strong>Email</strong>${escapeHtml(safeText(s.email, "-"))}</div>
        <div class="detail-box"><strong>Contact</strong>${escapeHtml(safeText(s.contact, "-"))}</div>
      </div>
    `
  );
}

function renderPatients() {
  const tbody = qs("#patientsTable");
  if (!tbody) return;
  ensureAdminTableActionDelegation();
  tbody.innerHTML = "";

  const table = tbody.closest("table");
  const headerRow = table?.querySelector("thead tr");
  if (headerRow) {
    headerRow.innerHTML = `
      <th>Name</th>
      <th>Email</th>
      <th>Phone</th>
      <th>Status</th>
      <th>Created Date</th>
      <th>Actions</th>
    `;
  }

  if (renderAdminReportPreviewIfNeeded()) return;

  const search = safeValue(qs("#patientSearch")).trim().toLowerCase();
  const sort = safeValue(qs("#patientSort"));

  let items = [...(state.patients || [])].filter(p => !p.archived);

  if (search) {
    items = items.filter(p =>
      safeText(p.name, "").toLowerCase().includes(search) ||
      safeText(p.email || p.contact, "").toLowerCase().includes(search) ||
      safeText(p.condition, "").toLowerCase().includes(search)
    );
  }

  if (sort === "name") items.sort((a, b) => safeText(a.name, "").localeCompare(safeText(b.name, "")));
  if (sort === "age") items.sort((a, b) => Number(a.age || 0) - Number(b.age || 0));

  if (!items.length) {
    tbody.innerHTML = tableEmptyRow(6, "No patients found", "Matching patient records will appear here.", "bi-people");
    return;
  }

  items.forEach(patient => {
    const status = getPatientRowStatus(patient);
    const createdDate = formatCreatedDate(patient.createdAt || patient.created_at || patient.dateCreated || patient.registeredAt);

    const tr = document.createElement("tr");
    tr.className = "appointment-table-row entity-table-row";
    tr.innerHTML = `
      <td>
        <div class="table-identity">
          <strong>${escapeHtml(safeText(patient.name, "Unnamed Patient"))}</strong>
          <span>${escapeHtml(safeText(patient.condition, "Patient record"))}</span>
        </div>
      </td>
      <td><span class="table-cell-muted">${escapeHtml(safeText(patient.email, "-"))}</span></td>
      <td><span class="table-cell-muted">${escapeHtml(safeText(patient.contact || patient.phone, "-"))}</span></td>
      <td>${statusBadge(status)}</td>
      <td><span class="table-muted">${escapeHtml(createdDate)}</span></td>
      ${buildRowMenu("patient", patient.id, [
        { action: "view", label: "View", icon: "bi-eye" },
        { action: "edit", label: "Edit", icon: "bi-pencil-square" },
        { action: "archive", label: "Archive", icon: "bi-archive", danger: true },
        { action: "delete", label: "Delete", icon: "bi-trash", danger: true }
      ])}
    `;

    tbody.appendChild(tr);
  });
}

function statusBadge(status) {
  const normalized = normalizedStatus(status);
  const cls = statusClassName(normalized);
  return `<span class="status-pill status-${cls}">${escapeHtml(normalized)}</span>`;
}

ensureAdminTableActionDelegation();


function buildAdminDiscountRows() {
  const filter = getAdminReportDateFilter();
  return adminDiscountReport.rows
    .filter(item => isRecordInDateFilter({ date: item.appointment_date }, filter.mode, filter.day))
    .map(item => ({ Patient: item.patient_name, Service: item.service, Date: reportDateText({date:item.appointment_date}), Status: normalizedStatus(item.status),
      "Service Total": Number(item.service_total).toFixed(2), "Additional Fees": Number(item.additional_fees).toFixed(2),
      "Before Discount": Number(item.original_price).toFixed(2), Discount: Number(item.discount_amount).toFixed(2),
      "Final Total": Number(item.discounted_price).toFixed(2), "Granted By": item.dentist_name || item.dentist_id || "",
      Reason: item.reason || "", "Recorded At": item.discount_recorded_at || "" }));
}
async function loadAdminDiscountedPrices() {
  if (adminDiscountReport.loading) return;
  adminDiscountReport.loading = true;
  qs("#discountRefreshBtn").disabled = true;
  qs("#discountReportStatus").textContent = "Loading saved discounts from Supabase...";
  try {
    const rows = [];
    let more = true;
    while (more) {
      const response = await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/discounted-prices?offset=${rows.length}`, {cache:"no-store"});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Unable to load discounts.");
      rows.push(...result.rows);
      more = result.hasMore && result.rows.length > 0;
    }
    adminDiscountReport.rows = rows;
    adminDiscountReport.loaded = true;
    qs("#discountReportStatus").textContent = `${rows.length} saved discounts synced from Supabase. Last refreshed: ${new Date().toLocaleTimeString()}.`;
  } catch (error) {
    adminDiscountReport.loaded = true;
    qs("#discountReportStatus").textContent = `${error.message} Click Refresh to retry. Previously loaded data may be outdated.`;
  } finally {
    adminDiscountReport.loading = false;
    qs("#discountRefreshBtn").disabled = false;
    renderPatients();
  }
}
function adminAuditDateParams() {
  const { mode, day } = getAdminReportDateFilter();
  const params = new URLSearchParams();
  if (mode === "all") return params;
  const start = mode === "day" ? new Date(`${day}T00:00:00`) : new Date();
  if (!Number.isFinite(start.getTime())) return params;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (mode === "month") { start.setDate(1); end.setMonth(start.getMonth() + 1, 1); }
  else if (mode === "week") { start.setDate(start.getDate() - start.getDay()); end.setTime(start.getTime()); end.setDate(start.getDate() + 7); }
  else end.setDate(start.getDate() + 1);
  params.set("from", start.toISOString()); params.set("to", end.toISOString());
  return params;
}
async function loadAdminAuditLog(more = false) {
  const key = adminAuditReport.key;
  const params = adminAuditFilterParams();
  if (!more) adminAuditReport.rows = [];
  params.set("offset", String(more ? adminAuditReport.rows.length : 0));
  const requestId = adminAuditReport.requestId = (adminAuditReport.requestId || 0) + 1;
  adminAuditReport.loading = true;
  qs("#auditReportStatus").textContent = "Loading audit log...";
  qs("#auditRefreshBtn").disabled = true; qs("#auditMoreBtn").disabled = true;
  try {
    const response = await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/audit-log?${params}`, { cache: "no-store" });
    const result = await response.json();
    if (requestId !== adminAuditReport.requestId || key !== adminAuditReport.key) return;
    if (!response.ok) throw new Error(result.message || "Unable to load audit log.");
    adminAuditReport.rows = more ? [...adminAuditReport.rows, ...result.rows] : result.rows;
    adminAuditReport.hasMore = result.hasMore;
    qs("#auditAlerts").innerHTML = (result.alerts || []).map(a=>`<p style="white-space:normal;overflow-wrap:anywhere">${escapeHtml(a.created_at)}: ${escapeHtml(a.description)}</p>`).join("") || "No alerts.";
    qs("#auditReportStatus").textContent = `${adminAuditReport.rows.length} events loaded. CSV exports all matching events. Logs begin when auditing was enabled.`;
    qs("#auditMoreBtn").classList.toggle("hidden", !result.hasMore);
  } catch (error) {
    if (requestId === adminAuditReport.requestId) qs("#auditReportStatus").textContent = error.message;
  } finally {
    if (requestId === adminAuditReport.requestId) {
      adminAuditReport.loading = false;
      qs("#auditRefreshBtn").disabled = false; qs("#auditMoreBtn").disabled = false;
      renderPatients();
    }
  }
}

function exportAppointmentsCsv() {
  const items = getFilteredAppointmentsForAdmin().slice().sort((a,b)=>dateTimeValue(a.date,a.time)-dateTimeValue(b.date,b.time));
  if (!items.length) { alert("No matching appointments to export."); return; }
  const headers = ["Appointment ID", "Patient", "Dentist", "Service", "Date", "Time", "Status"];
  const rows = items.map(item=>({"Appointment ID":item.id,Patient:item.patient || item.patientName || "",Dentist:item.dentist || item.dentistName || "",Service:item.service || "",Date:reportDateText(item),Time:reportTimeText(item),Status:normalizedStatus(item.status)}));
  downloadCsv(`appointments-${todayISO()}.csv`, headers, rows);
}
function exportBillingCsv() {
  const items = (state.appointments || []).filter(item=>!item.archived).slice().sort((a,b)=>dateTimeValue(b.date,b.time)-dateTimeValue(a.date,a.time));
  if (!items.length) { alert("No billing records to export."); return; }
  const headers = ["Appointment ID", "Patient", "Service", "Date", "Time", "Currency", "Total", "Paid", "Refunded", "Balance", "Method", "Status"];
  const rows = items.map(item=>{
    const total=Number(item.price ?? item.total ?? 0), paid=Number(item.totalCollected ?? item.paid ?? 0);
    const balance=Number(item.remainingBalance ?? Math.max(0,total-paid));
    return {"Appointment ID":item.id,Patient:item.patient || item.patientName || "",Service:item.service || "",Date:reportDateText(item),Time:reportTimeText(item),Currency:"PHP",Total:total,Paid:paid,Refunded:getTotalRefunded(item),Balance:balance,Method:item.paymentMethod || item.method || "",Status:item.paymentStatus || (paid<=0?"Unpaid":balance<=0?"Paid":"Partial")};
  });
  downloadCsv(`billing-${todayISO()}.csv`,headers,rows);
}

function adminAuditFilterParams() {
 const params=adminAuditDateParams();
 for(const [id,key] of [["auditUser","user"],["auditRole","role"],["auditAction","action"],["auditOutcome","outcome"]]) {const v=qs("#"+id)?.value.trim();if(v)params.set(key,v);}
 const from=qs("#auditFrom")?.value,to=qs("#auditTo")?.value;
 if(from)params.set("from",new Date(from+"T00:00:00").toISOString());
 if(to){const end=new Date(to+"T00:00:00");end.setDate(end.getDate()+1);params.set("to",end.toISOString());}
 return params;
}
async function exportFullAuditCsv(){
 try {const params=adminAuditFilterParams();params.set("export","csv");
 const response=await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/audit-log?${params}`,{cache:"no-store"});
 if(!response.ok)throw Error("Audit export failed.");
 const url=URL.createObjectURL(await response.blob()),a=document.createElement("a");a.href=url;a.download="user-audit-log.csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 await window.recordAuditInteraction?.('export', `${params.get('from') || 'All dates'} to ${params.get('to') || 'present'}`);
 }catch(error){qs("#auditReportStatus").textContent=error.message;}
}

// Alert polling reads only the latest alert summaries, not medical records.
let auditAlertPollBusy=false;
async function pollAuditAlerts(){
 if(document.visibilityState==='hidden'||auditAlertPollBusy)return;
 auditAlertPollBusy=true;
 try {
 const response=await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/audit-alerts`,{cache:'no-store'});
 if(!response.ok)return;
 const {alerts=[]}=await response.json();
 const nav=document.querySelector('[data-section="audit"]');if(!nav)return;
 let badge=document.getElementById('auditAlertBadge');if(!badge){badge=document.createElement('span');badge.id='auditAlertBadge';badge.setAttribute('role','status');nav.appendChild(badge);}
 badge.textContent=alerts.length?`${alerts.length} recent alerts`:'';
 badge.title=alerts[0]?.description||'';
 }catch{}finally{auditAlertPollBusy=false;}
}
setTimeout(pollAuditAlerts,1500);
setInterval(pollAuditAlerts,60000);
