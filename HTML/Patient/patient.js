const SESSION_KEY = "gm_dental_current_user";

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

const currentPatientUser = getCurrentUser();

if (!currentPatientUser) {
  window.location.replace("../Landing/landing.html");
} else if (currentPatientUser.role !== "patient") {
  window.location.replace("../Landing/landing.html");
}

const CLINIC_DB_KEY = "gm_dental_db_v1";

function getClinicDb() {
  try {
    const raw = localStorage.getItem(CLINIC_DB_KEY);
    if (!raw) {
      const initial = buildDefaultClinicDb();
      localStorage.setItem(CLINIC_DB_KEY, JSON.stringify(initial));
      return initial;
    }
    return ensureClinicDbShape(JSON.parse(raw));
  } catch {
    return buildDefaultClinicDb();
  }
}

function saveClinicDb(db) {
  localStorage.setItem(CLINIC_DB_KEY, JSON.stringify(ensureClinicDbShape(db)));
  localStorage.setItem("gm_dental_sync_stamp", String(Date.now()));
}
const services = [
    {
        name: "Consultation",
        price: 500,
        chairMinutes: 20,
        displayDuration: "20 min",
        description: "A thorough evaluation of your current oral health, including a visual exam and professional advice on necessary treatments or preventive care.",
        includes: ["Dental examination", "Oral health assessment", "Treatment planning"]
    },
    {
        name: "Oral Prophylaxis",
        price: 1000,
        chairMinutes: 45,
        displayDuration: "45 min",
        description: "A professional cleaning session to remove stubborn plaque and tartar buildup that regular brushing cannot reach, finished with a high-shine polish.",
        includes: ["Teeth cleaning", "Plaque & tartar removal", "Polishing"]
    },
    {
        name: "Restorative Treatment",
        price: 800,
        chairMinutes: 60,
        displayDuration: "1 hr",
        description: "Commonly known as a filling, this procedure repairs a decayed or damaged tooth using tooth-colored composite resin to restore its strength and appearance.",
        includes: ["Cavity cleaning", "Tooth filling", "Tooth restoration"]
    },
    {
        name: "Tooth Extraction",
        price: 1000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "Safe and gentle removal of a damaged or problematic tooth under local anesthesia to prevent further pain or infection.",
        includes: ["Local anesthesia", "Tooth removal", "Post-extraction care"]
    },
    {
        name: "Odontectomy",
        price: 10000,
        chairMinutes: 150,
        displayDuration: "2.5 hrs",
        description: "A specialized surgical procedure typically used for impacted wisdom teeth that are trapped under the gum line or bone.",
        includes: ["Surgical extraction", "Wisdom tooth removal", "Sutures if needed"]
    },
    {
        name: "Root Canal Treatment",
        price: 6000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "An advanced procedure designed to save a severely decayed or infected tooth by removing the damaged pulp and sealing the internal canal.",
        includes: ["Infection removal", "Canal cleaning", "Tooth sealing"]
    },
    {
        name: "Complete Denture",
        price: 15000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "A full-coverage prosthetic solution for patients missing all teeth in an arch, custom-molded for a natural look and comfortable fit.",
        includes: ["Full denture fitting", "Custom molding", "Bite adjustment"]
    },
    {
        name: "Partial Denture (Stayplate)",
        price: 6500,
        chairMinutes: 90,
        displayDuration: "1.5 hrs",
        description: "An affordable, removable acrylic plate used to replace one or several missing teeth, ideal for temporary or budget-friendly restoration.",
        includes: ["Partial denture creation", "Lightweight material", "Basic fitting"]
    },
    {
        name: "Partial Denture (Casted)",
        price: 12000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "A high-durability partial denture featuring a metal framework for superior strength, stability, and a thinner, more comfortable profile.",
        includes: ["Metal framework denture", "Precise fitting", "Durable design"]
    },
    {
        name: "Flexible Denture",
        price: 16000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "The most comfortable denture option, made from a premium nylon material that adapts to the shape of your gums and lacks visible metal clasps.",
        includes: ["Flexible material denture", "Comfort fit design", "Aesthetic finish"]
    },
    {
        name: "Crowns and Bridges",
        price: 6000,
        chairMinutes: 120,
        displayDuration: "2 hrs",
        description: "Fixed prosthetic devices used to cover a damaged tooth (Crown) or bridge the gap created by one or more missing teeth.",
        includes: ["Tooth restoration", "Crown or bridge placement", "Bite alignment"]
    },
    {
        name: "Orthodontic Treatment",
        price: 60000,
        chairMinutes: 60,
        displayDuration: "1 hr",
        description: "Comprehensive alignment correction using traditional braces. This price typically covers the installation and start of your journey to a perfect smile.",
        includes: ["Braces installation", "Alignment correction", "Monthly adjustments"]
    },
    {
        name: "Retainers",
        price: 6000,
        chairMinutes: 30,
        displayDuration: "30 min",
        description: "Custom-made appliances worn after orthodontic treatment to prevent teeth from shifting back to their original positions.",
        includes: ["Custom retainer", "Teeth alignment support", "Post-braces maintenance"]
    },
    {
        name: "Mouth Guard",
        price: 6000,
        chairMinutes: 30,
        displayDuration: "30 min",
        description: "A custom-fitted protective device for athletes or patients who grind their teeth (bruxism) at night to prevent dental wear and injury.",
        includes: ["Custom mouth guard", "Protection for teeth", "Comfort fit"]
    },
    {
        name: "Whitening",
        price: 12000,
        chairMinutes: 90,
        displayDuration: "1.5 hrs",
        description: "A high-strength professional bleaching treatment that removes deep stains caused by food, coffee, or smoking, brightening your smile by several shades.",
        includes: ["Teeth bleaching", "Stain removal", "Shade enhancement"]
    },
    {
        name: "Periapical X-Ray",
        price: 500,
        chairMinutes: 10,
        displayDuration: "10 min",
        description: "A focused X-ray that shows the entire tooth from the crown to the end of the root, essential for diagnosing infections or root issues.",
        includes: ["Tooth imaging", "Root analysis", "Diagnostic results"]
    },
    {
        name: "Panoramic X-Ray",
        price: 1000,
        chairMinutes: 15,
        displayDuration: "15 min",
        description: "A wide-angle X-ray of the entire jaw, providing a comprehensive view of all teeth, jawbones, and sinuses in a single image.",
        includes: ["Full mouth scan", "Jaw imaging", "Comprehensive diagnosis"]
    }
];

services.sort(window.GMServiceCatalog.compareNames);

function useSavedServiceCatalog(records) {
  if (!window.GMServiceCatalog || !Array.isArray(records)) return;
  const saved = window.GMServiceCatalog.merge(records).filter(service => !service.archived);
  services.splice(0, services.length, ...saved);
  selectedBookingServices = selectedBookingServices.map(selected => saved.find(service =>
    window.GMServiceCatalog.key(service.name) === window.GMServiceCatalog.key(selected.name))).filter(Boolean);
  bookingDependents = bookingDependents.map(dep => ({ ...dep, services: (dep.services || []).map(selected => saved.find(service =>
    window.GMServiceCatalog.key(service.name) === window.GMServiceCatalog.key(selected.name))).filter(Boolean) }));
  renderDependentsList();
  syncPrimarySelectedService();
  renderServices();
  populateServiceDropdown();
  renderServiceList();
  updateSelectedServicesList();
  updateSummary();
}

// =============================
// SHARED CLINIC SYNC LAYER
// Paste this in BOTH patient and dentist JS
// =============================
const CLINIC_SYNC_KEYS = {
  appointments: "appointments",
  archivedAppointments: "archivedAppointments",
  rescheduleRequests: "rescheduleRequests",
  userProfileData: "userProfileData",
  pendingPayment: "pendingPayment",
  patientNotifications: "patientNotifications",
  dentistNotifications: "dentistNotifications",
  clinicSyncStamp: "clinicSyncStamp"
};

function getClinicData(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function setClinicData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  touchClinicSync();
}

function touchClinicSync() {
  localStorage.setItem(
    CLINIC_SYNC_KEYS.clinicSyncStamp,
    JSON.stringify({
      updatedAt: new Date().toISOString(),
      stamp: Date.now()
    })
  );
}

function getPatientNotificationsShared() {
  const db = getClinicDb();
  const dbList = Array.isArray(db?.notifications?.patient) ? db.notifications.patient : [];
  if (dbList.length) return dbList;

  const legacyList = getClinicData(CLINIC_SYNC_KEYS.patientNotifications, []);
  return Array.isArray(legacyList) ? legacyList : [];
}

function savePatientNotificationsShared(list) {
  const safeList = Array.isArray(list) ? list : [];
  const db = getClinicDb();
  db.notifications = db.notifications || { admin: [], dentist: [], patient: [] };
  db.notifications.patient = safeList;
  saveClinicDb(db);
  localStorage.setItem(CLINIC_SYNC_KEYS.patientNotifications, JSON.stringify(safeList));
  touchClinicSync();
}

function getDentistNotificationsShared() {
  const list = getClinicData(CLINIC_SYNC_KEYS.dentistNotifications, []);
  return Array.isArray(list) ? list : [];
}

function saveDentistNotificationsShared(list) {
  const safeList = Array.isArray(list) ? list : [];
  const db = getClinicDb();
  db.notifications = db.notifications || { admin: [], dentist: [], patient: [] };
  db.notifications.dentist = safeList;
  saveClinicDb(db);
  localStorage.setItem(CLINIC_SYNC_KEYS.dentistNotifications, JSON.stringify(safeList));
  touchClinicSync();
}

function pushPatientNotification(text, patientIdOrMeta = null, meta = {}) {
  const sessionUser = getCurrentUser() || {};
  const payload = typeof patientIdOrMeta === "object" && patientIdOrMeta !== null
    ? patientIdOrMeta
    : {
        ...meta,
        patientId: patientIdOrMeta || meta.patientId || sessionUser.patientId || sessionUser.id || "PT-001"
      };

  const list = getPatientNotificationsShared();
  list.unshift({
    id: payload.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-p`,
    text,
    createdAt: payload.createdAt || new Date().toISOString(),
    read: false,
    patientId: payload.patientId || sessionUser.patientId || sessionUser.id || "PT-001",
    appointmentId: payload.appointmentId || "",
    treatmentId: payload.treatmentId || "",
    sessionId: payload.sessionId || "",
    eventType: payload.eventType || "general"
  });
  savePatientNotificationsShared(list);
}

function pushDentistNotification(text, meta = {}) {
  const list = getDentistNotificationsShared();
  list.unshift({
    id: meta.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-d`,
    text,
    createdAt: meta.createdAt || new Date().toISOString(),
    read: false,
    patientId: meta.patientId || "",
    appointmentId: meta.appointmentId || "",
    treatmentId: meta.treatmentId || "",
    sessionId: meta.sessionId || "",
    eventType: meta.eventType || "general"
  });
  saveDentistNotificationsShared(list);
}

function createPatientNotificationListItem(item) {
  const li = document.createElement("li");
  li.className = `notif-clickable${item.read ? "" : " unread"}`;
  li.tabIndex = 0;
  li.setAttribute("role", "button");
  li.dataset.notificationId = item.id || "";

  const title = document.createElement("span");
  title.className = "notif-item-title";
  title.textContent = item.text || "Notification";

  const time = document.createElement("span");
  time.className = "notif-item-time";
  time.textContent = item.createdAt ? new Date(item.createdAt).toLocaleString() : "";

  li.append(title, time);
  li.addEventListener("click", () => handlePatientNotificationClick(item.id));
  li.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePatientNotificationClick(item.id);
    }
  });

  return li;
}

function getRefundAppointmentFromNotification(notification = {}) {
  const appointment = notification.appointmentId ? getAppointmentById(notification.appointmentId) : null;
  const pendingAppointment = appointment || getPendingRefundMethodAppointment?.();
  if (!pendingAppointment) return null;

  const normalized = normalizeAppointmentFinancials(pendingAppointment);
  const totalCollected = Number(normalized.totalCollected || 0);
  const totalRefunded = safeArray(normalized.refunds).reduce((sum, refund) => sum + Number(refund.amount || 0), 0);
  const hasPendingRefundMethod = normalizeAppointmentLifecycleStatus(normalized.status || pendingAppointment.status) === "Cancelled"
    && normalized.refundMethodPending === true
    && totalCollected > totalRefunded;

  return hasPendingRefundMethod ? normalized : null;
}

function markPatientNotificationRead(notificationId) {
  if (!notificationId) return;
  const list = getPatientNotificationsShared().map(item => (
    String(item.id || "") === String(notificationId)
      ? { ...item, read: true }
      : item
  ));
  savePatientNotificationsShared(list);
}

function handlePatientNotificationClick(notificationId) {
  const notification = getPatientNotificationsShared().find(item => String(item.id || "") === String(notificationId));
  if (!notification) return;

  markPatientNotificationRead(notificationId);
  renderSharedNotifications("patient");

  if (notification.eventType === "appointment_refunded" && notification.appointmentId) {
    document.getElementById("notifPanel")?.classList.remove("active");
    document.getElementById("allNotifModal")?.classList.remove("active");
    viewAppointmentDetails(notification.appointmentId);
    return;
  }
  const refundAppointment = getRefundAppointmentFromNotification(notification);
  if (refundAppointment) {
    document.getElementById("notifPanel")?.classList.remove("active");
    document.getElementById("allNotifModal")?.classList.remove("active");
    openRefundSelectionModal(refundAppointment.id);
    return;
  }

  if (notification.appointmentId) {
    showSection("my-appointments");
  }
}

function markSharedNotificationsRead(type = "patient") {
  const sessionUser = getCurrentUser() || {};
  const currentPatientId = sessionUser.patientId || sessionUser.id || "PT-001";
  const key =
    type === "dentist"
      ? CLINIC_SYNC_KEYS.dentistNotifications
      : CLINIC_SYNC_KEYS.patientNotifications;

  const list = getClinicData(key, []).map(item => ({
    ...item,
    // Only mark this patient's notifications as read
    read: item.patientId && item.patientId !== currentPatientId ? item.read : true
  }));

  setClinicData(key, list);
}


// Automatically refresh page sections when the other page changes localStorage
function initCrossPageSync(refreshFn) {
  window.addEventListener("storage", (event) => {
    const watchedKeys = [
      CLINIC_SYNC_KEYS.appointments,
      CLINIC_SYNC_KEYS.archivedAppointments,
      CLINIC_SYNC_KEYS.rescheduleRequests,
      CLINIC_SYNC_KEYS.pendingPayment,
      CLINIC_SYNC_KEYS.userProfileData,
      CLINIC_SYNC_KEYS.patientNotifications,
      CLINIC_SYNC_KEYS.dentistNotifications,
      CLINIC_SYNC_KEYS.clinicSyncStamp
    ];

    if (watchedKeys.includes(event.key)) {
      if (typeof refreshFn === "function") {
        refreshFn();
      }
    }
  });
}

    // ✅ BILLING FORM
// ==============================
// 🔥 GLOBAL REALTIME SYNC ENGINE
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

function lockPageHistory() {
  history.replaceState({ pageLocked: true }, "", location.href);
  history.pushState({ pageLocked: true }, "", location.href);

  window.addEventListener("popstate", () => {
    history.pushState({ pageLocked: true }, "", location.href);
  });
}
// NAVIGATION
/**
 * Handles section switching and sidebar highlighting
 * @param {string} id - The ID of the content section to show
 */
function showSection(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const target = document.getElementById(id);
    if (target) {
        target.classList.add('active');
    }

    let navId = '';

    if (id === 'dashboard') navId = 'link-dash';
    else if (id === 'book-apt') navId = 'link-book';
    else if (id === 'my-appointments') navId = 'link-appointments';
    else if (id === 'history') navId = 'link-history';
    else if (id === 'services') navId = 'link-services';
    else if (id === 'archive') navId = 'link-archive';
    else if (id === 'profile') navId = 'link-profile';
    else if (id === 'billing') navId = 'link-book';

    const navLink = document.getElementById(navId);
    if (navLink) {
        navLink.classList.add('active');
    }

    closeMobileSidebar();
    if (id === 'book-apt') void refreshBookingReservations();
}

function normalizeAppointmentSchedule(apt) {
    if (!apt) return apt;

    const fixed = { ...apt };

    if (fixed.schedule) {
        const parts = fixed.schedule.split("•").map(s => s.trim());

        const datePart = parts[0] || "";
        const timePart = cleanDuplicateMeridiem(parts[1] || "");

        fixed.schedule = `${datePart} • ${timePart}`;
    }

    return fixed;
}

/**
 * INITIALIZATION: 
 * This ensures the Dashboard is active when the page first opens.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Calling your function here fixes the "no highlight on load" issue
    showSection('dashboard'); 
});
// SERVICES GRID
// SERVICES GRID - Updated to include Overview button
// RENDER THE GRID (In the Services Section)
function renderServices() {
    const grid = document.getElementById('serviceGrid');
    grid.innerHTML = "";

    services.forEach(s => {
        let photoKey = window.GMSiteContent.serviceImageKey(s);
        const aliases = {
            "oral prophylaxis teeth cleaning": "Oral Prophylaxis",
            "dental fillings": "Restorative Treatment",
            "teeth whitening": "Whitening",
            "orthodontic treatment braces": "Orthodontic Treatment"
        };
        const normalizedName = s.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        if (photoKey.startsWith("service:") && !window.GMClinicSettings?.images?.[photoKey] && aliases[normalizedName]) {
            photoKey = window.GMSiteContent.serviceImageKey({ ...s, name: aliases[normalizedName] });
        }
        grid.innerHTML += `
            <div class="service-card shadow-sm border-0">
                <img class="patient-service-photo" data-service-image="${escapeHtml(photoKey)}" alt="${escapeHtml(s.name)}" loading="lazy" hidden>
                <h4 class="mt-3 fw-bold">${escapeHtml(s.name)}</h4>
                <span class="price-tag mb-3">₱${s.price.toLocaleString()}</span>
                
                <div class="d-grid gap-2 w-100 px-3 pb-3">
                    <button class="btn-gradient mb-1" onclick="goToBooking(${escapeHtml(JSON.stringify(s.name))})">
                        Book Appointment
                    </button>
                    <button class="btn btn-link btn-sm text-decoration-none text-muted fw-bold" 
                            data-bs-toggle="offcanvas" 
                            data-bs-target="#serviceDetailsPanel"
                            onclick="populateOverviewPanel(${escapeHtml(JSON.stringify(s.name))})">
                        View Overview
                    </button>
                </div>
            </div>
        `;
    });
    window.GMRefreshServicePhotos?.();
}
function renderSharedNotifications(type = "patient") {
  const panel = document.getElementById("notifPanel");
  const listEl = document.getElementById("notifList");
  const allListEl = document.getElementById("allNotifList") || document.getElementById("allNotifModalList");
  const dotEl = document.querySelector(".notif-wrapper .dot");

  if (!panel || !listEl) return;

  const sessionUser = getCurrentUser() || {};
  const currentPatientId = sessionUser.patientId || sessionUser.id || "PT-001";

  const allNotifications =
    type === "dentist"
      ? getDentistNotificationsShared()
      : getPatientNotificationsShared();

  // Filter notifications to only show those belonging to this patient
  const notifications = allNotifications.filter(notification => {
    if (!notification.patientId) return true;
    return String(notification.patientId) === String(currentPatientId);
  });

  listEl.innerHTML = "";
  if (allListEl) allListEl.innerHTML = "";

  if (!notifications.length) {
    listEl.innerHTML = `<li class="notif-empty">No notifications yet.</li>`;
    if (allListEl) {
      allListEl.innerHTML = `<li class="notif-empty">No notifications yet.</li>`;
    }
  } else {
    const previewList = notifications.slice(0, 5);

    previewList.forEach(item => {
      listEl.appendChild(createPatientNotificationListItem(item));
    });

    if (allListEl) {
      notifications.forEach(item => {
        allListEl.appendChild(createPatientNotificationListItem(item));
      });
    }
  }

  const unread = notifications.some(n => !n.read);
  if (dotEl) {
    dotEl.style.display = unread ? "block" : "none";
  }
}
// POPULATE THE OVERVIEW SIDEBAR
function populateOverviewPanel(serviceName) {
    const service = services.find(s => s.name === serviceName);

    if (service) {
        document.getElementById('panelTitle').innerText = service.name;
        document.getElementById('panelDescription').innerText = service.description;

        const priceEl = document.getElementById('panelPrice');
        if (priceEl) priceEl.innerText = `₱${Number(service.price || 0).toLocaleString()}`;

        const durationEl = document.getElementById('panelDuration');
        if (durationEl) durationEl.innerText = service.displayDuration || "—";

        const list = document.getElementById('panelIncludes');
        if (list) {
            list.innerHTML = "";
            service.includes.forEach(item => {
                const li = document.createElement('li');
                li.className = "mb-2 d-flex align-items-center list-unstyled";
                li.innerHTML = `
                    <i class="bi bi-check-circle-fill text-success me-2"></i>
                    <span class="small ms-2">${item}</span>
                `;
                list.appendChild(li);
            });
        }
    }
}


// POPULATE SELECT
function populateSelect() {
    const select = document.getElementById('serviceSelect');
    select.innerHTML = "";

    services.forEach(s => {
        select.innerHTML += `<option>${s.name}</option>`;
    });
}

// BOOKING


function openBilling(appointment) {
  const item = resolveBillingTargetRecord(appointment);

  if (!item || !item.id) {
    showToast("Billing record not found ❗");
    return;
  }

  if (!canOpenBillingForAppointment(item)) {
    showToast("Payment is only available for approved or ongoing clinic records.");
    return;
  }

  if (item.remainingBalance <= 0 || item.paymentStatus === "Paid") {
    openInvoiceModal(item.treatmentId || item.id);
    return;
  }

  localStorage.setItem("pendingPayment", JSON.stringify(item));

  const paymentTypeSection = document.querySelector(".payment-type-section");
  const paymentAmountCaption = document.querySelector("#downPaymentWrapper .billing-panel-caption");
  const paymentHelp = document.getElementById("paymentHelp");
  const billingNote = document.getElementById("billingNote");

  if (paymentTypeSection) paymentTypeSection.classList.add("d-none");
  if (paymentAmountCaption) {
    paymentAmountCaption.textContent = "Amount updates automatically based on the selected services and additional fees.";
  }
  if (paymentHelp) {
    paymentHelp.textContent = "Choose how to pay each service below. Additional fees are paid in full. The total updates automatically.";
  }
  if (billingNote) {
    billingNote.classList.remove("d-none");
    billingNote.textContent = "All services may use full payment or downpayment. Orthodontic Treatment is the only service with the installment option.";
  }

  window.GMReceiptUpload?.reset();
  globalBillingPaymentMode = "full";
  initializeBillingEventBindings();
  setBillingPaymentMethod(item.paymentMethod === "cash" ? "cash" : "gcash");
  refreshBillingWorkspace(item);
  showSection("billing");
}
//BILLING FORM

// =============================
// SHARED APPOINTMENT DATA LAYER
// USE THIS EVERYWHERE IN PATIENT PAGE
// =============================
function getAppointmentsShared() {
  const db = getClinicDb();
  const dbList = Array.isArray(db.appointments) ? db.appointments : [];
  const legacyList = getClinicData(CLINIC_SYNC_KEYS.appointments, []);

  // Prefer DB, but fall back safely
  if (dbList.length) return dbList;
  return Array.isArray(legacyList) ? legacyList : [];
}

function saveAppointmentsShared(list) {
  const safeList = Array.isArray(list) ? list : [];

  const db = getClinicDb();
  db.appointments = safeList;
  saveClinicDb(db);

  localStorage.removeItem("appointments");
}

function getArchivedAppointmentsShared() {
  const db = getClinicDb();
  const dbList = Array.isArray(db.archivedAppointments) ? db.archivedAppointments : [];
  const legacyList = getClinicData(CLINIC_SYNC_KEYS.archivedAppointments, []);

  if (dbList.length) return dbList;
  return Array.isArray(legacyList) ? legacyList : [];
}

function saveArchivedAppointmentsShared(list) {
  const safeList = Array.isArray(list) ? list : [];

  const db = getClinicDb();
  db.archivedAppointments = safeList;
  saveClinicDb(db);

  localStorage.removeItem("archivedAppointments");
}

function getRescheduleRequestsShared() {
  const db = getClinicDb();
  const dbList = Array.isArray(db.rescheduleRequests) ? db.rescheduleRequests : [];
  const legacyList = getClinicData(CLINIC_SYNC_KEYS.rescheduleRequests, []);

  if (dbList.length) return dbList;
  return Array.isArray(legacyList) ? legacyList : [];
}

function saveRescheduleRequestsShared(list) {
  const safeList = Array.isArray(list) ? list : [];

  const db = getClinicDb();
  db.rescheduleRequests = safeList;
  saveClinicDb(db);

  localStorage.removeItem("rescheduleRequests");
}
function getCurrentReschedulableAppointment() {
    const candidates = getPatientAppointmentsShared({ includeArchived: false })
        .filter(a =>
            a &&
            a.schedule &&
            a.service &&
            ["Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(getOperationalAppointmentStatus(a))
        )
        .map(a => ({
            ...a,
            parsedDate: parseAppointmentDateTime(a.schedule)
        }))
        .filter(a => a.parsedDate);

    if (!candidates.length) return null;

    candidates.sort((a, b) => a.parsedDate - b.parsedDate);

    const now = new Date();
    return candidates.find(a => a.parsedDate >= now) || candidates[0];
}
function updateRescheduleModalText() {
    const helperText = document.getElementById("rescheduleHelperText");
    if (!helperText) return;

    const selectedAppointmentId = document.getElementById("rescheduleAppointmentId")?.value || "";
    const appointments = getPatientAppointmentsShared({ includeArchived: false });

    const targetAppointment = selectedAppointmentId
        ? appointments.find(a => String(a.id) === String(selectedAppointmentId))
        : getCurrentReschedulableAppointment();

    if (!targetAppointment || !targetAppointment.service) {
        helperText.innerHTML = `Please select a new preferred date for your <strong>appointment</strong>.`;
        return;
    }

    helperText.innerHTML = `Please select a new preferred date for your <strong>${targetAppointment.service}</strong>.`;
}
function matchesRecordFilter(record, searchValue, statusValue) {
    const search = String(searchValue || "").trim().toLowerCase();
    const status = String(statusValue || "").trim();

    const service = String(record.service || "").toLowerCase();
    const schedule = String(record.schedule || "").toLowerCase();
    const recordStatus = String(record.status || "").trim();

    const searchMatch =
        !search ||
        service.includes(search) ||
        schedule.includes(search);

    const statusMatch =
        !status || recordStatus === status;

    return searchMatch && statusMatch;
}

function getPatientFilterValues() {
  return {
    appointmentsSearch: document.getElementById("appointmentsSearchInput")?.value || "",
    appointmentsStatus: document.getElementById("appointmentsStatusFilter")?.dataset.value || "",
    historySearch: document.getElementById("historySearchInput")?.value || "",
    historyStatus: document.getElementById("historyStatusFilter")?.dataset.value || "",
    archiveSearch: document.getElementById("archiveSearchInput")?.value || "",
    archiveStatus: document.getElementById("archiveStatusFilter")?.dataset.value || ""
  };
}

function ensureActiveTreatmentPlansPanel() {
    const section = document.getElementById("my-appointments");
    if (!section) return null;

    let body = document.getElementById("activeTreatmentPlansTableBody");
    if (body) return body;

    const appointmentCard = section.querySelector(".premium-appointments-card");
    if (!appointmentCard) return null;

    const panel = document.createElement("div");
    panel.className = "settings-card premium-appointments-card mb-3";
    panel.id = "activeTreatmentPlansPanel";
    panel.innerHTML = `
        <div class="premium-appointments-card-top">
            <div>
                <h5>Active Treatment Plans</h5>
                <p>Track ongoing orthodontic cases, next adjustment visits, progress, and balance.</p>
            </div>
        </div>
        <div class="table-modern premium-appointments-table-wrap">
            <table class="table premium-appointments-table text-white">
                <thead>
                    <tr>
                        <th>Treatment</th>
                        <th>Next Adjustment</th>
                        <th>Progress</th>
                        <th>Balance</th>
                        <th class="text-center">Actions</th>
                    </tr>
                </thead>
                <tbody id="activeTreatmentPlansTableBody"></tbody>
            </table>
        </div>
    `;

    appointmentCard.parentNode.insertBefore(panel, appointmentCard);
    return document.getElementById("activeTreatmentPlansTableBody");
}

function getTreatmentPlanProgressLabel(plan = {}) {
    const sessions = safeArray(plan.sessions);
    const completed = sessions.filter(session => normalizeAppointmentLifecycleStatus(session.status || "") === "Completed").length;
    const total = Math.max(sessions.length, Number(plan.estimatedDurationMonths || 0), 1);
    const percent = Math.min(100, Math.round((completed / total) * 100));
    return `${completed}/${total} visits (${percent}%)`;
}

function renderActiveTreatmentPlans(activeTreatmentCases = []) {
    const body = ensureActiveTreatmentPlansPanel();
    if (!body) return;

    body.innerHTML = "";

    if (!activeTreatmentCases.length) {
        body.innerHTML = `
            <tr>
                <td colspan="5">No active treatment plans.</td>
            </tr>
        `;
        return;
    }

    activeTreatmentCases.forEach(plan => {
        const treatmentId = escapeSingleQuote(plan.treatmentId || plan.id || "");
        const menuId = `plan-${treatmentId}`;
        const planStatus = plan.rawPlanStatus || normalizeTreatmentPlanStatus(plan.status || "Active");
        const isDiscontinuationRequested = planStatus === "Discontinuation Requested";
        const isPendingConsultation = planStatus === "Pending Consultation";

        // Check the linked free consultation session state
        let consultationDone = false;
        let consultationBooked = false;
        if (isPendingConsultation && plan.consultationSessionId) {
            const csltAppt = getAppointmentById(plan.consultationSessionId);
            const csltStatus = String(csltAppt?.status || csltAppt?.lifecycleStatus || "").toLowerCase();
            consultationDone = csltStatus === "completed";
            consultationBooked = !!csltAppt && !["cancelled", "rejected", ""].includes(csltStatus);
        }

        const nextAdjustment = isDiscontinuationRequested
            ? "Awaiting Dentist Decision"
            : isPendingConsultation
                ? (consultationDone ? "Consultation Completed" : "Awaiting Consultation")
                : (plan.nextSessionSchedule || buildSchedule(plan.nextSessionDate || "", plan.nextSessionTime || "") || "To be scheduled");

        const statusBadge = isDiscontinuationRequested
            ? `<span class="badge" style="background:#f59e0b;color:#fff;font-size:0.68rem;margin-left:6px;vertical-align:middle;">Discontinuation Requested</span>`
            : isPendingConsultation
                ? `<span class="badge" style="background:#3b82f6;color:#fff;font-size:0.68rem;margin-left:6px;vertical-align:middle;">${consultationDone ? "Consultation Done" : "Pending Consultation"}</span>`
                : "";

        // "Request to Discontinue" is shown when: not already pending, and if pending consultation then only after consultation is done
        const showDiscontinueOption = !isDiscontinuationRequested && (!isPendingConsultation || consultationDone);

        const dropdownItems = `
            <button type="button" class="patient-dropdown-item"
                onclick="openInvoiceModal('${treatmentId}'); closeAllPatientActionMenus();">
                <i class="bi bi-receipt"></i>
                <span>View Invoice</span>
            </button>
            ${showDiscontinueOption ? `
            <button type="button" class="patient-dropdown-item danger"
                onclick="openDiscontinuationModal('${treatmentId}'); closeAllPatientActionMenus();">
                <i class="bi bi-x-circle"></i>
                <span>Request to Discontinue</span>
            </button>` : ""}
        `;

        // Banner row for Pending Consultation (only when consultation is not yet completed)
        const bookBtnLabel = consultationBooked ? "View Consultation" : "Book Free Consultation";
        const bookBtnIcon = consultationBooked ? "bi-eye" : "bi-calendar-check";
        const consultationBannerRow = (isPendingConsultation && !consultationDone) ? `
            <tr class="pcb-banner-row">
                <td colspan="5" style="padding:0;border:none;">
                    <div class="pending-consultation-banner">
                        <div class="pcb-info">
                            <i class="bi bi-chat-square-text-fill pcb-icon"></i>
                            <div>
                                <strong>Consultation Required</strong>
                                <span>The dentist requires a consultation before processing your discontinuation request.${plan.consultationNote ? ` <em>"${escapeHtml(plan.consultationNote)}"</em>` : ""}${consultationBooked ? " <strong style='color:#15803d;'>&#10003; Session booked.</strong>" : ""}</span>
                            </div>
                        </div>
                        <div class="pcb-actions">
                            <button class="pcb-btn-book" onclick="openConsultationSession('${treatmentId}')">
                                <i class="bi ${bookBtnIcon}"></i> ${bookBtnLabel}
                            </button>
                            <button class="pcb-btn-withdraw" onclick="withdrawDiscontinuationRequest('${treatmentId}')">
                                <i class="bi bi-arrow-counterclockwise"></i> Withdraw Request
                            </button>
                        </div>
                    </div>
                </td>
            </tr>` : "";

        body.innerHTML += `
            <tr>
                <td>
                    ${plan.serviceName || plan.service || "Orthodontic Treatment"}
                    ${statusBadge}
                </td>
                <td>${nextAdjustment}</td>
                <td>${getTreatmentPlanProgressLabel(plan)}</td>
                <td>${formatBillingCurrency(plan.remainingBalance || 0)}</td>
                <td class="text-center">
                    <div class="patient-action-menu-wrap">
                        <button class="more-toggle" type="button"
                            onclick="togglePatientActionMenu(event, '${menuId}')"
                            aria-label="More actions">
                            <i class="bi bi-three-dots"></i>
                        </button>
                        <div class="patient-action-dropdown" data-appointment-id="${menuId}">
                            ${dropdownItems}
                        </div>
                    </div>
                </td>
            </tr>
            ${consultationBannerRow}
        `;
    });
}

function initPatientRecordFilters() {
    const searchIds = [
        "appointmentsSearchInput",
        "historySearchInput",
        "archiveSearchInput"
    ];

    searchIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        el.addEventListener("input", () => {
            loadAppointmentsUI();
            loadArchiveUI();
        });
    });
}

function moveAppointmentToArchive(id, source = "patient") {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

// LOAD TABLE
function loadAppointmentsUI() {
    const dashboardBody = document.getElementById("dashboardTableBody");
    const appointmentsBody = document.getElementById("myAppointmentsTableBody");
    const historyBody = document.getElementById("historyTableBody");

    const patientAppointments = getPatientAppointmentsShared({ includeArchived: false }).map(normalizeAppointmentSchedule);
    const activeTreatmentCases = getActiveTreatmentCaseRecordsForPatient().map(normalizeAppointmentSchedule);
    const filters = getPatientFilterValues();

    if (dashboardBody) dashboardBody.innerHTML = "";
    if (appointmentsBody) appointmentsBody.innerHTML = "";
    if (historyBody) historyBody.innerHTML = "";

    renderActiveTreatmentPlans(activeTreatmentCases);

    const activeAppointmentsRaw = patientAppointments
        .filter(apt => isActiveLifecycleStatus(apt.lifecycleStatus || apt.status || "Pending"))
        .sort((left, right) => getRecordDateTimeValue(left) - getRecordDateTimeValue(right));

    const historyAppointmentsRaw = patientAppointments
        .filter(apt => isHistoryLifecycleStatus(apt.lifecycleStatus || apt.status || "Pending"))
        .sort((left, right) => getRecordDateTimeValue(right) - getRecordDateTimeValue(left));

    const activeAppointments = activeAppointmentsRaw.filter(apt =>
        matchesRecordFilter(apt, filters.appointmentsSearch, filters.appointmentsStatus)
    );

    const historyAppointments = historyAppointmentsRaw.filter(apt =>
        matchesRecordFilter(apt, filters.historySearch, filters.historyStatus)
    );

    const dashboardPreview = [...activeAppointmentsRaw].slice(0, 3);

    if (dashboardBody) {
        if (!dashboardPreview.length) {
            dashboardBody.innerHTML = `
                <tr>
                    <td colspan="4">No active appointments.</td>
                </tr>
            `;
        } else {
            dashboardPreview.forEach((apt) => {
                const safeStatus = String(apt.status || "Pending").trim() || "Pending";
                const safeStatusClass = safeStatus.toLowerCase().replace(/\s+/g, "-");

                dashboardBody.innerHTML += `
                    <tr>
                        <td>${apt.service}</td>
                        <td>${apt.schedule}</td>
                        <td><span class="badge ${safeStatusClass}">${safeStatus === "Reschedule Requested" ? "Awaiting Reschedule Confirmation" : safeStatus}</span></td>
                        <td>${buildPatientAppointmentActions(apt)}</td>
                    </tr>
                `;
            });
        }
    }

    if (appointmentsBody) {
        if (!activeAppointments.length) {
            appointmentsBody.innerHTML = `
                <tr>
                    <td colspan="4">No matching appointment records found.</td>
                </tr>
            `;
        } else {
            activeAppointments.forEach((apt) => {
                const safeStatus = String(apt.status || "Pending").trim() || "Pending";

                appointmentsBody.innerHTML += `
                    <tr>
                    <td>${apt.service}</td>
                    <td>${apt.schedule}</td>
                    <td>
                    <span class="badge ${String(apt.status || '').toLowerCase()}">
                        ${apt.status}
                    </span>
                    </td>
                    <td>${buildPatientAppointmentActions(apt)}</td>
                </tr>
                `;
            });
        }
    }

    if (historyBody) {
        if (!historyAppointments.length) {
            historyBody.innerHTML = `
                <tr>
                    <td colspan="4">No matching history records found.</td>
                </tr>
            `;
        } else {
            historyAppointments.forEach((apt) => {
                const safeStatus = String(apt.status || "Completed").trim() || "Completed";
                const safeStatusClass = safeStatus.toLowerCase().replace(/\s+/g, "-");

                historyBody.innerHTML += `
                    <tr>
                        <td>${apt.service}</td>
                        <td>${apt.schedule}</td>
                        <td><span class="badge ${safeStatusClass}">${safeStatus === "Reschedule Requested" ? "Awaiting Reschedule Confirmation" : safeStatus}</span></td>
                        <td>
                            <button class="btn btn-sm btn-outline-info me-1" onclick="viewAppointmentDetails('${apt.id}')">
                                <i class="bi bi-eye"></i>
                            </button>
                            <i class="bi bi-trash text-danger"
                               style="cursor:pointer"
                               onclick="deleteHistory('${apt.id}')"></i>
                        </td>
                    </tr>
                `;
            });
        }
    }
}

function deleteHistory(id) {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}


// DELETE APPOINTMENT
let appointmentIdToDelete = null;
let pendingPatientCrudAction = null;

function openPatientCrudWarning({
    title = "Confirm Action",
    message = "Please confirm that you want to continue.",
    confirmLabel = "Continue",
    confirmClass = "btn-gradient",
    iconClass = "icon-box-archive",
    icon = "bi bi-exclamation-triangle",
    onConfirm = null
} = {}) {
    const modal = document.getElementById("patientCrudWarningModal");
    const iconBox = document.getElementById("patientCrudWarningIcon");
    const titleEl = document.getElementById("patientCrudWarningTitle");
    const messageEl = document.getElementById("patientCrudWarningMessage");
    const confirmBtn = document.getElementById("patientCrudConfirmBtn");

    if (!modal || !iconBox || !titleEl || !messageEl || !confirmBtn) return;

    pendingPatientCrudAction = typeof onConfirm === "function" ? onConfirm : null;

    iconBox.className = iconClass;
    iconBox.innerHTML = `<i class="${icon}"></i>`;
    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = confirmClass;
    modal.classList.add("active");
}

function closePatientCrudWarning() {
    document.getElementById("patientCrudWarningModal")?.classList.remove("active");
    pendingPatientCrudAction = null;
}

function confirmPatientCrudWarning() {
    if (!pendingPatientCrudAction) return;
    const action = pendingPatientCrudAction;
    closePatientCrudWarning();
    action();
}

document.getElementById("patientCrudConfirmBtn")?.addEventListener("click", confirmPatientCrudWarning);

function performArchiveAppointment(id, source = "patient", successMessage = "Appointment archived.", notificationMessage = "An appointment was moved to archive.") {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

function performMoveManyAppointmentsToArchive(statuses = [], source = "patient-bulk", successMessage = "Appointments moved to archive.", notificationMessage = "Appointments were moved to archive.", emptyMessage = "No matching appointments found.") {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

function performClearArchive() {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

// 1. Trigger the Custom Modal instead of alert
function deleteAppointment(id) {
    const apt = getAppointmentById(id);
    if (!apt) {
        showToast("Appointment not found.");
        return;
    }

    appointmentIdToDelete = String(id);
    openPatientCrudWarning({
        title: "Move Appointment to Archive?",
        message: `This will hide ${apt.service || "this appointment"} from your active list. You can restore it later from Archive.`,
        confirmLabel: "Archive",
        confirmClass: "btn-gradient",
        iconClass: "icon-box-archive",
        icon: "bi bi-archive",
        onConfirm: () => performArchiveAppointment(id, "patient", "Appointment archived.", "An appointment was moved to archive.")
    });
}

// 2. Close the modal
// 3. The actual deletion logic (Attached to the Red Button)
// 3. The updated archiving logic
// 3. The updated archiving logic (Calls the helper function)
document.getElementById("confirmDeleteBtn").onclick = function() {
    if (!appointmentIdToDelete) return;
    performArchiveAppointment(appointmentIdToDelete);
    closeDeleteModal(); 
};

// NOTIFICATIONS

// =============================
// PATIENT NOTIFICATIONS
// Replace old addNotification / toggleNotifPanel logic
// =============================


function toggleSharedNotifPanel(type = "patient", forceClose = null) {
  const panel = document.getElementById("notifPanel");
  if (!panel) return;

  if (forceClose === true) {
    panel.classList.remove("active");
    return;
  }

  panel.classList.toggle("active");

  if (panel.classList.contains("active")) {
    renderSharedNotifications(type);
  }
}
function addNotification(text) {
  pushPatientNotification(text);
  renderSharedNotifications("patient");
}
function markAllPatientNotificationsRead() {
  const list = getPatientNotificationsShared().map(n => ({
    ...n,
    read: true
  }));

  savePatientNotificationsShared(list);
}

function clearAllPatientNotifications() {
  savePatientNotificationsShared([]);
}
function toggleSidebar() {
    const shell = document.querySelector(".app-shell");
    if (!shell) return;

    if (isMobileSidebarLayout()) {
        setMobileSidebar(!shell.classList.contains("collapsed"));
    } else {
        shell.classList.toggle("collapsed");
    }
}

function isMobileSidebarLayout() {
    return window.matchMedia("(max-width: 1024px)").matches;
}

function setMobileSidebar(open) {
    const shell = document.querySelector(".app-shell");
    const backdrop = document.getElementById("sidebarBackdrop");
    const mobileToggle = document.getElementById("mobileSidebarToggle");
    if (!shell) return;

    shell.classList.toggle("collapsed", open);
    shell.classList.toggle("mobile-open", open);
    backdrop?.classList.toggle("show", open);
    mobileToggle?.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("sidebar-open", open);
}

function closeMobileSidebar() {
    if (isMobileSidebarLayout()) setMobileSidebar(false);
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("mobileSidebarToggle")?.addEventListener("click", () => {
        const shell = document.querySelector(".app-shell");
        setMobileSidebar(!shell?.classList.contains("collapsed"));
    });

    document.getElementById("sidebarBackdrop")?.addEventListener("click", closeMobileSidebar);

    window.addEventListener("resize", () => {
        if (!isMobileSidebarLayout()) {
            document.getElementById("sidebarBackdrop")?.classList.remove("show");
            document.getElementById("mobileSidebarToggle")?.setAttribute("aria-expanded", "false");
            document.body.classList.remove("sidebar-open");
            document.querySelector(".app-shell")?.classList.remove("mobile-open");
        }
    });
});
function renderAllPatientUI() {
  loadAppointmentsUI?.();
  loadArchiveUI?.();
  renderHeroAppointment?.();
  loadSavedProfile?.();
  renderSharedNotifications("patient");
  promptPendingRefundMethodSelection?.();
}

function showToast(message) {
    const toast = document.getElementById("toastMessage");

    if (!toast) return;

    toast.innerHTML = `✔️ ${message}`;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 7000);
}

let selectedServiceObj = null;
let selectedTime = "";

// AUTO TIME SLOTS
let currentDate = new Date();
let selectedDate = "";

let selectedDentistId = "";
let selectedDentistObj = null;
let selectedBookingServices = [];
let bookingDependents = [];
let editingDependentIndex = -1;

function getBookingServices() {
    return [
        ...selectedBookingServices.map(service => ({ ...service, participantId: "main", participantName: "Main patient" })),
        ...bookingDependents.flatMap(dep => (dep.services || []).map(service => ({
            ...service, participantId: dep.id, participantName: dep.name
        })))
    ];
}


function syncPrimarySelectedService() {
    selectedServiceObj = getBookingServices()[0] || null;
    updateBookingStepLock();
}

function isStep1Complete() {
    return getBookingServices().length > 0 && !!selectedDentistObj;
}

function getStep1IncompleteReason() {
    if (!getBookingServices().length) return "Select at least one service first.";
    if (!selectedDentistObj) return "Choose a dentist before picking a date and time.";
    return "";
}

function updateBookingStepLock() {
    const locked = !isStep1Complete();
    ["step2", "step3"].forEach(stepClass => {
        const card = document.querySelector(`.booking-card.${stepClass}`);
        if (!card) return;
        card.classList.toggle("step-locked", locked);
        card.setAttribute("aria-disabled", String(locked));
    });
}

function getSelectedServicesDisplay() {
    if (!getBookingServices().length) return "Select Services";
    if (getBookingServices().length === 1) return getBookingServices()[0].name;
    return `${getBookingServices()[0].name} + ${getBookingServices().length - 1} more`;
}

function getSelectedServicesTotalPrice() {
    return getBookingServices().reduce((sum, service) => sum + Number(service.price || 0), 0);
}

function getSelectedServicesTotalDurationLabel() {
    const totalMinutes = getBookingServices().reduce((sum, service) => {
        return sum + BookingTime.serviceDuration(service);
    }, 0);

    if (totalMinutes <= 0) {
        if (!getBookingServices().length) return "-";
        return `${getBookingServices().length} service${getBookingServices().length > 1 ? "s" : ""}`;
    }
    if (totalMinutes < 60) return `${totalMinutes} mins`;
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function updateMainPatientDisplay() {
    const mainPatientName = document.getElementById("mainPatientName");
    if (!mainPatientName) return;

    const patientSession = currentPatientUser || getCurrentUser() || {};
    mainPatientName.textContent =
        patientSession.name ||
        patientSession.fullName ||
        patientSession.email ||
        "Patient";
}

function addDependent(index = -1) {

    editingDependentIndex = index;
    const dep = bookingDependents[index];
    const modal = document.getElementById("dependentModal");
    document.getElementById("dependentNameInput").value = dep?.name || "";
    document.getElementById("dependentAgeInput").value = dep?.age || "";
    document.getElementById("dependentRelationshipInput").value = dep?.relationship || "";
    document.getElementById("dependentModalTitle").textContent = dep ? "Edit dependent" : "Add dependent / child";
    document.getElementById("saveDependentButton").textContent = dep ? "Save changes" : "Add dependent";
    document.getElementById("saveDependentButton").disabled = !selectedDentistObj;
    document.getElementById("dependentServicesList").innerHTML = !selectedDentistObj ? '<p role="status">Select dentist first to see eligible services</p>' : services.map((service, i) => ({service, i})).filter(({service}) => dentistCanPerformService(selectedDentistObj, service.name)).map(({service, i}) => `
        <label class="dependent-service-option">
            <input type="checkbox" value="${i}" ${dep?.services?.some(item => item.name === service.name) ? "checked" : ""}>
            <span>${escapeHtml(service.name)}<small>${formatBillingCurrency(service.price || 0)} ? ${BookingTime.serviceDuration(service)} min</small></span>
        </label>`).join("");
    modal.classList.add("active");
    document.getElementById("dependentNameInput").focus();
}

function closeDependentModal() {
    document.getElementById("dependentModal")?.classList.remove("active");
}

function saveDependent() {
    const name = document.getElementById("dependentNameInput").value.trim();
    const ageInput = document.getElementById("dependentAgeInput");
    const age = ageInput.value.trim();
    const relationship = document.getElementById("dependentRelationshipInput").value.trim();
    const selected = Array.from(document.querySelectorAll("#dependentServicesList input:checked"))
        .map(input => services[Number(input.value)]).filter(Boolean);
    if (!name || /\p{N}/u.test(name)) { showToast("Enter a valid dependent name without numbers.", "error"); return; }
    if (!selectedDentistObj || selected.some(service => !dentistCanPerformService(selectedDentistObj, service.name))) return showToast("Choose services eligible for the selected dentist.", "error");
    if (!ageInput.checkValidity()) { ageInput.reportValidity(); return; }
    if (!selected.length) { showToast("Choose at least one service for this dependent."); return; }
    const dep = { id: bookingDependents[editingDependentIndex]?.id || createClinicEntityId("dep"), name, age, relationship, services: selected };
    if (editingDependentIndex >= 0) bookingDependents[editingDependentIndex] = dep;
    else bookingDependents.push(dep);
    refreshDependentBooking();
    closeDependentModal();
}

function renderDependentsList() {
    const list = document.getElementById("dependentsList");
    if (!list) return;
    list.querySelectorAll(".dependent-item:not(.main-patient)").forEach(el => el.remove());
    bookingDependents.forEach((dep, index) => {
        const item = document.createElement("div");
        item.className = "dependent-item";
        item.innerHTML = `<div class="dependent-info">
            <span class="dependent-name">${escapeHtml(dep.name)}</span>
            <span class="dependent-details">${escapeHtml(dep.relationship || "Dependent")}${dep.age !== undefined && dep.age !== null && dep.age !== "" ? " &middot; Age " + escapeHtml(dep.age) : ""}</span>
            <div class="dependent-service-summary">${(dep.services || []).map(service => `<span>${escapeHtml(service.name)} &middot; ${formatBillingCurrency(service.price || 0)}</span>`).join("")}</div>
        </div><div class="dependent-actions">
            <button type="button" class="btn btn-outline-primary btn-sm" onclick="addDependent(${index})">Edit</button>
            <button type="button" class="btn btn-outline-danger btn-sm" onclick="removeDependent(${index})" aria-label="Remove ${escapeHtml(dep.name)}">Remove</button>
        </div>`;
        list.appendChild(item);
    });
}

function refreshDependentBooking() {
    selectedTime = "";
    renderDependentsList();
    syncPrimarySelectedService();
    scheduleBookingSelectionRefresh();
    updateSummary();
}

function removeDependent(index) {
    bookingDependents.splice(index, 1);
    refreshDependentBooking();
}

function updateSelectedServicesList() {
    const list = document.getElementById("selectedServicesList");
    if (!list) return;

    if (!selectedBookingServices.length) {
        list.innerHTML = `<div class="text-muted small">No services selected yet.</div>`;
        return;
    }

    list.innerHTML = selectedBookingServices.map(service => `
        <div class="selected-service-item">
            <div class="service-info">
                <i class="bi bi-check-circle-fill text-primary"></i>
                <div>
                    <div class="service-name">${service.name}</div>
                    <div class="service-price">${formatBillingCurrency(service.price || 0)}</div>
                </div>
            </div>
            <button type="button" class="btn btn-link p-0 remove-service" data-service-name="${service.name}" aria-label="Remove ${service.name}">
                <i class="bi bi-x-circle"></i>
            </button>
        </div>
    `).join("");

    list.querySelectorAll(".remove-service").forEach(button => {
        button.addEventListener("click", () => {
            selectService(button.dataset.serviceName);
        });
    });
}

function updateServiceIncludes() {
    const includesList = document.getElementById("serviceIncludes");
    const panelIncludes = document.getElementById("panelIncludes");

    const renderContent = (target) => {
        if (!target) return;

        if (!selectedBookingServices.length) {
            target.innerHTML = `<li>Select services to view details</li>`;
            return;
        }

        target.innerHTML = selectedBookingServices.map(service => {
            const serviceIncludes = Array.isArray(service.includes) ? service.includes : [];
            return serviceIncludes.map(item => `<li>✔ ${service.name} - ${item}</li>`).join("");
        }).join("");
    };

    renderContent(includesList);
    renderContent(panelIncludes);
}

function getEligibleDentistsForSelectedServices() {
    if (!getBookingServices().length) return [];

    return bookingAvailabilityValue("eligibleDentists", () => getAllBookableDentists().filter(dentistCanPerformSelectedServices));
}

function resetBookingSelectionContext() {
    selectedDentistId = "";
    selectedDentistObj = null;
    selectedDate = "";
    selectedTime = "";
}

const CLINIC_DUTY_ROSTER = {
  "Monday": "Dr. Imelda Mappala",
  "Tuesday": "Dr. Daniel Santos",
  "Wednesday": "Dr. Carla Mendoza",
  "Thursday": "Dr. Paolo Villanueva",
  "Friday": "Dr. Sofia Ramirez",
  "Saturday-AM": "Dr. Miguel Torres",
  "Saturday-PM": "Dr. Andrea Cruz"
};



function buildDateString(year, month, day) {
    return normalizeBookingDate(`${year}-${month + 1}-${day}`);
}

// A render reads one snapshot. Never re-normalize and persist the complete
// appointment collection for each five-minute slot in a monthly calendar.
var bookingAvailabilitySnapshot = null;
var serverBookingReservations = [];
var bookingReservationsRequest = null;

async function refreshBookingReservations() {
    if (bookingReservationsRequest) return bookingReservationsRequest;
    bookingReservationsRequest = (async () => {
        try {
            const base = window.GmDentalSupabaseSync?.apiBaseUrl || window.GM_DENTAL_API_BASE || "";
            // Read independently of the write-sync queue. Unsaved local changes
            // must not hide reservations made on another device.
            const response = await window.GmDentalApiFetch(`${base}/api/booking-availability`, { cache: "no-store" });
            if (!response.ok) throw new Error("Could not refresh appointment availability.");
            const result = await response.json();
            if (!Array.isArray(result.db?.appointments)) throw new Error("Invalid appointment availability response.");
            if (Array.isArray(result.db.services)) useSavedServiceCatalog(result.db.services);
            serverBookingReservations = result.db.appointments;
            generateCalendar();
            generateTimeSlots();
            renderFreeConsultCalendar();
            renderFreeConsultTimeSlots();
            if (selectedDentistObj && !selectedTime) {
                setDentistAvailabilityHint("Choose an available time for your selected services.", "neutral");
            }
            return true;
        } catch (error) {
            setDentistAvailabilityHint("Could not refresh availability. Please try again before booking.", "danger");
            return false;
        } finally {
            bookingReservationsRequest = null;
        }
    })();
    return bookingReservationsRequest;
}

function withBookingAvailabilitySnapshot(render) {
    if (bookingAvailabilitySnapshot) return render();
    bookingAvailabilitySnapshot = new Map();
    try { return render(); }
    finally { bookingAvailabilitySnapshot = null; }
}

function bookingAvailabilityValue(key, read) {
    if (!bookingAvailabilitySnapshot) return read();
    if (!bookingAvailabilitySnapshot.has(key)) bookingAvailabilitySnapshot.set(key, read());
    return bookingAvailabilitySnapshot.get(key);
}

function getBookingAppointmentsForDate(dateString) {
    const byDate = bookingAvailabilityValue("appointmentsByDate", () => {
        const result = new Map();
        // This is a read-only operation: availability must not trigger sync writes.
        // Server records take precedence over stale local/legacy copies, without
        // overwriting local edits or sending a clinic database write.
        const reservations = new Map(buildCanonicalAppointmentCollections().map(appointment => [String(appointment.id), appointment]));
        for (const appointment of serverBookingReservations) reservations.set(String(appointment.id), appointment);
        for (const appointment of reservations.values()) {
            const date = normalizeBookingDate(appointment.date) || splitSchedule(appointment.schedule).date;
            if (!result.has(date)) result.set(date, []);
            result.get(date).push(appointment);
        }
        return result;
    });
    return byDate.get(normalizeBookingDate(dateString)) || [];
}

function getAvailableDentistsForDateTime(dateString, timeDisplayValue) {
    if (window.GMClinicHours && !GMClinicHours.allows(dateString, BookingTime.minutes(timeDisplayValue), BookingTime.duration({ services: getBookingServices() }), window.GMClinicSettings || {})) return [];
    if (!getBookingServices().length) return [];

    const identity = getCurrentPatientIdentity();
    if (patientHasConflict(identity.email, identity.name, dateString, timeDisplayValue)) return [];
    const availableDentist = getEligibleDentistsForSelectedServices().find((dentist) => {
        if (selectedDentistId && String(dentist.id) !== String(selectedDentistId)) {
            return false;
        }

        const works = dentistWorksOnDateAndTime(dentist, dateString, timeDisplayValue);
        return works && !isClinicSlotOccupied(dateString, timeDisplayValue, "", dentist);
    });

    // ✅ only allow ONE available dentist per slot
    return availableDentist ? [availableDentist] : [];
}
function isDateAvailable(dateString) {
    return withBookingAvailabilitySnapshot(() => isDateAvailableFromSnapshot(dateString));
}

function isDateAvailableFromSnapshot(dateString) {
    if (!getBookingServices().length) return false;

    return getAllBookingTimeSlots().some(time =>
        getAvailableDentistsForDateTime(dateString, time).length > 0
    );
}

function getDateAvailabilityCount(dateString) {
    return withBookingAvailabilitySnapshot(() => getDateAvailabilityCountFromSnapshot(dateString));
}

function getDateAvailabilityCountFromSnapshot(dateString) {
    if (!getBookingServices().length) return 0;

    let count = 0;

    getAllBookingTimeSlots().forEach(time => {
        if (getAvailableDentistsForDateTime(dateString, time).length > 0) {
            count++;
        }
    });

    return count;
}

function generateCalendar() {
    return withBookingAvailabilitySnapshot(() => generateCalendarFromSnapshot());
}

function generateCalendarFromSnapshot() {
    const daysContainer = document.getElementById("calendarDays");
    const monthLabel = document.getElementById("calendarMonth");

    if (!daysContainer || !monthLabel) return;

    daysContainer.innerHTML = "";

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    monthLabel.innerText = currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric"
    });

    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement("div");
        empty.className = "calendar-empty";
        daysContainer.appendChild(empty);
    }

    for (let i = 1; i <= totalDays; i++) {
        const day = document.createElement("div");
        day.className = "calendar-day";
        day.innerText = i;

        const dateOnly = new Date(year, month, i);
        const dateString = buildDateString(year, month, i);

        const indicator = document.createElement("span");
        indicator.className = "calendar-indicator";
        day.appendChild(indicator);

        if (dateOnly < todayOnly) {
            day.classList.add("past-day");
            day.title = "Past date";
        } else if (selectedServiceObj) {
            const availableCount = getDateAvailabilityCount(dateString);
            const subjectName = selectedDentistObj ? selectedDentistObj.name : "any eligible dentist";

            if (availableCount === 0) {
                day.classList.add("no-availability");
                day.title = selectedDentistObj
                    ? `${selectedDentistObj.name} is not on duty this day`
                    : "No dentist on duty this day";
            } else if (availableCount <= 2) {
                day.classList.add("has-availability", "limited-availability");
                day.title = `${availableCount} slot${availableCount === 1 ? "" : "s"} left for ${subjectName}`;
            } else {
                day.classList.add("has-availability");
                day.title = `${availableCount} slots open for ${subjectName}`;
            }
        }

        if (selectedDate === dateString) {
            day.classList.add("active");
        }

        day.onclick = () => {
            if (day.classList.contains("past-day")) return;

            if (!isStep1Complete()) {
                const reason = getStep1IncompleteReason();
                setDentistAvailabilityHint(reason, "danger");
                showToast(reason);
                return;
            }

            if (selectedServiceObj && day.classList.contains("no-availability")) {
                if (selectedDentistObj) {
                    setDentistAvailabilityHint(
                        `${selectedDentistObj.name} is not on duty on this date. Pick a different day or change dentist.`,
                        "danger"
                    );
                } else {
                    setDentistAvailabilityHint("No dentist is on duty for the selected service on this date.", "danger");
                }
                return;
            }

            document.querySelectorAll(".calendar-day").forEach(d => d.classList.remove("active"));
            day.classList.add("active");

            selectedDate = dateString;
            selectedTime = ""; // reset only time, not dentist

            updateSummary();
            generateTimeSlots();
            populateDentistDropdown();

            if (selectedDentistObj) {
                const availableCount = getDateAvailabilityCount(dateString);

                if (availableCount === 0) {
                    setDentistAvailabilityHint(`${selectedDentistObj.name} is not on duty on this date.`, "danger");
                } else if (availableCount <= 2) {
                    setDentistAvailabilityHint(`Limited schedule available for ${selectedDentistObj.name} on this date.`, "neutral");
                } else {
                    setDentistAvailabilityHint(`${selectedDentistObj.name} has available schedules on this date.`, "success");
                }
            } else {
                setDentistAvailabilityHint("Choose your preferred dentist first.", "neutral");
            }
        };

        daysContainer.appendChild(day);
    }
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    generateCalendar();
    populateDentistDropdown();
}

let currentPeriod = "morning";

function generateTimeSlots() {
    return withBookingAvailabilitySnapshot(() => generateTimeSlotsFromSnapshot());
}

function generateTimeSlotsFromSnapshot() {
    const allTimes = getAllBookingTimeSlots();

    const container = document.getElementById("timeSlots");
    if (!container) return;

    container.innerHTML = "";
    if (!selectedDate || !getBookingServices().length) {
        container.textContent = "Select your services and a date to view available times.";
        return;
    }
    if (selectedTime && !getAvailableDentistsForDateTime(selectedDate, selectedTime).length) selectedTime = "";

    const filtered = allTimes.filter(t => {
        if (currentPeriod === "morning") return t.includes("AM");
        return t.includes("PM");
    });

    const patientIdentity = (typeof getCurrentPatientIdentity === "function")
        ? getCurrentPatientIdentity()
        : null;

    const hasServices = getBookingServices().length > 0;

    filtered.forEach(t => {
        const btn = document.createElement("div");
        btn.className = "time-btn";
        btn.innerText = t;

        const availableDentists = (hasServices && selectedDate)
            ? getAvailableDentistsForDateTime(selectedDate, t)
            : [];

        let disabledReason = "";

        if (selectedDate) {
            if (hasServices && !availableDentists.length) {
                disabledReason = selectedDentistObj
                    ? `${selectedDentistObj.name} is already booked at ${t}`
                    : `All eligible dentists are booked at ${t}`;
            } else if (selectedDentistObj && isClinicSlotOccupied(selectedDate, t, "", selectedDentistObj)) {
                disabledReason = `${selectedDentistObj.name} is already booked at ${t}`;
            } else if (patientIdentity && patientHasConflict(
                patientIdentity.email,
                patientIdentity.name,
                selectedDate,
                t
            )) {
                disabledReason = `You already have an appointment at ${t}`;
            }
        }

        if (disabledReason) {
            if (selectedTime === t) selectedTime = "";
            return;
        }

        if (selectedTime === t && !disabledReason) {
            btn.classList.add("active");
        }

        btn.onclick = (e) => {
            if (!isStep1Complete()) {
                if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
                const reason = getStep1IncompleteReason();
                setDentistAvailabilityHint(reason, "danger");
                showToast(reason);
                return;
            }

            if (btn.classList.contains("disabled")) {
                if (e) { e.preventDefault?.(); e.stopPropagation?.(); }
                if (disabledReason) {
                    setDentistAvailabilityHint(disabledReason, "danger");
                }
                return;
            }

            document.querySelectorAll(".time-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            selectedTime = t;
            updateSummary();
            populateDentistDropdown();

            if (selectedDentistObj) {
                setDentistAvailabilityHint(`${selectedDentistObj.name} is available for this schedule.`, "success");
            }
        };

        container.appendChild(btn);
    });
    if (!container.children.length) container.textContent = "No times have enough availability for your selected services.";
    updateSummary();
}
document.querySelectorAll(".time-filter").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".time-filter").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        currentPeriod = btn.dataset.period;
        generateTimeSlots();
    });
});

// SELECT SERVICE FROM SERVICES PAGE
function goToBooking(serviceName) {
    showSection('book-apt', document.querySelectorAll('.nav-link')[1]);

    const service = services.find(s => s.name === serviceName);
    if (!service) return;

    if (!selectedBookingServices.some(selected => selected.name === service.name)) {
        selectedBookingServices.push(service);
    }

    syncPrimarySelectedService();
    resetBookingSelectionContext();
    updateSelectedServicesList();
    updateServiceIncludes();
    updateSummary();
    populateDentistDropdown();
    generateCalendar();
    generateTimeSlots();
    updateSelectedDentistCard();
}

// DATE CHANGE

function updateSummary() {
    const selectedServiceText = document.getElementById("selectedService");
    const summaryService = document.getElementById("summaryService");
    const summaryPrice = document.getElementById("summaryPrice");
    const summaryDuration = document.getElementById("summaryDuration");
    const summaryParticipants = document.getElementById("summaryParticipants");

    if (selectedServiceText) {
        selectedServiceText.innerText = selectedBookingServices.length ? selectedBookingServices.map(service => service.name).join(" + ") : "Select your services (optional)";
    }

    if (summaryService) {
        summaryService.innerText = getBookingServices().map(service => `${service.participantName}: ${service.name}`).join("; ") || "-";
    }

    if (summaryPrice) {
        summaryPrice.innerText = formatBillingCurrency(getSelectedServicesTotalPrice());
    }

    if (summaryDuration) {
        summaryDuration.innerText = getBookingServices().length ? `${selectedBookingDuration()} minutes reserved` : "-";
    }

    if (summaryParticipants) {
        const participantCount = (selectedBookingServices.length ? 1 : 0) + bookingDependents.length;
        summaryParticipants.innerText = `${participantCount} participant${participantCount > 1 ? "s" : ""}`;
    }

    document.getElementById("summaryDate").innerText = selectedDate || "-";
    document.getElementById("summaryTime").innerText = selectedTime || "-";

    const summaryDentist = document.getElementById("summaryDentist");
    if (summaryDentist) {
        summaryDentist.innerText = selectedDentistObj?.name || "-";
    }
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


function getDutyDentist(dateString, timeDisplayValue) {
  if (!dateString || !timeDisplayValue) return null;

  const date = new Date(dateString);
  const dayName = date.toLocaleDateString("en-US", { weekday: "long" });

  const isMorning = timeDisplayValue.toLowerCase().includes("am");

  let key = dayName;

  if (dayName === "Saturday") {
    key = isMorning ? "Saturday-AM" : "Saturday-PM";
  }

  const dentistName = CLINIC_DUTY_ROSTER[key];

  if (!dentistName) return null;

  return getAllBookableDentists().find(
    d => d.name === dentistName
  ) || null;
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

    if (!match) {
        const time24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
        if (!time24) return normalized;

        const hour = Math.min(23, Math.max(0, parseInt(time24[1], 10)));
        const minute = Math.min(59, Math.max(0, parseInt(time24[2], 10)));
        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    }

    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const meridiem = match[3].toUpperCase();

    if (meridiem === "PM" && hour !== 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;

    return `${String(hour).padStart(2, "0")}:${minute}`;
}

function normalizeBookingDate(value = "") {
    const raw = String(value || "").trim();
    if (!raw) return "";

    const direct = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (direct) {
        return `${direct[1]}-${String(Number(direct[2])).padStart(2, "0")}-${String(Number(direct[3])).padStart(2, "0")}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;

    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function getAppointmentTimeCandidates24(apt = {}) {
    const scheduleMeta = splitSchedule(apt.schedule || "");
    const candidates = [
        apt.time,
        apt.timeDisplay,
        scheduleMeta.time24,
        scheduleMeta.timeDisplay
    ];

    return new Set(
        candidates
            .map(value => convertDisplayTimeTo24(value))
            .map(value => String(value || "").trim())
            .filter(Boolean)
    );
}

function buildSchedule(dateValue = "", timeValue = "") {
    const safeDate = normalizeBookingDate(dateValue);
    const safeTime = normalizeTimeDisplay(timeValue);
    return safeDate && safeTime ? `${safeDate} • ${safeTime}` : safeDate || safeTime;
}

function splitSchedule(schedule = "") {
    const parts = String(schedule).split("•").map(s => s.trim());
    const cleanTime = normalizeTimeDisplay(parts[1] || "");

    return {
        date: normalizeBookingDate(parts[0] || ""),
        timeDisplay: cleanTime,
        time24: convertDisplayTimeTo24(cleanTime)
    };
}


// ==============================
// 🎯 LOAD DENTISTS FROM ADMIN DB
// ==============================
function getAllDentists() {
  const db = getClinicDb();
  return window.GMDefaultAccounts.normalizeDb(db).dentists || [];
}

// ==============================
// 🎯 RENDER DENTIST OPTIONS
// ==============================
function renderDentistOptions(serviceName) {
  const dentists = getAllDentists();
  const container = document.getElementById("dentistOptions");

  if (!container) return;

  container.innerHTML = "";

  const eligibleIds = new Set(getEligibleDentistsForService(serviceName).map(d => String(d.id || d.name)));
  const filtered = dentists.filter(d => eligibleIds.has(String(d.id || d.name)));

  if (!filtered.length) {
    container.innerHTML = `<p class="text-muted">No dentist available for this service</p>`;
    return;
  }

  filtered.forEach(d => {
    const el = document.createElement("div");
    el.className = "dentist-card";
    el.innerHTML = `
      <strong>${d.name}</strong>
      <span>${d.specialty}</span>
    `;

    el.onclick = () => {
      document.querySelectorAll(".dentist-card").forEach(c => c.classList.remove("active"));
      el.classList.add("active");
      selectedDentistObj = d;
    };

    container.appendChild(el);
  });
}





// ==============================
// 🚫 CHECK DENTIST AVAILABILITY
// ==============================
function isDentistAvailable(dentistName, date, time) {
  const db = getClinicDb();
  const appointments = db.appointments || [];

  return !appointments.some(a =>
    a.dentist === dentistName &&
    a.date === date &&
    a.time === time &&
    a.status !== "Cancelled"
  );
}

// ==============================
// 🚫 CHECK SLOT CONFLICT
// ==============================
function resolveDentistReferenceValue(dentistRef = "") {
  if (!dentistRef) return "";
  if (typeof dentistRef === "object") {
    return String(dentistRef.id || dentistRef.dentistId || dentistRef.name || dentistRef.dentist || "").trim().toLowerCase();
  }
  return String(dentistRef).trim().toLowerCase();
}

function resolveDentistReferenceValues(dentistRef = "") {
  if (!dentistRef) return [];
  if (typeof dentistRef === "object") {
    return [
      dentistRef.id,
      dentistRef.dentistId,
      dentistRef.name,
      dentistRef.dentist,
      dentistRef.dentistName
    ]
      .map(value => String(value || "").trim().toLowerCase())
      .filter(Boolean);
  }
  return [String(dentistRef).trim().toLowerCase()].filter(Boolean);
}

function selectedBookingDuration() {
  return BookingTime.duration({ services: getBookingServices() });
}

function isClinicSlotOccupied(dateString, timeDisplayValue, excludeId = "", dentistRef = "", durationMinutes = selectedBookingDuration()) {
  const selectedTime24 = convertDisplayTimeTo24(timeDisplayValue);
  const normalizedDate = normalizeBookingDate(dateString);
  const targetDentists = resolveDentistReferenceValues(dentistRef || selectedDentistObj || selectedDentistId);

  return getBookingAppointmentsForDate(normalizedDate).some((apt) => {
    if (!apt || String(apt.id) === String(excludeId)) return false;
    // Visibility flags do not release an active reservation.
    if (!isActiveLifecycleStatus(getOperationalAppointmentStatus(apt))) return false;

    const aptDate =
      normalizeBookingDate(apt.date) ||
      splitSchedule(apt.schedule).date ||
      "";

    const aptTimes24 = getAppointmentTimeCandidates24(apt);

    if (aptDate !== normalizedDate || ![...aptTimes24].some(time => BookingTime.overlaps(BookingTime.minutes(selectedTime24), durationMinutes, BookingTime.minutes(time), BookingTime.duration(apt)))) return false;

    if (!targetDentists.length) return true;

    const aptDentists = resolveDentistReferenceValues(apt);
    return aptDentists.some(value => targetDentists.includes(value));
  });
}

const SERVICE_SPECIALTY_MAP = {
  "Enhanced Infection Control": ["ANY"],
  "Consultation": ["ANY"],
  "Oral Prophylaxis": ["General Dentist", "Pediatric Dentist", "Periodontist"],
  "Restorative Treatment": ["General Dentist", "Cosmetic Dentist"],
  "Tooth Extraction": ["General Dentist", "Oral Surgeon"],
  "Odontectomy": ["Oral Surgeon"],
  "Root Canal Treatment": ["Endodontist"],
  "Complete Denture": ["Prosthodontist"],
  "Partial Denture (Stayplate)": ["General Dentist", "Prosthodontist"],
  "Partial Denture (Casted)": ["Prosthodontist"],
  "Flexible Denture": ["Prosthodontist"],
  "Crowns and Bridges": ["Prosthodontist"],
  "Orthodontic Treatment": ["Orthodontist"],
  "Retainers": ["Orthodontist"],
  "Mouth Guard": ["General Dentist", "Orthodontist"],
  "Whitening": ["Cosmetic Dentist"],
  "Periapical X-Ray": ["ANY"],
  "Panoramic X-Ray": ["ANY"]
};

const SERVICE_SPECIALTY_ALIASES = {
  "oral prophylaxis teeth cleaning": "Oral Prophylaxis",
  "teeth cleaning": "Oral Prophylaxis",
  "dental fillings": "Restorative Treatment",
  "filling": "Restorative Treatment",
  "tooth filling": "Restorative Treatment",
  "teeth whitening": "Whitening",
  "orthodontic treatment braces": "Orthodontic Treatment",
  "braces": "Orthodontic Treatment",
  "partial denture stayplate": "Partial Denture (Stayplate)",
  "partial denture casted": "Partial Denture (Casted)",
  "root canal": "Root Canal Treatment",
  "xray": "Periapical X-Ray",
  "x ray": "Periapical X-Ray",
  "periapical x ray": "Periapical X-Ray",
  "panoramic x ray": "Panoramic X-Ray"
};

function normalizeDayName(value = "") {
  return String(value || "").trim().toLowerCase();
}

function getDayNameFromDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function getClinicDentistsRaw() {
  const db = getClinicDb();
  return window.GMDefaultAccounts.normalizeDb(db).dentists || [];
}

function getFallbackDentists() {
  return window.GMDefaultAccounts.merge([], "dentist");
}

function mergeDentistsByIdOrName(primary = [], fallback = []) {
  // Saved profiles win; do not append fallback shifts to edited working hours.
  const existing = window.GMDefaultAccounts.merge(primary, "dentist", false);
  const missing = fallback.filter(row => !existing.some(saved =>
    window.GMDefaultAccounts.key(saved.name) === window.GMDefaultAccounts.key(row.name)));
  return window.GMDefaultAccounts.merge([...existing, ...missing], "dentist").filter(d => !d.archived);
}

function normalizeSpecialtyToken(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSpecialty(value = "") {
  const raw = normalizeSpecialtyToken(value);

  if (["general dentist", "general dentistry", "dentist"].includes(raw)) return "general dentist";
  if (["orthodontist", "orthodontics", "ortho"].includes(raw)) return "orthodontist";
  if (["pediatric dentist", "pediatric dentistry", "pedo"].includes(raw)) return "pediatric dentist";
  if (["endodontist", "endodontics"].includes(raw)) return "endodontist";
  if (["prosthodontist", "prosthodontics"].includes(raw)) return "prosthodontist";
  if (["oral surgeon", "oral surgery"].includes(raw)) return "oral surgeon";
  if (["cosmetic dentist", "cosmetic dentistry"].includes(raw)) return "cosmetic dentist";
  if (["periodontist", "periodontics"].includes(raw)) return "periodontist";

  return raw;
}

function getDentistSpecialtyTokens(dentist = {}) {
  const rawValues = [
    dentist.specialty,
    dentist.specialization,
    dentist.role,
    ...(Array.isArray(dentist.specialties) ? dentist.specialties : [])
  ];

  return rawValues
    .flatMap(value => String(value || "").split(/[,/|;]/))
    .map(normalizeSpecialty)
    .filter(Boolean);
}

function normalizeServiceSpecialtyKey(serviceName = "") {
  const normalized = normalizeSpecialtyToken(serviceName);
  if (!normalized) return "";

  if (SERVICE_SPECIALTY_ALIASES[normalized]) {
    return SERVICE_SPECIALTY_ALIASES[normalized];
  }

  const directMatch = Object.keys(SERVICE_SPECIALTY_MAP).find(
    name => normalizeSpecialtyToken(name) === normalized
  );

  return directMatch || String(serviceName || "").trim();
}

function getAllBookableDentists() {
  return bookingAvailabilityValue("dentists", () => {
    const clinicDentists = getClinicDentistsRaw();
    return mergeDentistsByIdOrName(clinicDentists, getFallbackDentists());
  });
}

function getAllowedSpecialtiesForService(serviceName = "") {
  const serviceKey = normalizeServiceSpecialtyKey(serviceName);
  return SERVICE_SPECIALTY_MAP[serviceKey] || ["General Dentist"];
}

function dentistCanPerformService(dentist = {}, serviceName = "") {
  if (getDentistSpecialtyTokens(dentist).includes("all services")) return true;
  const allowed = getAllowedSpecialtiesForService(serviceName);

  if (allowed.includes("ANY")) return true;

  const normalizedAllowed = allowed.map(normalizeSpecialty);
  const dentistSpecialties = getDentistSpecialtyTokens(dentist);

  return dentistSpecialties.some(specialty => normalizedAllowed.includes(specialty));
}

function dentistCanPerformSelectedServices(dentist = {}) {
  return getBookingServices().every(service => dentistCanPerformService(dentist, service.name));
}

function getEligibleDentistsForService(serviceName = "") {
  const allowed = getAllowedSpecialtiesForService(serviceName);

  const allDentists = getAllBookableDentists();

  // 🔥 if ANY → return all dentists
  if (allowed.includes("ANY")) {
    return allDentists;
  }

  const normalizedAllowed = allowed.map(s => normalizeSpecialty(s));

  return allDentists.filter((dentist) => {
    const dentistSpecialties = getDentistSpecialtyTokens(dentist);
    return dentistSpecialties.some(specialty => normalizedAllowed.includes(specialty));
  });
}

function dentistWorksOnDateAndTime(dentist, dateString, timeDisplayValue, durationMinutes = selectedBookingDuration()) {
  if (!dentist || !dateString || !timeDisplayValue) return true;

  const dayName = bookingAvailabilityValue(`weekday:${dateString}`, () => normalizeDayName(getDayNameFromDate(dateString)));
  const selectedTime24 = convertDisplayTimeTo24(timeDisplayValue);
  const schedules = Array.isArray(dentist.schedules) ? dentist.schedules : [];

  const bookingStart = BookingTime.minutes(selectedTime24);
  const bookingEnd = bookingStart + durationMinutes;
  if (!Number.isFinite(bookingStart) || bookingStart < (BookingTime.local24Hours() ? 0 : 9 * 60) || bookingEnd > (BookingTime.local24Hours() ? 1440 : 17 * 60)) return false;
  if (!schedules.length) return true;

  return schedules.some((slot) => {
    const slotDay = normalizeDayName(slot.day);
    if (slotDay !== dayName) return false;
    if (BookingTime.local24Hours()) return true;

    const start = String(slot.start || "").trim();
    const end = String(slot.end || "").trim();

    if (!start || !end) return true;
    return bookingStart >= BookingTime.minutes(start) && bookingEnd <= BookingTime.minutes(end);
  });
}

function isClosedStatus(status = "") {
  const value = String(status).trim().toLowerCase();
  return ["completed", "cancelled", "rejected"].includes(value);
}

function dentistHasConflict(dentistName, dateString, timeDisplayValue, excludeId = "") {
  return isClinicSlotOccupied(dateString, timeDisplayValue, excludeId, dentistName);
}

function patientHasConflict(patientEmail, patientName, dateString, timeDisplayValue, excludeId = "", durationMinutes = selectedBookingDuration()) {
  const selectedTime24 = convertDisplayTimeTo24(timeDisplayValue);
  const normalizedDate = normalizeBookingDate(dateString);

  return getBookingAppointmentsForDate(normalizedDate).some((apt) => {
    if (!apt || String(apt.id) === String(excludeId)) return false;
    // Patient archive flags only affect display, not reserved time.
    if (isClosedStatus(apt.status)) return false;

    const samePatient =
      (patientEmail && String(apt.patientEmail || "").trim().toLowerCase() === String(patientEmail).trim().toLowerCase()) ||
      (!patientEmail && String(apt.patientName || apt.patient || "").trim().toLowerCase() === String(patientName || "").trim().toLowerCase());

    if (!samePatient) return false;

    const aptDate =
      normalizeBookingDate(apt.date) ||
      splitSchedule(apt.schedule).date ||
      "";

    const aptTimes24 = getAppointmentTimeCandidates24(apt);

    return aptDate === normalizedDate && [...aptTimes24].some(time => BookingTime.overlaps(BookingTime.minutes(selectedTime24), durationMinutes, BookingTime.minutes(time), BookingTime.duration(apt)));
  });
}

function updateDentistSummary() {
  const summaryDentist = document.getElementById("summaryDentist");
  if (summaryDentist) {
    summaryDentist.textContent = selectedDentistObj?.name || "-";
  }
}

function setDentistAvailabilityHint(text, type = "neutral") {
  const hint = document.getElementById("dentistAvailabilityHint");
  if (!hint) return;

  hint.textContent = text || "";
  hint.classList.remove("is-success", "is-danger", "is-neutral");
  hint.classList.add(
    type === "success" ? "is-success" :
    type === "danger" ? "is-danger" :
    "is-neutral"
  );
}

function handleDentistSelection(dentistId) {
  const pickedId = String(dentistId || "").trim();

  if (!pickedId) {
    clearSelectedDentist();
    return;
  }

  selectedDentistId = pickedId;

  const eligible = getEligibleDentistsForSelectedServices();
  selectedDentistObj =
    eligible.find(d => String(d.id) === selectedDentistId) || null;

  updateDentistSummary();
  updateSummary();
  generateCalendar();
  generateTimeSlots();
  populateDentistDropdown();
  updateSelectedDentistCard();
  updateBookingStepLock();

  if (!selectedDentistObj) {
    setDentistAvailabilityHint("Please choose a dentist.", "neutral");
    return;
  }

  if (selectedDate && selectedTime) {
    const works = dentistWorksOnDateAndTime(
      selectedDentistObj,
      selectedDate,
      selectedTime
    );
    const occupied = isClinicSlotOccupied(selectedDate, selectedTime, "", selectedDentistObj);

    if (!works) {
      setDentistAvailabilityHint(
        `${selectedDentistObj.name} is not available on the selected date and time.`,
        "danger"
      );
      return;
    }

    if (occupied) {
      setDentistAvailabilityHint(
        "This clinic time slot is already occupied. Please choose another schedule.",
        "danger"
      );
      return;
    }

    setDentistAvailabilityHint(
      `${selectedDentistObj.name} is available for this schedule.`,
      "success"
    );
    return;
  }

  setDentistAvailabilityHint(
    `Selected dentist: ${selectedDentistObj.name}. Now choose date and time.`,
    "neutral"
  );
}

function updateSelectedDentistCard() {
  const card = document.getElementById("selectedDentistCard");
  const select = document.getElementById("dentistSelect");
  const nameEl = document.getElementById("selectedDentistName");
  const specialtyEl = document.getElementById("selectedDentistSpecialty");

  if (!card || !select || !nameEl || !specialtyEl) return;

  if (selectedDentistObj) {
    card.classList.remove("d-none");
    select.classList.add("d-none");

    nameEl.textContent = selectedDentistObj.name || "-";
    specialtyEl.textContent = selectedDentistObj.specialty || "-";
  } else {
    card.classList.add("d-none");
    select.classList.remove("d-none");

    nameEl.textContent = "-";
    specialtyEl.textContent = "-";
  }
}

function clearSelectedDentist() {
  selectedDentistId = "";
  selectedDentistObj = null;
  selectedDate = "";
  selectedTime = "";

  updateDentistSummary();
  updateSummary();
  populateDentistDropdown();
  generateCalendar();
  generateTimeSlots();
  updateSelectedDentistCard();
  updateBookingStepLock();

  setDentistAvailabilityHint("Choose your preferred dentist first.", "neutral");
}

function populateDentistDropdown() {
    return withBookingAvailabilitySnapshot(() => populateDentistDropdownFromSnapshot());
}

function populateDentistDropdownFromSnapshot() {
  const select = document.getElementById("dentistSelect");
  if (!select) return;

  select.innerHTML = "";

  if (!getBookingServices().length) {
    select.innerHTML = `<option value="">Select a service first</option>`;
    selectedDentistId = "";
    selectedDentistObj = null;
    updateDentistSummary();
    updateSelectedDentistCard();
    setDentistAvailabilityHint("Select a service first.", "neutral");
    return;
  }

  let eligibleDentists = getEligibleDentistsForSelectedServices();

  if (selectedDate && selectedTime) {
    eligibleDentists = eligibleDentists.filter((dentist) => {
      const works = dentistWorksOnDateAndTime(dentist, selectedDate, selectedTime);
      const occupied = isClinicSlotOccupied(selectedDate, selectedTime, "", dentist);
      return works && !occupied;
    });
  }

  if (selectedDentistObj) {
    const stillValid = eligibleDentists.find(
      d => String(d.id) === String(selectedDentistId)
    );

    if (stillValid) {
      selectedDentistObj = stillValid;
      updateDentistSummary();
      updateSelectedDentistCard();

      if (selectedDate && selectedTime) {
        setDentistAvailabilityHint(`${selectedDentistObj.name} is available for this schedule.`, "success");
      } else if (selectedDate) {
        setDentistAvailabilityHint(`Selected dentist: ${selectedDentistObj.name}. Now choose a time.`, "neutral");
      } else {
        setDentistAvailabilityHint(`Selected dentist: ${selectedDentistObj.name}. Now choose date and time.`, "neutral");
      }
      return;
    }

    selectedDentistId = "";
    selectedDentistObj = null;
  }

  select.innerHTML = `<option value="">Choose your dentist</option>`;

  if (!eligibleDentists.length) {
    updateDentistSummary();
    updateSelectedDentistCard();

    const specialtyMatches = getEligibleDentistsForSelectedServices();

    if (selectedDate && selectedTime && specialtyMatches.length) {
      setDentistAvailabilityHint("No eligible dentist is available on this selected date and time.", "danger");
    } else {
      const serviceLabel = getBookingServices().length > 1 ? "selected service combination" : "selected service";
      setDentistAvailabilityHint(`No dentist specialty matches the ${serviceLabel}.`, "danger");
    }
    return;
  }

  eligibleDentists.forEach((dentist) => {
    const option = document.createElement("option");
    option.value = dentist.id;
    option.textContent = `${dentist.name} (${dentist.specialty})`;
    select.appendChild(option);
  });

  updateDentistSummary();
  updateSelectedDentistCard();
  setDentistAvailabilityHint("Choose your preferred dentist first.", "neutral");
}

function getAllBookingTimeSlots() {
  return Array.from({ length: BookingTime.local24Hours() ? 288 : 96 }, (_, index) => {
    const value = (BookingTime.local24Hours() ? 0 : 9 * 60) + index * 5;
    const hour = Math.floor(value / 60);
    return `${hour % 12 || 12}:${String(value % 60).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  });
}

function addDays(dateString, daysToAdd) {
  const base = new Date(dateString);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + daysToAdd);

  return normalizeBookingDate(`${base.getFullYear()}-${base.getMonth() + 1}-${base.getDate()}`);
}

function getVisibleEligibleDentists(serviceName, dateString, timeDisplayValue) {
    const eligibleDentists = getEligibleDentistsForService(serviceName);

    return eligibleDentists.filter((dentist) => {
        if (selectedDentistId && String(dentist.id) !== String(selectedDentistId)) {
            return false;
        }

        const works = dentistWorksOnDateAndTime(dentist, dateString, timeDisplayValue);
        return works && !isClinicSlotOccupied(dateString, timeDisplayValue, "", dentist);
    });
}

function findNextAvailableSlot() {
    return withBookingAvailabilitySnapshot(() => findNextAvailableSlotFromSnapshot());
}

function findNextAvailableSlotFromSnapshot() {
    if (!getBookingServices().length) return null;

    const today = new Date();
    const startDate = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const allTimeSlots = getAllBookingTimeSlots();

    for (let i = 0; i < 45; i++) {
        const dateToCheck = addDays(startDate, i);
        if (!dateToCheck) continue;

        for (const time of allTimeSlots) {
            const availableDentists = getAvailableDentistsForDateTime(dateToCheck, time);

            if (availableDentists.length) {
                return {
                    date: dateToCheck,
                    time,
                    dentist: availableDentists[0]
                };
            }
        }
    }

    return null;
}




let reservationInFlight = false;
async function reservePatientAppointment(appointment) {
  if (reservationInFlight) return false;
  reservationInFlight = true;
  try {
    const base = window.GmDentalSupabaseSync?.apiBaseUrl || window.GM_DENTAL_API_BASE || "";
    const response = await window.GmDentalApiFetch(`${base}/api/appointments/book`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointment })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not reserve this time.");
    Object.assign(appointment, result.appointment);
    return true;
  } catch (error) {
    showToast(error.message || "Could not reserve your appointment. Please try again.");
    selectedTime = "";
    _freeConsultSelectedTime = "";
    await refreshBookingReservations();
    generateTimeSlots();
    renderFreeConsultTimeSlots();
    setDentistAvailabilityHint("Please choose another available time.", "danger");
    return false;
  } finally {
    reservationInFlight = false;
  }
}

// CONFIRM BOOKING
async function confirmBookingNew() {
  if (!await refreshBookingReservations()) return;
  if (bookingDependents.some(dep => !dep.services?.length)) { showToast("Choose a currently available service for each dependent."); return; }
  if (!getBookingServices().length) {
    showToast("Select at least one service first ❗");
    return;
  }

  if (!selectedDate || !selectedTime) {
    showToast("Select date & time ❗");
    return;
  }

  if (!selectedDentistObj) {
    showToast("Please choose a dentist first ❗");
    return;
  }

  const patientIdentity = getCurrentPatientIdentity();
  const patientSession = currentPatientUser || getCurrentUser() || {};
  const patientName = patientIdentity.name || patientSession.email || "Patient";
  const patientEmail = patientIdentity.email || "";
  const patientId = patientIdentity.id;

  if (!dentistWorksOnDateAndTime(selectedDentistObj, selectedDate, selectedTime)) {
    showToast(`${selectedDentistObj.name} is not available on that schedule.`);
    setDentistAvailabilityHint(`${selectedDentistObj.name} is not available on the selected date and time.`, "danger");
    populateDentistDropdown();
    return;
  }

  if (isClinicSlotOccupied(selectedDate, selectedTime, "", selectedDentistObj)) {
    showToast("This clinic time slot is already occupied. Please choose another schedule.");
    setDentistAvailabilityHint("This clinic time slot is already occupied. Please choose another schedule.", "danger");
    populateDentistDropdown();
    return;
  }

  if (patientHasConflict(patientEmail, patientName, selectedDate, selectedTime)) {
    showToast("You already have an appointment on that same date and time.");
    return;
  }

  const appointments = getAppointmentsShared();
  const serviceNames = getBookingServices().map(service => service.name);
  const price = getSelectedServicesTotalPrice();
  const normalizedServices = getBookingServices().map(service => normalizeBillingServiceRecord({
    serviceName: service.name,
    participantId: service.participantId,
    participantName: service.participantName === "Main patient" ? patientName : service.participantName,
    price: Number(service.price || 0),
    paymentMode: isLongTermTreatment(service.name) ? "installment" : "full",
    paidDownpayment: 0,
    totalPaid: 0,
    paymentStatus: "Unpaid",
    serviceStatus: "Pending"
  }));

  const longTermService = normalizedServices.find(service => service.isLongTermTreatment);

  if (longTermService) {
    const targetServiceKey = normalizeServiceKey(longTermService.serviceName);

    const hasActiveOrthoAppointment = getPatientAppointmentsShared({ includeArchived: false }).some(apt => {
      if (isArchivedRecord(apt)) return false;
      if (!isActiveLifecycleStatus(apt.lifecycleStatus || apt.status || "Pending")) return false;
      return safeArray(apt.services).some(s =>
        normalizeServiceKey(s.serviceName || s.name || s.service || "") === targetServiceKey
      );
    });

    const hasActiveTreatmentPlan = getPatientTreatmentPlansShared().some(plan =>
      ["Active", "Discontinuation Requested", "Pending Consultation"].includes(normalizeTreatmentPlanStatus(plan.status || "")) &&
      normalizeServiceKey(plan.serviceName || plan.service || "") === targetServiceKey
    );

    if (hasActiveOrthoAppointment || hasActiveTreatmentPlan) {
      showToast(`You already have an active ${longTermService.serviceName} treatment. Please complete your current treatment before booking a new one.`);
      return;
    }
  }

  const activeTreatmentPlan = longTermService
    ? findActiveTreatmentPlanForBooking(patientId, longTermService.serviceName, selectedDentistObj.id)
    : null;

  const appointmentId = createClinicEntityId("apt");
  const treatmentId = longTermService
    ? String(activeTreatmentPlan?.treatmentId || createClinicEntityId("trt")).trim()
    : "";

  const newApt = normalizeAppointmentFinancials({
    id: appointmentId,
    createdBy: "patient",
    approvalMode: "auto",
    requiresManualApproval: false,
    patientId,
    patientName,
    patientEmail,
    service: serviceNames.join(" + "),
    services: normalizedServices,
    dependents: bookingDependents,
    price,
    date: selectedDate,
    durationMinutes: selectedBookingDuration(),
    endTime: BookingTime.clock(BookingTime.minutes(selectedTime) + selectedBookingDuration()),
    time: convertDisplayTimeTo24(selectedTime),
    timeDisplay: selectedTime,
    schedule: buildSchedule(selectedDate, selectedTime),
    status: "Approved",
    dentist: selectedDentistObj.name,
    dentistId: selectedDentistObj.id,
    dentistName: selectedDentistObj.name,
    dentistEmail: selectedDentistObj.email || selectedDentistObj.contact || "",
    dentistSpecialty: selectedDentistObj.specialty,
    paid: false,
    paymentStatus: "Unpaid",
    paymentMethod: "",
    downPayment: 0,
    amountPaidOnline: 0,
    amountPaidInClinic: 0,
    totalCollected: 0,
    remainingBalance: price,
    requiresDownPayment: false,
    minimumDownPayment: 0,
    invoiceUnlocked: true,
    revenueCountedOnline: 0,
    revenueCountedClinic: 0,
    archived: false,
    archivedForPatient: false,
    archivedForDentist: false,
    treatmentId,
    sessionId: treatmentId ? `${appointmentId}-session` : "",
    serviceFlowType: longTermService ? "long_term_treatment" : (normalizedServices.some(service => service.serviceFlowType === "multi_visit") ? "multi_visit" : "single_visit"),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  if (!await reservePatientAppointment(newApt)) return;
  appointments.unshift(newApt);
  saveAppointmentsShared(appointments);
  if (treatmentId) {
    upsertTreatmentPlanFromAppointment(newApt, {
      status: activeTreatmentPlan?.status || "Active",
      estimatedDurationMonths: activeTreatmentPlan?.estimatedDurationMonths || 18
    });
  }
  localStorage.removeItem("pendingPayment");

  pushDentistNotification(
    `New appointment booked with ${newApt.patientName} for ${newApt.service} on ${newApt.schedule}.`,
    {
      patientId: newApt.patientId,
      appointmentId: newApt.id,
      treatmentId: newApt.treatmentId,
      sessionId: newApt.sessionId,
      eventType: longTermService ? "treatment_session_booked" : "appointment_booked"
    }
  );

  pushPatientNotification(
    longTermService && activeTreatmentPlan
      ? `Your next ${longTermService.serviceName} session with ${newApt.dentist} on ${newApt.schedule} has been booked successfully.`
      : longTermService
        ? `Your ${longTermService.serviceName} treatment case has been created and the first session on ${newApt.schedule} has been booked successfully.`
        : `Your appointment with ${newApt.dentist} for ${newApt.service} on ${newApt.schedule} has been booked successfully.`,
    {
      patientId: newApt.patientId,
      appointmentId: newApt.id,
      treatmentId: newApt.treatmentId,
      sessionId: newApt.sessionId,
      eventType: longTermService ? (activeTreatmentPlan ? "treatment_session_booked" : "treatment_case_created") : "appointment_booked"
    }
  );

  showToast(longTermService ? "Treatment session booked successfully ✅" : "Appointment booked successfully ✅");

  addNotification?.(
    `Appointment booked with ${newApt.dentist} for ${newApt.service} on ${newApt.schedule}.`
  );

  window.GmDentalSupabaseSync?.flushNow?.();

  selectedBookingServices = [];
  bookingDependents = [];
  syncPrimarySelectedService();
  resetBookingSelectionContext();
  updateSelectedServicesList();
  updateServiceIncludes();
  renderDependentsList();
  updateSummary();
  updateSelectedDentistCard();

  renderAllPatientUI?.();
  showSection?.("my-appointments");
}
// INIT
// INIT (RUN ON PAGE LOAD)
generateCalendar();
generateTimeSlots();
updateBookingStepLock();

function populateServiceDropdown() {
    const dropdown = document.getElementById("serviceDropdown");
    if (!dropdown) return; // The patient page uses the service-picker modal.

    dropdown.innerHTML = `<option value="">Select a Service</option>`;

    services.forEach(s => {
        dropdown.innerHTML += `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`;
    });
}



function openServicePicker() {
    document.getElementById("serviceModal").classList.add("active");
    renderServiceList();
}

function closeServicePicker() {
    document.getElementById("serviceModal").classList.remove("active");
    flushBookingSelectionRefresh();
}

function renderServiceList() {
    const list = document.getElementById("serviceList");
    if (!list) return;

    list.innerHTML = "";
    list.className = "modal-body premium-service-list";

    services.forEach(s => {
        const isSelected = selectedBookingServices.some(service => service.name === s.name);
        const div = document.createElement("div");
        div.className = `service-picker-card${isSelected ? " active" : ""}`;
        div.dataset.serviceName = s.name;
        div.setAttribute("role", "button");
        div.setAttribute("tabindex", "0");
        div.setAttribute("aria-pressed", String(isSelected));
        div.innerHTML = `
            <div class="service-picker-left">
                <div class="service-picker-icon">
                    <i class="bi bi-tooth"></i>
                </div>

                <div>
                    <div class="service-picker-name">${escapeHtml(s.name)}</div>
                    <div class="service-picker-desc">${escapeHtml(s.displayDuration || "Professional dental service")}</div>
                </div>
            </div>

            <div class="service-picker-right">
                <div class="service-picker-price">₱${Number(s.price || 0).toLocaleString()}</div>
                <div class="service-picker-check ${isSelected ? "checked" : ""}" aria-hidden="true">
                    <i class="bi bi-check"></i>
                </div>
            </div>
        `;

        div.onclick = () => {
            selectService(s.name);
        };

        div.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                selectService(s.name);
            }
        };

        list.appendChild(div);
    });
}

let bookingSelectionRefreshTimer = null;

function runBookingSelectionRefresh() {
    return withBookingAvailabilitySnapshot(() => runBookingSelectionRefreshFromSnapshot());
}

function runBookingSelectionRefreshFromSnapshot() {
    resetBookingSelectionContext();
    updateSelectedServicesList();
    updateServiceIncludes();
    updateSummary();
    populateDentistDropdown();
    generateCalendar();
    generateTimeSlots();
    updateSelectedDentistCard();
}

function scheduleBookingSelectionRefresh() {
    if (bookingSelectionRefreshTimer) {
        clearTimeout(bookingSelectionRefreshTimer);
    }

    bookingSelectionRefreshTimer = setTimeout(() => {
        bookingSelectionRefreshTimer = null;
        runBookingSelectionRefresh();
    }, 24);
}

function flushBookingSelectionRefresh() {
    if (bookingSelectionRefreshTimer) {
        clearTimeout(bookingSelectionRefreshTimer);
        bookingSelectionRefreshTimer = null;
    }

    runBookingSelectionRefresh();
}

function syncServicePickerSelectionState() {
    document.querySelectorAll("#serviceList .service-picker-card").forEach(card => {
        const serviceName = card.dataset.serviceName || "";
        const isSelected = selectedBookingServices.some(service => service.name === serviceName);
        const check = card.querySelector(".service-picker-check");

        card.classList.toggle("active", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));

        if (check) {
            check.classList.toggle("checked", isSelected);
        }
    });
}

function selectService(serviceOrName) {
    const service = typeof serviceOrName === "string"
        ? services.find(item => item.name === serviceOrName)
        : serviceOrName;

    if (!service) return;

    if (selectedBookingServices.some(item => item.name === service.name)) {
        selectedBookingServices = selectedBookingServices.filter(item => item.name !== service.name);
    } else {
        selectedBookingServices.push(service);
    }

    syncPrimarySelectedService();
    syncServicePickerSelectionState();
    scheduleBookingSelectionRefresh();
}
function outsideClick(e) {
    const modalContent = document.querySelector(".service-modal-content");

    // If clicked outside the modal box → close
    if (!modalContent.contains(e.target)) {
        closeServicePicker();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    lockPageHistory();
    syncCurrentPatientToSharedDirectory();
    history.pushState(null, null, location.href);

    window.addEventListener("popstate", function () {
        history.pushState(null, null, location.href);
    });
    // 1. Initialize UI elements
    renderServices();
    loadAppointmentsUI();
    generateCalendar();
    generateTimeSlots();
    loadArchiveUI();
    renderHeroAppointment();
    loadSavedProfile();
    setProfileEditingState(false);
    updateMainPatientDisplay();
    updateSelectedServicesList();
    updateServiceIncludes();
    updateSummary();
    renderSharedNotifications("patient");
    initCustomDropdown("appointmentsStatusFilter");
    initCustomDropdown("historyStatusFilter");
    initCustomDropdown("archiveStatusFilter");
    initPatientRecordFilters();;
    initCrossPageSync(renderAllPatientUI);
    listenGlobalSync(() => {
    renderAllPatientUI();
    });
const rescheduleModalEl = document.getElementById("rescheduleModal");

if (rescheduleModalEl) {
    rescheduleModalEl.addEventListener("show.bs.modal", () => {
        updateRescheduleModalText();
    });
}

const markAllReadBtn = document.getElementById("markAllReadBtn");
const modalMarkAllReadBtn = document.getElementById("modalMarkAllReadBtn");
const clearAllNotifBtn = document.getElementById("clearAllNotifBtn");

const clearNotifWarningModal = document.getElementById("clearNotifWarningModal");
const cancelClearNotifBtn = document.getElementById("cancelClearNotifBtn");
const confirmClearNotifBtn = document.getElementById("confirmClearNotifBtn");

// MARK ALL READ (small panel)
markAllReadBtn?.addEventListener("click", () => {
    markAllPatientNotificationsRead();
    renderSharedNotifications("patient");
    showToast("All notifications marked as read.");
});

// MARK ALL READ (modal)
modalMarkAllReadBtn?.addEventListener("click", () => {
    markAllPatientNotificationsRead();
    renderSharedNotifications("patient");
    showToast("All notifications marked as read.");
});

// OPEN CLEAR WARNING
clearAllNotifBtn?.addEventListener("click", () => {
    clearNotifWarningModal?.classList.add("active");
});

// CANCEL CLEAR
cancelClearNotifBtn?.addEventListener("click", () => {
    clearNotifWarningModal?.classList.remove("active");
});

// CONFIRM CLEAR
confirmClearNotifBtn?.addEventListener("click", () => {
    clearAllPatientNotifications();
    renderSharedNotifications("patient");

    clearNotifWarningModal?.classList.remove("active");
    document.getElementById("allNotifModal")?.classList.remove("active");

    showToast("All notifications cleared.");
});
const openAllNotifModalBtn = document.getElementById("openAllNotifModal");
const allNotifModal = document.getElementById("allNotifModal");
const closeAllNotifModalBtn = document.getElementById("closeAllNotifModal");

if (openAllNotifModalBtn && allNotifModal) {
    openAllNotifModalBtn.addEventListener("click", () => {
        allNotifModal.classList.add("active");
        renderSharedNotifications("patient");
    });
}

if (closeAllNotifModalBtn && allNotifModal) {
    closeAllNotifModalBtn.addEventListener("click", () => {
        allNotifModal.classList.remove("active");
    });
}

if (allNotifModal) {
    allNotifModal.addEventListener("click", (e) => {
        if (e.target === allNotifModal) {
            allNotifModal.classList.remove("active");
        }
    });
}


const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
if (confirmDeleteBtn) {
    confirmDeleteBtn.onclick = function() {
        if (!appointmentIdToDelete) return;
        archiveAppointment(appointmentIdToDelete);
        closeDeleteModal();
    };
}

    const profileMenuTrigger = document.getElementById("profileMenuTrigger");
    const profileDropdownMenu = document.getElementById("profileDropdownMenu");
    const goToSettingsBtn = document.getElementById("goToSettingsBtn");
    const logoutBtn = document.getElementById("logoutBtn");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                clearCurrentUser(); // ✅ uses sessionStorage

                window.location.replace("../Landing/landing.html");
            });
        }
    if (profileMenuTrigger) {
        profileMenuTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleProfileDropdown();
        });
    }

    if (profileDropdownMenu) {
        profileDropdownMenu.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }

    if (goToSettingsBtn) {
        goToSettingsBtn.addEventListener("click", () => {
            toggleProfileDropdown(true);
            showSection('profile');
        });
    }


    document.addEventListener("click", () => {
        toggleProfileDropdown(true);
    });

    const editBtn = document.getElementById("editProfileBtn");

    if (editBtn) {
        editBtn.addEventListener("click", async () => {
            if (!isEditingProfile) {
                setProfileEditingState(true);
            } else {
                const saved = await saveProfileChanges();
                if (saved) {
                    setProfileEditingState(false);
                }
            }
        });
    }



    // Toggle logic for Notifications and Tips


// Add to Calendar Logic



const SAME_DAY_RESCHEDULE_PENALTY = 500;

function getScheduleDateOnly(schedule = "") {
    return String(schedule).split("•")[0].trim();
}

function isSameDaySchedule(dateString = "") {
    if (!dateString) return false;

    const target = new Date(dateString);
    if (Number.isNaN(target.getTime())) return false;

    const now = new Date();

    return (
        target.getFullYear() === now.getFullYear() &&
        target.getMonth() === now.getMonth() &&
        target.getDate() === now.getDate()
    );
}

function applySameDayReschedulePenalty(appointment) {
    if (!appointment) return appointment;

    // prevent duplicate penalty
    if (appointment.sameDayReschedulePenaltyApplied) {
        return appointment;
    }

    const currentPrice = Number(appointment.price || 0);
    const currentRemaining = Number(appointment.remainingBalance || currentPrice || 0);
    const existingPenalty = Number(appointment.reschedulePenaltyFee || 0);

    return {
        ...appointment,
        price: currentPrice + SAME_DAY_RESCHEDULE_PENALTY,
        remainingBalance: currentRemaining + SAME_DAY_RESCHEDULE_PENALTY,
        reschedulePenaltyFee: existingPenalty + SAME_DAY_RESCHEDULE_PENALTY,
        sameDayReschedulePenaltyApplied: true,
        penaltyReason: "Same-day reschedule request",
        updatedAt: new Date().toISOString()
    };
}

const submitBtn = document.getElementById('submitRescheduleBtn');

function handlePatientRescheduleSubmit() {
    const dateInput = document.getElementById('newDateInput');
    const timeInput = document.getElementById('newTimeInput');
    const reasonInput = document.getElementById('rescheduleReason');
    const appointmentIdInput = document.getElementById('rescheduleAppointmentId');

    const newDate = dateInput?.value?.trim() || "";
    const newTime = timeInput?.value?.trim() || "";
    const reason = reasonInput?.value?.trim() || "";
    const selectedAppointmentId = appointmentIdInput?.value?.trim() || "";

    if (!selectedAppointmentId) {
        showToast("Please choose the exact appointment session to reschedule.");
        return;
    }

    if (!newDate) {
        showToast("Please select a new date.");
        return;
    }

    if (!newTime) {
        showToast("Please select a new time.");
        return;
    }

    const appointments = getAppointmentsShared();
    const requests = getRescheduleRequestsShared();
    const aptIndex = appointments.findIndex(a => String(a.id) === String(selectedAppointmentId) && matchesCurrentPatient(a));

    if (aptIndex === -1) {
        showToast("Appointment not found.");
        return;
    }

    const originalAppointment = normalizeAppointmentFinancials(appointments[aptIndex]);
    const operationalStatus = getOperationalAppointmentStatus(originalAppointment);

    if (!["Approved", "Ongoing", "Reschedule Rejected"].includes(operationalStatus)) {
        showToast("Only approved or ongoing sessions can be rescheduled.");
        return;
    }

    if (!window.PatientRescheduleCalendar?.available(newDate, originalAppointment).includes(newTime)) {
        showToast("That time is no longer available for the assigned dentist. Please choose another date and time.");
        window.PatientRescheduleCalendar?.refresh();
        return;
    }

    if (isClinicSlotOccupied(newDate, newTime, originalAppointment.id, originalAppointment.dentistId || originalAppointment.dentist)) {
        showToast("That dentist is no longer available on the requested schedule.");
        return;
    }

    const requestedSchedule = buildSchedule(newDate, newTime);
    const previousSchedule = originalAppointment.schedule || buildSchedule(originalAppointment.date || "", originalAppointment.timeDisplay || originalAppointment.time || "");
    const shouldApplyPenalty = isSameDaySchedule(getScheduleDateOnly(previousSchedule || originalAppointment.date || ""));

    let updatedAppointment = {
        ...originalAppointment,
        status: "Reschedule Requested",
        visitStatus: "Reschedule Requested",
        lifecycleStatus: "Reschedule Requested",
        statusBeforeReschedule: operationalStatus,
        requestedSchedule,
        previousSchedule,
        rescheduleReason: reason,
        updatedAt: new Date().toISOString()
    };

    if (shouldApplyPenalty) {
        updatedAppointment = applySameDayReschedulePenalty(updatedAppointment);
    }

    appointments[aptIndex] = normalizeAppointmentFinancials(updatedAppointment);

    const existingRequestIndex = requests.findIndex(
        r => String(r.appointmentId) === String(originalAppointment.id)
    );

    const requestPayload = {
        id: existingRequestIndex > -1 ? requests[existingRequestIndex].id : `${Date.now()}-rr`,
        appointmentId: originalAppointment.id,
        sessionId: originalAppointment.sessionId || "",
        treatmentId: originalAppointment.treatmentId || "",
        patientId: originalAppointment.patientId || "",
        patientName: originalAppointment.patientName || "Patient",
        patientEmail: originalAppointment.patientEmail || "",
        dentistId: originalAppointment.dentistId || "",
        dentist: originalAppointment.dentist || "",
        service: originalAppointment.service || "",
        before: previousSchedule,
        previousSchedule,
        requestedSchedule,
        requestedDate: newDate,
        requestedTime: newTime,
        reason,
        status: "Pending",
        penaltyFee: shouldApplyPenalty ? SAME_DAY_RESCHEDULE_PENALTY : 0,
        createdAt: existingRequestIndex > -1
            ? (requests[existingRequestIndex].createdAt || new Date().toISOString())
            : new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    if (existingRequestIndex > -1) {
        requests[existingRequestIndex] = requestPayload;
    } else {
        requests.unshift(requestPayload);
    }

    saveAppointmentsShared(appointments);
    saveRescheduleRequestsShared(requests);
    if (originalAppointment.treatmentId) {
        upsertTreatmentPlanFromAppointment(appointments[aptIndex]);
    }

    pushDentistNotification(
        shouldApplyPenalty
            ? `${requestPayload.patientName} requested to reschedule ${requestPayload.service} from ${previousSchedule} to ${requestedSchedule}. Penalty applied: ₱${SAME_DAY_RESCHEDULE_PENALTY}.`
            : `${requestPayload.patientName} requested to reschedule ${requestPayload.service} from ${previousSchedule} to ${requestedSchedule}.`,
        {
            patientId: requestPayload.patientId,
            appointmentId: requestPayload.appointmentId,
            treatmentId: requestPayload.treatmentId,
            sessionId: requestPayload.sessionId,
            eventType: "reschedule_requested"
        }
    );

    pushPatientNotification(
        shouldApplyPenalty
            ? `Your reschedule request for ${requestPayload.service} has been sent. Same-day penalty fee of ₱${SAME_DAY_RESCHEDULE_PENALTY} was added.`
            : `Your reschedule request for ${requestPayload.service} has been sent. Requested schedule: ${requestedSchedule}.`,
        {
            patientId: requestPayload.patientId,
            appointmentId: requestPayload.appointmentId,
            treatmentId: requestPayload.treatmentId,
            sessionId: requestPayload.sessionId,
            eventType: "reschedule_requested"
        }
    );

    const modalEl = document.getElementById('rescheduleModal');
    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalInstance.hide();

    if (dateInput) dateInput.value = "";
    if (timeInput) timeInput.value = "";
    if (reasonInput) reasonInput.value = "";
    if (appointmentIdInput) appointmentIdInput.value = "";

    showToast(
        shouldApplyPenalty
            ? `Reschedule request submitted. ₱${SAME_DAY_RESCHEDULE_PENALTY} penalty added.`
            : "Reschedule request submitted."
    );

    renderAllPatientUI?.();
}

if (submitBtn) {
    submitBtn.addEventListener('click', handlePatientRescheduleSubmit);
}
    // Put this inside your DOMContentLoaded


// 1. Put this inside your main DOMContentLoaded block

    // ---------------------------

    // 2. Define Tips Elements (Note: I removed the extra 'DOMContentLoaded' here)


 const tipsLink = document.querySelector('.more-tips-link');
const tipsPanel = document.getElementById('tipsPanel');
const closeTips = document.getElementById('closeTips');

function toggleTipsPanel(show) {
    if (!tipsPanel) return;
    tipsPanel.classList.toggle('active', show);
}

tipsLink?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleTipsPanel(true);
});

closeTips?.addEventListener('click', () => {
    toggleTipsPanel(false);
});

document.addEventListener('click', (e) => {
    if (!tipsPanel?.classList.contains('active')) return;

    if (!tipsPanel.contains(e.target) && !tipsLink.contains(e.target)) {
        toggleTipsPanel(false);
    }
});

    const dateElement = document.getElementById('currentDateDisplay');
    if (dateElement) {
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        // Sets the date to March 30, 2026
        dateElement.textContent = new Date().toLocaleDateString('en-US', options);
    }

    const calendarTrigger = document.getElementById('heroCalendarTrigger');
    if (calendarTrigger) {
        calendarTrigger.onclick = () => {
            // This triggers your existing booking view logic
            const bookingBtn = document.querySelector('[onclick*="booking"]');
            if (bookingBtn) {
                bookingBtn.click();
            } else {
                // Fallback if the button click doesn't work
                if (typeof showView === 'function') showView('booking');
            }
        };
    }

    // --- PHOTO UPLOAD LOGIC ---
        const photoInput = document.getElementById('photoUpload');
const profileImg = document.getElementById('profileDisplay');
const headerImg = document.getElementById('header-profile-img');

// Function to apply the image to all UI elements
const updateProfileUI = (imageData) => {
    if (profileImg) profileImg.src = imageData;
    if (headerImg) headerImg.src = imageData;
};

if (photoInput) {
    photoInput.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const newImage = event.target.result;
                
                // 1. Update all UI elements
                updateProfileUI(newImage);
                
                // 2. Persist to localStorage
                const sessionUser = getCurrentUser() || {};
                const photoKey = `userProfilePhoto_${sessionUser.email || sessionUser.id || "patient"}`;
                localStorage.setItem(photoKey, newImage);
                
                // 3. Feedback
                showToast("Profile photo updated! 📸");
            };
            reader.readAsDataURL(file);
        }
    };
}

// Load saved photo on startup for both locations
window.addEventListener('DOMContentLoaded', () => {
    const sessionUser = getCurrentUser() || {};
    const photoKey = `userProfilePhoto_${sessionUser.email || sessionUser.id || "patient"}`;
    const savedPhoto = localStorage.getItem(photoKey);
    if (savedPhoto) {
        updateProfileUI(savedPhoto);
    }
});

        // --- DARK MODE LOGIC ---
        // 1. Re-initialize selectors to ensure they match your HTML IDs
// 🌙 DARK MODE SYSTEM (CLEAN + COMPLETE)

const themeToggle = document.getElementById('darkModeToggle');

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        document.documentElement.setAttribute('data-bs-theme', 'dark');
        if (themeToggle) themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        document.documentElement.setAttribute('data-bs-theme', 'light');
        if (themeToggle) themeToggle.checked = false;
    }
}

// Load saved theme
applyTheme(localStorage.getItem('theme'));

// Toggle
if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// Load saved theme immediately
(function () {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
})();

// Toggle listener
if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme);
    });
}

// 3. Run immediately on page load to prevent "flashing" white
const savedTheme = localStorage.getItem('theme');
applyTheme(savedTheme);

// 4. The new, clean event listener
if (themeToggle) {
    themeToggle.addEventListener('change', () => {
        const newTheme = themeToggle.checked ? 'dark' : 'light';
        applyTheme(newTheme);
        localStorage.setItem('theme', newTheme); // Persists the choice
    });
}

    // 2. Define our elements
   const notifBtn = document.querySelector('.notif-wrapper');
const notifPanel = document.getElementById('notifPanel');
const closeNotifBtn = document.getElementById('closeNotif');
const dot = document.querySelector('.notif-wrapper .dot');

if (notifBtn && notifPanel) {
    notifBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSharedNotifPanel("patient");
    });
}

if (closeNotifBtn && notifPanel) {
    closeNotifBtn.addEventListener('click', () => {
        toggleSharedNotifPanel("patient", true);
    });
}

document.addEventListener('click', (e) => {
    if (!notifPanel || !notifBtn) return;

    if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
        toggleSharedNotifPanel("patient", true);
    }
});

    // BILLING FORM
    initializeBillingEventBindings();


    // INIT
    renderServices();
    populateServiceDropdown();
    loadAppointmentsUI();
    generateCalendar();
    generateTimeSlots();
    void refreshBookingReservations();



});

// ==============================
// CANONICAL CLINIC DATA LAYER
// ==============================
const LONG_TERM_TREATMENT_KEYWORDS = ["orthodontic treatment"];
const MULTI_VISIT_SERVICE_KEYS = [
  "root canal treatment",
  "crowns and bridges",
  "complete denture",
  "partial denture",
  "flexible denture"
];

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function buildDefaultClinicDb() {
  return {
    appointments: [],
    archivedAppointments: [],
    treatmentPlans: [],
    rescheduleRequests: [],
    notifications: {
      admin: [],
      dentist: [],
      patient: [],
      staff: []
    },
    dentists: [],
    patients: []
  };
}

function ensureClinicDbShape(db = {}) {
  const base = buildDefaultClinicDb();
  return {
    ...base,
    ...db,
    appointments: safeArray(db.appointments),
    archivedAppointments: safeArray(db.archivedAppointments),
    treatmentPlans: safeArray(db.treatmentPlans),
    rescheduleRequests: safeArray(db.rescheduleRequests),
    dentists: safeArray(db.dentists),
    patients: safeArray(db.patients),
    notifications: {
      admin: safeArray(db?.notifications?.admin),
      dentist: safeArray(db?.notifications?.dentist),
      staff: safeArray(db?.notifications?.staff),
      patient: safeArray(db?.notifications?.patient)
    }
  };
}

function createClinicEntityId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatBillingCurrency(value) {
  const amount = Number(value || 0);
  return `₱${Number.isFinite(amount) ? amount.toLocaleString() : "0"}`;
}

function normalizeServiceKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getServiceFlowType(serviceName = "") {
  const key = normalizeServiceKey(serviceName);
  if (LONG_TERM_TREATMENT_KEYWORDS.some(keyword => key.includes(keyword))) {
    return "long_term_treatment";
  }
  if (MULTI_VISIT_SERVICE_KEYS.some(keyword => key.includes(keyword))) {
    return "multi_visit";
  }
  return "single_visit";
}

function isLongTermTreatment(serviceName = "") {
  return getServiceFlowType(serviceName) === "long_term_treatment";
}

function isMultiVisitService(serviceName = "") {
  return getServiceFlowType(serviceName) === "multi_visit";
}

function isLongTermTreatmentService(serviceName = "") {
  return isLongTermTreatment(serviceName);
}

function isOrthodonticBillingService(serviceName = "") {
  return normalizeServiceKey(serviceName) === "orthodontic treatment";
}

function toTitleCaseLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeAppointmentLifecycleStatus(status = "", context = {}) {
  if (context.archived) return "Archived";

  const raw = String(status || "").trim();
  if (!raw) return "Pending";

  const lowered = raw.toLowerCase();

  if (["pending"].includes(lowered)) return "Pending";
  if (["approved", "upcoming"].includes(lowered)) return "Approved";
  if (["checked in", "checkedin", "ongoing", "active", "started", "in progress", "treatment in progress"].includes(lowered)) return "Ongoing";
  if (["completed", "visit completed"].includes(lowered)) return "Completed";
  if (["cancelled", "canceled"].includes(lowered)) return "Cancelled";
  if (["rejected"].includes(lowered)) return "Rejected";
  if (["reschedule requested", "reschedule request"].includes(lowered)) return "Reschedule Requested";
  if (["reschedule rejected"].includes(lowered)) return "Reschedule Rejected";
  if (["archived"].includes(lowered)) return "Archived";
  return toTitleCaseLabel(raw);
}

function normalizeVisitStatus(status = "") {
  return normalizeAppointmentLifecycleStatus(status);
}

function normalizeOverallPaymentStatus(status = "") {
  const raw = String(status || "").trim();
  if (!raw) return "Unpaid";
  const lowered = raw.toLowerCase();
  if (["partial", "partially paid"].includes(lowered)) return "Partial";
  if (lowered === "downpayment paid") return "Downpayment Paid";
  if (lowered === "installment ongoing") return "Installment Ongoing";
  if (lowered === "paid") return "Paid";
  if (lowered === "unpaid") return "Unpaid";
  return toTitleCaseLabel(raw);
}

function getCurrentPatientIdentity() {
  const sessionUser = currentPatientUser || getCurrentUser() || {};
  const fullName = String(sessionUser.name || sessionUser.fullName || sessionUser.email || "Patient").trim();
  const email = String(sessionUser.email || "").trim().toLowerCase();
  const id = String(
    sessionUser.patientId ||
    sessionUser.patient_id ||
    sessionUser.id ||
    email ||
    fullName ||
    "patient"
  ).trim();

  return {
    id,
    email,
    name: fullName
  };
}

function matchesCurrentPatient(record, identity = getCurrentPatientIdentity()) {
  if (!record) return false;

  const recordPatientId = String(record.patientId || record.patient_id || "").trim().toLowerCase();
  const recordEmail = String(record.patientEmail || record.email || "").trim().toLowerCase();
  const recordName = String(record.patientName || record.patient || "").trim().toLowerCase();

  const identityId = String(identity.id || "").trim().toLowerCase();
  const identityEmail = String(identity.email || "").trim().toLowerCase();
  const identityName = String(identity.name || "").trim().toLowerCase();

  return (
    (!!identityId && !!recordPatientId && identityId === recordPatientId) ||
    (!!identityEmail && !!recordEmail && identityEmail === recordEmail) ||
    (!!identityName && !!recordName && identityName === recordName)
  );
}

function isArchivedRecord(record = {}) {
  return record.archived === true || record.archivedForPatient === true || record.archivedForDentist === true;
}

function isClosedStatus(status = "") {
  return ["Completed", "Cancelled", "Rejected", "Archived"].includes(normalizeAppointmentLifecycleStatus(status));
}

function isActiveLifecycleStatus(status = "") {
  return ["Pending", "Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(normalizeAppointmentLifecycleStatus(status));
}

function isHistoryLifecycleStatus(status = "") {
  return ["Completed", "Cancelled", "Rejected"].includes(normalizeAppointmentLifecycleStatus(status));
}

function getOperationalAppointmentStatus(record = {}) {
  const safeStatus = normalizeAppointmentLifecycleStatus(record.lifecycleStatus || record.status || "Pending");
  if (safeStatus === "Reschedule Rejected") {
    const priorStatus = normalizeAppointmentLifecycleStatus(record.statusBeforeReschedule || "Approved");
    return ["Approved", "Ongoing"].includes(priorStatus) ? priorStatus : "Approved";
  }
  return safeStatus;
}

function canOpenBillingForAppointment(record = {}) {
  if (!record) return false;

  if (record.recordType === "treatment_plan") {
    return String(record.status || "") === "Ongoing" && Number(record.remainingBalance || 0) > 0;
  }

  return ["Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(getOperationalAppointmentStatus(record))
    && Number(record.remainingBalance || 0) > 0;
}

function getLegacyLocalArray(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function deriveLegacyTreatmentId(raw = {}) {
  const patientKey = String(raw.patientId || raw.patientEmail || raw.patientName || raw.patient || "patient")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const serviceKey = normalizeServiceKey(raw.service || "orthodontic treatment").replace(/\s+/g, "-");
  return raw.treatmentId || `trt-${patientKey}-${serviceKey}`;
}

function buildAppointmentIdentityKey(item = {}, index = 0) {
  const explicitId = String(item.id || item.appointmentId || "").trim();
  if (explicitId) return explicitId;

  const patientKey = String(item.patientId || item.patientEmail || item.patientName || item.patient || "patient")
    .trim()
    .toLowerCase();
  const scheduleKey = String(item.schedule || buildSchedule(item.date || "", item.time || "") || "")
    .trim()
    .toLowerCase();
  const serviceKey = String(item.service || "service").trim().toLowerCase();

  return `legacy-${patientKey}-${scheduleKey}-${serviceKey}-${index}`;
}

function mergeAppointmentRecordCollections(collections = []) {
  const map = new Map();

  collections.forEach(collection => {
    safeArray(collection).forEach((item, index) => {
      const key = buildAppointmentIdentityKey(item, index);
      const existing = map.get(key) || {};
      map.set(key, {
        ...existing,
        ...item,
        id: String(item.id || item.appointmentId || existing.id || key),
        patientName: item.patientName || item.patient || existing.patientName || existing.patient || "Patient",
        patient: item.patientName || item.patient || existing.patient || existing.patientName || "Patient"
      });
    });
  });

  return [...map.values()];
}

function deriveServicePaymentStatus(serviceRecord = {}) {
  const totalPaid = Number(serviceRecord.totalPaid || 0);
  const price = Number(serviceRecord.price || 0);
  const remainingBalance = Math.max(0, price - totalPaid);
  const requiredDownpayment = Number(serviceRecord.requiredDownpayment || 0);
  const paidDownpayment = Number(serviceRecord.paidDownpayment || 0);
  const paymentMode = serviceRecord.paymentMode || "full";
  const additionalPayments = Array.isArray(serviceRecord.additionalPayments) ? serviceRecord.additionalPayments : [];

  if (totalPaid <= 0) return "Unpaid";
  if (remainingBalance <= 0) return "Paid";
  if (paymentMode === "installment") {
    if (paidDownpayment > 0 && paidDownpayment >= requiredDownpayment && additionalPayments.length === 0) {
      return "Downpayment Paid";
    }
    return "Installment Ongoing";
  }
  if (paymentMode === "downpayment") {
    return "Downpayment Paid";
  }
  return "Partially Paid";
}

function normalizeServicePaymentStatus(status = "", serviceRecord = {}) {
  const normalized = normalizeOverallPaymentStatus(status);
  if (normalized === "Unpaid" || normalized === "Paid") return normalized;
  if (normalized === "Downpayment Paid" || normalized === "Installment Ongoing") {
    return ["installment", "downpayment"].includes(serviceRecord.paymentMode) ? normalized : "Partially Paid";
  }
  if (normalized === "Partial") {
    if (serviceRecord.paymentMode === "installment" && Number(serviceRecord.totalPaid || 0) > 0) {
      return "Installment Ongoing";
    }
    if (serviceRecord.paymentMode === "downpayment" && Number(serviceRecord.totalPaid || 0) > 0) {
      return "Downpayment Paid";
    }
    return "Partially Paid";
  }
  return deriveServicePaymentStatus(serviceRecord);
}

function buildLegacyServiceRecords(apt = {}, visitStatus = "Pending") {
  const serviceNames = String(apt.service || "")
    .split("+")
    .map(serviceName => serviceName.trim())
    .filter(Boolean);

  if (!serviceNames.length) return [];

  const fallbackPrice = window.GMAdditionalFees.serviceTotal(apt);
  const perServicePrice = serviceNames.length ? fallbackPrice / serviceNames.length : fallbackPrice;
  const legacyDownPayment = Number(apt.downPayment || 0);
  const hasInstallmentHistory = normalizeOverallPaymentStatus(apt.paymentStatus || "") !== "Unpaid" && legacyDownPayment > 0;

  return serviceNames.map(serviceName => {
    const catalogService = services.find(service => service.name === serviceName);
    const isOrthodontic = isOrthodonticBillingService(serviceName);

    return normalizeBillingServiceRecord({
      serviceName,
      price: Number(catalogService?.price || perServicePrice || 0),
      paymentMode: hasInstallmentHistory ? (isOrthodontic ? "installment" : "downpayment") : "full",
      paidDownpayment: legacyDownPayment,
      paymentStatus: apt.paymentStatus || "Unpaid",
      serviceStatus: apt.serviceStatus || "Pending"
    }, { visitStatus });
  });
}

function normalizeBillingServiceRecord(serviceObj = {}, options = {}) {
  const raw = typeof serviceObj === "string" ? { serviceName: serviceObj } : { ...(serviceObj || {}) };
  const serviceName = raw.serviceName || raw.name || raw.service || "Service";
  const catalogService = services.find(service => service.name === serviceName);
  const price = Number(raw.price != null ? raw.price : raw.cost != null ? raw.cost : catalogService?.price || 0);
  const flowType = raw.serviceFlowType || getServiceFlowType(serviceName);
  const isLongTermCase = flowType === "long_term_treatment";

  let paymentMode = raw.paymentMode;
  if (!paymentMode) {
    const normalizedStatus = normalizeOverallPaymentStatus(raw.paymentStatus || "");
    const hasDownpaymentHistory =
      ["Downpayment Paid", "Installment Ongoing"].includes(normalizedStatus) ||
      Number(raw.paidDownpayment || raw.downPayment || 0) > 0;

    if (isLongTermCase && hasDownpaymentHistory) {
      paymentMode = "installment";
    } else if (!isLongTermCase && hasDownpaymentHistory) {
      paymentMode = "downpayment";
    } else {
      paymentMode = "full";
    }
  }

  if (!isLongTermCase && !["full", "downpayment"].includes(paymentMode)) {
    paymentMode = "full";
  }

  const requiresDownpayment = price > 0;
  const requiredDownpayment = Number(
    raw.requiredDownpayment != null
      ? raw.requiredDownpayment
      : price > 0
        ? Math.max(1, Math.round(price * 0.10))
        : 0
  );

  const paidDownpayment = Math.max(
    0,
    Number(options.paidDownpayment != null ? options.paidDownpayment : raw.paidDownpayment || raw.downPayment || 0)
  );

  const additionalPayments = Array.isArray(raw.additionalPayments)
    ? raw.additionalPayments
        .map(entry => ({
          amount: Number(entry?.amount || 0),
          method: entry?.method || "",
          source: entry?.source || "",
          note: entry?.note || "",
          paidAt: entry?.paidAt || entry?.createdAt || ""
        }))
        .filter(entry => entry.amount > 0)
    : [];

  const fallbackTotalPaid =
    raw.totalPaid != null
      ? Number(raw.totalPaid || 0)
      : raw.remainingBalance != null
        ? Math.max(0, price - Number(raw.remainingBalance || 0))
        : paidDownpayment + additionalPayments.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

  const totalPaid = Math.min(price, Math.max(fallbackTotalPaid, paidDownpayment));
  const remainingBalance = Math.max(0, price - totalPaid);
  const visitStatus = normalizeVisitStatus(options.visitStatus || raw.visitStatus || raw.status || "Pending");
  const serviceStatus = String(raw.serviceStatus || "").trim()
    || (visitStatus === "Completed" ? (isLongTermCase ? "Active" : "Completed") : "Pending");

  const normalizedRecord = {
    participantId: raw.participantId || "main",
    participantName: raw.participantName || "",
    serviceName,
    price,
    paymentMode,
    requiresDownpayment,
    requiredDownpayment,
    paidDownpayment: Math.min(requiredDownpayment || price, paidDownpayment),
    totalPaid,
    remainingBalance,
    additionalPayments,
    isLongTermTreatment: isLongTermCase,
    serviceFlowType: flowType,
    serviceStatus
  };

  return {
    ...normalizedRecord,
    paymentStatus: normalizeServicePaymentStatus(raw.paymentStatus || "", normalizedRecord)
  };
}

function getNormalizedAppointmentServices(apt = {}, options = {}) {
  const baseServices = Array.isArray(apt.services) && apt.services.length
    ? apt.services
    : buildLegacyServiceRecords(apt, options.visitStatus || apt.status || "Pending");

  return baseServices.map(serviceRecord =>
    normalizeBillingServiceRecord(serviceRecord, {
      visitStatus: options.visitStatus || apt.visitStatus || apt.lifecycleStatus || apt.status || "Pending"
    })
  );
}

function summarizeAppointmentServices(serviceRecords, fallback = {}) {
  const servicesList = Array.isArray(serviceRecords) ? serviceRecords : [];
  const totalAmount = servicesList.length
    ? servicesList.reduce((sum, service) => sum + Number(service.price || 0), 0)
    : Number(fallback.fallbackPrice || 0);
  const totalPaid = servicesList.length
    ? servicesList.reduce((sum, service) => sum + Number(service.totalPaid || 0), 0)
    : Number(fallback.fallbackTotalPaid || 0);
  const remainingBalance = Math.max(0, totalAmount - totalPaid);
  const minimumDownPayment = servicesList.reduce((sum, service) => {
    if (!["installment", "downpayment"].includes(service.paymentMode) || Number(service.remainingBalance || 0) <= 0) {
      return sum;
    }
    return sum + Math.max(0, Number(service.requiredDownpayment || 0) - Number(service.paidDownpayment || 0));
  }, 0);
  const requiresDownPayment = minimumDownPayment > 0;

  let overallPaymentStatus = "Unpaid";
  if (totalAmount > 0 && remainingBalance <= 0) overallPaymentStatus = "Paid";
  else if (totalPaid > 0) overallPaymentStatus = "Partial";

  return {
    totalAmount,
    totalPaid,
    remainingBalance,
    overallPaymentStatus,
    requiresDownPayment,
    minimumDownPayment
  };
}

function addPaymentToServiceRecord(serviceRecord, amount, meta = {}, options = {}) {
  const safeAmount = Math.max(0, Number(amount || 0));
  const normalized = normalizeBillingServiceRecord(serviceRecord);

  if (!safeAmount || normalized.remainingBalance <= 0) {
    return normalized;
  }

  const next = {
    ...normalized,
    additionalPayments: Array.isArray(normalized.additionalPayments)
      ? [...normalized.additionalPayments]
      : []
  };

  const appliedAmount = Math.min(safeAmount, next.remainingBalance);
  if (options.applyToDownpayment) {
    next.paidDownpayment = Math.min(
      Number(next.requiredDownpayment || 0) || Number(next.price || 0),
      Number(next.paidDownpayment || 0) + appliedAmount
    );
  } else {
    next.additionalPayments.push({
      amount: appliedAmount,
      source: meta.source || "",
      method: meta.method || "",
      note: meta.note || "",
      paidAt: meta.paidAt || new Date().toISOString()
    });
  }

  next.totalPaid = Math.min(Number(next.price || 0), Number(next.totalPaid || 0) + appliedAmount);
  next.remainingBalance = Math.max(0, Number(next.price || 0) - next.totalPaid);
  next.paymentStatus = deriveServicePaymentStatus(next);
  return next;
}

function applyPaymentToServices(serviceRecords = [], amount = 0, options = {}) {
  let remaining = Math.max(0, Number(amount || 0));
  const normalizedServices = Array.isArray(serviceRecords)
    ? serviceRecords.map(serviceRecord => normalizeBillingServiceRecord(serviceRecord))
    : [];

  normalizedServices.forEach((serviceRecord, index) => {
    if (remaining <= 0) return;
    const paymentAmount = Math.min(remaining, Number(serviceRecord.remainingBalance || 0));
    if (paymentAmount <= 0) return;

    normalizedServices[index] = addPaymentToServiceRecord(serviceRecord, paymentAmount, options);
    remaining -= paymentAmount;
  });

  return {
    services: normalizedServices,
    appliedAmount: Math.max(0, Number(amount || 0) - remaining)
  };
}

function normalizeAppointmentFinancials(apt = {}) {
  if (apt?.recordType === "treatment_plan") {
    return normalizeTreatmentBillingItem(apt);
  }

  const fallbackId = String(apt.id || apt.appointmentId || createClinicEntityId("apt")).trim();
  const scheduleMeta = splitSchedule(apt.schedule || buildSchedule(apt.date || "", apt.timeDisplay || apt.time || ""));
  const amountPaidOnline = Number(apt.amountPaidOnline || 0);
  const amountPaidInClinic = Number(apt.amountPaidInClinic || 0);
  const storedCollected = Number(
    apt.totalCollected != null
      ? apt.totalCollected
      : amountPaidOnline + amountPaidInClinic
  );

  const patientIdentity = getCurrentPatientIdentity();
  const rawServiceNames = Array.isArray(apt.services) && apt.services.length
    ? apt.services.map(service => service.serviceName || service.name || service.service || "").filter(Boolean)
    : String(apt.service || "").split("+").map(item => item.trim()).filter(Boolean);

  const longTermTreatmentId = rawServiceNames.some(isLongTermTreatment)
    ? String(apt.treatmentId || deriveLegacyTreatmentId(apt)).trim()
    : String(apt.treatmentId || "").trim();

  const lifecycleStatus = normalizeAppointmentLifecycleStatus(apt.visitStatus || apt.status || "Pending", {
    archived: isArchivedRecord(apt)
  });

  let normalizedServices = getNormalizedAppointmentServices(apt, { visitStatus: lifecycleStatus });
  const currentServicePaid = normalizedServices.reduce((sum, service) => sum + Number(service.totalPaid || 0), 0);

  const feePaid = window.GMAdditionalFees.paymentSummary(apt).paid;
  const serviceCollected = Math.max(0, storedCollected - feePaid);
  if (normalizedServices.length && serviceCollected > currentServicePaid) {
    normalizedServices = applyPaymentToServices(normalizedServices, serviceCollected - currentServicePaid, {
      source: "legacy",
      method: apt.paymentMethod || "legacy",
      note: "Migrated legacy appointment payment",
      paidAt: apt.updatedAt || apt.createdAt || new Date().toISOString()
    }).services;
  }

  const totals = summarizeAppointmentServices(normalizedServices, {
    fallbackPrice: window.GMAdditionalFees.serviceTotal(apt),
    fallbackTotalPaid: storedCollected
  });
  const additionalFeesTotal = Number(apt.additionalFeesTotal || 0) || (window.GMAdditionalFees
    ? window.GMAdditionalFees.calculate(apt.additionalFees || []).total
    : 0);
  totals.totalAmount = Math.max(0, totals.totalAmount + additionalFeesTotal - Number(apt.discount?.amount || 0));
  totals.totalPaid = Math.max(totals.totalPaid + feePaid, storedCollected);
  totals.remainingBalance = Math.max(0, totals.totalAmount - totals.totalPaid);
  if (totals.totalAmount > 0 && totals.remainingBalance <= 0) totals.overallPaymentStatus = "Paid";
  else if (totals.totalPaid > 0) totals.overallPaymentStatus = "Partial";

  const serviceLabel = String(
    apt.service ||
    normalizedServices.map(service => service.serviceName).join(" + ") ||
    rawServiceNames.join(" + ") ||
    "Appointment"
  ).trim();

  const serviceFlowType = apt.serviceFlowType || (
    rawServiceNames.some(isLongTermTreatment)
      ? "long_term_treatment"
      : rawServiceNames.some(isMultiVisitService)
        ? "multi_visit"
        : "single_visit"
  );

  const derivedPatientId = String(
    apt.patientId ||
    apt.patient_id ||
    apt.patientEmail ||
    apt.email ||
    (matchesCurrentPatient(apt, patientIdentity) ? patientIdentity.id : "")
  ).trim();

  const normalized = {
    ...apt,
    id: fallbackId,
    recordType: apt.recordType || (longTermTreatmentId ? "treatment_session" : "appointment"),
    patientId: derivedPatientId,
    patientName: apt.patientName || apt.patient || patientIdentity.name || "Patient",
    patient: apt.patientName || apt.patient || patientIdentity.name || "Patient",
    patientEmail: String(apt.patientEmail || apt.email || "").trim(),
    dentistId: String(apt.dentistId || apt.dentist_id || "").trim(),
    dentist: String(apt.dentist || apt.dentistName || "").trim(),
    service: serviceLabel,
    services: normalizedServices,
    serviceFlowType,
    treatmentId: longTermTreatmentId,
    sessionId: String(apt.sessionId || (longTermTreatmentId ? `${fallbackId}-session` : "")).trim(),
    date: normalizeBookingDate(apt.date || scheduleMeta.date || ""),
    time: convertDisplayTimeTo24(apt.time || scheduleMeta.time24 || apt.timeDisplay || ""),
    timeDisplay: normalizeTimeDisplay(apt.timeDisplay || scheduleMeta.timeDisplay || ""),
    schedule: buildSchedule(apt.date || scheduleMeta.date || "", apt.timeDisplay || scheduleMeta.timeDisplay || apt.time || ""),
    lifecycleStatus,
    status: lifecycleStatus,
    statusBeforeReschedule: apt.statusBeforeReschedule ? normalizeAppointmentLifecycleStatus(apt.statusBeforeReschedule) : "",
    requestedSchedule: String(apt.requestedSchedule || "").trim(),
    previousSchedule: String(apt.previousSchedule || "").trim(),
    rescheduleReason: String(apt.rescheduleReason || "").trim(),
    price: totals.totalAmount,
    subtotal: totals.totalAmount,
    paid: totals.remainingBalance <= 0,
    visitStatus: lifecycleStatus,
    requiresDownPayment: totals.requiresDownPayment,
    minimumDownPayment: totals.minimumDownPayment,
    invoiceUnlocked: apt.invoiceUnlocked !== false,
    downPayment: normalizedServices.reduce((sum, service) => sum + Number(service.paidDownpayment || 0), 0),
    amountPaidOnline,
    amountPaidInClinic,
    totalCollected: totals.totalPaid,
    remainingBalance: totals.remainingBalance,
    paymentStatus: (apt.paymentProofs || []).some(p => p.method === "cash" && p.status === "pending") ? "Pending" : totals.overallPaymentStatus,
    archived: apt.archived === true || apt.archivedForPatient === true || apt.archivedForDentist === true,
    archivedForPatient: apt.archivedForPatient === true,
    archivedForDentist: apt.archivedForDentist === true,
    archivedAt: apt.archivedAt || "",
    archivedBy: apt.archivedBy || "",
    revenueCountedOnline: Number(apt.revenueCountedOnline || 0),
    revenueCountedClinic: Number(apt.revenueCountedClinic || 0),
    createdAt: apt.createdAt || apt.updatedAt || new Date().toISOString(),
    updatedAt: apt.updatedAt || apt.createdAt || new Date().toISOString(),
    notes: apt.notes || ""
  };

  return normalized;
}

function buildTreatmentSessionFromAppointment(appointment = {}) {
  const normalizedAppointment = normalizeAppointmentFinancials(appointment);
  return {
    sessionId: normalizedAppointment.sessionId || `${normalizedAppointment.id}-session`,
    appointmentId: normalizedAppointment.id,
    date: normalizedAppointment.date || splitSchedule(normalizedAppointment.schedule).date || "",
    time: normalizedAppointment.time || splitSchedule(normalizedAppointment.schedule).time24 || "",
    timeDisplay: normalizedAppointment.timeDisplay || splitSchedule(normalizedAppointment.schedule).timeDisplay || "",
    schedule: normalizedAppointment.schedule || buildSchedule(normalizedAppointment.date || "", normalizedAppointment.timeDisplay || normalizedAppointment.time || ""),
    status: normalizeAppointmentLifecycleStatus(normalizedAppointment.lifecycleStatus || normalizedAppointment.status || "Pending"),
    notes: normalizedAppointment.notes || "",
    createdAt: normalizedAppointment.createdAt || new Date().toISOString(),
    updatedAt: normalizedAppointment.updatedAt || new Date().toISOString()
  };
}

function normalizeTreatmentPlanStatus(status = "", context = {}) {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "discontinuation requested") return "Discontinuation Requested";
  if (raw === "pending consultation") return "Pending Consultation";
  if (raw === "discontinued") return "Discontinued";
  if (raw === "completed" || context.forceCompleted) return "Completed";
  if (raw === "cancelled" || raw === "canceled" || context.forceCancelled) return "Cancelled";
  return "Active";
}

function sortSessionsChronologically(left, right) {
  return getRecordDateTimeValue(left) - getRecordDateTimeValue(right);
}

function normalizeTreatmentPlanRecord(plan = {}, linkedAppointments = []) {
  const treatmentId = String(plan.treatmentId || plan.id || createClinicEntityId("trt")).trim();
  const serviceName = String(plan.serviceName || plan.service || "Orthodontic Treatment").trim() || "Orthodontic Treatment";
  const catalogService = services.find(service => normalizeServiceKey(service.name) === normalizeServiceKey(serviceName));
  const totalCost = Number(plan.totalCost != null ? plan.totalCost : plan.price != null ? plan.price : catalogService?.price || 0);
  const amountPaidOnline = Number(plan.amountPaidOnline || 0);
  const amountPaidInClinic = Number(plan.amountPaidInClinic || 0);
  const amountPaid = Number(
    plan.amountPaid != null
      ? plan.amountPaid
      : plan.totalCollected != null
        ? plan.totalCollected
        : amountPaidOnline + amountPaidInClinic
  );

  const sessionMap = new Map();

  safeArray(plan.sessions).forEach((session, index) => {
    const key = String(session.sessionId || session.appointmentId || `${treatmentId}-session-${index + 1}`).trim();
    sessionMap.set(key, {
      sessionId: key,
      appointmentId: String(session.appointmentId || "").trim(),
      date: String(session.date || splitSchedule(session.schedule).date || "").trim(),
      time: String(session.time || splitSchedule(session.schedule).time24 || "").trim(),
      timeDisplay: normalizeTimeDisplay(session.timeDisplay || splitSchedule(session.schedule).timeDisplay || session.time || ""),
      schedule: buildSchedule(session.date || splitSchedule(session.schedule).date || "", session.timeDisplay || splitSchedule(session.schedule).timeDisplay || session.time || ""),
      status: normalizeAppointmentLifecycleStatus(session.status || "Pending"),
      notes: session.notes || "",
      createdAt: session.createdAt || plan.createdAt || new Date().toISOString(),
      updatedAt: session.updatedAt || session.createdAt || plan.updatedAt || new Date().toISOString()
    });
  });

  safeArray(linkedAppointments).forEach(appointment => {
    if (String(appointment.treatmentId || "") !== treatmentId) return;
    const session = buildTreatmentSessionFromAppointment(appointment);
    sessionMap.set(session.sessionId, {
      ...sessionMap.get(session.sessionId),
      ...session
    });
  });

  const sessions = [...sessionMap.values()].sort(sortSessionsChronologically);
  const nextOpenSession = sessions.find(session => isActiveLifecycleStatus(session.status));
  const remainingBalance = Math.max(0, totalCost - amountPaid);
  const explicitStatus = normalizeTreatmentPlanStatus(plan.status || "", {
    forceCancelled: sessions.length > 0 && sessions.every(session => session.status === "Cancelled")
  });

  return {
    ...plan,
    id: treatmentId,
    treatmentId,
    recordType: "treatment_plan",
    type: "long_term_treatment",
    patientId: String(plan.patientId || linkedAppointments[0]?.patientId || "").trim(),
    patientName: plan.patientName || linkedAppointments[0]?.patientName || linkedAppointments[0]?.patient || "Patient",
    patientEmail: String(plan.patientEmail || linkedAppointments[0]?.patientEmail || "").trim(),
    dentistId: String(plan.dentistId || linkedAppointments[0]?.dentistId || "").trim(),
    dentist: String(plan.dentist || linkedAppointments[0]?.dentist || "").trim(),
    serviceName,
    status: explicitStatus,
    startDate: String(plan.startDate || linkedAppointments[0]?.date || "").trim(),
    estimatedDurationMonths: Number(plan.estimatedDurationMonths || 18),
    totalCost,
    downPayment: Number(plan.downPayment || 0),
    installmentAmount: Number(plan.installmentAmount || plan.monthlyAmount || Math.max(1, Math.round(totalCost / Math.max(1, Number(plan.estimatedDurationMonths || 18))))),
    monthlyAmount: Number(plan.monthlyAmount || plan.installmentAmount || Math.max(1, Math.round(totalCost / Math.max(1, Number(plan.estimatedDurationMonths || 18))))),
    amountPaid,
    amountPaidOnline,
    amountPaidInClinic,
    totalCollected: amountPaid,
    remainingBalance,
    nextSessionDate: String(plan.nextSessionDate || nextOpenSession?.date || "").trim(),
    nextSessionTime: normalizeTimeDisplay(plan.nextSessionTime || nextOpenSession?.timeDisplay || ""),
    nextSessionSchedule: buildSchedule(plan.nextSessionDate || nextOpenSession?.date || "", plan.nextSessionTime || nextOpenSession?.timeDisplay || ""),
    sessions,
    notes: plan.notes || "",
    createdAt: plan.createdAt || linkedAppointments[0]?.createdAt || new Date().toISOString(),
    updatedAt: plan.updatedAt || linkedAppointments[0]?.updatedAt || new Date().toISOString()
  };
}

function normalizeTreatmentBillingItem(planLike = {}) {
  const totalCost = Number(planLike.totalCost || planLike.price || 0);
  const amountPaid = Number(planLike.amountPaid != null ? planLike.amountPaid : planLike.totalCollected || 0);
  const remainingBalance = Math.max(0, Number(planLike.remainingBalance != null ? planLike.remainingBalance : totalCost - amountPaid));
  const paymentStatus = (planLike.paymentProofs || []).some(p => p.method === "cash" && p.status === "pending") ? "Pending" : remainingBalance <= 0 ? "Paid" : amountPaid > 0 ? "Partial" : "Unpaid";
  const serviceRecord = normalizeBillingServiceRecord({
    serviceName: planLike.serviceName || planLike.service || "Orthodontic Treatment",
    price: totalCost,
    paymentMode: "installment",
    paidDownpayment: Number(planLike.downPayment || 0),
    totalPaid: amountPaid,
    paymentStatus: remainingBalance <= 0 ? "Paid" : amountPaid > 0 ? "Installment Ongoing" : "Unpaid",
    serviceStatus: String(planLike.status || "Active") === "Completed" ? "Completed" : "Active"
  });

  return {
    ...planLike,
    id: String(planLike.treatmentId || planLike.id || createClinicEntityId("trt")).trim(),
    treatmentId: String(planLike.treatmentId || planLike.id || createClinicEntityId("trt")).trim(),
    recordType: "treatment_plan",
    patientId: String(planLike.patientId || "").trim(),
    patientName: planLike.patientName || "Patient",
    patientEmail: String(planLike.patientEmail || "").trim(),
    dentistId: String(planLike.dentistId || "").trim(),
    dentist: String(planLike.dentist || "").trim(),
    service: planLike.serviceName || planLike.service || "Orthodontic Treatment",
    services: [serviceRecord],
    price: totalCost,
    subtotal: totalCost,
    downPayment: Number(planLike.downPayment || 0),
    amountPaidOnline: Number(planLike.amountPaidOnline || 0),
    amountPaidInClinic: Number(planLike.amountPaidInClinic || 0),
    totalCollected: amountPaid,
    amountPaid,
    remainingBalance,
    paid: remainingBalance <= 0,
    paymentStatus,
    requiresDownPayment: remainingBalance > 0,
    minimumDownPayment: Math.max(0, Number(serviceRecord.requiredDownpayment || 0) - Number(serviceRecord.paidDownpayment || 0)),
    lifecycleStatus: (function() { const s = normalizeTreatmentPlanStatus(planLike.status || "Active"); return s === "Active" ? "Ongoing" : s; }()),
    status: (function() { const s = normalizeTreatmentPlanStatus(planLike.status || "Active"); return s === "Active" ? "Ongoing" : s; }()),
    schedule: planLike.nextSessionSchedule || buildSchedule(planLike.nextSessionDate || "", planLike.nextSessionTime || "") || (planLike.startDate ? `Started ${planLike.startDate}` : "Treatment case"),
    notes: planLike.notes || "",
    createdAt: planLike.createdAt || new Date().toISOString(),
    updatedAt: planLike.updatedAt || planLike.createdAt || new Date().toISOString()
  };
}

function getRecordDateTimeValue(record = {}) {
  if (!record) return Number.MAX_SAFE_INTEGER;
  if (record.schedule) {
    const parsed = parseAppointmentDateTime(record.schedule);
    if (parsed) return parsed.getTime();
  }
  if (record.date) {
    const parsed = parseAppointmentDateTime(buildSchedule(record.date, record.timeDisplay || record.time || ""));
    if (parsed) return parsed.getTime();
  }
  return Number.MAX_SAFE_INTEGER;
}

function buildCanonicalAppointmentCollections() {
  const db = ensureClinicDbShape(getClinicDb());
  const dbAppointments = safeArray(db.appointments).filter(isUsableAppointmentRecord);
  const legacyAppointments = safeArray(getClinicData(CLINIC_SYNC_KEYS.appointments, [])).concat(safeArray(getLegacyLocalArray("appointments"))).filter(isUsableAppointmentRecord);
  const legacyArchived = safeArray(getClinicData(CLINIC_SYNC_KEYS.archivedAppointments, [])).concat(safeArray(getLegacyLocalArray("archivedAppointments")))
    .map(item => ({
      ...item,
      archived: true,
      archivedForPatient: item.archivedForPatient !== false,
      archivedAt: item.archivedAt || new Date().toISOString()
    }));

  return mergeAppointmentRecordCollections([legacyAppointments.filter(isUsableAppointmentRecord), legacyArchived.filter(isUsableAppointmentRecord), dbAppointments])
    .map(normalizeAppointmentFinancials);
}

function isUsableAppointmentRecord(item = {}) {
  const patient = String(item.patientName || item.patient || item.patientId || "").trim();
  const service = String(item.service || "").trim();
  const schedule = String(item.schedule || "").trim();
  const date = String(item.date || "").trim();
  return Boolean(patient && (service || schedule || date) && service.toLowerCase() !== "no appointment yet" && item.recordType !== "profile");
}

function buildAppointmentScheduleKey(record = {}) {
  if (!record) return "";
  const date = normalizeBookingDate(record.date || splitSchedule(record.schedule || "").date || "");
  const time = convertDisplayTimeTo24(record.time || record.timeDisplay || splitSchedule(record.schedule || "").time24 || "");
  const dentist = String(record.dentistId || record.dentist || "").trim().toLowerCase();
  if (!date || !time || !dentist) return "";
  return `${dentist}__${date}__${time}`;
}

function isAutoApprovalEligibleAppointment(record = {}) {
  if (!record || record.recordType === "treatment_plan") return false;
  if (record.archivedForPatient === true || record.archivedForDentist === true) return false;
  if (normalizeAppointmentLifecycleStatus(record.status || record.lifecycleStatus || "Pending") !== "Pending") return false;
  if (record.requiresManualApproval === true) return false;
  if (String(record.service || "").trim().toLowerCase() === "no appointment yet") return false;

  const createdBy = String(record.createdBy || "").trim().toLowerCase();
  const approvalMode = String(record.approvalMode || "").trim().toLowerCase();

  return approvalMode === "auto"
    || createdBy === "patient"
    || (!createdBy && !!record.patientEmail && !!record.dentistId);
}

function autoApproveEligibleAppointments(records = []) {
  const normalized = safeArray(records).map(normalizeAppointmentFinancials);
  const occupied = new Set(
    normalized
      .filter(item => ["Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(getOperationalAppointmentStatus(item)))
      .map(buildAppointmentScheduleKey)
      .filter(Boolean)
  );

  let changed = false;

  normalized
    .map((item, index) => ({ item, index }))
    .sort((left, right) => new Date(left.item.createdAt || 0) - new Date(right.item.createdAt || 0))
    .forEach(({ item, index }) => {
      if (!isAutoApprovalEligibleAppointment(item)) return;

      const key = buildAppointmentScheduleKey(item);
      if (!key || occupied.has(key)) return;

      normalized[index] = normalizeAppointmentFinancials({
        ...item,
        status: "Approved",
        lifecycleStatus: "Approved",
        approvalMode: "auto",
        updatedAt: new Date().toISOString()
      });

      occupied.add(key);
      changed = true;
    });

  return changed ? normalized : records;
}

function persistCanonicalAppointmentsIfNeeded(appointments) {
  const db = ensureClinicDbShape(getClinicDb());
  const normalizedAppointments = autoApproveEligibleAppointments(safeArray(appointments).map(normalizeAppointmentFinancials));
  const activeLegacyMirror = normalizedAppointments.filter(item => item.archived !== true && item.archivedForPatient !== true && item.archivedForDentist !== true);
  const archivedMirror = normalizedAppointments.filter(item => item.archived === true || item.archivedForPatient === true || item.archivedForDentist === true);

  const currentSerialized = JSON.stringify({
    appointments: safeArray(db.appointments),
    archivedAppointments: safeArray(db.archivedAppointments)
  });

  const nextSerialized = JSON.stringify({
    appointments: normalizedAppointments,
    archivedAppointments: archivedMirror
  });

  if (currentSerialized !== nextSerialized) {
    db.appointments = normalizedAppointments;
    db.archivedAppointments = archivedMirror;
    saveClinicDb(db);
    setClinicData(CLINIC_SYNC_KEYS.appointments, activeLegacyMirror);
    setClinicData(CLINIC_SYNC_KEYS.archivedAppointments, archivedMirror);
    localStorage.setItem("appointments", JSON.stringify(activeLegacyMirror));
    localStorage.setItem("archivedAppointments", JSON.stringify(archivedMirror));
    triggerGlobalSync?.();
  }

  return normalizedAppointments;
}

function getAppointmentsShared() {
  return persistCanonicalAppointmentsIfNeeded(buildCanonicalAppointmentCollections());
}

function getPatientAppointmentsShared(options = {}) {
  const { includeArchived = true } = options;
  return getAppointmentsShared().filter(item => {
    if (!matchesCurrentPatient(item)) return false;
    if (!includeArchived && (item.archivedForPatient === true || item.archived === true)) return false;
    return true;
  });
}

function getArchivedAppointmentsShared() {
  return getPatientAppointmentsShared({ includeArchived: true }).filter(item => item.archivedForPatient === true || item.archived === true);
}

function saveArchivedAppointmentsShared(list) {
  const safeList = Array.isArray(list) ? list : [];

  const db = getClinicDb();
  db.archivedAppointments = safeList;
  saveClinicDb(db);

  setClinicData(CLINIC_SYNC_KEYS.archivedAppointments, safeList);
  localStorage.removeItem("archivedAppointments");
}

function getTreatmentPlansShared() {
  const db = ensureClinicDbShape(getClinicDb());
  const appointments = getAppointmentsShared();
  const planMap = new Map();

  safeArray(db.treatmentPlans).forEach(plan => {
    const normalized = normalizeTreatmentPlanRecord(plan, appointments.filter(item => String(item.treatmentId || "") === String(plan.treatmentId || plan.id || "")));
    planMap.set(normalized.treatmentId, normalized);
  });

  appointments.forEach(appointment => {
    if (!appointment.treatmentId || !appointment.services.some(service => service.isLongTermTreatment)) return;
    if (planMap.has(appointment.treatmentId)) return;

    planMap.set(appointment.treatmentId, normalizeTreatmentPlanRecord({
      treatmentId: appointment.treatmentId,
      patientId: appointment.patientId,
      patientName: appointment.patientName,
      patientEmail: appointment.patientEmail,
      dentistId: appointment.dentistId,
      dentist: appointment.dentist,
      serviceName: appointment.services.find(service => service.isLongTermTreatment)?.serviceName || appointment.service,
      startDate: appointment.date,
      estimatedDurationMonths: 18,
      totalCost: appointment.services.find(service => service.isLongTermTreatment)?.price || appointment.price,
      downPayment: appointment.downPayment || 0,
      amountPaid: 0,
      remainingBalance: appointment.services.find(service => service.isLongTermTreatment)?.price || appointment.price,
      sessions: []
    }, [appointment]));
  });

  const normalizedPlans = [...planMap.values()].sort((left, right) => getRecordDateTimeValue(left) - getRecordDateTimeValue(right));
  const currentSerialized = JSON.stringify(safeArray(db.treatmentPlans));
  const nextSerialized = JSON.stringify(normalizedPlans);

  if (currentSerialized !== nextSerialized) {
    db.treatmentPlans = normalizedPlans;
    saveClinicDb(db);
    triggerGlobalSync?.();
  }

  return normalizedPlans;
}

function getPatientTreatmentPlansShared() {
  return getTreatmentPlansShared().filter(plan => matchesCurrentPatient(plan));
}

function saveTreatmentPlansShared(list) {
  const db = ensureClinicDbShape(getClinicDb());
  db.treatmentPlans = safeArray(list).map(plan => normalizeTreatmentPlanRecord(plan, getAppointmentsShared().filter(item => String(item.treatmentId || "") === String(plan.treatmentId || plan.id || ""))));
  saveClinicDb(db);
  triggerGlobalSync?.();
}

function getTreatmentPlanById(id) {
  return getTreatmentPlansShared().find(plan => String(plan.treatmentId) === String(id)) || null;
}

function updateTreatmentPlanById(id, updater) {
  const plans = getTreatmentPlansShared();
  const index = plans.findIndex(plan => String(plan.treatmentId) === String(id));
  if (index === -1) return null;

  const current = normalizeTreatmentPlanRecord(plans[index], getAppointmentsShared().filter(item => String(item.treatmentId || "") === String(id)));
  const updatedRaw = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  plans[index] = normalizeTreatmentPlanRecord({
    ...current,
    ...updatedRaw,
    updatedAt: new Date().toISOString()
  }, getAppointmentsShared().filter(item => String(item.treatmentId || "") === String(id)));

  saveTreatmentPlansShared(plans);
  return plans[index];
}

function findActiveTreatmentPlanForBooking(patientId, serviceName = "", dentistId = "") {
  const requestedService = normalizeServiceKey(serviceName || "Orthodontic Treatment");
  return getTreatmentPlansShared().find(plan => {
    if (String(plan.patientId || "") !== String(patientId || "")) return false;
    if (normalizeServiceKey(plan.serviceName || plan.service || "") !== requestedService) return false;
    if (String(plan.status || "") !== "Active") return false;
    if (dentistId && String(plan.dentistId || "") !== String(dentistId)) return false;
    return true;
  }) || null;
}

function upsertTreatmentPlanFromAppointment(appointment, options = {}) {
  const normalizedAppointment = normalizeAppointmentFinancials(appointment);
  const longTermService = normalizedAppointment.services.find(service => service.isLongTermTreatment);
  if (!normalizedAppointment.treatmentId || !longTermService) {
    return null;
  }

  const existing = getTreatmentPlanById(normalizedAppointment.treatmentId);
  const appointments = getAppointmentsShared().filter(item => String(item.treatmentId || "") === String(normalizedAppointment.treatmentId));
  const syncedTotalCost = Number(existing?.totalCost || longTermService.price || normalizedAppointment.price || 0);
  const syncedDownPayment = Math.max(
    Number(existing?.downPayment || 0),
    Number(longTermService.paidDownpayment || 0)
  );
  const syncedAmountPaid = Math.max(
    Number(existing?.amountPaid || existing?.totalCollected || 0),
    Number(longTermService.totalPaid || 0)
  );
  const nextPlan = normalizeTreatmentPlanRecord({
    treatmentId: normalizedAppointment.treatmentId,
    patientId: normalizedAppointment.patientId,
    patientName: normalizedAppointment.patientName,
    patientEmail: normalizedAppointment.patientEmail,
    dentistId: normalizedAppointment.dentistId,
    dentist: normalizedAppointment.dentist,
    serviceName: longTermService.serviceName,
    type: "long_term_treatment",
    status: options.status || existing?.status || "Active",
    startDate: existing?.startDate || normalizedAppointment.date,
    estimatedDurationMonths: Number(existing?.estimatedDurationMonths || options.estimatedDurationMonths || 18),
    totalCost: syncedTotalCost,
    downPayment: syncedDownPayment,
    installmentAmount: Number(existing?.installmentAmount || existing?.monthlyAmount || options.installmentAmount || Math.max(1, Math.round(Number(longTermService.price || normalizedAppointment.price || 0) / 18))),
    monthlyAmount: Number(existing?.monthlyAmount || existing?.installmentAmount || options.monthlyAmount || Math.max(1, Math.round(Number(longTermService.price || normalizedAppointment.price || 0) / 18))),
    amountPaid: syncedAmountPaid,
    amountPaidOnline: Number(existing?.amountPaidOnline || 0),
    amountPaidInClinic: Number(existing?.amountPaidInClinic || 0),
    totalCollected: syncedAmountPaid,
    remainingBalance: Math.max(0, syncedTotalCost - syncedAmountPaid),
    nextSessionDate: normalizedAppointment.date,
    nextSessionTime: normalizedAppointment.timeDisplay,
    sessions: existing?.sessions || [],
    notes: existing?.notes || options.notes || ""
  }, appointments);

  const plans = getTreatmentPlansShared();
  const index = plans.findIndex(plan => String(plan.treatmentId) === String(nextPlan.treatmentId));
  if (index > -1) {
    plans[index] = nextPlan;
  } else {
    plans.unshift(nextPlan);
  }
  saveTreatmentPlansShared(plans);
  return nextPlan;
}

function buildActiveTreatmentCaseRecord(plan) {
  const billingItem = normalizeTreatmentBillingItem(plan);
  const planStatus = normalizeTreatmentPlanStatus(plan.status || "Active");
  const resolvedLifecycle = planStatus === "Active" ? "Ongoing" : planStatus;
  return {
    ...billingItem,
    id: billingItem.treatmentId,
    recordType: "treatment_plan",
    isTreatmentCase: true,
    service: plan.serviceName || "Orthodontic Treatment",
    serviceName: plan.serviceName || "Orthodontic Treatment",
    schedule: plan.nextSessionSchedule || buildSchedule(plan.nextSessionDate || "", plan.nextSessionTime || "") || "",
    status: resolvedLifecycle,
    lifecycleStatus: resolvedLifecycle,
    rawPlanStatus: planStatus
  };
}

function getActiveTreatmentCaseRecordsForPatient() {
  return getPatientTreatmentPlansShared()
    .filter(plan => ["Active", "Discontinuation Requested", "Pending Consultation"].includes(normalizeTreatmentPlanStatus(plan.status || "")))
    .map(buildActiveTreatmentCaseRecord);
}

function getAppointmentById(id) {
  return getAppointmentsShared().find(a => String(a.id) === String(id)) || null;
}

function updateAppointmentById(id, updater) {
  const list = getAppointmentsShared();
  const index = list.findIndex(a => String(a.id) === String(id));
  if (index === -1) return null;

  const current = normalizeAppointmentFinancials(list[index]);
  const updatedRaw = typeof updater === "function" ? updater(current) : { ...current, ...updater };

  list[index] = normalizeAppointmentFinancials({
    ...current,
    ...updatedRaw,
    updatedAt: new Date().toISOString()
  });

  saveAppointmentsShared(list);
  if (list[index].treatmentId) {
    upsertTreatmentPlanFromAppointment(list[index]);
  }
  return list[index];
}

function canPatientCancel(status) {
  return ["Pending", "Approved", "Reschedule Requested", "Reschedule Rejected"].includes(normalizeAppointmentLifecycleStatus(status));
}

function canPatientPay(apt) {
  return canOpenBillingForAppointment(resolveBillingTargetRecord(apt));
}

function buildMixedAppointmentBillingItem(appointment = {}, planLike = null) {
  const normalizedAppointment = normalizeAppointmentFinancials(appointment);
  const planBillingItem = planLike ? normalizeTreatmentBillingItem(planLike) : null;
  const longTermPlanService = planBillingItem?.services?.find(service => service.isLongTermTreatment)
    || planBillingItem?.services?.find(service => isOrthodonticBillingService(service.serviceName));

  if (!normalizedAppointment.services.length || !longTermPlanService) {
    return normalizedAppointment;
  }

  const visitStatus = normalizedAppointment.lifecycleStatus || normalizedAppointment.status || "Pending";
  const mixedServices = normalizedAppointment.services.map(serviceRecord => {
    const normalizedService = normalizeBillingServiceRecord(serviceRecord, { visitStatus });
    if (!normalizedService.isLongTermTreatment) {
      return normalizedService;
    }

    return normalizeBillingServiceRecord({
      ...normalizedService,
      ...longTermPlanService,
      serviceName: normalizedService.serviceName,
      serviceStatus: normalizedService.serviceStatus || longTermPlanService.serviceStatus || visitStatus,
      isLongTermTreatment: true
    }, { visitStatus });
  });

  const totals = summarizeAppointmentServices(mixedServices, {
    fallbackPrice: Number(normalizedAppointment.price || 0),
    fallbackTotalPaid: Number(normalizedAppointment.totalCollected || 0)
  });

  return normalizeAppointmentFinancials({
    ...normalizedAppointment,
    services: mixedServices,
    price: totals.totalAmount,
    subtotal: totals.totalAmount,
    downPayment: mixedServices.reduce((sum, service) => sum + Number(service.paidDownpayment || 0), 0),
    totalCollected: totals.totalPaid,
    remainingBalance: totals.remainingBalance,
    paymentStatus: totals.overallPaymentStatus,
    requiresDownPayment: totals.requiresDownPayment,
    minimumDownPayment: totals.minimumDownPayment,
    billingResolved: true,
    billingSource: "mixed_appointment"
  });
}

function resolveBillingTargetRecord(target) {
  if (!target) return null;

  if (typeof target === "object" && target.recordType === "treatment_plan") {
    const plan = getTreatmentPlanById(target.treatmentId || target.id);
    return plan ? normalizeTreatmentBillingItem(plan) : normalizeTreatmentBillingItem(target);
  }

  if (typeof target === "object" && target.billingSource === "mixed_appointment" && Array.isArray(target.services)) {
    return normalizeAppointmentFinancials(target);
  }

  const lookupId = typeof target === "object" ? target.id : target;
  const appointment = lookupId ? getAppointmentById(lookupId) : null;
  if (appointment) {
    const normalizedAppointment = normalizeAppointmentFinancials(appointment);
    const longTermService = normalizedAppointment.services?.find(service => service.isLongTermTreatment);
    const hasAdditionalServices = normalizedAppointment.services?.some(service => !service.isLongTermTreatment);

    if (normalizedAppointment.treatmentId && longTermService) {
      const plan = getTreatmentPlanById(normalizedAppointment.treatmentId);
      if (plan) {
        if (hasAdditionalServices) {
          return buildMixedAppointmentBillingItem(normalizedAppointment, {
            ...plan,
            dentist: normalizedAppointment.dentist || plan.dentist,
            dentistId: normalizedAppointment.dentistId || plan.dentistId,
            patientName: normalizedAppointment.patientName || plan.patientName,
            patientEmail: normalizedAppointment.patientEmail || plan.patientEmail,
            patientId: normalizedAppointment.patientId || plan.patientId
          });
        }

        return normalizeTreatmentBillingItem({
          ...plan,
          dentist: normalizedAppointment.dentist || plan.dentist,
          dentistId: normalizedAppointment.dentistId || plan.dentistId,
          patientName: normalizedAppointment.patientName || plan.patientName,
          patientEmail: normalizedAppointment.patientEmail || plan.patientEmail,
          patientId: normalizedAppointment.patientId || plan.patientId
        });
      }
    }
    return normalizedAppointment;
  }

  const plan = lookupId ? getTreatmentPlanById(lookupId) : null;
  return plan ? normalizeTreatmentBillingItem(plan) : null;
}

function getInvoiceLabel(apt) {
  const item = resolveBillingTargetRecord(apt);
  if (!item) return "Pay / View Invoice";
  if (item.requiresDownPayment && item.paymentStatus === "Unpaid") {
    return `Down Payment Required (₱${item.minimumDownPayment.toLocaleString()})`;
  }
  if (item.paymentStatus === "Partial") return "Pay Remaining Balance";
  if (item.paymentStatus === "Paid") return "View Invoice";
  return "Pay / View Invoice";
}

function getBillingSelectionKey(serviceRecord = {}, index = 0) {
  return `${normalizeServiceKey(serviceRecord.serviceName || serviceRecord.service || `service-${index}`)}-${index}`;
}

function getInstallmentMinimumAmount(serviceRecord = {}) {
  const normalized = normalizeBillingServiceRecord(serviceRecord);
  const gap = Math.max(
    0,
    Number(normalized.requiredDownpayment || 0) - Number(normalized.paidDownpayment || 0)
  );

  if (gap > 0) {
    return Math.min(Number(normalized.remainingBalance || 0), gap);
  }

  return Number(normalized.remainingBalance || 0) > 0 ? 1 : 0;
}

function getDefaultServicePaymentAmount(serviceRecord = {}, paymentMode = "full") {
  const normalized = normalizeBillingServiceRecord(serviceRecord);
  const remainingBalance = Number(normalized.remainingBalance || 0);

  if (paymentMode === "full") {
    return remainingBalance;
  }

  const gap = Math.max(
    0,
    Number(normalized.requiredDownpayment || 0) - Number(normalized.paidDownpayment || 0)
  );

  if (gap > 0) {
    return Math.min(remainingBalance, gap);
  }

  return remainingBalance;
}

function isRemainingBalanceOnlyService(serviceRecord = {}) {
  const normalized = normalizeBillingServiceRecord(serviceRecord);
  return !isOrthodonticBillingService(normalized.serviceName)
    && Number(normalized.totalPaid || 0) > 0
    && Number(normalized.remainingBalance || 0) > 0;
}

function getPendingBillingItem() {
  const pending = JSON.parse(localStorage.getItem("pendingPayment") || "null");
  return pending ? normalizeAppointmentFinancials(pending) : null;
}

function getBillingSelectionsFromPending(item) {
  const normalized = normalizeAppointmentFinancials(item);
  const pending = JSON.parse(localStorage.getItem("pendingPayment") || "null") || {};
  const existingSelections = pending.billingSelections || {};

  const selections = (normalized.services || []).map((serviceRecord, index) => {
    const normalizedService = normalizeBillingServiceRecord(serviceRecord);
    const serviceKey = getBillingSelectionKey(normalizedService, index);
    const isRemainingBalanceOnly = isRemainingBalanceOnlyService(normalizedService);
    const paymentMode = isRemainingBalanceOnly ? "full" : globalBillingPaymentMode;
    const remainingBalance = Number(normalizedService.remainingBalance || 0);

    let amountToPay = 0;
    if (remainingBalance > 0) {
      if (paymentMode === "downpayment") {
        const defaultAmount = getDefaultServicePaymentAmount(normalizedService, "downpayment");
        const minimumAmount = getInstallmentMinimumAmount(normalizedService);
        amountToPay = Math.min(remainingBalance, Math.max(minimumAmount, defaultAmount));
      } else {
        amountToPay = remainingBalance;
      }
    }

    return {
      serviceKey,
      serviceIndex: index,
      serviceRecord: normalizedService,
      isRemainingBalanceOnly,
      paymentMode,
      amountToPay
    };
  });
  const fees = window.GMAdditionalFees.paymentSummary(normalized);
  if (fees.total > 0 && normalized.recordType !== "treatment_plan") {
    selections.push({
      serviceKey: "additional-fees",
      serviceIndex: -1,
      isAdditionalFee: true,
      isRemainingBalanceOnly: true,
      paymentMode: "full",
      amountToPay: fees.remaining,
      serviceRecord: {
        serviceName: "Additional Fees",
        price: fees.total,
        totalPaid: fees.paid,
        remainingBalance: fees.remaining,
        paymentMode: "full",
        paymentStatus: fees.remaining <= 0 ? "Paid" : fees.paid > 0 ? "Partial" : "Unpaid"
      }
    });
  }
  return selections;
}

function storeBillingSelections(item, selections) {
  const normalized = normalizeAppointmentFinancials(item);
  const billingSelections = {};

  (Array.isArray(selections) ? selections : []).forEach(selection => {
    billingSelections[selection.serviceKey] = {
      serviceKey: selection.serviceKey,
      paymentMode: selection.paymentMode === "installment"
        ? "installment"
        : selection.paymentMode === "downpayment"
          ? "downpayment"
          : "full",
      amountToPay: Math.max(0, Number(selection.amountToPay || 0))
    };
  });

  const nextPending = {
    ...normalized,
    billingSelections
  };

  localStorage.setItem("pendingPayment", JSON.stringify(nextPending));
  return nextPending;
}

function getBillingStageLabel(selections = []) {
  const payableSelections = selections.filter(selection => Number(selection.serviceRecord?.remainingBalance || 0) > 0);
  if (!payableSelections.length) return "Paid";

  const downpaymentCount = payableSelections.filter(selection => selection.paymentMode === "downpayment").length;
  const installmentCount = payableSelections.filter(selection => selection.paymentMode === "installment").length;
  if (!installmentCount && !downpaymentCount) return "Full Payment";
  if (installmentCount === payableSelections.length) return "Installment";
  if (downpaymentCount === payableSelections.length) return "Downpayment";
  return "Mixed Payment";
}

function formatBillingPaymentModeLabel(mode = "", serviceRecord = {}) {
  if (isRemainingBalanceOnlyService(serviceRecord)) return "Pay Remaining Balance";
  if (mode === "installment") return "Installment / Downpayment";
  if (mode === "downpayment") return "Downpayment";
  return "Full Payment";
}

function getBillingSummaryPeople(item = {}) {
  const dependents = Array.isArray(item.dependents)
    ? item.dependents
    : Array.isArray(item.participants)
      ? item.participants.slice(1)
      : [];

  if (dependents.length) {
    return `${item.patientName || "Patient"} + ${dependents.length} dependent${dependents.length > 1 ? "s" : ""}`;
  }

  return item.patientName || currentPatientUser?.name || "Patient";
}

function ensureBillingServiceEditor() {
  const form = document.getElementById("billingForm");
  if (!form) return null;

  let panel = document.getElementById("billingServiceEditor");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "billingServiceEditor";
    panel.className = "billing-panel billing-service-editor";

    const amountPanel = document.getElementById("downPaymentWrapper");
    const paymentMethodsPanel = form.querySelector(".payment-methods-section");

    if (amountPanel && amountPanel.parentNode === form) {
      form.insertBefore(panel, amountPanel.nextSibling);
    } else if (paymentMethodsPanel) {
      form.insertBefore(panel, paymentMethodsPanel);
    } else {
      form.appendChild(panel);
    }
  }

  return panel;
}

function setBillingPaymentMethod(method = "gcash") {
  const safeMethod = method === "cash" ? "cash" : "gcash";
  const paymentMethodInput = document.getElementById("paymentMethod");
  const confirmBtn = document.getElementById("confirmPaymentBtn");

  if (paymentMethodInput) paymentMethodInput.value = safeMethod;
  if (confirmBtn) confirmBtn.textContent = safeMethod === "cash" ? "Submit Cash Payment for Approval" : "Submit Receipt for Review";

  document.querySelectorAll(".payment-card").forEach(card => {
    const isActive = card.getAttribute("data-method") === safeMethod;
    card.classList.toggle("active", isActive);
    card.setAttribute("aria-checked", String(isActive));
    card.setAttribute("tabindex", isActive ? "0" : "-1");
  });

  document.querySelectorAll(".payment-form").forEach(form => form.classList.add("d-none"));
  document.getElementById(`${safeMethod}Form`)?.classList.remove("d-none");
}

function renderBillingSummaryEnhanced(item) {
  const receiptStatus = document.getElementById("receiptPendingStatus");
  if (receiptStatus) {
    const db = getClinicDb();
    const record = [...(db.appointments || []), ...(db.treatmentPlans || [])].find(row => String(row.id) === String(item.id));
    const latest = (record?.paymentProofs || []).slice(-1)[0];
    receiptStatus.textContent = latest ? `${latest.method === "cash" ? "Cash payment" : `Receipt ${latest.reference}`}: ${latest.status === "pending" ? "Awaiting staff verification" : latest.status}${latest.rejectionReason ? " - " + latest.rejectionReason : ""}` : "";
  }
  const normalized = normalizeAppointmentFinancials(item);
  const selections = getBillingSelectionsFromPending(normalized);
  const amountToPayNow = selections.reduce((sum, selection) => sum + Math.max(0, Number(selection.amountToPay || 0)), 0);
  const remainingAfterPayment = Math.max(0, Number(normalized.remainingBalance || 0) - amountToPayNow);
  const statusText =
    normalized.paymentStatus === "Pending" ? "Pending approval" : normalized.paymentStatus === "Paid"
      ? "Paid"
      : normalized.paymentStatus === "Partial"
        ? "Partially Paid"
        : "Awaiting Payment";

  const billingStatus = document.getElementById("billingStatus");
  const statusBadge = document.getElementById("billingSummaryStatusBadge");
  const dentistEl = document.getElementById("billingSummaryDentist");
  const dateTimeEl = document.getElementById("billingSummaryDateTime");
  const peopleEl = document.getElementById("billingSummaryPeople");
  const servicesEl = document.getElementById("billingSummaryServices");
  const summaryTotal = document.getElementById("summaryTotal");
  const summaryDownPayment = document.getElementById("summaryDownPayment");
  const summaryRemaining = document.getElementById("summaryRemaining");
  const paymentNowLabel = summaryDownPayment?.closest(".breakdown-row")?.querySelector("span");
  const heroModeEl = document.getElementById("billingHeroMode");

  if (billingStatus) billingStatus.textContent = statusText;
  if (statusBadge) statusBadge.textContent = statusText;
  if (dentistEl) dentistEl.textContent = normalized.dentist || normalized.dentistName || "-";
  if (dateTimeEl) dateTimeEl.textContent = normalized.schedule || buildSchedule(normalized.date || "", normalized.time || "") || "-";
  if (peopleEl) peopleEl.textContent = getBillingSummaryPeople(normalized);
  if (paymentNowLabel) paymentNowLabel.textContent = "Amount To Pay Now";
  if (summaryTotal) summaryTotal.textContent = formatBillingCurrency(normalized.price || 0);
  if (summaryDownPayment) summaryDownPayment.textContent = formatBillingCurrency(amountToPayNow);
  if (summaryRemaining) summaryRemaining.textContent = formatBillingCurrency(remainingAfterPayment);
  if (heroModeEl) heroModeEl.textContent = getBillingStageLabel(selections);

  if (servicesEl) {
    servicesEl.innerHTML = selections.length
      ? selections.map(selection => `
          <li>
            <strong>${selection.serviceRecord.serviceName}</strong><br>
            <small>
              ${formatBillingPaymentModeLabel(selection.paymentMode, selection.serviceRecord)} • Pay now ${formatBillingCurrency(selection.amountToPay)} • Paid ${formatBillingCurrency(selection.serviceRecord.totalPaid)} • Remaining ${formatBillingCurrency(Math.max(0, Number(selection.serviceRecord.remainingBalance || 0) - Number(selection.amountToPay || 0)))}
            </small>
          </li>
        `).join("")
      : `<li>No services selected.</li>`;
  }
}

function syncBillingAmountDisplay(item) {
  const normalized = item ? normalizeAppointmentFinancials(item) : getPendingBillingItem();
  const selections = normalized ? getBillingSelectionsFromPending(normalized) : [];
  const amountToPayNow = selections.reduce((sum, selection) => sum + Math.max(0, Number(selection.amountToPay || 0)), 0);
  const heroAmount = document.getElementById("billTotal");
  const amountInput = document.getElementById("billDown");
  const gcashAmount = document.getElementById("gcashAmountDisplay");
  const remainingEl = document.getElementById("billRemaining");
  const remainingAfterPayment = Math.max(0, Number(normalized?.remainingBalance || 0) - amountToPayNow);
  const displayAmount = amountToPayNow > 0 ? amountToPayNow : Number(normalized?.remainingBalance || normalized?.price || 0);

  if (heroAmount) heroAmount.textContent = formatBillingCurrency(displayAmount);
  if (amountInput) {
    amountInput.value = String(amountToPayNow > 0 ? amountToPayNow : 0);
    amountInput.readOnly = true;
    amountInput.min = "0";
    amountInput.max = String(Math.max(0, Number(normalized?.remainingBalance || 0)));
  }
  if (gcashAmount) gcashAmount.textContent = formatBillingCurrency(displayAmount);
  if (remainingEl) remainingEl.textContent = formatBillingCurrency(remainingAfterPayment);
}

function refreshBillingWorkspace(item) {
  const normalized = normalizeAppointmentFinancials(item);
  const nextPending = storeBillingSelections(normalized, getBillingSelectionsFromPending(normalized));
  renderBillingServiceEditor(nextPending);
  renderBillingSummaryEnhanced(nextPending);
  syncBillingAmountDisplay(nextPending);
  return nextPending;
}

function updateBillingSelection(serviceKey, patch = {}, options = {}) {
  const pending = getPendingBillingItem();
  if (!pending) return;

  const selections = getBillingSelectionsFromPending(pending).map(selection => {
    if (selection.serviceKey !== serviceKey) return selection;

    const serviceRecord = normalizeBillingServiceRecord(selection.serviceRecord);
    const isOrthodontic = isOrthodonticBillingService(serviceRecord.serviceName);
    const isRemainingBalanceOnly = isRemainingBalanceOnlyService(serviceRecord);
    const paymentMode = isRemainingBalanceOnly
      ? "full"
      : isOrthodontic
        ? (patch.paymentMode === "installment" ? "installment" : "full")
        : (patch.paymentMode === "downpayment" ? "downpayment" : "full");
    const modeChanged = patch.paymentMode != null && paymentMode !== selection.paymentMode;
    let amountToPay = 0;

    if (Number(serviceRecord.remainingBalance || 0) > 0) {
      if (paymentMode !== "full") {
        const minimumAmount = getInstallmentMinimumAmount(serviceRecord);
        const defaultAmount = getDefaultServicePaymentAmount(serviceRecord, paymentMode);
        const fallbackAmount = modeChanged ? defaultAmount : (selection.amountToPay || defaultAmount);
        const requestedAmount = Number(patch.amountToPay != null ? patch.amountToPay : fallbackAmount);
        amountToPay = Math.min(
          Number(serviceRecord.remainingBalance || 0),
          Math.max(minimumAmount, requestedAmount || defaultAmount)
        );
      } else {
        amountToPay = Number(serviceRecord.remainingBalance || 0);
      }
    }

    return {
      ...selection,
      isRemainingBalanceOnly,
      paymentMode,
      amountToPay
    };
  });

  const nextPending = storeBillingSelections(pending, selections);
  if (options.rerenderEditor === false) {
    renderBillingSummaryEnhanced(nextPending);
    syncBillingAmountDisplay(nextPending);
    return;
  }

  refreshBillingWorkspace(nextPending);
}

function renderBillingServiceEditor(item) {
  const normalized = normalizeAppointmentFinancials(item);
  const panel = ensureBillingServiceEditor();
  if (!panel) return;

  const paymentTypeSection = document.querySelector(".payment-type-section");
  if (paymentTypeSection) paymentTypeSection.classList.add("d-none");

  const selections = getBillingSelectionsFromPending(normalized);
  if (!selections.length) {
    panel.innerHTML = `<div class="text-muted">No services found for this appointment.</div>`;
    return;
  }

  const combinedTotal = selections.reduce((sum, s) => sum + Number(s.amountToPay || 0), 0);
  const hasDownpaymentEligible = selections.some(s => !s.isRemainingBalanceOnly && Number(s.serviceRecord.remainingBalance || 0) > 0);

  panel.innerHTML = `
    <div class="billing-panel-head billing-service-editor-head mb-3">
      <label class="form-label fw-semibold mb-0">Services and Additional Fees</label>
      <span class="billing-panel-caption">Payment mode applies to services. Additional fees are paid in full.</span>
    </div>
    ${hasDownpaymentEligible ? `
      <div class="mb-3">
        <label class="form-label small fw-semibold">Payment Mode</label>
        <select class="form-select global-billing-mode-select">
          <option value="full" ${globalBillingPaymentMode === "full" ? "selected" : ""}>Full Payment</option>
          <option value="downpayment" ${globalBillingPaymentMode === "downpayment" ? "selected" : ""}>Downpayment</option>
        </select>
      </div>
    ` : ""}
    <div class="d-grid gap-3">
      ${selections.map(selection => {
        const service = selection.serviceRecord;
        return `
          <div class="billing-service-card">
            <div class="billing-service-card-top">
              <div class="billing-service-meta">
                <div class="billing-service-title">${service.serviceName}</div>
                <div class="billing-service-submeta">Price: ${formatBillingCurrency(service.price)}</div>
                <div class="billing-service-submeta">Paid so far: ${formatBillingCurrency(service.totalPaid)}</div>
                <div class="billing-service-submeta">Remaining: ${formatBillingCurrency(service.remainingBalance)}</div>
              </div>
              <span class="billing-service-status">${service.paymentStatus}</span>
            </div>
            <div class="billing-service-amount-row">
              <span class="billing-service-amount-label">Amount to Pay</span>
              <span class="billing-service-amount-value">${formatBillingCurrency(selection.amountToPay)}</span>
            </div>
          </div>
        `;
      }).join("")}
      ${selections.length > 1 ? `
        <div class="billing-combined-total-row">
          <span class="billing-combined-total-label">Combined Total</span>
          <span class="billing-combined-total-value">${formatBillingCurrency(combinedTotal)}</span>
        </div>
      ` : ""}
    </div>
  `;

  panel.querySelector(".global-billing-mode-select")?.addEventListener("change", (e) => {
    globalBillingPaymentMode = e.target.value;
    const currentPending = getPendingBillingItem();
    if (currentPending) refreshBillingWorkspace(currentPending);
  });
}

function initializeBillingEventBindings() {
  const billingForm = document.getElementById("billingForm");
  if (billingForm && !billingForm.dataset.billingBound) {
    billingForm.addEventListener("submit", handleServiceLevelPaymentSubmit);
    billingForm.dataset.billingBound = "true";
  }

  document.querySelectorAll(".payment-card").forEach(card => {
    if (card.dataset.billingBound === "true") return;
    card.addEventListener("click", () => {
      setBillingPaymentMethod(card.getAttribute("data-method") || "gcash");
    });
    card.dataset.billingBound = "true";
  });

  const currentMethod = document.getElementById("paymentMethod")?.value || "gcash";
  setBillingPaymentMethod(currentMethod);
}

let billingSubmitLocked = false;
let globalBillingPaymentMode = "full";

async function handleServiceLevelPaymentSubmit(e) {
  e?.preventDefault?.();
  if (billingSubmitLocked) return;

  const pending = getPendingBillingItem();
  if (!pending || !pending.id) {
    showToast("No billing record selected ❗");
    return;
  }

  const current = resolveBillingTargetRecord(pending);
  if (!current) {
    showToast("Billing record not found ❗");
    return;
  }

  if (!canOpenBillingForAppointment(current)) {
    showToast("You can only pay once the clinic record is approved or ongoing.");
    return;
  }

  const item = resolveBillingTargetRecord(current);
  if (item.remainingBalance <= 0) {
    showToast("This billing record is already fully paid.");
    return;
  }

  const method = document.getElementById("paymentMethod")?.value || document.querySelector(".payment-card.active")?.getAttribute("data-method") || "gcash";
  const selections = getBillingSelectionsFromPending(item);
  const payableSelections = selections.filter(selection => Number(selection.amountToPay || 0) > 0 && Number(selection.serviceRecord.remainingBalance || 0) > 0);

  if (!payableSelections.length) {
    showToast("Select at least one service or additional fee payment before confirming.");
    return;
  }

  for (const selection of payableSelections) {
    const service = normalizeBillingServiceRecord(selection.serviceRecord);
    const isOrthodontic = isOrthodonticBillingService(service.serviceName);
    const isRemainingBalanceOnly = isRemainingBalanceOnlyService(service);
    const amountToPay = Number(selection.amountToPay || 0);
    const remainingBalance = Number(service.remainingBalance || 0);

    if (amountToPay <= 0) {
      showToast(`Enter a valid amount for ${service.serviceName}.`);
      return;
    }

    if (amountToPay > remainingBalance) {
      showToast(`Payment for ${service.serviceName} cannot exceed its remaining balance.`);
      return;
    }

    if (isRemainingBalanceOnly && amountToPay !== remainingBalance) {
      showToast(`Remaining balance for ${service.serviceName} must be settled in full.`);
      return;
    }

    if (selection.paymentMode === "full" && amountToPay !== remainingBalance) {
      showToast(`Full payment for ${service.serviceName} must match the full remaining balance.`);
      return;
    }

    if (selection.paymentMode !== "full") {
      const minimumAmount = getInstallmentMinimumAmount(service);
      if (amountToPay < minimumAmount) {
        showToast(`Minimum ${selection.paymentMode === "installment" ? "installment" : "downpayment"} for ${service.serviceName} is ${formatBillingCurrency(minimumAmount)}.`);
        return;
      }
    }
  }

  if (method === "cash") {
    billingSubmitLocked = true;
    try {
      const amount = Math.round(payableSelections.reduce((sum, selection) => sum + Number(selection.amountToPay), 0) * 100) / 100;
      const updater = record => {
        if ((record.paymentProofs || []).some(p => p.status === "pending")) throw new Error("A payment for this bill is already awaiting review.");
        const proof = { id: crypto.randomUUID(), method: "cash", status: "pending", amount,
          submittedAt: new Date().toISOString(), balanceAtSubmission: Number(item.remainingBalance), services: item.services,
          allocations: payableSelections.map(s => ({ serviceIndex: s.serviceIndex, serviceName: s.serviceRecord.serviceName,
            amount: Number(s.amountToPay), paymentMode: s.paymentMode, isAdditionalFee: !!s.isAdditionalFee })) };
        return window.GMPaymentReceipts.submitCash(record, proof);
      };
      const saved = item.recordType === "treatment_plan" ? updateTreatmentPlanById(item.treatmentId || item.id, updater) : updateAppointmentById(item.id, updater);
      if (!saved) throw new Error("Unable to submit cash payment.");
      refreshBillingWorkspace(resolveBillingTargetRecord(saved));
      renderAllPatientUI?.();
      showToast("Cash payment is pending Admin or Staff approval. Your balance will update after cash is received.");
      window.GmDentalSupabaseSync?.flushNow?.();
    } catch (error) { showToast(error.message || "Unable to submit cash payment."); }
    finally { billingSubmitLocked = false; }
    return;
  }

  if (method === "gcash") {
    billingSubmitLocked = true;
    try {
      const db = getClinicDb();
      const collection = item.recordType === "treatment_plan" ? db.treatmentPlans : db.appointments;
      const source = (collection || []).find(row => item.recordType === "treatment_plan"
        ? String(row.treatmentId || row.id) === String(item.treatmentId || item.id)
        : String(row.id) === String(item.id));
      if ((source?.paymentProofs || []).some(proof => proof.status === "pending")) throw new Error("A receipt for this bill is already awaiting staff review.");
      const receipt = window.GMReceiptUpload.get();
      const amount = Math.round(payableSelections.reduce((sum, selection) => sum + Number(selection.amountToPay || 0), 0) * 100) / 100;
      if (!receipt) throw new Error("Upload a receipt image first.");
      const proof = { ...receipt, id: crypto.randomUUID(), status: "pending", submittedAt: new Date().toISOString(),
        services: item.services, balanceAtSubmission: Number(item.remainingBalance),
        allocations: payableSelections.map(selection => ({ serviceIndex: selection.serviceIndex, serviceName: selection.serviceRecord.serviceName,
          amount: Number(selection.amountToPay), paymentMode: selection.paymentMode, isAdditionalFee: !!selection.isAdditionalFee })) };
      let decision;
      const updater = record => {
        const updated = window.GMPaymentReceipts.autoReview(record, proof, amount, db);
        decision = updated.paymentProofs.find(p => p.id === proof.id);
        return updated;
      };
      const saved = item.recordType === "treatment_plan" ? updateTreatmentPlanById(item.treatmentId || item.id, updater) : updateAppointmentById(item.id, updater);
      if (!saved) throw new Error("Unable to save receipt. Please try again.");
      const synced = await window.GmDentalSupabaseSync?.flushNow?.();
      if (!synced) throw new Error("Receipt saved on this device, but the server has not confirmed it. Reconnect and refresh before submitting another payment.");
      window.GMReceiptUpload.reset();
      const updatedBilling = resolveBillingTargetRecord(saved);
      if (decision.status === "verified") {
        localStorage.removeItem("pendingPayment");
        renderAllPatientUI?.();
        if (updatedBilling.remainingBalance > 0) {
          localStorage.setItem("pendingPayment", JSON.stringify(updatedBilling));
          refreshBillingWorkspace(updatedBilling);
        } else {
          showSection("my-appointments");
          openInvoiceModal(updatedBilling.treatmentId || updatedBilling.id);
        }
      }
      const message = decision.status === "verified" ? `Receipt approved. ${formatBillingCurrency(decision.amount)} deducted from your bill. Remaining balance: ${formatBillingCurrency(updatedBilling.remainingBalance)}.` : decision.status === "pending" ? "Receipt submitted for staff review. Some image details could not be read confidently. Your balance will update after approval." : `Receipt automatically rejected: ${decision.rejectionReason}`;
      document.getElementById("receiptPendingStatus").textContent = message;
      showToast(message, decision.status === "rejected" ? "error" : decision.status === "pending" ? "warning" : "success");
      pushDentistNotification(`${item.patientName || "Patient"}: ${message}`, { appointmentId: item.id, eventType: "payment_review" });
    } catch (error) { showToast(error.message || "Unable to submit receipt.", "error"); }
    finally { billingSubmitLocked = false; }
    return;
  }

  billingSubmitLocked = true;

  const isTreatmentCase = item.recordType === "treatment_plan";
  const totalPaymentAmount = payableSelections.reduce((sum, selection) => sum + Number(selection.amountToPay || 0), 0);

  const updated = isTreatmentCase
    ? updateTreatmentPlanById(item.treatmentId || item.id, (plan) => {
        let serviceRecord = normalizeBillingServiceRecord({
          serviceName: plan.serviceName || plan.service || "Orthodontic Treatment",
          price: Number(plan.totalCost || plan.price || 0),
          paymentMode: "installment",
          paidDownpayment: Number(plan.downPayment || 0),
          totalPaid: Number(plan.amountPaid || plan.totalCollected || 0),
          paymentStatus: Number(plan.remainingBalance || 0) <= 0 ? "Paid" : Number(plan.amountPaid || plan.totalCollected || 0) > 0 ? "Installment Ongoing" : "Unpaid",
          serviceStatus: String(plan.status || "Active") === "Completed" ? "Completed" : "Active"
        });

        const selection = payableSelections[0];
        const requestedAmount = Math.min(Number(selection?.amountToPay || 0), Number(serviceRecord.remainingBalance || 0));
        const paymentMode = selection?.paymentMode === "installment" ? "installment" : "full";
        const paymentMeta = {
          source: method === "cash" ? "clinic" : "online",
          method,
          note: paymentMode === "installment" ? "Installment payment recorded" : "Full payment recorded",
          paidAt: new Date().toISOString()
        };

        serviceRecord = normalizeBillingServiceRecord({ ...serviceRecord, paymentMode });

        if (paymentMode === "installment") {
          const downpaymentGap = Math.max(
            0,
            Number(serviceRecord.requiredDownpayment || 0) - Number(serviceRecord.paidDownpayment || 0)
          );
          const appliedToDownpayment = Math.min(requestedAmount, downpaymentGap);

          if (appliedToDownpayment > 0) {
            serviceRecord = addPaymentToServiceRecord(serviceRecord, appliedToDownpayment, paymentMeta, {
              applyToDownpayment: true
            });
          }

          const extraPayment = requestedAmount - appliedToDownpayment;
          if (extraPayment > 0) {
            serviceRecord = addPaymentToServiceRecord(serviceRecord, extraPayment, paymentMeta);
          }
        } else {
          serviceRecord = addPaymentToServiceRecord(serviceRecord, requestedAmount, paymentMeta);
        }

        const nextOnline = Number(plan.amountPaidOnline || 0) + (method === "gcash" ? requestedAmount : 0);
        const nextClinic = Number(plan.amountPaidInClinic || 0) + (method === "cash" ? requestedAmount : 0);

        return {
          ...plan,
          downPayment: Number(serviceRecord.paidDownpayment || 0),
          amountPaid: Number(serviceRecord.totalPaid || 0),
          amountPaidOnline: nextOnline,
          amountPaidInClinic: nextClinic,
          totalCollected: Number(serviceRecord.totalPaid || 0),
          remainingBalance: Number(serviceRecord.remainingBalance || 0),
          paymentMethod: method,
          updatedAt: new Date().toISOString()
        };
      })
    : updateAppointmentById(item.id, (apt) => {
        const currentServices = getNormalizedAppointmentServices({
          ...apt,
          services: item.billingSource === "mixed_appointment" && String(item.id || "") === String(apt.id || "")
            ? item.services
            : apt.services
        }, {
          visitStatus: apt.visitStatus || apt.status || item.lifecycleStatus || item.status || "Pending"
        });
        const selectionsByIndex = new Map(payableSelections.map(selection => [selection.serviceIndex, selection]));
        let appliedAmount = 0;

        const nextServices = currentServices.map((serviceRecord, index) => {
          const selection = selectionsByIndex.get(index);
          if (!selection) return normalizeBillingServiceRecord(serviceRecord);

          let nextRecord = normalizeBillingServiceRecord(serviceRecord);
          const requestedAmount = Math.min(Number(selection.amountToPay || 0), Number(nextRecord.remainingBalance || 0));
          if (requestedAmount <= 0) return nextRecord;

          appliedAmount += requestedAmount;
          const paymentMode = selection.paymentMode === "installment" && isOrthodonticBillingService(nextRecord.serviceName)
            ? "installment"
            : selection.paymentMode === "downpayment"
              ? "downpayment"
              : "full";
          const paymentMeta = {
            source: method === "cash" ? "clinic" : "online",
            method,
            note: paymentMode === "installment"
              ? "Installment payment recorded"
              : paymentMode === "downpayment"
                ? "Downpayment recorded"
                : "Full payment recorded",
            paidAt: new Date().toISOString()
          };

          nextRecord = normalizeBillingServiceRecord({
            ...nextRecord,
            paymentMode
          });

          if (paymentMode === "installment" || paymentMode === "downpayment") {
            const downpaymentGap = Math.max(
              0,
              Number(nextRecord.requiredDownpayment || 0) - Number(nextRecord.paidDownpayment || 0)
            );
            const appliedToDownpayment = Math.min(requestedAmount, downpaymentGap);

            if (appliedToDownpayment > 0) {
              nextRecord = addPaymentToServiceRecord(nextRecord, appliedToDownpayment, paymentMeta, {
                applyToDownpayment: true
              });
            }

            const extraPayment = requestedAmount - appliedToDownpayment;
            if (extraPayment > 0) {
              nextRecord = addPaymentToServiceRecord(nextRecord, extraPayment, paymentMeta);
            }
          } else {
            nextRecord = addPaymentToServiceRecord(nextRecord, requestedAmount, paymentMeta);
          }

          return normalizeBillingServiceRecord(nextRecord);
        });

        const feeSummary = window.GMAdditionalFees.paymentSummary(apt);
        const feeSelection = payableSelections.find(selection => selection.isAdditionalFee);
        const feePayment = Math.min(Number(feeSelection?.amountToPay || 0), feeSummary.remaining);
        const additionalFeesPaid = Math.round((feeSummary.paid + feePayment) * 100) / 100;
        appliedAmount += feePayment;
        const nextOnline = Number(apt.amountPaidOnline || 0) + (method === "gcash" ? appliedAmount : 0);
        const nextClinic = Number(apt.amountPaidInClinic || 0) + (method === "cash" ? appliedAmount : 0);
        const totals = summarizeAppointmentServices(nextServices, {
          fallbackPrice: window.GMAdditionalFees.serviceTotal(apt),
          fallbackTotalPaid: nextOnline + nextClinic
        });
        const serviceTotal = totals.totalAmount;
        totals.totalAmount = Math.max(0, totals.totalAmount + feeSummary.total - Number(apt.discount?.amount || 0));
        totals.totalPaid += additionalFeesPaid;
        totals.remainingBalance = Math.max(0, totals.totalAmount - totals.totalPaid);
        totals.overallPaymentStatus = totals.remainingBalance <= 0 ? "Paid" : totals.totalPaid > 0 ? "Partial" : "Unpaid";

        return {
          ...apt,
          services: nextServices,
          serviceTotal,
          additionalFeesPaid,
          grandTotal: totals.totalAmount,
          service: apt.service || nextServices.map(service => service.serviceName).join(" + "),
          price: totals.totalAmount,
          paymentMethod: method,
          downPayment: nextServices.reduce((sum, service) => sum + Number(service.paidDownpayment || 0), 0),
          amountPaidOnline: nextOnline,
          amountPaidInClinic: nextClinic,
          totalCollected: totals.totalPaid,
          remainingBalance: totals.remainingBalance,
          paymentStatus: totals.overallPaymentStatus,
          requiresDownPayment: totals.requiresDownPayment,
          minimumDownPayment: totals.minimumDownPayment
        };
      });

  billingSubmitLocked = false;

  if (!updated) {
    showToast("Unable to record payment right now.");
    return;
  }

  localStorage.removeItem("pendingPayment");

  const normalizedUpdated = isTreatmentCase
    ? normalizeTreatmentBillingItem(updated)
    : normalizeAppointmentFinancials(updated);
  if (normalizedUpdated.paymentStatus === "Paid") {
    showToast("Payment completed successfully 💳");
    addNotification?.(`Full payment recorded for ${normalizedUpdated.service}.`);
    pushDentistNotification(
      `${normalizedUpdated.patientName} completed payment for ${normalizedUpdated.service} via ${method}.`,
      {
        patientId: normalizedUpdated.patientId,
        appointmentId: isTreatmentCase ? "" : normalizedUpdated.id,
        treatmentId: normalizedUpdated.treatmentId || "",
        eventType: isTreatmentCase ? "treatment_paid" : "appointment_paid"
      }
    );
    renderAllPatientUI?.();
    showSection?.("my-appointments");
    openInvoiceModal?.(normalizedUpdated.treatmentId || normalizedUpdated.id);
    return;
  }

  showToast("Payment recorded successfully 💳");
  addNotification?.(`Payment recorded for ${normalizedUpdated.service}.`);
  pushDentistNotification(
    `${normalizedUpdated.patientName} paid ${formatBillingCurrency(totalPaymentAmount)} for ${normalizedUpdated.service} via ${method}.`,
    {
      patientId: normalizedUpdated.patientId,
      appointmentId: isTreatmentCase ? "" : normalizedUpdated.id,
      treatmentId: normalizedUpdated.treatmentId || "",
      eventType: isTreatmentCase ? "treatment_payment_recorded" : "appointment_payment_recorded"
    }
  );

  renderAllPatientUI?.();
  showSection?.("my-appointments");

  selectedBookingServices = [];
  bookingDependents = [];
  syncPrimarySelectedService();
  resetBookingSelectionContext();
  updateSelectedServicesList();
  updateServiceIncludes();
  renderDependentsList();
  updateSummary();
  updateSelectedDentistCard();
}

function handlePaymentSubmit(e) {
  return handleServiceLevelPaymentSubmit(e);
}

let _cancelTargetAppointmentId = null;

function cancelPatientAppointment(id) {
  const apt = getAppointmentById(id);
  if (!apt) {
    showToast("Appointment not found.");
    return;
  }

  if (!canPatientCancel(apt.lifecycleStatus || apt.status)) {
    showToast("Only pending, approved, or reschedule-related appointments can be cancelled.");
    return;
  }

  _cancelTargetAppointmentId = id;
  const reasonInput = document.getElementById("cancelReasonInput");
  if (reasonInput) reasonInput.value = "";

  const totalCollected = Number(normalizeAppointmentFinancials(apt).totalCollected || 0);
  const refundSection = document.getElementById("patientRefundMethodSection");
  const refundSelect = document.getElementById("patientRefundMethodSelect");
  if (refundSection) refundSection.style.display = totalCollected > 0 ? "" : "none";
  if (refundSelect) refundSelect.value = "";
  const gcashSection = document.getElementById("patientGcashNumberSection");
  const gcashInput = document.getElementById("patientGcashNumberInput");
  if (gcashSection) gcashSection.style.display = "none";
  if (gcashInput) gcashInput.value = "";

  const modal = document.getElementById("cancelAppointmentModal");
  if (modal) modal.classList.add("active");
}

function togglePatientGcashField() {
  const val = document.getElementById("patientRefundMethodSelect")?.value;
  const gcashSection = document.getElementById("patientGcashNumberSection");
  const gcashInput = document.getElementById("patientGcashNumberInput");
  if (gcashSection) gcashSection.style.display = val === "GCash" ? "" : "none";
  if (val !== "GCash" && gcashInput) gcashInput.value = "";
}

function closeCancelAppointmentModal() {
  const modal = document.getElementById("cancelAppointmentModal");
  if (modal) modal.classList.remove("active");
  _cancelTargetAppointmentId = null;
}

function confirmCancelAppointment() {
  const id = _cancelTargetAppointmentId;
  if (!id) return;

  const reasonInput = document.getElementById("cancelReasonInput");
  const reason = (reasonInput?.value || "").trim();
  if (!reason) {
    reasonInput?.classList.add("cancel-reason-error");
    reasonInput?.focus();
    showToast("Please provide a reason for cancellation.");
    return;
  }
  reasonInput?.classList.remove("cancel-reason-error");

  const refundSection = document.getElementById("patientRefundMethodSection");
  const refundSelect = document.getElementById("patientRefundMethodSelect");
  const refundVisible = refundSection && refundSection.style.display !== "none";
  const refundMethod = (refundSelect?.value || "").trim();
  if (refundVisible && !refundMethod) {
    refundSelect?.focus();
    showToast("Please select a preferred refund method.");
    return;
  }

  const gcashInput = document.getElementById("patientGcashNumberInput");
  const gcashNumber = (gcashInput?.value || "").trim();
  if (refundMethod === "GCash") {
    if (!gcashNumber) {
      gcashInput?.focus();
      showToast("Please enter your GCash number.");
      return;
    }
    if (!/^09\d{9}$/.test(gcashNumber)) {
      gcashInput?.focus();
      showToast("Please enter a valid GCash number (e.g. 09XXXXXXXXX).");
      return;
    }
  }

  const updated = updateAppointmentById(id, {
    status: "Cancelled",
    visitStatus: "Cancelled",
    lifecycleStatus: "Cancelled",
    cancellationReason: reason,
    ...(refundMethod ? { preferredRefundMethod: refundMethod } : {}),
    ...(gcashNumber ? { refundGcashNumber: gcashNumber } : {})
  });

  localStorage.removeItem("pendingPayment");

  pushDentistNotification(
    `${updated.patientName || "A patient"} cancelled the appointment for ${updated.service} on ${updated.schedule}. Reason: ${reason}${updated.preferredRefundMethod ? ` Preferred refund: ${updated.preferredRefundMethod}${updated.refundGcashNumber ? ` (${updated.refundGcashNumber})` : ""}.` : ""}`,
    {
      patientId: updated.patientId,
      appointmentId: updated.id,
      treatmentId: updated.treatmentId || "",
      sessionId: updated.sessionId || "",
      eventType: updated.treatmentId ? "treatment_session_cancelled" : "appointment_cancelled"
    }
  );

  notifyStaffRefundChoice(updated);
  addNotification?.(`Appointment cancelled for ${updated.service}.`);
  showToast("Appointment cancelled successfully.");

  closeCancelAppointmentModal();
  renderAllPatientUI?.();
}

// ==============================
// REFUND METHOD SELECTION (dentist-cancelled paid appointments)
// ==============================
let _refundSelectionTargetId = null;

function openRefundSelectionModal(id) {
  _refundSelectionTargetId = id;
  const select = document.getElementById("refundSelectionMethodSelect");
  const gcashSection = document.getElementById("refundSelectionGcashSection");
  const gcashInput = document.getElementById("refundSelectionGcashInput");
  if (select) select.value = "";
  if (gcashSection) gcashSection.style.display = "none";
  if (gcashInput) gcashInput.value = "";
  const modal = document.getElementById("refundSelectionModal");
  if (modal) modal.classList.add("active");
}

function closeRefundSelectionModal() {
  const modal = document.getElementById("refundSelectionModal");
  if (modal) modal.classList.remove("active");
  _refundSelectionTargetId = null;
}

function toggleRefundSelectionGcashField() {
  const val = document.getElementById("refundSelectionMethodSelect")?.value;
  const gcashSection = document.getElementById("refundSelectionGcashSection");
  const gcashInput = document.getElementById("refundSelectionGcashInput");
  if (gcashSection) gcashSection.style.display = val === "GCash" ? "" : "none";
  if (val !== "GCash" && gcashInput) gcashInput.value = "";
}

function notifyStaffRefundChoice(updated) {
  const refundMethod = updated.preferredRefundMethod;
  if (!refundMethod) return;
  const db = getClinicDb();
  db.notifications = db.notifications || {};
  db.notifications.staff = safeArray(db.notifications.staff);
  db.notifications.staff.unshift({ id: `refund-choice-${updated.id}-${Date.now()}`, title: "Refund requested", text: `${updated.patientName || "Patient"} selected ${refundMethod} for their refund. Please process the refund${refundMethod === "GCash" ? " and attach proof of transfer" : ""}.`, patientId: updated.patientId, appointmentId: updated.id, eventType: "refund_method_selected", read: false, createdAt: new Date().toISOString() });
  saveClinicDb(db);
}

async function submitRefundSelection() {
  const id = _refundSelectionTargetId;
  if (!id) return;

  const select = document.getElementById("refundSelectionMethodSelect");
  const refundMethod = (select?.value || "").trim();
  if (!refundMethod) {
    select?.focus();
    showToast("Please select a refund method.");
    return;
  }

  const gcashInput = document.getElementById("refundSelectionGcashInput");
  const gcashNumber = (gcashInput?.value || "").trim();
  if (refundMethod === "GCash") {
    if (!gcashNumber) {
      gcashInput?.focus();
      showToast("Please enter your GCash number.");
      return;
    }
    if (!/^09\d{9}$/.test(gcashNumber)) {
      gcashInput?.focus();
      showToast("Please enter a valid GCash number (e.g. 09XXXXXXXXX).");
      return;
    }
  }

  const updated = updateAppointmentById(id, {
    preferredRefundMethod: refundMethod,
    refundMethodPending: false,
    ...(gcashNumber ? { refundGcashNumber: gcashNumber } : {})
  });

  pushDentistNotification(
    `${updated.patientName || "Patient"} has selected their refund method for the cancelled ${updated.service} appointment: ${refundMethod}${gcashNumber ? ` (${gcashNumber})` : ""}.`,
    {
      patientId: updated.patientId,
      appointmentId: updated.id,
      treatmentId: updated.treatmentId || "",
      sessionId: updated.sessionId || "",
      eventType: "refund_method_selected"
    }
  );

  notifyStaffRefundChoice(updated);
  const synced = await window.GmDentalSupabaseSync?.flushNow?.();
  showToast(synced === true ? "Refund method saved. Staff have been notified." : "Refund method saved on this device; notification sync is pending.");
  closeRefundSelectionModal();
  renderAllPatientUI?.();
}

function getPendingRefundMethodAppointment() {
  return getPatientAppointmentsShared({ includeArchived: false }).find(apt => {
    const normalized = normalizeAppointmentFinancials(apt);
    const totalCollected = Number(normalized.totalCollected || 0);
    const totalRefunded = safeArray(normalized.refunds).reduce((sum, refund) => sum + Number(refund.amount || 0), 0);

    return normalizeAppointmentLifecycleStatus(normalized.status || apt.status) === "Cancelled"
      && normalized.refundMethodPending === true
      && totalCollected > totalRefunded;
  }) || null;
}

function promptPendingRefundMethodSelection() {
  const pending = getPendingRefundMethodAppointment();
  if (!pending) return;

  const promptKey = `gm_dental_refund_prompted_${pending.id}`;
  if (sessionStorage.getItem(promptKey) === "true") return;

  sessionStorage.setItem(promptKey, "true");
  window.setTimeout(() => openRefundSelectionModal(pending.id), 150);
}

// ==============================
// TREATMENT DISCONTINUATION FLOW
// ==============================
let _discontinuationTargetTreatmentId = null;

function openDiscontinuationModal(treatmentId) {
  _discontinuationTargetTreatmentId = String(treatmentId || "");
  const reasonInput = document.getElementById("discontinuationReasonInput");
  if (reasonInput) {
    reasonInput.value = "";
    reasonInput.classList.remove("cancel-reason-error");
  }
  const modal = document.getElementById("discontinuationModal");
  if (modal) modal.classList.add("active");
}

function closeDiscontinuationModal() {
  const modal = document.getElementById("discontinuationModal");
  if (modal) modal.classList.remove("active");
  _discontinuationTargetTreatmentId = null;
}

function submitDiscontinuationRequest() {
  const id = _discontinuationTargetTreatmentId;
  if (!id) return;

  const reasonInput = document.getElementById("discontinuationReasonInput");
  const reason = (reasonInput?.value || "").trim();

  if (!reason) {
    reasonInput?.classList.add("cancel-reason-error");
    reasonInput?.focus();
    showToast("Please provide a reason for discontinuation.");
    return;
  }
  reasonInput?.classList.remove("cancel-reason-error");

  const plan = getTreatmentPlanById(id);
  if (!plan) {
    showToast("Treatment plan not found.");
    return;
  }

  if (normalizeTreatmentPlanStatus(plan.status || "") === "Discontinuation Requested") {
    showToast("A discontinuation request is already pending for this treatment.");
    return;
  }

  const updated = updateTreatmentPlanById(id, (currentPlan) => ({
    ...currentPlan,
    status: "Discontinuation Requested",
    discontinuationReason: reason,
    discontinuationRequestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  if (!updated) {
    showToast("Unable to submit request. Please try again.");
    return;
  }

  pushDentistNotification(
    `${plan.patientName || "A patient"} has requested to discontinue their ${plan.serviceName || "Orthodontic Treatment"} treatment. Reason: ${reason}`,
    {
      patientId: plan.patientId,
      treatmentId: id,
      eventType: "treatment_discontinuation_requested"
    }
  );

  pushPatientNotification(
    `Your request to discontinue ${plan.serviceName || "Orthodontic Treatment"} has been submitted and is awaiting dentist approval.`,
    {
      patientId: plan.patientId,
      treatmentId: id,
      eventType: "treatment_discontinuation_requested"
    }
  );

  closeDiscontinuationModal();
  showToast("Discontinuation request submitted. Awaiting dentist approval.");
  addNotification?.(`Discontinuation request submitted for ${plan.serviceName || "Orthodontic Treatment"}.`);
  renderAllPatientUI?.();
}

// ==============================
// FREE CONSULTATION SCHEDULING
// ==============================
let _freeConsultTreatmentId = null;
let _freeConsultSelectedDate = "";
let _freeConsultSelectedTime = "";
let _freeConsultCalendarDate = new Date();
let _freeConsultPeriod = "morning";

// Returns true if any eligible Consultation dentist has an open slot at this date+time
// and the patient has no conflict
function isFreeConsultSlotAvailable(dateString, timeDisplay) {
  const eligible = getEligibleDentistsForService("Consultation");
  const anyDentistOpen = eligible.some(dentist =>
    dentistWorksOnDateAndTime(dentist, dateString, timeDisplay, 20) &&
    !isClinicSlotOccupied(dateString, timeDisplay, "", dentist, 20)
  );
  if (!anyDentistOpen) return false;
  const identity = getCurrentPatientIdentity();
  return !patientHasConflict(identity.email || "", identity.name || "", dateString, timeDisplay, "", 20);
}

function isFreeConsultDateHasAvailability(dateString) {
  return getAllBookingTimeSlots().some(t => isFreeConsultSlotAvailable(dateString, t));
}

function renderFreeConsultCalendar() {
    return withBookingAvailabilitySnapshot(() => renderFreeConsultCalendarFromSnapshot());
}

function renderFreeConsultCalendarFromSnapshot() {
  const daysContainer = document.getElementById("freeConsultCalendarDays");
  const monthLabel   = document.getElementById("freeConsultCalendarMonth");
  if (!daysContainer || !monthLabel) return;

  daysContainer.innerHTML = "";

  const year  = _freeConsultCalendarDate.getFullYear();
  const month = _freeConsultCalendarDate.getMonth();

  monthLabel.textContent = _freeConsultCalendarDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Day-of-week headers
  ["Su","Mo","Tu","We","Th","Fr","Sa"].forEach(label => {
    const h = document.createElement("div");
    h.textContent = label;
    h.style.cssText = "text-align:center;font-size:0.62rem;font-weight:600;color:#94a3b8;padding:3px 0;overflow:hidden;";
    daysContainer.appendChild(h);
  });

  const firstDay  = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const todayOnly = new Date();
  todayOnly.setHours(0, 0, 0, 0);

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-empty";
    daysContainer.appendChild(empty);
  }

  for (let i = 1; i <= totalDays; i++) {
    const day = document.createElement("div");
    day.className = "calendar-day";
    day.textContent = i;

    const dateOnly   = new Date(year, month, i);
    const dateString = `${year}-${month + 1}-${i}`;

    const indicator = document.createElement("span");
    indicator.className = "calendar-indicator";
    day.appendChild(indicator);

    if (dateOnly < todayOnly) {
      day.classList.add("past-day");
    } else {
      if (isFreeConsultDateHasAvailability(dateString)) {
        day.classList.add("has-availability");
      } else {
        day.classList.add("no-availability");
      }
    }

    if (_freeConsultSelectedDate === dateString) day.classList.add("active");

    day.onclick = () => {
      if (day.classList.contains("past-day") || day.classList.contains("no-availability")) return;
      daysContainer.querySelectorAll(".calendar-day").forEach(d => d.classList.remove("active"));
      day.classList.add("active");
      _freeConsultSelectedDate = dateString;
      _freeConsultSelectedTime = "";
      renderFreeConsultTimeSlots();
    };

    daysContainer.appendChild(day);
  }
}

function changeFreeConsultMonth(dir) {
  _freeConsultCalendarDate.setMonth(_freeConsultCalendarDate.getMonth() + dir);
  renderFreeConsultCalendar();
}

function setFreeConsultPeriod(period, el) {
  _freeConsultPeriod = period;
  document.querySelectorAll(".fcb-period-btn").forEach(b => b.classList.remove("active"));
  if (el) el.classList.add("active");
  renderFreeConsultTimeSlots();
}

function renderFreeConsultTimeSlots() {
    return withBookingAvailabilitySnapshot(() => renderFreeConsultTimeSlotsFromSnapshot());
}

function renderFreeConsultTimeSlotsFromSnapshot() {
  const wrap     = document.getElementById("freeConsultTimeSlotsWrap");
  const slotsDiv = document.getElementById("freeConsultTimeSlots");
  if (!wrap || !slotsDiv) return;

  if (!_freeConsultSelectedDate) {
    slotsDiv.innerHTML = '<p id="freeConsultTimePlaceholder" style="grid-column:1/-1;font-size:0.78rem;color:#94a3b8;text-align:center;margin:1rem 0;">Select a date to view available times</p>';
    return;
  }

  const filtered = getAllBookingTimeSlots().filter(t =>
    _freeConsultPeriod === "morning" ? t.includes("AM") : t.includes("PM")
  );

  slotsDiv.innerHTML = "";
  if (_freeConsultSelectedTime && !isFreeConsultSlotAvailable(_freeConsultSelectedDate, _freeConsultSelectedTime)) _freeConsultSelectedTime = "";
  filtered.forEach(time => {
    const btn = document.createElement("div");
    btn.className = "time-btn";
    btn.textContent = time;

    const available = isFreeConsultSlotAvailable(_freeConsultSelectedDate, time);
    if (!available) return;
    if (_freeConsultSelectedTime === time) btn.classList.add("active");

    btn.onclick = () => {
      if (btn.classList.contains("disabled")) return;
      slotsDiv.querySelectorAll(".time-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      _freeConsultSelectedTime = time;
    };

    slotsDiv.appendChild(btn);
  });
  if (!slotsDiv.children.length) slotsDiv.textContent = "No consultation times are available in this period.";
}

function openConsultationSession(treatmentId) {
  const plan = getTreatmentPlanById(String(treatmentId || ""));
  if (!plan) { showToast("Treatment plan not found."); return; }

  // If a session is already booked and still active, show the confirmation card
  if (plan.consultationSessionId) {
    const csltAppt = getAppointmentById(plan.consultationSessionId);
    if (csltAppt && !["Cancelled", "Rejected"].includes(String(csltAppt.status || ""))) {
      openFreeConsultConfirmModal(plan.consultationSessionId, plan);
      return;
    }
  }

  // No session yet (or was cancelled) — open the scheduling modal
  openFreeConsultationModal(treatmentId);
}

function openFreeConsultConfirmModal(appointmentId, plan) {
  const appt = getAppointmentById(appointmentId);
  if (!appt) { showToast("Appointment not found."); return; }

  const el = id => document.getElementById(id);

  if (el("fcconfirmDentist"))  el("fcconfirmDentist").textContent  = appt.dentist || "—";
  if (el("fcconfirmSchedule")) el("fcconfirmSchedule").textContent = appt.schedule || appt.timeDisplay || "—";
  if (el("fcconfirmService"))  el("fcconfirmService").textContent  = appt.service  || "Consultation";
  if (el("fcconfirmStatus"))   el("fcconfirmStatus").textContent   = appt.status   || "—";

  const note = plan?.consultationNote || "";
  const noteRow = el("fcconfirmNoteRow");
  const noteEl  = el("fcconfirmNote");
  if (noteRow && noteEl) {
    if (note) { noteEl.textContent = note; noteRow.style.display = "flex"; }
    else { noteRow.style.display = "none"; }
  }

  const modal = el("freeConsultConfirmModal");
  if (modal) modal.classList.add("active");
}

function closeFreeConsultConfirmModal() {
  const modal = document.getElementById("freeConsultConfirmModal");
  if (modal) modal.classList.remove("active");
}

function openFreeConsultationModal(treatmentId) {
  _freeConsultTreatmentId = String(treatmentId || "");
  _freeConsultSelectedDate = "";
  _freeConsultSelectedTime = "";
  _freeConsultCalendarDate = new Date();
  _freeConsultPeriod = "morning";

  // Show dentist note if present
  const plan = getTreatmentPlanById(_freeConsultTreatmentId);
  const noteBox  = document.getElementById("freeConsultNoteBox");
  const noteText = document.getElementById("freeConsultNoteText");
  if (plan?.consultationNote) {
    if (noteText) noteText.textContent = plan.consultationNote;
    if (noteBox)  noteBox.style.display = "block";
  } else {
    if (noteBox)  noteBox.style.display = "none";
  }

  // Reset period buttons
  document.querySelectorAll(".fcb-period-btn").forEach((b, i) => b.classList.toggle("active", i === 0));

  // Reset time slots to placeholder
  const slotsDiv = document.getElementById("freeConsultTimeSlots");
  if (slotsDiv) slotsDiv.innerHTML = '<p id="freeConsultTimePlaceholder" style="grid-column:1/-1;font-size:0.78rem;color:#94a3b8;text-align:center;margin:1rem 0;">Select a date to view available times</p>';

  // Render the calendar
  renderFreeConsultCalendar();

  const modal = document.getElementById("freeConsultationModal");
  if (modal) modal.classList.add("active");
  void refreshBookingReservations();
}

function closeFreeConsultationModal() {
  const modal = document.getElementById("freeConsultationModal");
  if (modal) modal.classList.remove("active");
  _freeConsultTreatmentId = null;
  _freeConsultSelectedDate = "";
  _freeConsultSelectedTime = "";
}

async function confirmFreeConsultationBooking() {
  if (!_freeConsultTreatmentId) return;
  if (!await refreshBookingReservations()) return;
  if (!_freeConsultSelectedDate) { showToast("Please select a date."); return; }
  if (!_freeConsultSelectedTime) { showToast("Please select a time slot."); return; }

  const plan = getTreatmentPlanById(_freeConsultTreatmentId);
  if (!plan) { showToast("Treatment plan not found."); return; }

  // Final availability guard
  if (!isFreeConsultSlotAvailable(_freeConsultSelectedDate, _freeConsultSelectedTime)) {
    showToast("That slot is no longer available. Please choose another.");
    renderFreeConsultCalendar();
    renderFreeConsultTimeSlots();
    return;
  }

  // Pick first eligible dentist who is free at this slot
  const eligible = getEligibleDentistsForService("Consultation");
  const assignedDentist = eligible.find(d =>
    dentistWorksOnDateAndTime(d, _freeConsultSelectedDate, _freeConsultSelectedTime, 20) &&
    !isClinicSlotOccupied(_freeConsultSelectedDate, _freeConsultSelectedTime, "", d, 20)
  ) || { name: "Dr. Daniel Santos", id: "" };

  const patientIdentity = getCurrentPatientIdentity();
  const patientName  = patientIdentity.name  || (currentPatientUser?.email || "Patient");
  const patientEmail = patientIdentity.email || "";
  const patientId    = patientIdentity.id;

  const appointmentId = createClinicEntityId("cslt");
  const schedule      = buildSchedule(_freeConsultSelectedDate, _freeConsultSelectedTime);

  const newAppt = normalizeAppointmentFinancials({
    id: appointmentId,
    createdBy: "patient",
    approvalMode: "auto",
    requiresManualApproval: false,
    patientId,
    patientName,
    patientEmail,
    dentist: assignedDentist.name || "Dr. Daniel Santos",
    dentistId: assignedDentist.id || "",
    service: "Consultation",
    price: 0,
    date: _freeConsultSelectedDate,
    durationMinutes: 20,
    endTime: BookingTime.clock(BookingTime.minutes(_freeConsultSelectedTime) + 20),
    time: convertDisplayTimeTo24(_freeConsultSelectedTime),
    timeDisplay: _freeConsultSelectedTime,
    schedule,
    status: "Approved",
    treatmentId: plan.treatmentId || plan.id || "",
    sessionId: `${appointmentId}-session`,
    serviceFlowType: "single_visit",
    isConsultationForDiscontinuation: true,
    paid: true,
    paymentMethod: "complimentary",
    downPayment: 0,
    amountPaidOnline: 0,
    amountPaidInClinic: 0,
    totalCollected: 0,
    remainingBalance: 0,
    invoiceUnlocked: true,
    notes: `Free consultation for discontinuation request.${plan.consultationNote ? ` Dentist note: ${plan.consultationNote}` : ""}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const appointments = getAppointmentsShared();
  if (!await reservePatientAppointment(newAppt)) return;
  appointments.unshift(newAppt);
  saveAppointmentsShared(appointments);

  updateTreatmentPlanById(_freeConsultTreatmentId, current => ({
    ...current,
    consultationSessionId: appointmentId,
    updatedAt: new Date().toISOString()
  }));

  pushDentistNotification(
    `${patientName} has booked their free discontinuation consultation for ${plan.serviceName || "Orthodontic Treatment"} on ${schedule}.`,
    {
      patientId,
      treatmentId: plan.treatmentId || plan.id,
      appointmentId,
      eventType: "consultation_booked_for_discontinuation"
    }
  );

  closeFreeConsultationModal();
  showToast(`Consultation booked for ${schedule}.`);
  renderAllPatientUI?.();
}

// Patient withdraws their discontinuation request from either "Discontinuation Requested" or "Pending Consultation"
function withdrawDiscontinuationRequest(treatmentId) {
  const plan = getTreatmentPlanById(String(treatmentId || ""));
  if (!plan) { showToast("Treatment plan not found."); return; }

  const currentStatus = normalizeTreatmentPlanStatus(plan.status || "");
  if (!["Discontinuation Requested", "Pending Consultation"].includes(currentStatus)) {
    showToast("No active discontinuation request to withdraw.");
    return;
  }

  const sessionIdToCancel = plan.consultationSessionId;

  updateTreatmentPlanById(treatmentId, current => ({
    ...current,
    status: "Active",
    discontinuationReason: "",
    discontinuationRequestedAt: "",
    consultationNote: "",
    consultationSessionId: "",
    consultationRequestedAt: "",
    updatedAt: new Date().toISOString()
  }));

  // Cancel the free consultation appointment if it hasn't been completed yet
  if (sessionIdToCancel) {
    const csltAppt = getAppointmentById(sessionIdToCancel);
    if (csltAppt && !["Completed", "Cancelled"].includes(String(csltAppt.status || ""))) {
      updateAppointmentById(sessionIdToCancel, current => ({
        ...current,
        status: "Cancelled",
        notes: (current.notes || "") + " [Cancelled: patient withdrew discontinuation request]"
      }));
    }
  }

  pushDentistNotification(
    `${plan.patientName || "A patient"} has withdrawn their discontinuation request for ${plan.serviceName || "Orthodontic Treatment"}. Treatment is now active.`,
    {
      patientId: plan.patientId,
      treatmentId,
      eventType: "treatment_discontinuation_withdrawn"
    }
  );

  showToast("Discontinuation request withdrawn. Your treatment is now active.");
  renderAllPatientUI?.();
}

function getSharedPatients() {
  const db = getClinicDb();
  return Array.isArray(db.patients) ? db.patients : [];
}

function saveSharedPatients(list) {
  const db = getClinicDb();
  db.patients = Array.isArray(list) ? list : [];
  saveClinicDb(db);
}

function syncCurrentPatientToSharedDirectory() {
  const patientSession = currentPatientUser || {};

  const patientName = String(
    patientSession.name ||
    patientSession.fullName ||
    patientSession.email ||
    ""
  ).trim();

  if (!patientName) return;

  const patients = getSharedPatients();
  const key = patientName.toLowerCase();

  const record = {
    id: patientSession.id || `patient-${Date.now()}`,
    name: patientName,
    email: patientSession.email || "",
    age: calculateAge(patientSession.dob),
    gender: patientSession.sex || "",
    condition: patientSession.condition || "",
    address: patientSession.address || "",
    contact: patientSession.mobile || "",
    archived: false,
    updatedAt: new Date().toISOString()
  };

  const existingIndex = patients.findIndex(
    p => String(p.name || "").trim().toLowerCase() === key
  );

  if (existingIndex > -1) {
    patients[existingIndex] = {
      ...patients[existingIndex],
      ...record
    };
  } else {
    patients.unshift(record);
  }

  saveSharedPatients(patients);
}
function buildPatientAppointmentActions(item) {
  const apt = normalizeAppointmentFinancials(item);
  let primaryActions = "";
  const operationalStatus = getOperationalAppointmentStatus(apt);
  const scheduleParts = splitSchedule(apt.schedule || "");
  const safeService = escapeSingleQuote(apt.service || "");
  const safeScheduleDate = escapeSingleQuote(scheduleParts.date || "");
  const safeScheduleTime = escapeSingleQuote(scheduleParts.timeDisplay || "");
  const canAddToCalendar = Boolean(safeService && safeScheduleDate && safeScheduleTime);
  const canReschedule = ["Approved", "Ongoing", "Reschedule Rejected"].includes(operationalStatus);
  const canArchive = ["Rejected", "Cancelled", "Completed"].includes(apt.status);
  const dropdownItems = [];

  if (canPatientCancel(apt.status)) {
    primaryActions += `
      <button class="btn btn-outline-danger btn-sm cancel-btn"
        onclick="cancelPatientAppointment('${apt.id}')">
        Cancel
      </button>
    `;
  }

  const totalCollected = Number(normalizeAppointmentFinancials(apt).totalCollected || 0);
  if (apt.status === "Cancelled" && apt.refundMethodPending === true && totalCollected > 0) {
    primaryActions += `
      <button class="btn btn-warning btn-sm"
        onclick="openRefundSelectionModal('${apt.id}')">
        <i class="bi bi-cash-coin"></i> Choose Refund Method
      </button>
    `;
  }

  if (apt.status === "Approved") {
    if (apt.paymentStatus === "Unpaid") {
      primaryActions += `
        <button class="btn btn-primary btn-sm"
          onclick="openBillingById('${apt.id}')">
          ${apt.requiresDownPayment ? "Pay Down Payment" : "Pay Invoice"}
        </button>
      `;
    } else if (apt.paymentStatus === "Partial") {
      primaryActions += `
        <button class="btn btn-primary btn-sm"
          onclick="openBillingById('${apt.id}')">
          Pay Remaining Balance
        </button>
      `;
    }
  }

  if (canAddToCalendar) {
    dropdownItems.push(`
      <button type="button" class="patient-dropdown-item"
        onclick="handleDropdownAddToCalendar(event, '${safeService}', '${safeScheduleDate}', '${safeScheduleTime}')">
        <i class="bi bi-calendar-plus"></i>
        <span>Add to Calendar</span>
      </button>
    `);
  }

  if (canReschedule) {
    dropdownItems.push(`
      <button type="button" class="patient-dropdown-item"
        onclick="openRowRescheduleModal('${apt.id}'); closeAllPatientActionMenus();">
        <i class="bi bi-calendar2-week"></i>
        <span>Reschedule</span>
      </button>
    `);
  }

  dropdownItems.push(`
    <button type="button" class="patient-dropdown-item"
      onclick="openInvoiceModal('${apt.id}'); closeAllPatientActionMenus();">
      <i class="bi bi-receipt"></i>
      <span>View Invoice</span>
    </button>
  `);

  if (canArchive) {
    dropdownItems.push(`
      <button type="button" class="patient-dropdown-item danger"
        onclick="archiveAppointment('${apt.id}'); closeAllPatientActionMenus();">
        <i class="bi bi-archive"></i>
        <span>Archive</span>
      </button>
    `);
  }
    return `
      <div class="patient-row-actions">
        ${primaryActions}

        <div class="patient-action-menu-wrap">
          <button class="more-toggle"
            type="button"
            onclick="togglePatientActionMenu(event, '${apt.id}')"
            aria-label="More actions">
            <i class="bi bi-three-dots"></i>
          </button>

          <div class="patient-action-dropdown" data-appointment-id="${apt.id}">
            ${dropdownItems.join("")}
          </div>
        </div>
      </div>
    `;
}


function escapeSingleQuote(value = "") {
  return String(value).replace(/'/g, "\\'");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function addToCalendar(service, date, time) {
    if (!service || !date || !time) {
        showToast("Missing appointment details for calendar.");
        return;
    }

    function normalizeDateParts(dateStr) {
        const cleaned = String(dateStr).trim();
        const parts = cleaned.split("-").map(part => part.trim());

        if (parts.length !== 3) return null;

        const year = Number(parts[0]);
        const month = Number(parts[1]);
        const day = Number(parts[2]);

        if (!year || !month || !day) return null;

        return { year, month, day };
    }

    function normalizeTimeTo24(timeStr) {
        const raw = String(timeStr).trim().toUpperCase();

        // supports "4:00 PM"
        let match = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
        if (match) {
            let hour = parseInt(match[1], 10);
            const minute = parseInt(match[2], 10);
            const meridiem = match[3].toUpperCase();

            if (meridiem === "PM" && hour !== 12) hour += 12;
            if (meridiem === "AM" && hour === 12) hour = 0;

            return { hour, minute };
        }

        // supports "16:00"
        match = raw.match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
            return {
                hour: parseInt(match[1], 10),
                minute: parseInt(match[2], 10)
            };
        }

        return null;
    }

    const dateParts = normalizeDateParts(date);
    const timeParts = normalizeTimeTo24(time);

    if (!dateParts || !timeParts) {
        showToast("Invalid appointment date or time for calendar.");
        return;
    }

    const start = new Date(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        timeParts.hour,
        timeParts.minute,
        0
    );

    const end = new Date(start.getTime() + 60 * 60 * 1000);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        showToast("Invalid appointment date or time for calendar.");
        return;
    }

    const formatGoogleDate = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        const h = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return `${y}${m}${day}T${h}${min}00`;
    };

    const googleUrl =
        `https://calendar.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(service)}` +
        `&dates=${formatGoogleDate(start)}/${formatGoogleDate(end)}` +
        `&details=${encodeURIComponent("Dental appointment at G-M Dental Clinic")}` +
        `&location=${encodeURIComponent("G-M Dental Clinic")}`;

    window.open(googleUrl, "_blank", "noopener");
}

function handleDropdownAddToCalendar(event, service, date, time) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    addToCalendar(service, date, time);

    setTimeout(() => {
        closeAllPatientActionMenus();
    }, 50);
}
function getPatientActionBackdrop() {
  return document.getElementById("patientActionBackdrop");
}

function getPatientFloatingActionMenu() {
  let menu = document.getElementById("patientFloatingActionMenu");
  if (menu) return menu;

  menu = document.createElement("div");
  menu.id = "patientFloatingActionMenu";
  menu.className = "patient-floating-action-menu";
  document.body.appendChild(menu);
  return menu;
}

function hidePatientFloatingActionMenu() {
  const floatingMenu = document.getElementById("patientFloatingActionMenu");
  if (!floatingMenu) return;

  floatingMenu.classList.remove("show");
  floatingMenu.innerHTML = "";
  delete floatingMenu.dataset.appointmentId;
  floatingMenu.style.top = "";
  floatingMenu.style.left = "";
}

function positionPatientFloatingActionMenu(toggleButton, floatingMenu) {
  if (!toggleButton || !floatingMenu) return;

  const rect = toggleButton.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const menuWidth = floatingMenu.offsetWidth || 220;
  const menuHeight = floatingMenu.offsetHeight || 0;
  const spacing = 8;

  let left = rect.right - menuWidth;
  left = Math.max(spacing, Math.min(left, viewportWidth - menuWidth - spacing));

  let top = rect.bottom + spacing;
  if (top + menuHeight > viewportHeight - spacing) {
    top = Math.max(spacing, rect.top - menuHeight - spacing);
  }

  floatingMenu.style.left = `${Math.round(left)}px`;
  floatingMenu.style.top = `${Math.round(top)}px`;
}

function clearActivePatientActionLayers() {
  document.querySelectorAll(".patient-row-actions.menu-open").forEach(wrap => {
    wrap.classList.remove("menu-open");
  });

  document.querySelectorAll(".patient-actions-cell-active").forEach(cell => {
    cell.classList.remove("patient-actions-cell-active");
  });

  document.querySelectorAll(".patient-actions-row-active").forEach(row => {
    row.classList.remove("patient-actions-row-active");
  });
}

function closeAllPatientActionMenus() {
  document.querySelectorAll(".patient-action-dropdown").forEach(menu => {
    menu.classList.remove("show");
  });

  document.querySelectorAll(".patient-action-menu-wrap.open").forEach(wrap => {
    wrap.classList.remove("open");
  });

  document.querySelectorAll(".more-toggle").forEach(btn => {
    btn.classList.remove("menu-owner");
  });

  clearActivePatientActionLayers();
  hidePatientFloatingActionMenu();

  document.body.classList.remove("patient-menu-open");

  const backdrop = getPatientActionBackdrop();
  if (backdrop) backdrop.classList.remove("show");
}

function togglePatientActionMenu(event, appointmentId) {
  event.stopPropagation();

  const menuWrap = event.currentTarget?.closest(".patient-action-menu-wrap") || null;
  const localMenu = menuWrap?.querySelector(".patient-action-dropdown") || null;
  const menu = localMenu || document.querySelector(`.patient-action-dropdown[data-appointment-id="${appointmentId}"]`);
  if (!menu) return;

  const toggleButton = event.currentTarget || menu.previousElementSibling;
  const resolvedMenuWrap = menu.closest(".patient-action-menu-wrap");
  const resolvedActionWrap = menu.closest(".patient-row-actions");
  const actionCell = menu.closest("td");
  const actionRow = menu.closest("tr");
  const floatingMenu = getPatientFloatingActionMenu();

  const isOpen = floatingMenu.classList.contains("show")
    && String(floatingMenu.dataset.appointmentId || "") === String(appointmentId);

  closeAllPatientActionMenus();

  if (!isOpen) {
    toggleButton?.classList.add("menu-owner");
    resolvedActionWrap?.classList.add("menu-open");
    actionCell?.classList.add("patient-actions-cell-active");
    actionRow?.classList.add("patient-actions-row-active");
    document.body.classList.add("patient-menu-open");

    floatingMenu.innerHTML = menu.innerHTML;
    floatingMenu.dataset.appointmentId = String(appointmentId);
    floatingMenu.classList.add("show");
    positionPatientFloatingActionMenu(toggleButton, floatingMenu);

    const backdrop = getPatientActionBackdrop();
    if (backdrop) backdrop.classList.add("show");
  }
}

document.addEventListener("click", function (event) {
  if (!event.target.closest(".patient-row-actions") && !event.target.closest(".patient-floating-action-menu")) {
    closeAllPatientActionMenus();
  }
});

function openBillingById(id) {
  const apt = getAppointmentById(id);
  if (!apt) {
    showToast("Appointment not found.");
    return;
  }
  openBilling(apt);
}

document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeAllPatientActionMenus();
  }
});

window.addEventListener("resize", closeAllPatientActionMenus);

function openRowRescheduleModal(id) {
  const appointments = getPatientAppointmentsShared({ includeArchived: false });
  const target = appointments.find(a => String(a.id) === String(id));

  if (!target) {
    showToast("Appointment not found.");
    return;
  }

  const operationalStatus = getOperationalAppointmentStatus(target);
  if (!["Approved", "Ongoing", "Reschedule Rejected"].includes(operationalStatus)) {
    showToast("Only approved or ongoing sessions can be rescheduled.");
    return;
  }

  const hiddenInput = document.getElementById("rescheduleAppointmentId");
  const helperText = document.getElementById("rescheduleHelperText");

  if (hiddenInput) hiddenInput.value = target.id;
  if (helperText) {
    helperText.innerHTML = `Please select a new preferred date for your <strong>${target.service || "appointment"}</strong>.`;
  }

  const modalEl = document.getElementById("rescheduleModal");
  if (!modalEl) {
    showToast("Reschedule modal not found.");
    return;
  }

  const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
  modalInstance.show();
}
function openInvoiceModal(id) {
  const item = resolveBillingTargetRecord(id);
  if (!item) {
    showToast("Billing record not found.");
    return;
  }

  const invoiceDentist = document.getElementById("invoiceDentist");
  const invoicePatient = document.getElementById("invoicePatient");
  const invoiceService = document.getElementById("invoiceService");
  const invoiceSchedule = document.getElementById("invoiceSchedule");
  const invoiceTotal = document.getElementById("invoiceTotal");
  const invoicePaid = document.getElementById("invoicePaid");
  const invoiceRemaining = document.getElementById("invoiceRemaining");
  const invoiceMethod = document.getElementById("invoiceMethod");
  const invoiceStatus = document.getElementById("invoiceStatus");
  const invoiceStatusBadge = document.getElementById("invoiceStatusBadge");
  const invoiceServicesList = document.getElementById("invoiceServicesList");
  const invoiceServiceTotal = document.getElementById("invoiceServiceTotal");
  const invoiceAdditionalFeesTotal = document.getElementById("invoiceAdditionalFeesTotal");
  const invoiceAdditionalFeesList = document.getElementById("invoiceAdditionalFeesList");

  const normalizedStatus = item.paymentStatus === "Partial" ? "Partially Paid" : (item.paymentStatus || "Unpaid");
  const statusClass = item.paymentStatus === "Paid"
    ? "paid"
    : item.paymentStatus === "Partial"
      ? "partial"
      : "unpaid";
  const servicesList = Array.isArray(item.services) ? item.services : [];

  if (invoiceDentist) invoiceDentist.textContent = item.dentist || item.dentistName || "-";
  if (invoicePatient) invoicePatient.textContent = item.patientName || currentPatientUser?.name || "Patient";
  if (invoiceService) invoiceService.textContent = item.service || "-";
  if (invoiceSchedule) invoiceSchedule.textContent = item.schedule || "-";
  const serviceTotal = window.GMAdditionalFees.serviceTotal(item);
  const additionalFees = window.GMAdditionalFees ? GMAdditionalFees.calculate(item.additionalFees || []) : { lines: [], total: Number(item.additionalFeesTotal || 0) };
  const discountRow = document.getElementById("invoiceDiscountRow");
  if (discountRow) { discountRow.hidden = !item.discount?.amount; discountRow.textContent = item.discount?.amount ? `Discount: ${formatBillingCurrency(item.discount.amount)} - Granted by ${item.discount.dentistName || "Dentist"}` : ""; }
  if (invoiceServiceTotal) invoiceServiceTotal.textContent = formatBillingCurrency(serviceTotal);
  if (invoiceAdditionalFeesTotal) invoiceAdditionalFeesTotal.textContent = formatBillingCurrency(additionalFees.total);
  if (invoiceTotal) invoiceTotal.textContent = formatBillingCurrency(Math.max(0, serviceTotal + additionalFees.total - Number(item.discount?.amount || 0)));
  if (invoicePaid) invoicePaid.textContent = formatBillingCurrency(item.totalCollected || 0);
  if (invoiceRemaining) invoiceRemaining.textContent = formatBillingCurrency(item.remainingBalance || 0);
  if (invoiceMethod) invoiceMethod.textContent = item.paymentMethod || "Not yet selected";
  if (invoiceStatus) invoiceStatus.textContent = normalizedStatus;
  if (invoiceStatusBadge) {
    invoiceStatusBadge.textContent = normalizedStatus;
    invoiceStatusBadge.classList.remove("paid", "partial", "unpaid");
    invoiceStatusBadge.classList.add(statusClass);
  }
  if (invoiceServicesList) {
    invoiceServicesList.innerHTML = servicesList.length
      ? servicesList.map(service => `
          <li class="invoice-service-item">
            <div class="invoice-service-line">
              <strong class="invoice-service-name">${service.serviceName}</strong>
              <span class="invoice-service-mode">${formatBillingPaymentModeLabel(service.paymentMode, service)}</span>
            </div>
            <div class="invoice-service-stats">
              <div class="invoice-service-stat">
                <span class="invoice-service-stat-label">Paid</span>
                <strong>${formatBillingCurrency(service.totalPaid)}</strong>
              </div>
              <div class="invoice-service-stat">
                <span class="invoice-service-stat-label">Remaining</span>
                <strong>${formatBillingCurrency(service.remainingBalance)}</strong>
              </div>
              <div class="invoice-service-stat">
                <span class="invoice-service-stat-label">Status</span>
                <strong>${service.paymentStatus}</strong>
              </div>
            </div>
          </li>
        `).join("")
      : `<li>${item.service || "No services found."}</li>`;
  }
  if (invoiceAdditionalFeesList) {
    invoiceAdditionalFeesList.innerHTML = additionalFees.lines.length
      ? additionalFees.lines.map(fee => `<tr><td>${escapeHtml(fee.feeName || fee.name || "Additional Fee")}<small class="d-block">${escapeHtml(fee.description || "")}</small></td><td>${fee.quantity}</td><td>${formatBillingCurrency(fee.unitPrice)}</td><td>${formatBillingCurrency(fee.subtotal)}</td></tr>`).join("")
      : `<tr><td colspan="4">No additional fees</td></tr>`;
  }

  document.getElementById("invoiceModal")?.classList.add("active");
}
function closeInvoiceModal() {
  document.getElementById("invoiceModal")?.classList.remove("active");
}

function openPaymentModal(id) {
  openBilling(id);
}

function submitReview(appointmentId, rating, text) {
  const db = getClinicDb();

  const appt = db.appointments.find(a => a.id === appointmentId);
  if (!appt) return;

  appt.review = text;
  appt.rating = rating;

  saveClinicDb(db);
  triggerGlobalSync();

  showToast("Review submitted!");
}

function archiveAppointment(id) {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

function clearAppointments() {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

function archiveAllHistory() {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

function clearArchive() {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

// Remove all appointments and archived appointments for the patient and refresh UI
function clearAllAppointments() {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

// Function to pull an appointment out of Archive
function restoreFromArchive(id) {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}

// Function to render the Archive table
function loadArchiveUI() {
    const archiveBody = document.getElementById("archiveTableBody");
    if (!archiveBody) return;

    const filters = getPatientFilterValues();
    let archive = getArchivedAppointmentsShared();

    archive = archive.filter(apt =>
        matchesRecordFilter(apt, filters.archiveSearch, filters.archiveStatus)
    );

    archiveBody.innerHTML = "";

    if (!archive.length) {
        archiveBody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted py-4">
                    No matching archived records found.
                </td>
            </tr>
        `;
        return;
    }

    archive.forEach(apt => {
        archiveBody.innerHTML += `
            <tr>
                <td class="fw-bold">${apt.service}</td>
                <td>${apt.schedule}<br><small class="text-muted">${apt.lifecycleStatus || apt.status}</small></td>
                <td>
                    <button class="btn btn-sm btn-outline-info me-1" onclick="viewAppointmentDetails('${apt.id}')">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="permanentlyDelete('${apt.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}


function viewAppointmentDetails(id) {
    const apt = getAppointmentById(id);
    if (!apt) { showToast("Appointment not found."); return; }

    const status = apt.lifecycleStatus || apt.status || "—";
    const dentist = apt.dentist || apt.dentistName || "—";
    const date = apt.date || (apt.schedule ? apt.schedule.split("•")[0].trim() : "—");
    const time = apt.timeDisplay || apt.time || (apt.schedule ? apt.schedule.split("•")[1]?.trim() : "") || "—";
    const notes = apt.notes || "None";
    const cancellationReason = apt.cancellationReason || "";
    const totalAmount = Number(apt.subtotal || apt.price || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" });
    const totalPaid = Number(apt.totalCollected || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" });
    const balance = Number(apt.remainingBalance || 0).toLocaleString("en-PH", { style: "currency", currency: "PHP" });
    const paymentStatus = apt.paymentStatus || "—";

    const servicesHtml = Array.isArray(apt.services) && apt.services.length > 1
        ? `<ul class="apt-detail-services-list">${apt.services.map(s => `<li>${s.serviceName || s.name || s.service || s}</li>`).join("")}</ul>`
        : `<span>${(Array.isArray(apt.services) && apt.services[0] ? apt.services[0].serviceName || apt.services[0].name || apt.services[0].service : null) || apt.service || "—"}</span>`;

    document.getElementById("aptDetailService").innerHTML = servicesHtml;
    document.getElementById("aptDetailDate").textContent = date;
    document.getElementById("aptDetailTime").textContent = time;
    document.getElementById("aptDetailDentist").textContent = dentist;
    document.getElementById("aptDetailStatus").innerHTML = `<span class="badge ${status.toLowerCase().replace(/\s+/g, "-")}">${status === "Reschedule Requested" ? "Awaiting Reschedule Confirmation" : status}</span>`;
    document.getElementById("aptDetailTotal").textContent = totalAmount;
    document.getElementById("aptDetailPaid").textContent = totalPaid;
    document.getElementById("aptDetailBalance").textContent = balance;
    document.getElementById("aptDetailPaymentStatus").textContent = paymentStatus;
    document.getElementById("aptDetailNotes").textContent = notes;
    const proofList = document.getElementById("aptDetailRefundProofs");
    if (proofList) {
      proofList.replaceChildren();
      for (const refund of safeArray(apt.refunds)) {
        if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(refund.proofImage || "")) continue;
        const label = document.createElement("p");
        label.textContent = `GCash refund: PHP ${Number(refund.amount).toFixed(2)} - Reference: ${refund.reference || ""}`;
        const image = document.createElement("img"); image.src = refund.proofImage; image.alt = "Proof of GCash refund"; image.style.maxWidth = "100%";
        proofList.append(label, image);
      }
    }


    const cancelRow = document.getElementById("aptDetailCancelRow");
    if (cancellationReason) {
        cancelRow.style.display = "";
        document.getElementById("aptDetailCancelReason").textContent = cancellationReason;
    } else {
        cancelRow.style.display = "none";
    }

    const modal = document.getElementById("appointmentDetailsModal");
    if (modal) {
        // Keep the overlay outside transformed or clipped dashboard containers.
        document.body.appendChild(modal);
        modal.classList.add("active");
        modal.querySelector('.apt-detail-grid')?.scrollTo(0, 0);
    }
}

function closeAppointmentDetailsModal() {
    const modal = document.getElementById("appointmentDetailsModal");
    if (modal) modal.classList.remove("active");
}

function restoreAppointment(id) {
    return showToast("Only an administrator can manage archived appointment records.", "error");
}



// 2. Close the modal
function closeClearModal() {
    document.getElementById("clearArchiveModal").classList.remove("active");
}

// 3. Handle the actual clearing logic
document.getElementById("confirmClearAllBtn").onclick = function() {
    performClearArchive();
    closeClearModal();
};

// Function to permanently wipe an archived item
// Variable to store the ID of the item to be permanently deleted
// ==============================
// PERMANENT DELETE FROM ARCHIVE
// ==============================
let permanentDeleteId = null;

function permanentlyDelete(id) {
    return showToast("Only an administrator can delete appointment records.", "error");
}

function closePermanentDeleteModal() {
    const modal = document.getElementById("permanentDeleteModal");
    if (modal) {
        modal.classList.remove("active");
    }
    permanentDeleteId = null;
}

document.getElementById("confirmPermanentDeleteBtn")?.addEventListener("click", function () {
    if (!permanentDeleteId) return;

    const appointments = getAppointmentsShared().filter(item => {
        if (!matchesCurrentPatient(item)) return true;
        return String(item.id) !== String(permanentDeleteId);
    });

    saveAppointmentsShared(appointments);

    closePermanentDeleteModal();
    loadArchiveUI();
    loadAppointmentsUI();
    renderHeroAppointment?.();

    showToast("Archived record permanently deleted.");
    addNotification("An archived record was permanently deleted.");
});
let isEditingProfile = false;

function setProfileEditingState(isEditing) {
    const email = document.getElementById("profileEmail");
    if (email) email.disabled = true;
    const fields = [
        document.getElementById("profileFullName"),
        document.getElementById("profilePhone"),
        document.getElementById("profileNewPassword"),
        document.getElementById("profileConfirmPassword")
    ];

    fields.forEach(field => {
        if (field) field.disabled = !isEditing;
    });

    const btn = document.getElementById("editProfileBtn");
    if (btn) {
        btn.textContent = isEditing ? "Save Changes" : "Edit Profile";
    }

    isEditingProfile = isEditing;
}

function loadSavedProfile() {
    loadLoggedInPatientUI();

    const sessionUser = getCurrentUser() || {};
    const profileKey = `userProfileData_${sessionUser.email || sessionUser.id || "patient"}`;
    const savedProfile = JSON.parse(localStorage.getItem(profileKey)) || {};

    const fullNameInput = document.getElementById("profileFullName");
    const emailInput = document.getElementById("profileEmail");
    const phoneInput = document.getElementById("profilePhone");

    if (fullNameInput && savedProfile.fullName) {
        fullNameInput.value = sessionUser.name || savedProfile.fullName;
    }

    if (emailInput && savedProfile.email) {
        emailInput.value = sessionUser.email || savedProfile.email;
    }

    if (phoneInput && savedProfile.phone) {
        phoneInput.value = sessionUser.mobile || savedProfile.phone;
    }

    updateProfileTextUI();
}

function updateProfileTextUI() {
    const fullName = document.getElementById("profileFullName")?.value || "Patient";

    const settingsName = document.getElementById("settingsPatientName");
    if (settingsName) settingsName.textContent = fullName;

    const headerName = document.getElementById("headerPatientName");
    if (headerName) headerName.textContent = fullName;
}

async function saveProfileChanges() {
    const fullNameInput = document.getElementById("profileFullName");
    const emailInput = document.getElementById("profileEmail");
    const phoneInput = document.getElementById("profilePhone");
    const newPasswordInput = document.getElementById("profileNewPassword");
    const confirmPasswordInput = document.getElementById("profileConfirmPassword");

    const fullName = fullNameInput?.value.trim() || "";
    const email = emailInput?.value.trim() || "";
    const phone = phoneInput?.value.trim() || "";
    const newPassword = newPasswordInput?.value || "";
    const confirmPassword = confirmPasswordInput?.value || "";

    if (!fullName) {
        showToast("Full name is required ❗");
        return false;
    }

    if (!email) {
        showToast("Email is required ❗");
        return false;
    }

    if (newPassword || confirmPassword) {
        if (newPassword !== confirmPassword) {
            showToast("Passwords do not match ❗");
            return false;
        }
    }

        const verified = await window.GmAccountSecurity.update({ name: fullName, mobile: phone, newPassword });
        if (!verified) return false;
        const sessionUser = getCurrentUser() || {};
        const profileKey = `userProfileData_${sessionUser.email || sessionUser.id || "patient"}`;

        const profileData = {
            fullName: verified.name,
            email: verified.email,
            phone: verified.mobile
        };

        localStorage.setItem(profileKey, JSON.stringify(profileData));

    updateProfileTextUI();

    if (newPasswordInput) newPasswordInput.value = "";
    if (confirmPasswordInput) confirmPasswordInput.value = "";

    showToast("Profile updated successfully! ✅");
    return true;
}
function loadLoggedInPatientUI() {
    const sessionUser = getCurrentUser() || {};

    const profileKey = `userProfileData_${sessionUser.email || sessionUser.id || "patient"}`;
    const savedProfile = JSON.parse(localStorage.getItem(profileKey)) || {};

    const fullName =
        sessionUser.name ||
        sessionUser.fullName ||
        savedProfile.fullName ||
        "Patient";

    const email =
        sessionUser.email ||
        savedProfile.email ||
        "";

    const phone =
        sessionUser.mobile || savedProfile.phone || "";

    const patientId =
        sessionUser.patientId ||
        sessionUser.patient_id ||
        (sessionUser.id ? `PT-${String(sessionUser.id).slice(0, 6).toUpperCase()}` : "PT-001");

    const fullNameInput = document.getElementById("profileFullName");
    const emailInput = document.getElementById("profileEmail");
    const phoneInput = document.getElementById("profilePhone");

    if (fullNameInput) fullNameInput.value = fullName;
    if (emailInput) emailInput.value = email;
    if (phoneInput) phoneInput.value = phone;

    const headerPatientName = document.getElementById("headerPatientName");
    const headerPatientId = document.getElementById("headerPatientId");

    if (headerPatientName) headerPatientName.textContent = fullName;
    if (headerPatientId) headerPatientId.textContent = `ID: #${patientId}`;

    const settingsPatientName = document.getElementById("settingsPatientName");
    const settingsPatientId = document.getElementById("settingsPatientId");

    if (settingsPatientName) settingsPatientName.textContent = fullName;
    if (settingsPatientId) settingsPatientId.textContent = `Patient ID: #${patientId}`;

    const generatedAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=4e73df&color=fff`;

    const profileDisplay = document.getElementById("profileDisplay");
    const headerProfileImg = document.getElementById("header-profile-img");

    const photoKey = `userProfilePhoto_${sessionUser.email || sessionUser.id || "patient"}`;
    const savedPhoto = localStorage.getItem(photoKey);
    const finalPhoto = savedPhoto || generatedAvatar;

    if (profileDisplay) profileDisplay.src = finalPhoto;
    if (headerProfileImg) headerProfileImg.src = finalPhoto;
}


// 2. Handle the "Delete" button click inside the modal
document.getElementById("confirmPermanentDeleteBtn").onclick = function() {
    if (!permanentDeleteId) return;

    const appointments = getAppointmentsShared().filter(item => {
        if (!matchesCurrentPatient(item)) return true;
        return String(item.id) !== String(permanentDeleteId);
    });

    saveAppointmentsShared(appointments);
    loadArchiveUI();
    closePermanentDeleteModal();
    showToast("Permanently deleted ❌");
};

// 3. Helper to close the permanent delete modal


document.addEventListener('click', function(event) {
    const panel = document.querySelector('.side-panel');
    const moreTipsLink = document.querySelector('.more-tips-link');

    // Check if the panel is currently open
    if (panel.classList.contains('active')) {
        // If the click is NOT inside the panel AND NOT on the "More Tips" link
        if (!panel.contains(event.target) && !moreTipsLink.contains(event.target)) {
            panel.classList.remove('active');
        }
    }
});

function openDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) modal.style.display = 'flex';
}

function closeDeleteModal() {
    const modal = document.getElementById("deleteModal");
    if (modal) {
        modal.classList.remove("active");
    }

    const backdrops = document.querySelectorAll(".modal-backdrop");
    backdrops.forEach(b => b.remove());

    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";

    appointmentIdToDelete = null;
}

// Apply the same 'flex' logic to your permanentDeleteModal and clearArchiveModal
// 1. Select the correct elements
function openGuide() {
    document.getElementById("dental-guide-panel").style.display = "block";
    document.body.style.overflow = "hidden"; // Locks the background
}

function closeGuide() {
    document.getElementById("dental-guide-panel").style.display = "none";
    document.body.style.overflow = "auto"; // Restores scrolling
}

document.getElementById('addToCalendarBtn')?.addEventListener('click', function() {
    const apt = window.currentHeroAppointment;

    if (!apt) {
        showToast("No upcoming appointment found.");
        return;
    }

    const start = parseAppointmentDateTime(apt.schedule);
    if (!start) {
        showToast("Invalid appointment schedule.");
        return;
    }

    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const formatGoogleDate = (d) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        const ss = "00";
        return `${yyyy}${mm}${dd}T${hh}${mi}${ss}`;
    };

    const eventTitle = `${apt.service} - G-M Dental`;
    const location = "Ganal-Mappala Dental Clinic";
    const description = `Dental appointment for ${apt.service}.`;

    const googleCalendarUrl =
        `https://www.google.com/calendar/render?action=TEMPLATE` +
        `&text=${encodeURIComponent(eventTitle)}` +
        `&dates=${formatGoogleDate(start)}/${formatGoogleDate(end)}` +
        `&details=${encodeURIComponent(description)}` +
        `&location=${encodeURIComponent(location)}` +
        `&sf=true&output=xml`;

    window.open(googleCalendarUrl, '_blank');
});

function toggleTipsPanel(show) {
    const panel = document.getElementById('tipsPanel');
    if (!panel) {
        console.log("tipsPanel NOT FOUND");
        return;
    }

    console.log("toggle fired:", show);

    panel.classList.toggle('active', show);
}
function parseAppointmentDateTime(schedule) {
    if (!schedule) return null;

    const parts = schedule.split('•').map(s => s.trim());
    if (parts.length !== 2) return null;

    const datePart = parts[0];
    const timePart = parts[1];

    const parsed = new Date(`${datePart} ${timePart}`);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function formatHeroWhen(dateObj) {
    if (!dateObj) return "soon";

    const now = new Date();

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());

    const diffMs = target - today;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "tomorrow";

    return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getUpcomingPatientAppointments(now = new Date()) {
    const appointments = getPatientAppointmentsShared({ includeArchived: false });
    const treatmentCases = getActiveTreatmentCaseRecordsForPatient();

    const validAppointments = [...appointments, ...treatmentCases]
        .filter(a =>
            a &&
            a.schedule &&
            a.service &&
            (a.recordType === "treatment_plan" || isActiveLifecycleStatus(a.lifecycleStatus || a.status || "Pending"))
        )
        .map(a => ({
            ...a,
            parsedDate: parseAppointmentDateTime(a.schedule)
        }))
        .filter(a => a.parsedDate && a.parsedDate >= now)
        .filter((a, index, records) => a.recordType !== "treatment_plan" || !records.some((other, otherIndex) =>
            otherIndex !== index && other.recordType !== "treatment_plan" &&
            other.treatmentId && other.treatmentId === a.treatmentId &&
            other.parsedDate.getTime() === a.parsedDate.getTime()
        ));

    return validAppointments.sort((a, b) => a.parsedDate - b.parsedDate);
}

function getNextUpcomingAppointment() {
    return getUpcomingPatientAppointments()[0] || null;
}

function renderPatientDashboardStats() {
    const totalVisits = document.getElementById("totalVisitsCount");
    const upcomingCount = document.getElementById("upcomingAppointmentsCount");
    const completedVisits = getPatientAppointmentsShared({ includeArchived: true }).filter(appointment => {
        const status = normalizeAppointmentLifecycleStatus(
            appointment.visitStatus || appointment.lifecycleStatus || appointment.status || "Pending"
        );
        return status === "Completed" || (status === "Archived" &&
            normalizeAppointmentLifecycleStatus(appointment.statusBeforeArchive) === "Completed");
    });

    if (totalVisits) totalVisits.textContent = String(completedVisits.length);
    if (upcomingCount) upcomingCount.textContent = String(getUpcomingPatientAppointments().length);
}

function renderHeroAppointment() {
    renderPatientDashboardStats();
    const heroWelcomeText = document.getElementById("heroWelcomeText");
    const heroText = document.getElementById("heroUpcomingText");
    const heroBtn = document.getElementById("heroViewDetailsBtn");

    const badge = document.getElementById("appointmentStatusBadge");
    const title = document.getElementById("appointmentServiceTitle");
    const scheduleText = document.getElementById("appointmentScheduleText");
    const includesList = document.getElementById("appointmentIncludesList");
    const addToCalendarBtn = document.getElementById("addToCalendarBtn");
    const rescheduleBtn = document.getElementById("rescheduleBtn");

    const sessionUser = currentPatientUser || getCurrentUser() || {};
    const firstNameRaw =
        sessionUser.name ||
        sessionUser.fullName ||
        sessionUser.email ||
        "Patient";

    const firstName = String(firstNameRaw).trim().split(" ")[0] || "Patient";

    if (heroWelcomeText) {
        heroWelcomeText.textContent = `Welcome, ${firstName}! 👋`;
    }

    const upcoming = getNextUpcomingAppointment();

    if (!upcoming) {
        if (heroText) {
            heroText.textContent = "You have no upcoming appointments.";
        }

        if (heroBtn) {
            heroBtn.disabled = true;
            heroBtn.style.opacity = "0.6";
            heroBtn.style.pointerEvents = "none";
        }

        if (badge) badge.textContent = "No Appointment";
        if (title) title.textContent = "No upcoming appointments";
        if (scheduleText) scheduleText.textContent = "Book an appointment to see details here.";

        if (includesList) {
            includesList.innerHTML = `<li class="mb-2">No service selected yet.</li>`;
        }

        if (addToCalendarBtn) addToCalendarBtn.disabled = true;
        if (rescheduleBtn) rescheduleBtn.disabled = true;

        window.currentHeroAppointment = null;
        return;
    }

    const displayServiceName = String(upcoming.service || "");
    const serviceData = services.find(s => normalizeServiceKey(s.name) === normalizeServiceKey(displayServiceName));
    const whenText = formatHeroWhen(upcoming.parsedDate);

    if (heroText) {
        heroText.innerHTML = upcoming.recordType === "treatment_plan"
            ? `Your <strong>${displayServiceName}</strong> treatment remains active. Next session is ${whenText}.`
            : `You have an upcoming <strong>${upcoming.service}</strong> ${whenText}.`;
    }

    if (heroBtn) {
        heroBtn.disabled = false;
        heroBtn.style.opacity = "1";
        heroBtn.style.pointerEvents = "auto";
    }

    if (badge) badge.textContent = upcoming.status || "Pending";
    if (title) title.textContent = upcoming.service;
    if (scheduleText) {
        scheduleText.textContent = upcoming.recordType === "treatment_plan"
            ? `Active treatment case. ${upcoming.schedule ? `Next session: ${upcoming.schedule}` : "Next session to be scheduled."}`
            : `Scheduled for ${upcoming.schedule}`;
    }

    if (includesList) {
        if (serviceData && Array.isArray(serviceData.includes) && serviceData.includes.length) {
            includesList.innerHTML = serviceData.includes.map(item => `
                <li class="mb-2">
                    <i class="bi bi-check2-circle text-primary me-2"></i>${item}
                </li>
            `).join("");
        } else {
            includesList.innerHTML = `<li class="mb-2">No included details available.</li>`;
        }
    }

    if (addToCalendarBtn) addToCalendarBtn.disabled = upcoming.recordType === "treatment_plan" && !upcoming.schedule.includes("•");
    if (rescheduleBtn) rescheduleBtn.disabled = upcoming.recordType === "treatment_plan";

    window.currentHeroAppointment = upcoming;
}
function toggleProfileDropdown(forceClose = false) {
    const dropdown = document.getElementById("profileDropdownMenu");
    if (!dropdown) return;

    if (forceClose) {
        dropdown.classList.remove("active");
        return;
    }

    dropdown.classList.toggle("active");
}
function initCustomDropdown(id) {
  const dropdown = document.getElementById(id);
  if (!dropdown) return;

  const selected = dropdown.querySelector(".dropdown-selected");
  const options = dropdown.querySelector(".dropdown-options");
  if (!selected || !options) return;

  // default value
  if (!dropdown.dataset.value) {
    dropdown.dataset.value = "";
  }

  selected.addEventListener("click", (e) => {
    e.stopPropagation();

    document.querySelectorAll(".custom-dropdown").forEach(d => {
      if (d !== dropdown) d.classList.remove("open");
    });

    dropdown.classList.toggle("open");
  });

  options.querySelectorAll("div").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();

      const value = opt.dataset.value || "";
      selected.textContent = opt.textContent.trim();

      // save selected value here
      dropdown.dataset.value = value;

      dropdown.classList.remove("open");

      // refresh tables immediately
      loadAppointmentsUI();
      loadArchiveUI();
    });
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });
}
function calculateAge(dob) {
  if (!dob) return "";

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age >= 0 ? age : "";
}
function cancelBillingPayment() {
    localStorage.removeItem("pendingPayment");

    const billTotal = document.getElementById("billTotal");
    const billDown = document.getElementById("billDown");
    const billRemaining = document.getElementById("billRemaining");
    const gcashAmountDisplay = document.getElementById("gcashAmountDisplay");
    const editor = document.getElementById("billingServiceEditor");
    const servicesSummary = document.getElementById("billingSummaryServices");
    const summaryTotal = document.getElementById("summaryTotal");
    const summaryDownPayment = document.getElementById("summaryDownPayment");
    const summaryRemaining = document.getElementById("summaryRemaining");

    if (billTotal) billTotal.textContent = formatBillingCurrency(0);
    if (billDown) billDown.value = "0";
    if (billRemaining) billRemaining.textContent = formatBillingCurrency(0);
    if (gcashAmountDisplay) gcashAmountDisplay.textContent = formatBillingCurrency(0);
    if (summaryTotal) summaryTotal.textContent = formatBillingCurrency(0);
    if (summaryDownPayment) summaryDownPayment.textContent = formatBillingCurrency(0);
    if (summaryRemaining) summaryRemaining.textContent = formatBillingCurrency(0);
    if (editor) editor.innerHTML = "";
    if (servicesSummary) servicesSummary.innerHTML = `<li>No services selected.</li>`;

    setBillingPaymentMethod("gcash");
    showSection("my-appointments");
    showToast("Payment cancelled for now.");
}
const chatbotFab = document.getElementById("chatbotFab");
const chatbotPanel = document.getElementById("chatbotPanel");
const closeChatbot = document.getElementById("closeChatbot");
const chatbotMessages = document.getElementById("chatbotMessages");
const chatbotInput = document.getElementById("chatbotInput");
const sendChatbotBtn = document.getElementById("sendChatbotBtn");

chatbotFab?.addEventListener("click", () => {
  chatbotPanel?.classList.toggle("active");
});

closeChatbot?.addEventListener("click", () => {
  chatbotPanel?.classList.remove("active");
});

function addChatMessage(role, text) {
  if (!chatbotMessages) return;

  const div = document.createElement("div");
  div.className = role === "user" ? "user-msg" : "bot-msg";
  div.textContent = text;
  chatbotMessages.appendChild(div);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
}

function getSelectedServiceDetails() {
  if (window.selectedServiceObj) {
    return {
      name: window.selectedServiceObj.name || "",
      price: window.selectedServiceObj.price || 0,
      description: window.selectedServiceObj.description || "",
      includes: window.selectedServiceObj.includes || []
    };
  }

  return {
    name: "",
    price: 0,
    description: "",
    includes: []
  };
}

const CHATBOT_API_BASE_URL =
  window.GM_DENTAL_API_BASE ||
  localStorage.getItem("gm_dental_api_base") ||
  (window.GmDentalSupabaseSync && window.GmDentalSupabaseSync.apiBaseUrl) ||
  (window.location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:3000"
    : "");

function getChatbotPageContext() {
  const activeView = document.querySelector(".view.active")?.id || "dashboard";
  const currentUser = JSON.parse(sessionStorage.getItem("gm_dental_current_user") || "null");
  const pendingPayment = JSON.parse(localStorage.getItem("pendingPayment") || "null");
  const selected = getSelectedServiceDetails();

  return {
    patientName:
      currentUser?.name ||
      currentUser?.fullName ||
      currentUser?.email ||
      "Patient",

    currentSection: activeView,

    selectedService: selected.name || pendingPayment?.service || "",
    selectedPrice: selected.price || pendingPayment?.price || 0,

    appointmentStatus: pendingPayment?.status || "",
    paymentStatus: pendingPayment?.paymentStatus || ""
  };
}

async function sendChatbotMessage(customText = "") {
  const message = customText || chatbotInput?.value.trim();

  if (!message) return;

  addChatMessage("user", message);
  if (chatbotInput) chatbotInput.value = "";

  const loadingNode = document.createElement("div");
  loadingNode.className = "bot-msg";
  loadingNode.textContent = "Typing...";
  chatbotMessages?.appendChild(loadingNode);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;

  try {
    const context = getChatbotPageContext();

    const response = await window.GmDentalApiFetch(`${CHATBOT_API_BASE_URL}/api/patient-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message,
        ...context
      })
    });

    const data = await response.json();
    loadingNode.remove();

    addChatMessage(
      "bot",
      data?.reply || "Sorry, I could not generate a reply right now."
    );
  } catch (error) {
    loadingNode.remove();
    addChatMessage(
      "bot",
      "Sorry, the chatbot is currently unavailable."
    );
    console.error("Chatbot frontend error:", error);
  }
}

sendChatbotBtn?.addEventListener("click", () => {
  sendChatbotMessage();
});

chatbotInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendChatbotMessage();
  }
});

document.querySelectorAll(".chat-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    sendChatbotMessage(chip.dataset.chat || "");
  });
});

async function askPatientAssistant(message) {
  const selectedServiceObj = window.selectedServiceObj || null;
  const appointments = JSON.parse(localStorage.getItem("appointments") || "[]");
  const latestAppointment = appointments.length ? appointments[appointments.length - 1] : null;

  const payload = {
    message,
    currentSection: document.querySelector(".view.active")?.id || "unknown",
    selectedService: selectedServiceObj?.name || "",
    selectedPrice: selectedServiceObj?.price || 0,
    appointmentStatus: latestAppointment?.status || "",
    paymentStatus: latestAppointment?.paid ? "Paid" : "Unpaid",
    patientName: JSON.parse(localStorage.getItem("loggedInUser") || "{}")?.name || "Patient"
  };

  const res = await window.GmDentalApiFetch(`${CHATBOT_API_BASE_URL}/api/patient-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  return data.reply || "Sorry, I could not answer that right now.";
}

function setupResponsiveTables() {
  enhanceResponsiveTables();

  const observer = new MutationObserver(() => {
    window.requestAnimationFrame(enhanceResponsiveTables);
  });

  document.querySelectorAll(".table-modern table, .table-responsive table").forEach(table => {
    const target = table.querySelector("tbody") || table;
    observer.observe(target, { childList: true, subtree: true });
  });
}

function enhanceResponsiveTables() {
  document.querySelectorAll(".table-modern table, .table-responsive table").forEach(table => {
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

document.addEventListener("DOMContentLoaded", setupResponsiveTables);
