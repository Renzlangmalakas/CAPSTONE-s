console.log("DENTIST JS LOADED");
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



const currentDentistUser = getCurrentUser();

if (!currentDentistUser) {
  window.location.replace("../Landing/landing.html");
} else if (currentDentistUser.role !== "dentist") {
  window.location.replace("../Landing/landing.html");
}

// ---------------------------
// CLINIC DB
// ---------------------------
const CLINIC_DB_KEY = "gm_dental_db_v1";

function getClinicDb() {
  try {
    const raw = localStorage.getItem(CLINIC_DB_KEY);
    if (!raw) {
      const initial = buildDefaultClinicDb();
      localStorage.setItem(CLINIC_DB_KEY, JSON.stringify(initial));
      return initial;
    }
    return ensureClinicDbShape(window.GMDentistAccess.scope(JSON.parse(raw), currentDentistUser));
  } catch {
    return buildDefaultClinicDb();
  }
}

function saveClinicDb(db) {
  localStorage.setItem(CLINIC_DB_KEY, JSON.stringify(ensureClinicDbShape(db)));
  localStorage.setItem("gm_dental_sync_stamp", String(Date.now()));
  localStorage.setItem("gm_dental_global_sync", String(Date.now()));
}

// ---------------------------
// STORAGE KEYS
// ---------------------------
const STORAGE_KEYS = {
  appointments: "appointments",
  dentistArchive: "archive",
  rescheduleRequests: "rescheduleRequests",
  quickNotes: "dentistQuickNotes",
  dentistProfilePhoto: "dentistProfilePhoto",
  theme: "theme",
  dentistProfile: "dentistProfile"
};

const CLINIC_SYNC_KEYS = {
  patientNotifications: "patientNotifications",
  dentistNotifications: "dentistNotifications",
  clinicSyncStamp: "clinicSyncStamp"
};

let isRemoteSyncRefresh = false;
let dentistUiRefreshTimer = 0;
let dentistUiRefreshReason = "";
function queueRefreshDentistUI(reason = "sync") {
  dentistUiRefreshReason = reason || dentistUiRefreshReason || "sync";

  if (dentistUiRefreshTimer) {
    window.clearTimeout(dentistUiRefreshTimer);
  }

  dentistUiRefreshTimer = window.setTimeout(() => {
    const flushReason = dentistUiRefreshReason || "sync";
    dentistUiRefreshTimer = 0;
    dentistUiRefreshReason = "";

    isRemoteSyncRefresh = true;
    try {
      refreshDentistUI();
    } finally {
      isRemoteSyncRefresh = false;
    }
  }, 80);
}
// ---------------------------
// DEFAULT DATA
// ---------------------------
const serviceCatalog = [
  {
    name: "Enhanced Infection Control",
    price: 300,
    duration: "15 mins",
    description: "Hospital-grade sterilization and room disinfection.",
    includes: ["Sterilized instruments", "Clinic-wide disinfection", "Protective equipment use"]
  },
  {
    name: "Consultation",
    price: 500,
    duration: "30 mins",
    description: "Comprehensive oral health assessment and treatment planning.",
    includes: ["Dental examination", "Oral health assessment", "Treatment planning"]
  },
  {
    name: "Oral Prophylaxis",
    price: 1000,
    duration: "45 mins",
    description: "Professional teeth cleaning and polishing.",
    includes: ["Teeth cleaning", "Plaque & tartar removal", "Polishing"]
  },
  {
    name: "Restorative Treatment",
    price: 800,
    duration: "45 mins",
    description: "Tooth-colored restorations for damaged teeth.",
    includes: ["Cavity cleaning", "Tooth filling", "Tooth restoration"]
  },
  {
    name: "Tooth Extraction",
    price: 1000,
    duration: "30-45 mins",
    description: "Safe and gentle extraction procedure.",
    includes: ["Local anesthesia", "Tooth removal", "Post-extraction care"]
  },
  {
    name: "Odontectomy",
    price: 10000,
    duration: "1-2 hours",
    description: "Surgical removal of impacted teeth.",
    includes: ["Surgical extraction", "Wisdom tooth removal", "Sutures if needed"]
  },
  {
    name: "Root Canal Treatment",
    price: 6000,
    duration: "1.5 hours",
    description: "Treatment to save infected teeth.",
    includes: ["Infection removal", "Canal cleaning", "Tooth sealing"]
  },
  {
    name: "Complete Denture",
    price: 15000,
    duration: "Multiple Visits",
    description: "Full arch denture fitting.",
    includes: ["Full denture fitting", "Custom molding", "Bite adjustment"]
  },
  {
    name: "Partial Denture (Stayplate)",
    price: 6500,
    duration: "2-3 Visits",
    description: "Removable acrylic partial denture.",
    includes: ["Partial denture creation", "Lightweight material", "Basic fitting"]
  },
  {
    name: "Partial Denture (Casted)",
    price: 12000,
    duration: "3-4 Visits",
    description: "Durable metal-based partial denture.",
    includes: ["Metal framework denture", "Precise fitting", "Durable design"]
  },
  {
    name: "Flexible Denture",
    price: 16000,
    duration: "2-3 Visits",
    description: "Premium flexible removable denture.",
    includes: ["Flexible material denture", "Comfort fit design", "Aesthetic finish"]
  },
  {
    name: "Crowns and Bridges",
    price: 6000,
    duration: "2 Visits",
    description: "Fixed restorative prosthetics.",
    includes: ["Tooth restoration", "Crown or bridge placement", "Bite alignment"]
  },
  {
    name: "Orthodontic Treatment",
    price: 60000,
    duration: "12-24 Months",
    description: "Braces-based alignment correction.",
    includes: ["Braces installation", "Alignment correction", "Monthly adjustments"]
  },
  {
    name: "Retainers",
    price: 6000,
    duration: "1 Week",
    description: "Post-braces alignment support.",
    includes: ["Custom retainer", "Teeth alignment support", "Post-braces maintenance"]
  },
  {
    name: "Mouth Guard",
    price: 6000,
    duration: "1 Week",
    description: "Custom protective oral appliance.",
    includes: ["Custom mouth guard", "Protection for teeth", "Comfort fit"]
  },
  {
    name: "Whitening",
    price: 12000,
    duration: "1 hour",
    description: "Professional bleaching treatment.",
    includes: ["Teeth bleaching", "Stain removal", "Shade enhancement"]
  },
  {
    name: "Periapical X-Ray",
    price: 500,
    duration: "10 mins",
    description: "Focused diagnostic tooth x-ray.",
    includes: ["Tooth imaging", "Root analysis", "Diagnostic results"]
  },
  {
    name: "Panoramic X-Ray",
    price: 1000,
    duration: "15 mins",
    description: "Full mouth panoramic diagnostic image.",
    includes: ["Full mouth scan", "Jaw imaging", "Comprehensive diagnosis"]
  }
];
serviceCatalog.sort((a, b) => a.name.trim().localeCompare(b.name.trim(), 'en', { sensitivity: 'base', numeric: true }));

const defaultReminders = [
  "Review pending approvals before clinic opens.",
  "Check today’s treatment notes after every completed case.",
  "Follow up patients with reschedule requests."
];


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
let pendingArchiveId = null;
let pendingDeleteArchivedId = null;
let pendingPatientNotesKey = null;
let pendingPatientNotesName = "";

// ---------------------------
// HELPERS
// ---------------------------
function getData(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function setData(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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

function safeArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function isTrueFlag(value) {
  return value === true || String(value).trim().toLowerCase() === "true";
}

function getDirectAppointmentId(record = {}) {
  return String(record?.id || record?.appointmentId || "").trim();
}

function getAppointmentIdentity(record = {}, index = 0) {
  const directId = getDirectAppointmentId(record);
  if (directId) return directId;

  const patient = String(record.patientId || record.patientEmail || record.patientName || record.patient || "").trim();
  const service = String(record.service || "").trim();
  const schedule = String(record.schedule || "").trim();
  const createdAt = String(record.createdAt || "").trim();
  const compositeId = [patient, service, schedule, createdAt].filter(Boolean).join("__");

  return compositeId || `appointment-${index}`;
}

function appointmentMatchesId(record = {}, id = "", index = 0, offset = 0) {
  const targetId = String(id || "").trim();
  if (!targetId) return false;

  const directId = getDirectAppointmentId(record);
  if (directId && directId === targetId) return true;

  return getAppointmentIdentity(record, index) === targetId
    || getAppointmentIdentity(record, index + offset) === targetId;
}

function buildDefaultClinicDb() {
  return {
    appointments: [],
    archivedAppointments: [],
    patientClinicalNotes: [],
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
    patientClinicalNotes: safeArray(db.patientClinicalNotes),
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

function buildAppointmentScheduleKey(record = {}) {
  if (!record) return "";
  const date = String(record.date || parseScheduleParts(record.schedule || "").datePart || "").trim();
  const time = String(record.time || convertDisplayTimeTo24(parseScheduleParts(record.schedule || "").timePart || "") || "").trim();
  const dentist = String(record.dentistId || record.dentist || "").trim().toLowerCase();
  if (!date || !time || !dentist) return "";
  return `${dentist}__${date}__${time}`;
}

function isAutoApprovalEligibleAppointment(record = {}) {
  if (!record) return false;
  if (normalizeAppointmentStatus(record.status || "Pending") !== "Pending") return false;
  if (record.requiresManualApproval === true) return false;
  if (record.archivedForDentist === true) return false;
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
      .filter(item => ["Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(normalizeAppointmentStatus(item.status || "Pending")))
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
        approvalMode: "auto",
        updatedAt: new Date().toISOString()
      });
      occupied.add(key);
      changed = true;
    });

  return changed ? normalized : records;
}

const confirmedDentistCompletions = new Map();
let completionRefreshRequest = null;

async function refreshConfirmedDentistCompletions() {
  if (completionRefreshRequest) return completionRefreshRequest;
  completionRefreshRequest = (async () => {
    try {
      const base = window.GmDentalSupabaseSync?.apiBaseUrl || window.GM_DENTAL_API_BASE || '';
      const response = await window.GmDentalApiFetch(`${base}/api/clinic-db`, { cache: 'no-store' });
      if (!response.ok) return false;
      const { db } = await response.json();
      if (!Array.isArray(db?.appointments)) return false;
      for (const item of [...db.appointments, ...safeArray(db.archivedAppointments)]) {
        if (item.status === 'Completed' && isMyAppointment(item)) {
          confirmedDentistCompletions.set(String(item.id), item);
        }
      }
      refreshDentistUI();
      return true;
    } catch (error) {
      console.warn('Could not refresh completed appointments:', error.message);
      return false;
    } finally {
      completionRefreshRequest = null;
    }
  })();
  return completionRefreshRequest;
}

function getAppointments() {
  const db = ensureClinicDbShape(getClinicDb());
  const active = safeArray(db.appointments).filter(isUsableAppointmentRecord);
  const archived = safeArray(db.archivedAppointments).filter(isUsableAppointmentRecord);

  const mergedMap = new Map();

  dedupeAppointments([...active, ...archived]).forEach((item, index) => {
    if (!item) return;

    const key = getAppointmentIdentity(item, index);

    mergedMap.set(
      key,
      normalizeAppointmentFinancials({
        ...item,
        id: key,
        patientName: item.patientName || item.patient || "Unknown Patient",
        patient: item.patientName || item.patient || "Unknown Patient",
        archivedForDentist: isTrueFlag(item.archivedForDentist),
        archivedForPatient: isTrueFlag(item.archivedForPatient),
        archived: isTrueFlag(item.archived),
        updatedAt: item.updatedAt || new Date().toISOString()
      })
    );
  });

  // Completion is terminal on the server. A delayed sync snapshot must not
  // reopen it locally; keep current billing and visibility fields intact.
  for (const [id, completed] of confirmedDentistCompletions) {
    const current = mergedMap.get(id) || completed;
    mergedMap.set(id, { ...current, status: 'Completed', visitStatus: 'Completed',
      lifecycleStatus: 'Completed', overallCaseStatus: 'Completed', completedAt: completed.completedAt });
  }

  const normalized = dedupeAppointments(
    autoApproveEligibleAppointments([...mergedMap.values()]).map(item =>
      normalizeAppointmentFinancials(item)
    )
  );

  return normalized;
}

function isUsableAppointmentRecord(item = {}) {
  const patient = String(item.patientName || item.patient || item.patientId || "").trim();
  const service = String(item.service || "").trim();
  const schedule = String(item.schedule || "").trim();
  const date = String(item.date || "").trim();
  return Boolean(patient && (service || schedule || date) && service.toLowerCase() !== "no appointment yet" && item.recordType !== "profile");
}

// Returns true when the appointment belongs to the currently logged-in dentist.
// Matches by dentistId first (authoritative once bookings record it), then by
// dentist name (case-insensitive). Returns false when the dentist field is
// empty so legacy unassigned appointments don't leak across every dentist's
// view.
function normalizeDentistIdentifier(value = "") {
  return String(value || "")
    .replace(/\bdr\.?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function isMyAppointment(apt) {
  return window.GMDentistAccess.assigned(apt, window.GMDentistAccess.identity(getClinicDb(), currentDentistUser));
}

function getMyAppointments() {
  return getAppointments().filter(isMyAppointment);
}

function isArchivedByCurrentDentist(apt = {}) {
  if (!apt || !currentDentistUser) return false;

  const myId = String(currentDentistUser.id || "").trim();
  const myName = normalizeDentistIdentifier(currentDentistUser.name || currentDentistUser.fullName || "");
  const myEmail = String(currentDentistUser.email || "").trim().toLowerCase();

  const archivedById = String(apt.archivedByDentistId || "").trim();
  if (myId && archivedById && archivedById === myId) return true;

  const archivedByName = normalizeDentistIdentifier(apt.archivedByDentistName || "");
  if (myName && archivedByName && archivedByName === myName) return true;

  const archivedByEmail = String(apt.archivedByDentistEmail || "").trim().toLowerCase();
  if (myEmail && archivedByEmail && archivedByEmail === myEmail) return true;

  return false;
}

function saveAppointments(list) {
  const normalized = dedupeAppointments(
    safeArray(list).map(item => normalizeAppointmentFinancials(item))
  );

  const db = ensureClinicDbShape(getClinicDb());

  db.appointments = normalized.filter(
    item => !isTrueFlag(item.archived) && !isTrueFlag(item.archivedForDentist) && !isTrueFlag(item.archivedForPatient)
  );

  db.archivedAppointments = normalized.filter(
    item => isTrueFlag(item.archived) || isTrueFlag(item.archivedForDentist) || isTrueFlag(item.archivedForPatient)
  );

  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();
}

function getAllAdjustmentTimeSlots() {
  if (typeof getAllBookingTimeSlots === "function") {
    const slots = getAllBookingTimeSlots();
    if (Array.isArray(slots) && slots.length) return slots;
  }

  return [
    "09:00 AM",
    "10:00 AM",
    "11:00 AM",
    "12:00 PM",
    "01:00 PM",
    "02:00 PM",
    "03:00 PM",
    "04:00 PM",
    "05:00 PM"
  ];
}

function getOccupiedAdjustmentTimes(dateValue, excludeAppointmentId = "") {
  return getMyAppointments()
    .filter((apt) => {
      if (!apt) return false;
      if (String(apt.id || "") === String(excludeAppointmentId || "")) return false;
      if (apt.archived === true || apt.archivedForDentist === true || apt.archivedForPatient === true) return false;

      const status = normalizeAppointmentStatus(apt.status || "Pending");
      if (["Cancelled", "Rejected", "Completed", "Archived"].includes(status)) return false;

      const parts = parseScheduleParts(apt.schedule || "");
      return String(parts.datePart || "").trim() === String(dateValue || "").trim();
    })
    .map((apt) => normalizeTimeDisplay(parseScheduleParts(apt.schedule || "").timePart || ""))
    .filter(Boolean);
}

function renderAdjustmentTimeOptions(dateValue, excludeAppointmentId = "", selectedTime = "") {
  const timeSelect = document.getElementById("adjustmentTime");
  if (!timeSelect) return;

  timeSelect.innerHTML = `<option value="">Select available time</option>`;

  if (!dateValue) {
    timeSelect.innerHTML = `<option value="">Select a date first</option>`;
    return;
  }

  const allSlots = getAllAdjustmentTimeSlots();
  const occupiedTimes = new Set(getOccupiedAdjustmentTimes(dateValue, excludeAppointmentId));

  const availableSlots = allSlots.filter((time) => {
    return !occupiedTimes.has(normalizeTimeDisplay(time));
  });

  if (!availableSlots.length) {
    timeSelect.innerHTML = `<option value="">No available time slots</option>`;
    return;
  }

  availableSlots.forEach((time) => {
    const option = document.createElement("option");
    option.value = time;
    option.textContent = time;

    if (normalizeTimeDisplay(selectedTime) === normalizeTimeDisplay(time)) {
      option.selected = true;
    }

    timeSelect.appendChild(option);
  });
}

function getArchive() {
  return getAppointments().filter(item =>
    isTrueFlag(item.archivedForDentist) &&
    (isMyAppointment(item) || isArchivedByCurrentDentist(item))
  );
}

function saveArchive(list) {
  const archiveIds = new Set(safeArray(list).map(item => String(item.id)));
  const appointments = getAppointments().map(item => {
    if (!archiveIds.has(String(item.id))) return item;
    return normalizeAppointmentFinancials({
      ...item,
      archived: true,
      archivedForDentist: true,
      archivedAt: item.archivedAt || new Date().toISOString(),
      archivedBy: item.archivedBy || "dentist"
    });
  });
  saveAppointments(appointments);
}

function getRescheduleRequests() {
  const db = ensureClinicDbShape(getClinicDb());
  const dbList = Array.isArray(db.rescheduleRequests) ? db.rescheduleRequests : [];
  return dbList;
}

function saveRescheduleRequests(list) {
  const safeList = Array.isArray(list) ? list : [];

  const db = ensureClinicDbShape(getClinicDb());
  db.rescheduleRequests = safeList;
  saveClinicDb(db);

  triggerGlobalSync?.();
  touchClinicSync();
}

function createDentistEntityId(prefix = "item") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTreatmentPlans() {
  const db = ensureClinicDbShape(getClinicDb());
  const appointments = getAppointments();
  const planMap = new Map();

  safeArray(db.treatmentPlans).forEach(plan => {
    const key = String(plan.treatmentId || plan.id || "").trim();
    if (!key) return;
    planMap.set(key, normalizeTreatmentPlanRecord(plan, appointments.filter(item => String(item.treatmentId || "") === key)));
  });

  appointments.forEach(appointment => {
    if (!appointment.treatmentId || !appointment.services?.some(service => service.isLongTermTreatment)) return;
    if (planMap.has(String(appointment.treatmentId))) return;

    planMap.set(String(appointment.treatmentId), normalizeTreatmentPlanRecord({
      treatmentId: appointment.treatmentId,
      patientId: appointment.patientId || "",
      patientName: appointment.patientName || appointment.patient || "Patient",
      patientEmail: appointment.patientEmail || "",
      dentistId: appointment.dentistId || "",
      dentist: appointment.dentist || "",
      serviceName: appointment.services.find(service => service.isLongTermTreatment)?.serviceName || appointment.service,
      status: "Active",
      startDate: appointment.date || parseScheduleParts(appointment.schedule).datePart || "",
      estimatedDurationMonths: 18,
      totalCost: appointment.services.find(service => service.isLongTermTreatment)?.price || appointment.price || 0,
      sessions: []
    }, [appointment]));
  });

  const normalizedPlans = [...planMap.values()];
  const currentSerialized = JSON.stringify(safeArray(db.treatmentPlans));
  const nextSerialized = JSON.stringify(normalizedPlans);
  if (currentSerialized !== nextSerialized) {
    db.treatmentPlans = normalizedPlans;
    saveClinicDb(db);
  }

  return normalizedPlans;
}

function saveTreatmentPlans(list) {
  const db = ensureClinicDbShape(getClinicDb());
  db.treatmentPlans = safeArray(list).map(plan => normalizeTreatmentPlanRecord(plan, getAppointments().filter(item => String(item.treatmentId || "") === String(plan.treatmentId || plan.id || ""))));
  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();
}

function getTreatmentPlanById(id) {
  return getTreatmentPlans().find(plan => String(plan.treatmentId || plan.id || "") === String(id)) || null;
}

function updateTreatmentPlanById(id, updater) {
  const plans = getTreatmentPlans();
  const index = plans.findIndex(plan => String(plan.treatmentId || plan.id || "") === String(id));
  if (index === -1) return null;

  const current = normalizeTreatmentPlanRecord(plans[index], getAppointments().filter(item => String(item.treatmentId || "") === String(id)));
  const updatedRaw = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  plans[index] = normalizeTreatmentPlanRecord({
    ...current,
    ...updatedRaw,
    updatedAt: new Date().toISOString()
  }, getAppointments().filter(item => String(item.treatmentId || "") === String(id)));

  saveTreatmentPlans(plans);
  return plans[index];
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

function buildTreatmentSessionFromAppointment(appointment = {}) {
  const normalizedAppointment = normalizeAppointmentFinancials(appointment);
  const parts = parseScheduleParts(normalizedAppointment.schedule || "");
  return {
    sessionId: normalizedAppointment.sessionId || `${normalizedAppointment.id}-session`,
    appointmentId: normalizedAppointment.id,
    date: normalizedAppointment.date || parts.datePart || "",
    time: normalizedAppointment.time || convertDisplayTimeTo24(parts.timePart || "") || "",
    timeDisplay: normalizedAppointment.timeDisplay || parts.timePart || "",
    schedule: normalizedAppointment.schedule || buildSchedule(normalizedAppointment.date || parts.datePart || "", normalizedAppointment.timeDisplay || parts.timePart || normalizedAppointment.time || ""),
    status: normalizeAppointmentStatus(normalizedAppointment.status || "Pending"),
    notes: normalizedAppointment.notes || "",
    createdAt: normalizedAppointment.createdAt || new Date().toISOString(),
    updatedAt: normalizedAppointment.updatedAt || new Date().toISOString()
  };
}

function normalizeTreatmentPlanRecord(plan = {}, linkedAppointments = []) {
  const treatmentId = String(plan.treatmentId || plan.id || createDentistEntityId("trt")).trim();
  const sessionMap = new Map();

  safeArray(plan.sessions).forEach((session, index) => {
    const key = String(session.sessionId || session.appointmentId || `${treatmentId}-session-${index + 1}`).trim();
    sessionMap.set(key, {
      sessionId: key,
      appointmentId: String(session.appointmentId || "").trim(),
      date: String(session.date || parseScheduleParts(session.schedule || "").datePart || "").trim(),
      time: String(session.time || convertDisplayTimeTo24(parseScheduleParts(session.schedule || "").timePart || "") || "").trim(),
      timeDisplay: normalizeTimeDisplay(session.timeDisplay || parseScheduleParts(session.schedule || "").timePart || session.time || ""),
      schedule: buildSchedule(session.date || parseScheduleParts(session.schedule || "").datePart || "", session.timeDisplay || parseScheduleParts(session.schedule || "").timePart || session.time || ""),
      status: normalizeAppointmentStatus(session.status || "Pending"),
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

  const sessions = [...sessionMap.values()].sort((left, right) => {
    const leftDate = new Date(`${left.date || ""} ${left.timeDisplay || ""}`);
    const rightDate = new Date(`${right.date || ""} ${right.timeDisplay || ""}`);
    return leftDate - rightDate;
  });
  const nextOpenSession = sessions.find(session => ["Pending", "Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(session.status));
  const totalCost = Number(plan.totalCost || plan.price || linkedAppointments[0]?.price || 0);
  const amountPaidOnline = Number(plan.amountPaidOnline || 0);
  const amountPaidInClinic = Number(plan.amountPaidInClinic || 0);
  const amountPaid = Number(plan.amountPaid != null ? plan.amountPaid : plan.totalCollected != null ? plan.totalCollected : amountPaidOnline + amountPaidInClinic);
  const remainingBalance = Math.max(0, totalCost - amountPaid);

  return {
    ...plan,
    id: treatmentId,
    treatmentId,
    patientId: String(plan.patientId || linkedAppointments[0]?.patientId || "").trim(),
    patientName: plan.patientName || linkedAppointments[0]?.patientName || linkedAppointments[0]?.patient || "Patient",
    patientEmail: plan.patientEmail || linkedAppointments[0]?.patientEmail || "",
    dentistId: String(plan.dentistId || linkedAppointments[0]?.dentistId || "").trim(),
    dentist: plan.dentist || linkedAppointments[0]?.dentist || "",
    serviceName: plan.serviceName || plan.service || linkedAppointments[0]?.service || "Orthodontic Treatment",
    type: "long_term_treatment",
    status: normalizeTreatmentPlanStatus(plan.status || "Active", {
      forceCancelled: sessions.length > 0 && sessions.every(session => session.status === "Cancelled")
    }),
    startDate: plan.startDate || linkedAppointments[0]?.date || parseScheduleParts(linkedAppointments[0]?.schedule || "").datePart || "",
    estimatedDurationMonths: Number(plan.estimatedDurationMonths || 18),
    totalCost,
    downPayment: Number(plan.downPayment || 0),
    installmentAmount: Number(plan.installmentAmount || plan.monthlyAmount || Math.max(1, Math.round(totalCost / 18))),
    monthlyAmount: Number(plan.monthlyAmount || plan.installmentAmount || Math.max(1, Math.round(totalCost / 18))),
    amountPaid,
    amountPaidOnline,
    amountPaidInClinic,
    totalCollected: amountPaid,
    remainingBalance,
    nextSessionDate: plan.nextSessionDate || nextOpenSession?.date || "",
    nextSessionTime: normalizeTimeDisplay(plan.nextSessionTime || nextOpenSession?.timeDisplay || ""),
    nextSessionSchedule: buildSchedule(plan.nextSessionDate || nextOpenSession?.date || "", plan.nextSessionTime || nextOpenSession?.timeDisplay || ""),
    sessions,
    notes: plan.notes || "",
    createdAt: plan.createdAt || linkedAppointments[0]?.createdAt || new Date().toISOString(),
    updatedAt: plan.updatedAt || linkedAppointments[0]?.updatedAt || new Date().toISOString()
  };
}

function upsertTreatmentPlanFromAppointment(appointment, options = {}) {
  const normalizedAppointment = normalizeAppointmentFinancials(appointment);
  const longTermService = normalizedAppointment.services?.find(service => service.isLongTermTreatment);
  if (!normalizedAppointment.treatmentId || !longTermService) {
    return null;
  }

  const existing = getTreatmentPlanById(normalizedAppointment.treatmentId);
  const linkedAppointments = getAppointments().filter(item => String(item.treatmentId || "") === String(normalizedAppointment.treatmentId));
  const nextPlan = normalizeTreatmentPlanRecord({
    treatmentId: normalizedAppointment.treatmentId,
    patientId: normalizedAppointment.patientId || "",
    patientName: normalizedAppointment.patientName || normalizedAppointment.patient || "Patient",
    patientEmail: normalizedAppointment.patientEmail || "",
    dentistId: normalizedAppointment.dentistId || "",
    dentist: normalizedAppointment.dentist || "",
    serviceName: longTermService.serviceName,
    status: options.status || existing?.status || "Active",
    startDate: existing?.startDate || normalizedAppointment.date,
    estimatedDurationMonths: Number(existing?.estimatedDurationMonths || options.estimatedDurationMonths || 18),
    totalCost: Number(existing?.totalCost || longTermService.price || normalizedAppointment.price || 0),
    downPayment: Number(existing?.downPayment || 0),
    installmentAmount: Number(existing?.installmentAmount || existing?.monthlyAmount || Math.max(1, Math.round(Number(longTermService.price || normalizedAppointment.price || 0) / 18))),
    monthlyAmount: Number(existing?.monthlyAmount || existing?.installmentAmount || Math.max(1, Math.round(Number(longTermService.price || normalizedAppointment.price || 0) / 18))),
    amountPaid: Number(existing?.amountPaid || 0),
    amountPaidOnline: Number(existing?.amountPaidOnline || 0),
    amountPaidInClinic: Number(existing?.amountPaidInClinic || 0),
    nextSessionDate: normalizedAppointment.date || parseScheduleParts(normalizedAppointment.schedule || "").datePart || "",
    nextSessionTime: normalizedAppointment.timeDisplay || parseScheduleParts(normalizedAppointment.schedule || "").timePart || "",
    sessions: existing?.sessions || [],
    notes: existing?.notes || options.notes || ""
  }, linkedAppointments);

  const plans = getTreatmentPlans();
  const index = plans.findIndex(plan => String(plan.treatmentId || plan.id || "") === String(nextPlan.treatmentId));
  if (index > -1) {
    plans[index] = nextPlan;
  } else {
    plans.unshift(nextPlan);
  }
  saveTreatmentPlans(plans);
  return nextPlan;
}

function getPatientNotificationsShared() {
  const db = getClinicDb();
  const dbList = Array.isArray(db?.notifications?.patient) ? db.notifications.patient : [];
  if (dbList.length) return dbList;

  const legacyList = getData(CLINIC_SYNC_KEYS.patientNotifications, []);
  return Array.isArray(legacyList) ? legacyList : [];
}

function savePatientNotificationsShared(list) {
  const safeList = Array.isArray(list) ? list : [];
  const db = getClinicDb();
  db.notifications = db.notifications || { admin: [], dentist: [], patient: [] };
  db.notifications.patient = safeList;
  saveClinicDb(db);
  setData(CLINIC_SYNC_KEYS.patientNotifications, safeList);
  touchClinicSync();
}

function getDentistNotificationsShared() {
  const db = getClinicDb();
  const dbList = Array.isArray(db?.notifications?.dentist) ? db.notifications.dentist : [];
  return dbList;
}

function saveDentistNotificationsShared(list) {
  const safeList = Array.isArray(list) ? list : [];
  const db = getClinicDb();
  db.notifications = db.notifications || { admin: [], dentist: [], patient: [] };
  db.notifications.dentist = safeList;
  saveClinicDb(db);
  setData(CLINIC_SYNC_KEYS.dentistNotifications, safeList);
  touchClinicSync();
}

function pushPatientNotification(text, meta = {}) {
  const list = getPatientNotificationsShared();
  list.unshift({
    id: meta.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-p`,
    text,
    createdAt: meta.createdAt || new Date().toISOString(),
    read: false,
    patientId: meta.patientId || "",
    appointmentId: meta.appointmentId || "",
    treatmentId: meta.treatmentId || "",
    sessionId: meta.sessionId || "",
    eventType: meta.eventType || "general"
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

function clearAllDentistNotifications() {
  saveDentistNotificationsShared([]);
}

function currency(value) {
  return `₱${Number(value || 0).toLocaleString()}`;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeOnclickArg(value) {
  return escapeHtml(
    String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, " ")
  );
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
function parseSchedulePartsLegacyOriginal(schedule = "") {
  const [datePartRaw = "", timePartRaw = ""] = String(schedule).split("•").map(s => s.trim());
  const timePart = normalizeTimeDisplay(timePartRaw);

  return {
    datePart: datePartRaw,
    timePart
  };
}
function getApprovedBookedSlots(dateFilter = "") {
  return getMyAppointments()
    .filter((apt) => {
      if (apt.archivedForDentist === true) return false;
      if (String(apt.status || "").trim() !== "Approved") return false;

      const datePart = normalizeDateValue(apt);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !normalizeTimeValue(apt)) return false;
      if (dateFilter && datePart !== dateFilter) return false;

      return true;
    })
    .sort((a, b) => {
      const aTime = `${normalizeDateValue(a)} ${normalizeTimeValue(a)}`;
      const bTime = `${normalizeDateValue(b)} ${normalizeTimeValue(b)}`;
      return aTime.localeCompare(bTime);
    });
}

function renderBookedSlots(dateFilter = "") {
  const box = document.getElementById("bookedSlotsList");
  if (!box) return;

  const slots = getApprovedBookedSlots(dateFilter);
  box.innerHTML = "";

  if (!slots.length) {
    box.innerHTML = `<div class="empty-state">No approved booked slots.</div>`;
    return;
  }

  slots.forEach((apt) => {
    const datePart = normalizeDateValue(apt);
    const timePart = normalizeTimeDisplay(apt.timeDisplay || apt.time || parseScheduleParts(apt.schedule).timePart);

    box.innerHTML += `
      <div class="booked-slot-item">
        <div class="booked-slot-time">${escapeHtml(timePart || "-")}</div>
        <div class="booked-slot-info">
          <strong>${escapeHtml(apt.patientName || apt.patient || "Unknown Patient")}</strong>
          <span>${escapeHtml(apt.service || "-")} • ${escapeHtml(datePart || "-")}</span>
        </div>
      </div>
    `;
  });
}

function openBookedSlotsModal() {
  renderBookedSlotsModal();
  document.getElementById("bookedSlotsModal")?.classList.add("active");
}

function closeBookedSlotsModal() {
  document.getElementById("bookedSlotsModal")?.classList.remove("active");
}

function renderBookedSlotsModal(dateFilter = "") {
  const box = document.getElementById("bookedSlotsModalList");
  if (!box) return;

  const slots = getApprovedBookedSlots(dateFilter);
  box.innerHTML = "";

  if (!slots.length) {
    box.innerHTML = `<div class="empty-state">No approved booked slots.</div>`;
    return;
  }

  slots.forEach((apt) => {
    const datePart = normalizeDateValue(apt);
    const timePart = normalizeTimeDisplay(apt.timeDisplay || apt.time || parseScheduleParts(apt.schedule).timePart);

    box.innerHTML += `
      <div class="booked-slot-modal-item">
        <div class="booked-slot-modal-time">${escapeHtml(timePart || "-")}</div>
        <div class="booked-slot-modal-details">
          <h6>${escapeHtml(apt.patientName || apt.patient || "Unknown Patient")}</h6>
          <p>${escapeHtml(apt.service || "-")}</p>
          <span>${escapeHtml(datePart || "-")}</span>
        </div>
        <div class="booked-slot-modal-status">
          <span class="badge approved">Approved</span>
        </div>
      </div>
    `;
  });
}
function isTodayDate(dateString) {
  if (!dateString) return false;
  const value = String(dateString).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function formatLongDate(dateString) {
  if (!dateString) return "No date";
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
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

function splitSchedule(schedule = "") {
  const [dateRaw = "", timeRaw = ""] = String(schedule).split("•").map(s => s.trim());
  const timeDisplay = normalizeTimeDisplay(timeRaw);

  return {
    date: dateRaw,
    timeDisplay,
    time24: convertDisplayTimeTo24(timeDisplay)
  };
}


function findService(serviceName) {
  return serviceCatalog.find(s => s.name === serviceName);
}

function convert24To12(time24) {
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
    ? convert24To12(timeValue)
    : normalizeTimeDisplay(timeValue);

  return safeDate && safeTime ? `${safeDate} • ${safeTime}` : safeDate || safeTime;
}

function normalizeAppointmentStatus(status) {
  const value = String(status || "").trim();
  if (!value) return "Pending";

  const lowered = value.toLowerCase();
  if (lowered === "profile only") return "Profile Only";
  if (lowered === "pending") return "Pending";
  if (["approved", "upcoming"].includes(lowered)) return "Approved";
  if (["checked in", "checkedin", "ongoing", "active", "started", "treatment in progress"].includes(lowered)) return "Ongoing";
  if (["completed", "visit completed"].includes(lowered)) return "Completed";
  if (["cancelled", "canceled"].includes(lowered)) return "Cancelled";
  if (lowered === "rejected") return "Rejected";
  if (["reschedule requested", "reschedule request"].includes(lowered)) return "Reschedule Requested";
  if (lowered === "reschedule rejected") return "Reschedule Rejected";
  if (lowered === "archived") return "Archived";
  return "Pending";
}

function statusClassName(status) {
  return normalizeAppointmentStatus(status)
    .toLowerCase()
    .replace(/\s+/g, "-");
}

// ---------------------------
// TOAST + NOTIFICATIONS
// ---------------------------
function showToast(message) {
  let toast = document.getElementById("globalToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "globalToast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function addDentistNotification(text) {
  pushDentistNotification(text);
  renderDentistNotifications();
}

function renderDentistNotifications() {
  const listEl = document.getElementById("notifList");
  const allListEl = document.getElementById("allNotifList");
  const dotEl = document.querySelector(".notif-wrapper .dot");

  if (!listEl) return;

  const notifications = getDentistNotificationsShared();

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
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="notif-item-title">${escapeHtml(item.text)}</span>
        <span class="notif-item-time">${new Date(item.createdAt).toLocaleString()}</span>
      `;
      listEl.appendChild(li);
    });

    if (allListEl) {
      notifications.forEach(item => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="notif-item-title">${escapeHtml(item.text)}</span>
          <span class="notif-item-time">${new Date(item.createdAt).toLocaleString()}</span>
        `;
        allListEl.appendChild(li);
      });
    }
  }

  const unread = notifications.some(n => !n.read);
  if (dotEl) {
    dotEl.style.display = unread ? "block" : "none";
  }
}

function toggleDentistNotifPanel(forceClose = null) {
  const panel = document.getElementById("notifPanel");
  if (!panel) return;

  if (forceClose === true) {
    panel.classList.remove("active");
    return;
  }

  panel.classList.toggle("active");

  if (panel.classList.contains("active")) {
    renderDentistNotifications();
  }
}

function markAllDentistNotificationsRead() {
  const list = getDentistNotificationsShared().map(n => ({
    ...n,
    read: true
  }));
  saveDentistNotificationsShared(list);
}

// ---------------------------
// NAVIGATION
// ---------------------------
function showSection(id) {
  if (id === 'profile') refreshDentistProfileSchedule();
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));

  document.getElementById(id)?.classList.add("active");

  const map = {
    dashboard: "link-dash",
    schedule: "link-schedule",
    patients: "link-patients",
    records: "link-records",
    services: "link-services",
    billing: "link-billing",
    history: "link-history",
    archive: "link-archive",
    profile: "link-profile"
  };

  document.getElementById(map[id])?.classList.add("active");
  closeMobileSidebar();
  if (['schedule', 'history'].includes(id)) void refreshConfirmedDentistCompletions();
}

// ---------------------------
// SIDEBAR
// ---------------------------
function toggleSidebar() {
  const shell = document.getElementById("appShell");
  if (!shell) return;

  if (window.innerWidth <= 992) {
    setMobileSidebar(!shell.classList.contains("mobile-open"));
  } else {
    shell.classList.toggle("collapsed");
  }
}

function isMobileSidebarLayout() {
  return window.matchMedia("(max-width: 1024px)").matches;
}

function setMobileSidebar(open) {
  const shell = document.getElementById("appShell");
  const backdrop = document.getElementById("sidebarBackdrop");
  const mobileToggle = document.getElementById("mobileSidebarToggle");
  if (!shell) return;

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
    const shell = document.getElementById("appShell");
    setMobileSidebar(!shell?.classList.contains("mobile-open"));
  });

  document.getElementById("sidebarBackdrop")?.addEventListener("click", closeMobileSidebar);

  window.addEventListener("resize", () => {
    if (!isMobileSidebarLayout()) {
      document.getElementById("sidebarBackdrop")?.classList.remove("show");
      document.getElementById("mobileSidebarToggle")?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("sidebar-open");
      document.getElementById("appShell")?.classList.remove("mobile-open");
    }
  });
});

// ---------------------------
// DASHBOARD
// ---------------------------
function getDashboardSummary(appointments = []) {
  const todayAppointments = appointments.filter(a => {
    const status = normalizeAppointmentStatus(a.status || "Pending");
    return isTodayDate(normalizeDateValue(a))
      && ![true, "true"].includes(a.archivedForDentist)
      && ![true, "true"].includes(a.archived)
      && ["Pending", "Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(status);
  }).sort((a, b) => (normalizeTimeValue(a) || "99:99").localeCompare(normalizeTimeValue(b) || "99:99"));

  const patientKeys = new Set(appointments.filter(a => ![true, "true"].includes(a.archivedForDentist) && ![true, "true"].includes(a.archived)).map(getPatientClinicalKey).filter(Boolean));
  return { todayAppointments, patientCount: patientKeys.size };
}

function renderDashboard() {
  const { todayAppointments, patientCount } = getDashboardSummary(getMyAppointments());

  const dateDisplay = document.getElementById("currentDateDisplay");
  const heroUpcomingText = document.getElementById("heroUpcomingText");
  const statTodayCount = document.getElementById("statTodayCount");
  const statPatientCount = document.getElementById("statPatientCount");
  const greeting = document.getElementById("heroGreeting");
  if (greeting) greeting.textContent = `Welcome, ${currentDentistUser?.name || currentDentistUser?.fullName || "Doctor"}`;

  if (dateDisplay) {
    dateDisplay.textContent = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  if (heroUpcomingText) {
    heroUpcomingText.textContent = todayAppointments.length
      ? `You have ${todayAppointments.length} appointment${todayAppointments.length > 1 ? "s" : ""} scheduled for today.`
      : "You have 0 appointments scheduled for today.";
  }

  if (statTodayCount) statTodayCount.textContent = todayAppointments.length;
  if (statPatientCount) statPatientCount.textContent = patientCount;

  renderDashboardTable(todayAppointments);
  renderTodayQueue(todayAppointments);
  renderReminders();
}

function renderDashboardTable(todayAppointments) {
  const body = document.getElementById("dashboardTableBody");
  if (!body) return;

  body.innerHTML = "";

  if (!todayAppointments.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4" class="dashboard-empty"><i class="bi bi-calendar2-check" aria-hidden="true"></i><strong>No appointments today</strong><span>Your next appointments are available in Schedule.</span><button type="button" class="btn-soft" onclick="showSection('schedule')">View Schedule</button></td>
      </tr>
    `;
    return;
  }

  todayAppointments.forEach(apt => {
    const { timePart } = parseScheduleParts(apt.schedule);
    body.innerHTML += `
      <tr>
        <td>${escapeHtml(apt.patientName || apt.patient || "Unknown Patient")}</td>
        <td>${escapeHtml(apt.service)}</td>
        <td>${escapeHtml(timePart || normalizeTimeDisplay(apt.timeDisplay || apt.time || "") || "-")}</td>
        <td><span class="badge ${statusClassName(apt.status)}">${escapeHtml(apt.status === "Reschedule Requested" ? "Awaiting Reschedule Confirmation" : apt.status)}</span></td>
      </tr>
    `;
  });
}

function renderTodayQueue(todayAppointments) {
  const list = document.getElementById("todayQueueList");
  const title = document.getElementById("todayPanelTitle");
  const subtitle = document.getElementById("todayPanelSubtitle");

  if (!list) return;

  list.innerHTML = "";

  if (!todayAppointments.length) {
    if (title) title.textContent = "No active queue";
    if (subtitle) subtitle.textContent = "Your approved and pending appointments for today will appear here.";
    list.innerHTML = `<li>No appointments for today.</li>`;
    return;
  }

  if (title) title.textContent = `${todayAppointments.length} patient${todayAppointments.length > 1 ? "s" : ""} in today’s queue`;
  if (subtitle) subtitle.textContent = "Pending, approved, and reschedule-requested cases are listed below.";

  todayAppointments.forEach(apt => {
    const { timePart } = parseScheduleParts(apt.schedule);
    list.innerHTML += `
      <li>
        <strong>${escapeHtml(apt.patientName || apt.patient || "Unknown Patient")}</strong>
        <small>${escapeHtml(apt.service)} • ${escapeHtml(timePart || "-")} • ${escapeHtml(apt.status)}</small>
      </li>
    `;
  });
}

function renderReminders() {
  const list = document.getElementById("reminderList");
  const count = document.getElementById("reminderCount");
  if (!list) return;

  const myAppointmentIds = new Set(getMyAppointments().map(apt => String(apt.id)));
  const requests = Array.isArray(getRescheduleRequests())
    ? getRescheduleRequests().filter(r => String(r?.status || "").trim() === "Pending" && myAppointmentIds.has(String(r.appointmentId)))
    : [];

  const reminderItems = Array.isArray(defaultReminders) ? [...defaultReminders] : [];

  if (requests.length) {
    reminderItems.unshift(
      `${requests.length} reschedule request${requests.length > 1 ? "s" : ""} need review.`
    );
  }

  list.innerHTML = "";

  if (!reminderItems.length) {
    list.innerHTML = `<li>No reminders available.</li>`;
    if (count) count.textContent = "0";
    return;
  }

  reminderItems.forEach(text => {
    const li = document.createElement("li");
    li.textContent = text;
    list.appendChild(li);
  });

  if (count) count.textContent = String(reminderItems.length);
}

// ---------------------------
// SERVICES
// ---------------------------
function renderServices() {
  const grid = document.getElementById("serviceGrid");
  const select = document.getElementById("a_service");
  if (!grid) return;

  grid.innerHTML = "";

  serviceCatalog.forEach(service => {
    const aliases = {
      'oral prophylaxis teeth cleaning': 'Oral Prophylaxis',
      'dental fillings': 'Restorative Treatment',
      'teeth whitening': 'Whitening',
      'orthodontic treatment braces': 'Orthodontic Treatment'
    };
    let photoKey = window.GMSiteContent.serviceImageKey(service);
    const alias = aliases[service.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()];
    if (photoKey.startsWith('service:') && !window.GMClinicSettings?.images?.[photoKey] && alias) {
      photoKey = window.GMSiteContent.serviceImageKey({ ...service, name: alias });
    }
    grid.innerHTML += `
      <div class="service-card">
        <div>
          <img class="dentist-service-photo" data-service-image="${escapeHtml(photoKey)}" alt="${escapeHtml(service.name)}" loading="lazy" hidden>
          <div class="service-icon"><i class="bi bi-shield-check"></i></div>
          <h4>${escapeHtml(service.name)}</h4>
          <div class="price-tag">${currency(service.price)}</div>
        </div>
        <div class="service-actions">
          <button type="button" class="btn-soft" onclick="openServiceModal('${encodeURIComponent(service.name)}')">View Overview</button>
        </div>
      </div>
    `;
  });

  grid.querySelectorAll('.dentist-service-photo').forEach(image => {
    image.addEventListener('error', () => { image.hidden = true; });
  });
  window.GMRefreshServicePhotos?.();

  if (select) {
    select.innerHTML = `<option value="">Select Service</option>`;
    serviceCatalog.forEach(service => {
      select.innerHTML += `<option value="${escapeHtml(service.name)}">${escapeHtml(service.name)}</option>`;
    });
  }
}

function openServiceModal(encodedName) {
  const serviceName = decodeURIComponent(encodedName);
  const service = findService(serviceName);
  if (!service) return;

  const modal = document.getElementById("serviceModal");
  const title = document.getElementById("servicePanelTitle");
  const desc = document.getElementById("servicePanelDescription");
  const includes = document.getElementById("servicePanelIncludes");

  if (title) title.textContent = service.name;
  if (desc) desc.textContent = service.description;

  if (includes) {
    includes.innerHTML = "";
    service.includes.forEach(item => {
      includes.innerHTML += `<li>${escapeHtml(item)}</li>`;
    });
  }

  modal?.classList.add("active");
}

function closeServiceModal() {
  document.getElementById("serviceModal")?.classList.remove("active");
}

function outsideClick(event) {
  const content = event.currentTarget.querySelector(".service-modal-content");
  if (!content.contains(event.target)) {
    closeServiceModal();
  }
}

function getPatientClinicalKey(record = {}) {
  return String(
    record.patientId ||
    record.patientEmail ||
    record.email ||
    record.patientName ||
    record.patient ||
    record.name ||
    ""
  ).trim().toLowerCase();
}

function getPatientClinicalNotes() {
  const db = ensureClinicDbShape(getClinicDb());
  return safeArray(db.patientClinicalNotes)
    .map(note => ({
      ...note,
      id: String(note.id || createDentistEntityId("note")),
      patientKey: String(note.patientKey || "").trim().toLowerCase(),
      patientName: note.patientName || "Unknown Patient",
      text: String(note.text || "").trim(),
      createdAt: note.createdAt || new Date().toISOString(),
      createdBy: note.createdBy || "Dentist"
    }))
    .filter(note => note.patientKey && note.text)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function savePatientClinicalNotes(notes = []) {
  const db = ensureClinicDbShape(getClinicDb());
  db.patientClinicalNotes = safeArray(notes);
  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();
}

function getPatientNotesForKey(patientKey) {
  const key = String(patientKey || "").trim().toLowerCase();
  if (!key) return [];
  return window.GMDentistAccess.scope(ensureClinicDbShape(getClinicDb()), currentDentistUser).patientClinicalNotes.filter(note => note.patientKey === key);
}

function formatClinicalNoteDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function renderPatientNotesModalList() {
  const list = document.getElementById("patientNotesList");
  if (!list) return;

  const notes = getPatientNotesForKey(pendingPatientNotesKey);

  if (!notes.length) {
    list.innerHTML = `<div class="patient-note-empty">No findings or notes recorded yet.</div>`;
    return;
  }

  list.innerHTML = notes.map(note => `
    <div class="patient-note-item">
      <div class="patient-note-meta">
        <strong>${escapeHtml(note.createdBy)}</strong>
        <span>${escapeHtml(formatClinicalNoteDate(note.createdAt))}</span>
      </div>
      <p>${escapeHtml(note.text)}</p>
    </div>
  `).join("");
}

function openPatientNotesModal(encodedKey, encodedName) {
  if (!getMyAppointments().some(a => getPatientClinicalKey(a) === decodeURIComponent(encodedKey || "").toLowerCase())) { showToast("This patient is not assigned to you."); return; }
  pendingPatientNotesKey = decodeURIComponent(encodedKey || "").trim().toLowerCase();
  pendingPatientNotesName = decodeURIComponent(encodedName || "Unknown Patient");

  const title = document.getElementById("patientNotesTitle");
  const subtitle = document.getElementById("patientNotesSubtitle");
  const input = document.getElementById("patientFindingInput");

  if (title) title.textContent = `Findings for ${pendingPatientNotesName}`;
  if (subtitle) subtitle.textContent = "Add clinical findings, progress notes, or follow-up reminders for this patient.";
  if (input) input.value = "";

  renderPatientNotesModalList();
  document.getElementById("patientNotesModal")?.classList.add("active");
}

function closePatientNotesModal() {
  pendingPatientNotesKey = null;
  pendingPatientNotesName = "";
  document.getElementById("patientNotesModal")?.classList.remove("active");
}

function savePatientFinding() {
  const input = document.getElementById("patientFindingInput");
  const text = String(input?.value || "").trim();

  if (!pendingPatientNotesKey) {
    showToast("Patient not selected.");
    return;
  }

  if (!text) {
    showToast("Please enter findings or notes.");
    return;
  }

  const dentistName =
    currentDentistUser?.fullName ||
    currentDentistUser?.name ||
    currentDentistUser?.email ||
    "Dentist";

  const notes = getPatientClinicalNotes();
  notes.unshift({
    id: createDentistEntityId("note"),
    patientKey: pendingPatientNotesKey,
    patientName: pendingPatientNotesName || "Unknown Patient",
    text,
    createdAt: new Date().toISOString(),
    createdBy: dentistName,
    dentistId: currentDentistUser?.id || "",
    dentistEmail: currentDentistUser?.email || ""
  });

  savePatientClinicalNotes(notes);
  if (input) input.value = "";
  renderPatientNotesModalList();
  renderPatients();
  showToast("Patient findings saved.");
}

// ---------------------------
// PATIENT DIRECTORY
// ---------------------------
function completedPatientVisit(appointment) {
  const completed = String(appointment.visitStatus || appointment.status || "").trim().toLowerCase() === "completed";
  if (!completed || !appointment.completedAt || !Number.isFinite(Date.parse(appointment.completedAt))) return null;
  const date = appointment.date || parseScheduleParts(appointment.schedule || "").datePart;
  const timestamp = Date.parse(date);
  return { label: date || new Date(appointment.completedAt).toLocaleDateString("en-CA"), timestamp: Number.isFinite(timestamp) ? timestamp : Date.parse(appointment.completedAt) };
}

const dentistListPages = { directory: 1, disabled: 1, billing: 1 };
function dentistListSlice(items, key, render) {
  const size = Number(document.getElementById(key + 'PageSize')?.value || 8);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const page = dentistListPages[key] = Math.max(1, Math.min(dentistListPages[key], pages));
  const start = (page - 1) * size;
  const pagination = document.getElementById(key + 'Pagination');
  if (pagination) {
    pagination.innerHTML = `<span role="status">Showing ${items.length ? start + 1 : 0}-${Math.min(start + size, items.length)} of ${items.length}</span><div><button type="button" class="action-chip secondary" data-page="previous" ${page === 1 ? 'disabled' : ''}>Previous</button><span>Page ${page} of ${pages}</span><button type="button" class="action-chip secondary" data-page="next" ${page === pages ? 'disabled' : ''}>Next</button></div>`;
    pagination.querySelector('[data-page="previous"]').onclick = () => { dentistListPages[key]--; render(); };
    pagination.querySelector('[data-page="next"]').onclick = () => { dentistListPages[key]++; render(); };
  }
  return items.slice(start, start + size);
}
let clinicalPage = 1;
let clinicalTargetKey = '';
function goToPatientRecords(encodedKey) {
  const search = document.getElementById('clinicalSearch');
  if (search) search.value = '';
  clinicalTargetKey = encodedKey;
  renderPatients();
  showSection('records');
  const card = Array.from(document.querySelectorAll('#clinicalPatientCards [data-patient-key]'))
    .find(item => item.dataset.patientKey === encodedKey);
  if (!card) return;
  document.querySelectorAll('#clinicalPatientCards .patient-record-target').forEach(item => item.classList.remove('patient-record-target'));
  card.classList.add('patient-record-target');
  card.focus({ preventScroll: true });
  card.scrollIntoView({ block: 'center', behavior: 'auto' });
}

function getDirectoryPatientContact(appointment, profiles) {
  const normalize = value => String(value || '').trim().toLowerCase();
  const id = normalize(appointment.patientId);
  const email = normalize(appointment.patientEmail || appointment.email);
  // Match saved profiles by identity, never by a potentially shared name.
  const profile = profiles.find(p => id && normalize(p.id) === id)
    || profiles.find(p => email && normalize(p.email || p.patientEmail) === email);
  const values = [profile?.contact, profile?.phone, profile?.mobile, profile?.contactNumber,
    appointment.patientPhone, appointment.contact, appointment.phone, appointment.mobile, appointment.contactNumber];
  return values.map(value => String(value || '').trim()).find(value => /\d/.test(value)) || '';
}

function renderPatients() {
  const activeContainer = document.getElementById("patientCards");
  const disabledContainer = document.getElementById("disabledPatientCards");

  if (!activeContainer) return;
  if (disabledContainer) disabledContainer.innerHTML = "";

  const appointments = getMyAppointments();
  const directoryProfiles = window.GMDentistAccess.scope(ensureClinicDbShape(getClinicDb()), currentDentistUser).patients;
  const patientMap = new Map();
  const notesByPatient = new Map();

  getPatientClinicalNotes().forEach(note => {
    if (!notesByPatient.has(note.patientKey)) {
      notesByPatient.set(note.patientKey, { latest: note, count: 0 });
    }
    notesByPatient.get(note.patientKey).count += 1;
  });

  appointments.forEach(apt => {
    const rawName = String(apt.patientName || apt.patient || "").trim();
    const safeName = rawName || "Unknown Patient";
    const safeStatus = String(apt.status || "").trim();
    const isDisabled = apt.archivedForDentist === true || apt.archivedForDentist === "true";
    const patientKey = getPatientClinicalKey(apt) || safeName.toLowerCase();
    const savedContact = getDirectoryPatientContact(apt, directoryProfiles);

    const isBrokenRecord =
      safeStatus === "Profile Only" ||
      rawName === "" ||
      safeName === "Unknown Patient" ||
      safeName === "Dr. Daniel Santos";

    if (!patientMap.has(safeName)) {
      patientMap.set(safeName, {
        key: patientKey,
        name: safeName,
        rawName,
        contact: savedContact || "Not recorded",
        address: apt.patientAddress || apt.address || "—",
        gender: apt.gender || "—",
        age: apt.age || "—",
        condition: apt.patientCondition || apt.condition || "—",
        lastVisit: apt.schedule || "—",
        totalAppointments: 0,
        isBroken: isBrokenRecord,
        isDisabled
      });
    }

    const current = patientMap.get(safeName);
    current.totalAppointments += 1;
    current.key = current.key || patientKey;

    if (!current.lastVisit || current.lastVisit === "—") {
      current.lastVisit = apt.schedule || "—";
    }

    if (current.contact === "Not recorded" && savedContact) {
      current.contact = savedContact;
    }

    if (current.condition === "—" && (apt.patientCondition || apt.condition)) {
      current.condition = apt.patientCondition || apt.condition;
    }

    if (isBrokenRecord) current.isBroken = true;
    if (isDisabled) current.isDisabled = true;
  });

  const patients = Array.from(patientMap.values());

  const activePatients = patients.filter(p => !p.isDisabled);
  const disabledPatients = patients.filter(p => p.isDisabled);

  const buildPatientCard = (patient, isDisabledSection = false, clinical = false) => {
    const { datePart } = parseScheduleParts(patient.lastVisit);
    const noteInfo = notesByPatient.get(patient.key) || { latest: null, count: 0 };
    const latestNote = noteInfo.latest;
    const encodedKey = encodeURIComponent(patient.key || patient.name);
    const encodedName = encodeURIComponent(patient.name);
    const safeEncodedKey = escapeOnclickArg(encodedKey);
    const safeEncodedName = escapeOnclickArg(encodedName);

    if (clinical) return `<tr data-patient-key="${escapeHtml(encodedKey)}" tabindex="-1">
      <td><strong>${escapeHtml(patient.name)}</strong><small>${patient.totalAppointments} ${patient.totalAppointments === 1 ? 'appointment' : 'appointments'}</small></td>
      <td>${escapeHtml(patient.contact)}</td>
      <td>${escapeHtml(patient.condition)}</td>
      <td class="records-nowrap">${escapeHtml(datePart || '?')}</td>
      <td><strong>${noteInfo.count} ${noteInfo.count === 1 ? 'finding' : 'findings'}</strong><small class="records-note">${latestNote ? escapeHtml(latestNote.text) : 'No findings recorded yet.'}</small></td>
      <td><span class="badge ${isDisabledSection ? 'cancelled' : patient.isBroken ? 'rejected' : 'upcoming'}">${isDisabledSection ? 'Disabled' : patient.isBroken ? 'Broken Record' : 'Active'}</span></td>
      <td><div class="records-row-actions"><button type="button" class="action-chip secondary" onclick="openDentalRecord('${safeEncodedKey}', '${safeEncodedName}')">Patient Record</button><button type="button" class="action-chip secondary" onclick="openPatientNotesModal('${safeEncodedKey}', '${safeEncodedName}')">Findings</button></div></td>
    </tr>`;

    return `<tr><td><strong>${escapeHtml(patient.name)}</strong><small>${patient.totalAppointments} appointments</small></td><td>${escapeHtml(patient.contact)}</td><td class="records-nowrap">${escapeHtml(datePart || '-')}</td><td><span class="badge ${isDisabledSection ? 'cancelled' : 'upcoming'}">${isDisabledSection ? 'Disabled' : patient.isBroken ? 'Broken Record' : 'Active'}</span></td><td><div class="records-row-actions"><button type="button" class="action-chip secondary" onclick="goToPatientRecords('${safeEncodedKey}')">Records &amp; Findings</button>${patient.isBroken ? `<button type="button" class="action-chip danger" onclick="deleteBrokenPatient('${safeEncodedName}')">Delete Broken Patient</button>` : isDisabledSection ? `<button type="button" class="action-chip success" onclick="restoreDisabledPatient('${safeEncodedName}')">Restore</button>` : `<button type="button" class="action-chip warn" onclick="disablePatientRecord('${safeEncodedName}')">Disable</button>`}</div></td></tr>`;
  };

  const clinicalContainer = document.getElementById("clinicalPatientCards");
  if (clinicalContainer) {
    const query = (document.getElementById('clinicalSearch')?.value || '').trim().toLowerCase();
    const sort = document.getElementById('clinicalSort')?.value || 'name';
    const size = Number(document.getElementById('clinicalPageSize')?.value || 8);
    const findings = patient => notesByPatient.get(patient.key)?.count || 0;
    const visit = patient => Date.parse(parseScheduleParts(patient.lastVisit).datePart || '') || 0;
    const filtered = patients.filter(patient => [patient.name, patient.contact, patient.condition,
      ...getPatientClinicalNotes().filter(note => note.patientKey === patient.key).map(note => note.text)]
      .join(' ').toLowerCase().includes(query));
    filtered.sort((a,b) => {
      const name = a.name.localeCompare(b.name, 'en', {sensitivity:'base',numeric:true});
      return (sort === 'visit' ? visit(b)-visit(a) : sort === 'appointments' ? b.totalAppointments-a.totalAppointments : sort === 'findings' ? findings(b)-findings(a) : sort === 'name-desc' ? -name : name) || name;
    });
    const pages = Math.max(1, Math.ceil(filtered.length / size));
    if (clinicalTargetKey) {
      const index = filtered.findIndex(patient => encodeURIComponent(patient.key || patient.name) === clinicalTargetKey);
      if (index >= 0) clinicalPage = Math.floor(index / size) + 1;
      clinicalTargetKey = '';
    }
    clinicalPage = Math.max(1, Math.min(clinicalPage, pages));
    const start = (clinicalPage-1)*size;
    clinicalContainer.innerHTML = filtered.length ? filtered.slice(start,start+size).map(patient => buildPatientCard(patient,patient.isDisabled,true)).join('') : '<tr><td colspan="7">No matching patient records.</td></tr>';
    const pagination = document.getElementById('clinicalPagination');
    if (pagination) {
      pagination.innerHTML = `<span role="status">Showing ${filtered.length ? start+1 : 0}?${Math.min(start+size,filtered.length)} of ${filtered.length}</span><div><button type="button" class="action-chip secondary" ${clinicalPage===1?'disabled':''} data-page="previous">Previous</button><span>Page ${clinicalPage} of ${pages}</span><button type="button" class="action-chip secondary" ${clinicalPage===pages?'disabled':''} data-page="next">Next</button></div>`;
      pagination.querySelector('[data-page="previous"]').onclick = () => { clinicalPage--; renderPatients(); };
      pagination.querySelector('[data-page="next"]').onclick = () => { clinicalPage++; renderPatients(); };
    }
  }

  const renderDirectory = (items, key, container, disabled) => {
    if (!container) return;
    const query = (document.getElementById(key + 'Search')?.value || '').trim().toLowerCase();
    const sort = document.getElementById(key + 'Sort')?.value || 'name';
    const filtered = items.filter(p => [p.name, p.contact, p.condition].join(' ').toLowerCase().includes(query));
    filtered.sort((a, b) => {
      const name = a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true });
      const visit = p => Date.parse(parseScheduleParts(p.lastVisit).datePart || '') || 0;
      return (sort === 'visit' ? visit(b) - visit(a) : sort === 'appointments' ? b.totalAppointments - a.totalAppointments : sort === 'name-desc' ? -name : name) || name;
    });
    container.innerHTML = dentistListSlice(filtered, key, renderPatients).map(p => buildPatientCard(p, disabled)).join('') || '<tr><td colspan="5">No matching patients.</td></tr>';
  };
  renderDirectory(activePatients, 'directory', activeContainer, false);
  renderDirectory(disabledPatients, 'disabled', disabledContainer, true);
}

function deleteBrokenPatient(encodedName) {
  const patientName = decodeURIComponent(encodedName);
  let appointments = getAppointments();

  const beforeCount = appointments.length;

  appointments = appointments.filter(item => {
    const rawName = String(item.patientName || item.patient || "").trim();
    const safeName = rawName || "Unknown Patient";
    const safeStatus = String(item.status || "").trim();

    const isBrokenRecord =
      safeStatus === "Profile Only" ||
      rawName === "" ||
      safeName === "Unknown Patient" ||
      safeName === "Dr. Daniel Santos";

    if (safeName === patientName && isBrokenRecord) {
      return false;
    }

    return true;
  });

  const removedCount = beforeCount - appointments.length;
  saveAppointments(appointments);

  showToast(removedCount ? "Broken patient record deleted." : "No broken records found.");
  refreshDentistUI();
}

function disablePatientRecord(encodedName) {
  const patientName = decodeURIComponent(encodedName);
  let appointments = getAppointments();
  let updated = false;

  appointments = appointments.map(item => {
    const safeName = String(item.patientName || item.patient || "").trim() || "Unknown Patient";

    if (safeName === patientName) {
      updated = true;
      return {
        ...item,
        archivedForDentist: true,
        updatedAt: new Date().toISOString()
      };
    }

    return item;
  });

  saveAppointments(appointments);
  showToast(updated ? `${patientName} disabled.` : "Patient not found.");
  refreshDentistUI();
}

function restoreDisabledPatient(encodedName) {
  const patientName = decodeURIComponent(encodedName);
  let appointments = getAppointments();
  let updated = false;

  appointments = appointments.map(item => {
    const safeName = String(item.patientName || item.patient || "").trim() || "Unknown Patient";

    if (safeName === patientName) {
      updated = true;
      return {
        ...item,
        archivedForDentist: false,
        updatedAt: new Date().toISOString()
      };
    }

    return item;
  });

  saveAppointments(appointments);
  showToast(updated ? `${patientName} restored.` : "Patient not found.");
  refreshDentistUI();
}

// ---------------------------
// SCHEDULE
// ---------------------------
function renderScheduleTable() {
  const body = document.getElementById("scheduleTableBody");
  if (!body) return;

  const searchValue = (document.getElementById("scheduleSearch")?.value || "").trim().toLowerCase();
  const statusValue = document.getElementById("statusFilter")?.value || "All";

  const allAppointments = getMyAppointments();
  const sessionNumberMap = buildSessionNumberMap(allAppointments);

  const visibleAppointments = allAppointments
    .filter(item => {
      const safeStatus = normalizeAppointmentStatus(item.status || "Pending");
      const patientName = String(item.patientName || item.patient || "").trim();

      return (
        ["Pending", "Approved", "Ongoing", "Reschedule Requested", "Reschedule Rejected"].includes(safeStatus) &&
        safeStatus !== "Cancelled" && // Exclude cancelled appointments
        patientName !== "" &&
        item.archivedForDentist !== true
      );
    })
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  const filtered = visibleAppointments.filter(item => {
    const patientName = String(item.patientName || item.patient || "Unknown Patient");
    const safeStatus = normalizeAppointmentStatus(item.status || "Pending");
    const serviceLabel = getSessionLabel(item, sessionNumberMap);
    const haystack = `${patientName} ${serviceLabel}`.toLowerCase();

    const textMatch = !searchValue || haystack.includes(searchValue);
    const statusMatch = statusValue === "All" || safeStatus === statusValue;

    return textMatch && statusMatch;
  });

  body.innerHTML = "";

  if (!filtered.length) {
    body.innerHTML = `
      <tr>
        <td colspan="6">No matching records found.</td>
      </tr>
    `;
    return;
  }

  filtered.forEach(item => {
    const { datePart, timePart } = parseScheduleParts(item.schedule);
    const safeStatus = normalizeAppointmentStatus(item.status || "Pending");
    const safeStatusClass = statusClassName(safeStatus);
    const conflictWarning = safeStatus === "Pending" && hasPendingConflict(item);
    const serviceLabel = getSessionLabel(item, sessionNumberMap);

    body.innerHTML += `
      <tr data-appointment-id="${escapeHtml(item.id)}">
        <td>${escapeHtml(item.patientName || item.patient || "Unknown Patient")}</td>
        <td>${escapeHtml(serviceLabel)}</td>
        <td>${escapeHtml(datePart || "-")}</td>
        <td>${escapeHtml(timePart || "-")}</td>
        <td>
          <span class="badge ${safeStatusClass}">
            ${escapeHtml(safeStatus)}
          </span>
          ${conflictWarning ? `<div class="small text-danger mt-1">⚠ Slot already occupied</div>` : ``}
        </td>
        <td>${buildDentistAppointmentActions(item)}</td>
      </tr>
    `;
  });
} 

// ==============================
// DISCONTINUATION REQUESTS
// ==============================
function renderDiscontinuationRequests() {
  const body = document.getElementById("discontinuationTableBody");
  const badge = document.getElementById("discontinuationRequestCount");
  if (!body) return;

  const plans = getTreatmentPlans().filter(plan =>
    normalizeTreatmentPlanStatus(plan.status || "") === "Discontinuation Requested"
  );

  body.innerHTML = "";

  if (badge) badge.textContent = plans.length;

  if (!plans.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5">No pending discontinuation requests.</td>
      </tr>
    `;
    return;
  }

  plans.forEach(plan => {
    const requestedAt = plan.discontinuationRequestedAt
      ? new Date(plan.discontinuationRequestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";
    const safeId = escapeOnclickArg(plan.treatmentId || plan.id || "");

    body.innerHTML += `
      <tr>
        <td>${escapeHtml(plan.patientName || "Unknown Patient")}</td>
        <td>${escapeHtml(plan.serviceName || plan.service || "Orthodontic Treatment")}</td>
        <td>
          <div class="d-flex flex-column">
            <small style="color:var(--text-muted);">Reason</small>
            <strong>${escapeHtml(plan.discontinuationReason || "No reason provided")}</strong>
          </div>
        </td>
        <td>${requestedAt}</td>
        <td>
          <div class="action-buttons">
            <button class="action-chip success" onclick="approveDiscontinuationRequest('${safeId}')">
              Approve &amp; Discontinue
            </button>
            <button class="action-chip warn" onclick="openConsultationRequestModal('${safeId}')">
              Request Consultation
            </button>
          </div>
        </td>
      </tr>
    `;
  });
}

function approveDiscontinuationRequest(treatmentId) {
  const plan = getTreatmentPlanById(treatmentId);
  if (!plan) { showToast("Treatment plan not found."); return; }

  if (normalizeTreatmentPlanStatus(plan.status || "") !== "Discontinuation Requested") {
    showToast("This plan is no longer pending a discontinuation request.");
    return;
  }

  updateTreatmentPlanById(treatmentId, current => ({
    ...current,
    status: "Discontinued",
    discontinuationApprovedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  pushPatientNotification(
    `Your request to discontinue ${plan.serviceName || "Orthodontic Treatment"} has been approved. Please visit the clinic for your final removal appointment.`,
    {
      patientId: plan.patientId,
      treatmentId: plan.treatmentId || plan.id,
      eventType: "treatment_discontinuation_approved"
    }
  );

  showToast(`${plan.serviceName || "Orthodontic Treatment"} treatment discontinued for ${plan.patientName || "patient"}.`);
  refreshDentistUI();
}

// ==============================
// REQUEST CONSULTATION FLOW
// ==============================
let _consultationRequestTargetId = null;

function openConsultationRequestModal(treatmentId) {
  _consultationRequestTargetId = String(treatmentId || "");
  const noteInput = document.getElementById("consultationNoteInput");
  if (noteInput) {
    noteInput.value = "";
    noteInput.classList.remove("cancel-reason-error");
  }
  const modal = document.getElementById("consultationRequestModal");
  if (modal) modal.classList.add("active");
}

function closeConsultationRequestModal() {
  const modal = document.getElementById("consultationRequestModal");
  if (modal) modal.classList.remove("active");
  _consultationRequestTargetId = null;
}

function submitConsultationRequest() {
  const id = _consultationRequestTargetId;
  if (!id) return;

  const noteInput = document.getElementById("consultationNoteInput");
  const note = (noteInput?.value || "").trim();

  if (!note) {
    noteInput?.classList.add("cancel-reason-error");
    noteInput?.focus();
    showToast("Please enter a note for the patient.");
    return;
  }
  noteInput?.classList.remove("cancel-reason-error");

  const plan = getTreatmentPlanById(id);
  if (!plan) { showToast("Treatment plan not found."); return; }

  if (normalizeTreatmentPlanStatus(plan.status || "") !== "Discontinuation Requested") {
    showToast("This plan is no longer pending a discontinuation request.");
    closeConsultationRequestModal();
    return;
  }

  // Update plan status — the patient will pick their own date/time for the free consultation
  updateTreatmentPlanById(id, current => ({
    ...current,
    status: "Pending Consultation",
    consultationNote: note,
    consultationSessionId: "",
    consultationRequestedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  pushPatientNotification(
    `Your discontinuation request for ${plan.serviceName || "Orthodontic Treatment"} requires a consultation before it can be processed. Dentist note: "${note}". Please book your free consultation slot through your Active Treatment Plans.`,
    {
      patientId: plan.patientId,
      treatmentId: plan.treatmentId || plan.id,
      eventType: "consultation_required_for_discontinuation"
    }
  );

  showToast(`Consultation requested for ${plan.patientName || "patient"}. Patient will book the slot.`);
  closeConsultationRequestModal();
  refreshDentistUI();
}

function renderRescheduleRequests() {
  const body = document.getElementById("rescheduleTableBody");
  const badge = document.getElementById("rescheduleRequestCount");
  if (!body) return;

  const requests = getRescheduleRequests().filter(req => {
    return String(req.status || "Pending").trim() === "Pending";
  });

  body.innerHTML = "";

  if (badge) {
    badge.textContent = requests.length;
  }

  if (!requests.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5">No pending reschedule requests.</td>
      </tr>
    `;
    return;
  }

  requests.forEach(req => {
    body.innerHTML += `
      <tr>
        <td>${escapeHtml(req.patientName || "Unknown Patient")}</td>
        <td>${escapeHtml(req.service || "-")}</td>
        <td>
          <div class="d-flex flex-column">
            <small style="color:var(--text-muted);">Current</small>
            <strong>${escapeHtml(req.previousSchedule || req.before || "-")}</strong>
          </div>
        </td>
        <td>
          <div class="d-flex flex-column">
            <small style="color:var(--text-muted);">Requested</small>
            <strong style="color:#22c55e;">${escapeHtml(req.requestedSchedule || "-")}</strong>
            <small style="color:var(--text-muted); margin-top:6px;">
              ${escapeHtml(req.reason || "No reason provided")}
            </small>
          </div>
        </td>
        <td>
          <div class="action-buttons">
            <button class="action-chip success" onclick="approveRescheduleRequest('${req.id}')">
              Confirm Reschedule
            </button>

            <button class="action-chip danger" onclick="rejectRescheduleRequest('${req.id}')">
              Reject
            </button>
          </div>
        </td>
      </tr>
    `;
  });
}

function filterSchedule(status) {
  const statusFilter = document.getElementById("statusFilter");
  if (statusFilter) {
    statusFilter.value = status;
  }
  showSection("schedule");
  renderScheduleTable();
}

// ==============================
// APPOINTMENT FLOW HELPERS
// ==============================
function normalizeAppointmentFinancials(apt = {}) {
   if (String(apt.status || "").trim() === "Completed") {
    return {
      ...apt,
      visitStatus: "Completed",
      lifecycleStatus: "Completed",
      overallCaseStatus: "Completed"
    };
  }
  const rawServiceNames = Array.isArray(apt.services) && apt.services.length
    ? apt.services.map(service => service.serviceName || service.name || service.service || "").filter(Boolean)
    : String(apt.service || "").split("+").map(service => service.trim()).filter(Boolean);
  const amountPaidOnline = Number(apt.amountPaidOnline || 0);
  const amountPaidInClinic = Number(apt.amountPaidInClinic || 0);
  const storedCollected = Number(
    apt.totalCollected != null
      ? apt.totalCollected
      : amountPaidOnline + amountPaidInClinic
  );
  const downPayment = Number(apt.downPayment || 0);
  const visitStatus = normalizeVisitStatus(apt.visitStatus || apt.status || "Pending");
  let normalizedServices = getNormalizedAppointmentServices(apt, { visitStatus });
  const currentServicePaid = normalizedServices.reduce((sum, service) => sum + Number(service.totalPaid || 0), 0);

  const feePaid = window.GMAdditionalFees.paymentSummary(apt).paid;
  const serviceCollected = Math.max(0, storedCollected - feePaid);
  if (normalizedServices.length && serviceCollected > currentServicePaid) {
    normalizedServices = applyPaymentToServices(normalizedServices, serviceCollected - currentServicePaid, {
      target: "all",
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
  const overallCaseStatus = deriveOverallCaseStatus(normalizedServices, visitStatus);
  const rawStatus = String(apt.status || "").trim();
  const normalizedVisitStatus =
    ["Cancelled", "Rejected", "Reschedule Rejected"].includes(rawStatus)
      ? rawStatus
      : visitStatus;
    let derivedStatus;

    if (String(apt.status || "").trim() === "Completed") {
      derivedStatus = "Completed";
    } else if (["Cancelled", "Rejected", "Reschedule Rejected"].includes(normalizedVisitStatus)) {
      derivedStatus = normalizedVisitStatus;
    } else if (overallCaseStatus === "Completed") {
      derivedStatus = "Completed";
    } else {
      derivedStatus = normalizedVisitStatus;
    }
  const derivedTreatmentId = rawServiceNames.some(isLongTermTreatmentService)
    ? String(apt.treatmentId || `trt-${String(apt.patientId || apt.patientEmail || apt.patientName || apt.patient || apt.id || "patient").trim().replace(/\s+/g, "-").toLowerCase()}-orthodontic-treatment`)
    : String(apt.treatmentId || "");
  const archived = (apt.archived === true && String(apt.archivedBy || "").toLowerCase() === "dentist") || apt.archivedForDentist === true;

  return {
    ...apt,
    services: normalizedServices,
    service: apt.service || normalizedServices.map(service => service.serviceName).join(" + "),
    patientId: String(apt.patientId || apt.patientEmail || apt.patientName || apt.patient || "").trim(),
    patientEmail: String(apt.patientEmail || apt.email || "").trim(),
    dentistId: String(apt.dentistId || "").trim(),
    treatmentId: derivedTreatmentId,
    sessionId: String(apt.sessionId || (derivedTreatmentId ? `${apt.id || createDentistEntityId("apt")}-session` : "")).trim(),
    serviceFlowType: apt.serviceFlowType || (rawServiceNames.some(isLongTermTreatmentService) ? "long_term_treatment" : rawServiceNames.some(isMultiVisitService) ? "multi_visit" : "single_visit"),
    timeDisplay: normalizeTimeDisplay(apt.timeDisplay || parseScheduleParts(apt.schedule || "").timePart || apt.time || ""),
    price: totals.totalAmount,
    paid: totals.remainingBalance <= 0,
    visitStatus: normalizedVisitStatus,
    overallCaseStatus,
    requiresDownPayment: totals.requiresDownPayment,
    minimumDownPayment: totals.minimumDownPayment,
    qualifyingDownpaymentBase: totals.qualifyingDownpaymentBase,
    subtotal: totals.totalAmount,
    invoiceUnlocked: !!apt.invoiceUnlocked,
    downPayment,
    amountPaidOnline,
    amountPaidInClinic,
    totalCollected: totals.totalPaid,
    remainingBalance: totals.remainingBalance,
    paymentStatus: totals.overallPaymentStatus,
    lifecycleStatus: derivedStatus,
    status: archived ? "Archived" : derivedStatus,
    archived,
    revenueCountedOnline: Number(apt.revenueCountedOnline || 0),
    revenueCountedClinic: Number(apt.revenueCountedClinic || 0)
  };
}

const LONG_TERM_TREATMENT_KEYWORDS = ["orthodontic treatment"];

function normalizeServiceKey(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isLongTermTreatmentService(serviceName = "") {
  const key = normalizeServiceKey(serviceName);
  return LONG_TERM_TREATMENT_KEYWORDS.some(keyword => key.includes(keyword));
}

function getServiceFlowType(serviceName = "") {
  const key = normalizeServiceKey(serviceName);
  if (isLongTermTreatmentService(key)) return "long_term_treatment";
  if (["root canal treatment", "crowns and bridges", "complete denture", "partial denture", "flexible denture"].some(keyword => key.includes(keyword))) {
    return "multi_visit";
  }
  return "single_visit";
}

function isMultiVisitService(serviceName = "") {
  return getServiceFlowType(serviceName) === "multi_visit";
}

function toTitleCaseLabel(value = "") {
  return String(value || "")
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeVisitStatus(status = "") {
  return normalizeAppointmentStatus(status || "Pending");
}

function normalizeOverallPaymentStatus(status = "") {
  const raw = String(status || "").trim();
  if (!raw) return "Unpaid";
  const lowered = raw.toLowerCase();
  if (lowered === "partial" || lowered === "partially paid") return "Partially Paid";
  if (lowered === "downpayment paid") return "Downpayment Paid";
  if (lowered === "installment ongoing") return "Installment Ongoing";
  if (lowered === "paid") return "Paid";
  if (lowered === "unpaid") return "Unpaid";
  return toTitleCaseLabel(raw);
}

function normalizeServiceStatus(status = "", context = {}) {
  const raw = String(status || "").trim();
  const { isLongTermTreatment = false, visitCompleted = false, remainingBalance = 0 } = context;
  if (!raw) {
    if (visitCompleted) return isLongTermTreatment && remainingBalance > 0 ? "Active" : "Completed";
    return "Pending";
  }
  const lowered = raw.toLowerCase();
  if (lowered === "completed") return "Completed";
  if (lowered === "active") return "Active";
  if (lowered === "ongoing") return "Ongoing";
  if (lowered === "started") return "Started";
  if (lowered === "pending") return "Pending";
  return toTitleCaseLabel(raw);
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
  if (normalized === "Partially Paid") {
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
    const catalogService = serviceCatalog.find(service => service.name === serviceName);
    return normalizeBillingServiceRecord({
      serviceName,
      price: Number(catalogService?.price || perServicePrice || 0),
      paymentMode: hasInstallmentHistory ? (isLongTermTreatmentService(serviceName) ? "installment" : "downpayment") : "full",
      paidDownpayment: legacyDownPayment,
      serviceStatus: String(apt.status || "").trim() === "Completed" ? "Completed" : "",
      paymentStatus: apt.paymentStatus || "Unpaid"
    }, { visitStatus });
  });
}

function normalizeBillingServiceRecord(serviceObj = {}, options = {}) {
  const raw = typeof serviceObj === "string" ? { serviceName: serviceObj } : { ...(serviceObj || {}) };
  const serviceName = raw.serviceName || raw.name || raw.service || "Service";
  const catalogService = serviceCatalog.find(service => service.name === serviceName);
  const price = Number(raw.price != null ? raw.price : raw.cost != null ? raw.cost : catalogService?.price || 0);
  const isLongTermTreatment =
    raw.isLongTermTreatment != null ? !!raw.isLongTermTreatment : isLongTermTreatmentService(serviceName);
  
  let paymentMode = raw.paymentMode;
  if (!paymentMode) {
    const hasDownpaymentHistory =
      ["Downpayment Paid", "Installment Ongoing"].includes(normalizeOverallPaymentStatus(raw.paymentStatus || "")) ||
      (Number(raw.paidDownpayment || 0) > 0 && Number(raw.remainingBalance || 0) > 0);

    if (isLongTermTreatmentService(serviceName) && hasDownpaymentHistory) {
      paymentMode = "installment";
    } else if (hasDownpaymentHistory) {
      paymentMode = "downpayment";
    } else {
      paymentMode = "full";
    }
  }

  if (!isLongTermTreatmentService(serviceName) && !["full", "downpayment"].includes(paymentMode)) {
    paymentMode = "full";
  }

  let requiresDownpayment = raw.requiresDownpayment != null ? !!raw.requiresDownpayment : price > 0;
  let requiredDownpayment = Number(
    raw.requiredDownpayment != null
      ? raw.requiredDownpayment
      : (requiresDownpayment ? Math.max(1, Math.round(price * 0.10)) : 0)
  );
  
  const paidDownpayment = Number(
    options.paidDownpayment != null ? options.paidDownpayment : raw.paidDownpayment || 0
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
  const visitCompleted = visitStatus === "Completed" || String(raw.status || "").trim() === "Completed";
  const serviceStatus = normalizeServiceStatus(raw.serviceStatus || raw.treatmentStatus || "", {
    isLongTermTreatment,
    visitCompleted,
    remainingBalance
  });

  const normalizedRecord = {
    participantId: raw.participantId || "main",
    participantName: raw.participantName || "",
    serviceName,
    price,
    serviceStatus,
    paymentMode,
    requiresDownpayment,
    requiredDownpayment,
    paidDownpayment: Math.min(requiredDownpayment || price, paidDownpayment),
    totalPaid,
    remainingBalance,
    additionalPayments,
    isLongTermTreatment
  };

  return {
    ...normalizedRecord,
    paymentStatus: normalizeServicePaymentStatus(raw.paymentStatus || "", normalizedRecord)
  };
}

function getNormalizedAppointmentServices(apt = {}, options = {}) {
  const baseServices = Array.isArray(apt.services) && apt.services.length
    ? apt.services
    : buildLegacyServiceRecords(apt, options.visitStatus);

  return baseServices.map(serviceRecord =>
    normalizeBillingServiceRecord(serviceRecord, {
      visitStatus: options.visitStatus || apt.visitStatus || apt.status || "Pending"
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
  const qualifyingDownpaymentBase = servicesList.reduce((sum, service) => {
    return sum + (service.paymentMode !== "full" ? Number(service.price || 0) : 0);
  }, 0);
  const minimumDownPayment = servicesList.reduce((sum, service) => {
    if (!["installment", "downpayment"].includes(service.paymentMode) || Number(service.remainingBalance || 0) <= 0) {
      return sum;
    }
    const neededDownpayment = Math.max(
      0,
      Number(service.requiredDownpayment || 0) - Number(service.paidDownpayment || 0)
    );
    return sum + neededDownpayment;
  }, 0);
  const requiresDownPayment = minimumDownPayment > 0;

  let overallPaymentStatus = "Unpaid";
  if (servicesList.length ? servicesList.every(service => service.paymentStatus === "Paid") : totalPaid >= totalAmount && totalAmount > 0) {
    overallPaymentStatus = "Paid";
  } else if (totalPaid > 0) {
    overallPaymentStatus = "Partially Paid";
  }

  return {
    totalAmount,
    totalPaid,
    remainingBalance,
    overallPaymentStatus,
    serviceCount: servicesList.length,
    installmentServices: servicesList.filter(service => service.paymentMode === "installment").length,
    qualifyingDownpaymentBase,
    requiresDownPayment,
    minimumDownPayment
  };
}

function deriveOverallCaseStatus(serviceRecords = [], visitStatus = "Pending") {
  if (!Array.isArray(serviceRecords) || !serviceRecords.length) {
    return visitStatus === "Completed" ? "Ongoing" : "Pending";
  }

  if (serviceRecords.every(service => service.serviceStatus === "Completed")) {
    return "Completed";
  }

  if (serviceRecords.some(service => ["Started", "Active", "Ongoing"].includes(service.serviceStatus))) {
    return "Ongoing";
  }

  if (serviceRecords.every(service => service.serviceStatus === "Pending")) {
    return "Pending";
  }

  return visitStatus === "Completed" ? "Ongoing" : "Ongoing";
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
  let normalizedServices = Array.isArray(serviceRecords)
    ? serviceRecords.map(serviceRecord => normalizeBillingServiceRecord(serviceRecord))
    : [];

  if (!remaining || !normalizedServices.length) {
    return {
      services: normalizedServices,
      appliedAmount: 0
    };
  }

  const buildTargets = (mode = "all") => {
    if (mode === "downpayment") {
      return normalizedServices
        .map((serviceRecord, index) => ({ serviceRecord, index }))
        .filter(({ serviceRecord }) => {
          const downpaymentGap = Math.max(
            0,
            Number(serviceRecord.requiredDownpayment || 0) - Number(serviceRecord.paidDownpayment || 0)
          );
          return serviceRecord.requiresDownpayment && serviceRecord.remainingBalance > 0 && downpaymentGap > 0;
        });
    }

    if (mode === "one-visit") {
      return normalizedServices
        .map((serviceRecord, index) => ({ serviceRecord, index }))
        .filter(({ serviceRecord }) => !serviceRecord.isLongTermTreatment && serviceRecord.remainingBalance > 0);
    }

    return normalizedServices
      .map((serviceRecord, index) => ({ serviceRecord, index }))
      .filter(({ serviceRecord }) => serviceRecord.remainingBalance > 0)
      .sort((left, right) => {
        if (!!left.serviceRecord.isLongTermTreatment === !!right.serviceRecord.isLongTermTreatment) return 0;
        return left.serviceRecord.isLongTermTreatment ? 1 : -1;
      });
  };

  const targetMode = options.target || "all";
  const targets = buildTargets(targetMode);

  targets.forEach(({ index }) => {
    if (remaining <= 0) return;

    const current = normalizedServices[index];
    const paymentCap = targetMode === "downpayment"
      ? Math.max(0, Number(current.requiredDownpayment || 0) - Number(current.paidDownpayment || 0))
      : Number(current.remainingBalance || 0);
    const paymentAmount = Math.min(remaining, paymentCap);

    if (paymentAmount <= 0) return;

    normalizedServices[index] = addPaymentToServiceRecord(current, paymentAmount, options, {
      applyToDownpayment: targetMode === "downpayment"
    });
    remaining -= paymentAmount;
  });

  return {
    services: normalizedServices,
    appliedAmount: Math.max(0, Number(amount || 0) - remaining)
  };
}

function migrateLegacyAppointmentsToClinicDb() {
  const db = ensureClinicDbShape(getClinicDb());
  const clinicList = safeArray(db.appointments);
  const legacyList = safeArray(getData(STORAGE_KEYS.appointments, []));

  if (clinicList.length || !legacyList.length) return;

  const migrated = legacyList.map(item => normalizeAppointmentFinancials({
    ...item,
    patientName: item.patientName || item.patient || "Unknown Patient",
    patient: item.patientName || item.patient || "Unknown Patient",
    updatedAt: item.updatedAt || new Date().toISOString()
  }));

  saveAppointments(migrated);
}
function updateDentistAppointment(id, updater) {
  const db = ensureClinicDbShape(getClinicDb());

  const activeIndex = safeArray(db.appointments).findIndex(item => String(item.id) === String(id));
  const archivedIndex = activeIndex === -1
    ? safeArray(db.archivedAppointments).findIndex(item => String(item.id) === String(id))
    : -1;

  const targetCollection =
    activeIndex > -1 ? db.appointments :
    archivedIndex > -1 ? db.archivedAppointments :
    null;

  const targetIndex =
    activeIndex > -1 ? activeIndex :
    archivedIndex > -1 ? archivedIndex :
    -1;

  if (!targetCollection || targetIndex === -1) return null;

  const current = normalizeAppointmentFinancials(targetCollection[targetIndex]);
  const updatedRaw =
    typeof updater === "function"
      ? updater({ ...current })
      : (updater && typeof updater === "object" ? updater : null);

  if (!updatedRaw || typeof updatedRaw !== "object") {
    return null;
  }

  const nextAppointment = normalizeAppointmentFinancials({
    ...current,
    ...updatedRaw,
    updatedAt: new Date().toISOString()
  });

  targetCollection[targetIndex] = nextAppointment;

  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();

  return nextAppointment;
}

function canArchiveStatus(status) {
  return ["Rejected", "Cancelled", "Completed"].includes(normalizeAppointmentStatus(status));
}

function normalizeDateValue(apt = {}) {
  if (apt.date) return String(apt.date).trim();

  const { datePart } = parseScheduleParts(apt.schedule || "");
  return String(datePart || "").trim();
}

function normalizeTimeValue(apt = {}) {
  if (apt.time) {
    const raw = String(apt.time).trim();
    return /am|pm/i.test(raw) ? convertDisplayTimeTo24(raw) : raw;
  }

  const { timePart } = parseScheduleParts(apt.schedule || "");
  return convertDisplayTimeTo24(timePart || "");
}

function normalizeDentistValue(apt = {}) {
  return String(apt.dentistId || apt.dentist || apt.dentistName || "Dr. Daniel Santos").trim().toLowerCase();
}

function buildSlotKey(apt = {}) {
  const dentist = normalizeDentistValue(apt);
  const date = normalizeDateValue(apt);
  const time = normalizeTimeValue(apt);

  return `${dentist}__${date}__${time}`;
}
function hasAppointmentConflict(targetAppointment, options = {}) {
  const {
    excludeId = null,
    includePending = false,
    includeRescheduleRequested = false
  } = options;

  const appointments = getAppointments();
  const targetKey = buildSlotKey(targetAppointment);

  return appointments.some((apt) => {
    if (excludeId && String(apt.id) === String(excludeId)) return false;
    if (apt.archivedForDentist === true) return false;

    const aptKey = buildSlotKey(apt);
    if (aptKey !== targetKey) return false;

    const status = String(apt.status || "").trim();

    if (["Approved", "Ongoing"].includes(normalizeAppointmentStatus(status))) return true;
    if (includePending && normalizeAppointmentStatus(status) === "Pending") return true;
    if (includeRescheduleRequested && ["Reschedule Requested", "Reschedule Rejected"].includes(normalizeAppointmentStatus(status))) return true;

    return false;
  });
}

function tryApproveAppointmentSlot(appointmentId, nextSchedule = null) {
  const appointments = getAppointments();
  const index = appointments.findIndex(a => String(a.id) === String(appointmentId));

  if (index === -1) {
    return {
      ok: false,
      reason: "Appointment not found."
    };
  }

  const current = normalizeAppointmentFinancials(appointments[index]);

  let candidate = {
    ...current,
    status: "Approved"
  };

  if (nextSchedule) {
    const { datePart, timePart } = parseScheduleParts(nextSchedule);

    candidate = {
      ...candidate,
      schedule: nextSchedule,
      date: datePart || current.date || "",
      time: timePart || current.time || ""
    };
  }

  candidate = normalizeAppointmentFinancials(candidate);

  const conflict = hasAppointmentConflict(candidate, {
    excludeId: candidate.id
  });

  if (conflict) {
    return {
      ok: false,
      reason: "This time slot is already occupied by another approved appointment."
    };
  }

  appointments[index] = {
    ...candidate,
    status: "Approved",
    visitStatus: "Approved",
    invoiceUnlocked: true,
    updatedAt: new Date().toISOString()
  };

  saveAppointments(appointments);
  if (appointments[index].treatmentId) {
    upsertTreatmentPlanFromAppointment(appointments[index], { status: "Active" });
  }

  return {
    ok: true,
    appointment: appointments[index]
  };
}

function repairApprovedScheduleConflicts() {
  const appointments = getAppointments();
  const seen = new Set();
  let changed = false;

  const fixed = appointments.map((apt) => {
    const status = String(apt.status || "").trim();
    if (status !== "Approved") return apt;

    const key = buildSlotKey(apt);

    if (seen.has(key)) {
      changed = true;
      return {
        ...apt,
        status: "Pending",
        updatedAt: new Date().toISOString()
      };
    }

    seen.add(key);
    return apt;
  });

  if (changed) {
    saveAppointments(fixed);
  }
}

function hasPendingConflict(item) {
  return hasAppointmentConflict(item, {
    excludeId: item.id
  });
}

function reconcileTreatmentPlanFromAppointment(appointment, options = {}) {
  if (!appointment?.treatmentId) return null;

  const currentPlan = upsertTreatmentPlanFromAppointment(appointment, { status: options.status || "Active" }) || getTreatmentPlanById(appointment.treatmentId);
  if (!currentPlan) return null;

  const sessions = safeArray(currentPlan.sessions);
  let nextStatus = options.completePlan ? "Completed" : currentPlan.status || "Active";

  if (!options.completePlan) {
    if (sessions.length && sessions.every(session => ["Cancelled", "Rejected"].includes(normalizeAppointmentStatus(session.status)))) {
      nextStatus = "Cancelled";
    } else {
      nextStatus = "Active";
    }
  }

  return updateTreatmentPlanById(currentPlan.treatmentId, plan => ({
    ...plan,
    status: nextStatus,
    nextSessionDate: options.completePlan ? "" : plan.nextSessionDate,
    nextSessionTime: options.completePlan ? "" : plan.nextSessionTime
  }));
}
async function approveAppointment(id) {
  const current = getAppointments().find(a => String(a.id) === String(id));

  if (!current) {
    showToast("Appointment not found.");
    return;
  }

  if (normalizeAppointmentStatus(current.status || "Pending") !== "Pending") {
    showToast("Only pending appointments can be approved.");
    return;
  }

  const candidate = normalizeAppointmentFinancials({
    ...current,
    status: "Approved",
    visitStatus: "Approved"
  });

  if (hasAppointmentConflict(candidate, { excludeId: candidate.id })) {
    showToast("This time slot is already occupied by another approved appointment.");
    pushPatientNotification(
      `Your appointment for ${current.service} on ${current.schedule} could not be approved because the slot is already taken. Please choose another schedule.`
    );
    return;
  }

  const updated = updateDentistAppointment(id, (apt) => ({
    ...apt,
    status: "Approved",
    visitStatus: "Approved",
    invoiceUnlocked: true,
    updatedAt: new Date().toISOString()
  }));

  if (!updated) {
    showToast("Appointment not found.");
    return;
  }

  if (updated.treatmentId) {
    reconcileTreatmentPlanFromAppointment(updated, { status: "Active" });
  }

  pushPatientNotification(
    updated.treatmentId
      ? `Your ${updated.service} session on ${updated.schedule} has been approved.`
      : updated.requiresDownPayment
        ? `Your appointment for ${updated.service} has been approved. A minimum down payment of ₱${updated.minimumDownPayment.toLocaleString()} is now required.`
        : `Your appointment for ${updated.service} has been approved. You may now view and pay the invoice online if you want.`,
    {
      patientId: updated.patientId,
      appointmentId: updated.id,
      treatmentId: updated.treatmentId || "",
      sessionId: updated.sessionId || "",
      eventType: updated.treatmentId ? "treatment_session_approved" : "appointment_approved"
    }
  );

  pushDentistNotification(
    `Appointment approved for ${updated.patientName || updated.patient || "patient"}.`,
    {
      patientId: updated.patientId,
      appointmentId: updated.id,
      treatmentId: updated.treatmentId || "",
      sessionId: updated.sessionId || "",
      eventType: updated.treatmentId ? "treatment_session_approved" : "appointment_approved"
    }
  );

  refreshDentistUI();
  try {
    const synced = await window.GmDentalSupabaseSync?.flushNow?.();
    if (synced !== true) {
      showToast("Approval saved on this device, but server sync is pending. Keep this page open and check your connection.");
      return;
    }
    showToast("Appointment approved.");
  } catch (error) {
    showToast("Approval saved on this device, but server sync failed. Keep this page open and retry sync.");
  }
}

function canUseDentistActiveAppointmentActions(status = "") {
  return ["Approved", "Ongoing", "Reschedule Rejected"].includes(
    normalizeAppointmentStatus(status || "Pending")
  );
}

function handleScheduleTableActionClick(event) {
  const button = event.target.closest("button[data-schedule-action]");
  if (!button || !event.currentTarget.contains(button)) return;

  event.preventDefault();

  const action = String(button.dataset.scheduleAction || "").trim();
  const appointmentId = String(button.dataset.appointmentId || "").trim();
  const toastMessage = String(button.dataset.toastMessage || "").trim();

  console.log("[Dentist Schedule] action button clicked:", { action, appointmentId });

  if (action === "toast") {
    if (toastMessage) {
      showToast(toastMessage);
    }
    return;
  }

  if (!appointmentId) {
    console.warn("[Dentist Schedule] Missing appointment id for action:", action);
    return;
  }

  if (action === "approve") {
    approveAppointment(appointmentId);
    return;
  }

  if (action === "reject") {
    rejectAppointment(appointmentId);
    return;
  }

  if (action === "complete") {
    completeAppointment(appointmentId);
    return;
  }

  if (action === "finish-treatment") {
    completeTreatmentCase(appointmentId);
    return;
  }

  if (action === "schedule-next-adjustment") {
    scheduleNextAdjustment(appointmentId);
    return;
  }

  if (action === "cancel") {
    openDentistCancelModal(appointmentId);
    return;
  }

  if (action === "archive") {
    openArchiveModal(appointmentId);
    return;
  }

  console.warn("[Dentist Schedule] Unknown schedule action:", action);
}

function initScheduleTableActionDelegation() {
  const body = document.getElementById("scheduleTableBody");
  if (!body || body.dataset.actionDelegationBound === "true") return;

  body.dataset.actionDelegationBound = "true";
  body.addEventListener("click", handleScheduleTableActionClick);
}

function buildDentistAppointmentActions(item) {
  const apt = normalizeAppointmentFinancials(item);
  const appointmentId = escapeOnclickArg(apt.id);
  const safeStatus = normalizeAppointmentStatus(apt.status || "Pending");
  const plan = apt.treatmentId ? getTreatmentPlanById(apt.treatmentId) : null;

  const isLongTermSession =
    isLongTermTreatmentService(apt.service || "") &&
    !!apt.treatmentId &&
    !!plan &&
    String(plan.type || "").trim() === "long_term_treatment";

  const remainingBalance = Number(plan?.remainingBalance || 0);
  const canFinishTreatment = isLongTermSession && remainingBalance <= 0;

  if (safeStatus === "Pending") {
    return `
      <div class="dentist-action-group">
        <button class="action-chip success" onclick="approveAppointment('${appointmentId}')">Approve</button>
        <button class="action-chip danger" onclick="rejectAppointment('${appointmentId}')">Reject</button>
      </div>
    `;
  }

  if (safeStatus === "Reschedule Requested") {
    return `<span class="text-muted small">Review in Reschedule Requests</span>`;
  }

  if (["Approved", "Ongoing", "Reschedule Rejected"].includes(safeStatus)) {
    return `
      <div class="dentist-action-group">
        <button class="action-chip primary" onclick="completeAppointment('${appointmentId}')">
          ${isLongTermSession ? "Complete Visit" : "Complete Appointment"}
        </button>

        ${
          isLongTermSession
            ? `
              <button class="action-chip success ${canFinishTreatment ? "" : "disabled"}"
                onclick="${canFinishTreatment ? `completeTreatmentCase('${appointmentId}')` : `showToast('Finish Treatment is only available when the remaining balance is fully paid.')`}"
                ${canFinishTreatment ? "" : `title="Patient must finish payment before the full treatment can be completed."`}>
                Finish Treatment
              </button>

              <button class="action-chip secondary" onclick="scheduleNextAdjustment('${appointmentId}')">
                Schedule Next Adjustment
              </button>
            `
            : ""
        }

        <button class="action-chip danger" onclick="openDentistCancelModal('${appointmentId}')">
          Cancel
        </button>
      </div>
    `;
  }

  if (canArchiveStatus(safeStatus)) {
    return `
      <div class="dentist-action-group">
        <button class="action-chip secondary" onclick="openArchiveModal('${appointmentId}')">Archive</button>
      </div>
    `;
  }

  return `<span class="text-muted small">No actions</span>`;
}
function rejectAppointment(id) {
  const updated = updateDentistAppointment(id, (apt) => {
   if (apt.status !== "Pending" || apt.overallCaseStatus === "Completed") return apt;
    return {
      ...apt,
      status: "Rejected",
      invoiceUnlocked: false
    };
  });

  if (!updated) {
    showToast("Appointment not found.");
    return;
  }

  localStorage.removeItem("pendingPayment");

  pushPatientNotification(
    `Your appointment for ${updated.service} on ${updated.schedule} was rejected by the clinic.`
  );

  showToast("Appointment rejected.");
  refreshDentistUI?.();
}

let _pendingCancelId = null;

function openDentistCancelModal(id) {
  _pendingCancelId = id;
  const textarea = document.getElementById("cancelReasonInput");
  if (textarea) textarea.value = "";
  const modal = document.getElementById("cancelAppointmentModal");
  if (modal) modal.classList.add("active");
}

function closeDentistCancelModal() {
  _pendingCancelId = null;
  const modal = document.getElementById("cancelAppointmentModal");
  if (modal) modal.classList.remove("active");
}

function confirmDentistCancel() {
  const id = _pendingCancelId;
  if (!id) return;

  const reason = (document.getElementById("cancelReasonInput")?.value || "").trim();
  if (!reason) {
    document.getElementById("cancelReasonInput")?.focus();
    showToast("Please enter a reason for cancellation.");
    return;
  }

  closeDentistCancelModal();
  cancelApprovedAppointmentByDentist(id, reason);
}

function cancelApprovedAppointmentByDentist(id, reason = "") {
  const raw = getAppointments().find(a => String(a.id) === String(id));
  const totalCollected = Number(normalizeAppointmentFinancials(raw || {}).totalCollected || 0);
  const hasPaidAmount = totalCollected > 0;

  const updated = updateDentistAppointment(id, apt => ({
    ...apt,
    status: "Cancelled",
    visitStatus: "Cancelled",
    lifecycleStatus: "Cancelled",
    overallCaseStatus: "Cancelled",
    cancellationReason: reason || "",
    cancelledBy: "dentist",
    refundMethodPending: hasPaidAmount,
    ...(hasPaidAmount
      ? { preferredRefundMethod: "", refundGcashNumber: "" }
      : {}),
    notes: [apt.notes, reason ? `Cancelled by dentist: ${reason}` : "Cancelled by dentist."]
      .filter(Boolean).join(" | ")
  }));

  if (!updated) {
    showToast("Appointment not found.");
    return;
  }

  const meta = {
    patientId: updated.patientId || "",
    appointmentId: updated.id || "",
    treatmentId: updated.treatmentId || "",
    sessionId: updated.sessionId || "",
    eventType: updated.treatmentId ? "treatment_session_cancelled" : "appointment_cancelled"
  };

  pushPatientNotification(
    `Your appointment for ${updated.service} on ${updated.schedule} has been cancelled by the clinic. Reason: "${reason}"`,
    meta
  );

  if (hasPaidAmount) {
    pushPatientNotification(
      `You have a pending refund for your cancelled ${updated.service} appointment. Please go to your appointments and select your preferred refund method (Cash or GCash).`,
      { ...meta, eventType: "refund_method_required" }
    );
  }

  showToast("Appointment cancelled.");
  refreshDentistUI();
  window.GmDentalSupabaseSync?.flushNow?.();
}

const completingAppointments = new Set();
async function completeAppointment(id) {
  if (completingAppointments.has(String(id))) return;
  completingAppointments.add(String(id));
  try {
    const response = await window.GmDentalApiFetch(window.GmDentalSupabaseSync.apiBaseUrl + '/api/appointments/' + encodeURIComponent(id) + '/complete', { method: 'POST' });
    if(response.status===304){await window.GmDentalSupabaseSync.pull();refreshDentistUI();showToast('This appointment is already completed.');return;}
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Could not complete the appointment.');
    if (result.appointment?.status !== 'Completed') throw new Error('The server did not confirm completion.');
    confirmedDentistCompletions.set(String(id), result.appointment);
    const db = getClinicDb();
    for (const key of ['appointments', 'archivedAppointments']) {
      db[key] = safeArray(db[key]).map(item => String(item.id) === String(id) ? { ...item, ...result.appointment } : item);
    }
    saveClinicDb(db);
    pushPatientNotification(`Your appointment for ${result.appointment.service || "treatment"} has been marked as completed.`, {
      patientId: result.appointment.patientId || "", appointmentId: String(id), eventType: "appointment_completed"
    });
    refreshDentistUI();
    showToast('Appointment completed and saved. You can find it in Treatment Log.');
  } catch (error) {
    showToast(error.message || 'Could not save completion. Please try again.');
  } finally {
    completingAppointments.delete(String(id));
  }
}

function cancelAppointment(id) {
  let list = getAppointments();

  list = list.map(item => {
    if (String(item.id) === String(id)) {
      return {
        ...item,
        status: "Cancelled",
        visitStatus: "Cancelled",
        archivedForDentist: true,
        updatedAt: new Date().toISOString()
      };
    }
    return item;
  });

  saveAppointments(list);

  showToast("Appointment cancelled.");
  refreshDentistUI();
  window.GmDentalSupabaseSync?.flushNow?.();
}

function completeTreatmentCase(id) {
  const current = getAppointments().find(apt => String(apt.id) === String(id));

  if (!current || !current.treatmentId) {
    showToast("Treatment case not found.");
    return;
  }

  const normalizedCurrent = normalizeAppointmentFinancials(current);
  const plan = getTreatmentPlanById(normalizedCurrent.treatmentId);

  if (!plan) {
    showToast("Treatment plan not found.");
    return;
  }

  const remainingBalance = Number(plan.remainingBalance || 0);

  if (remainingBalance > 0) {
    showToast("Finish Treatment is only available when the remaining balance is fully paid.");
    return;
  }

  const updated = updateDentistAppointment(id, (apt) => ({
    ...apt,
    status: "Completed",
    visitStatus: "Completed",
    lifecycleStatus: "Completed",
    overallCaseStatus: "Completed",
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));

  if (!updated) {
    showToast("Appointment not found.");
    return;
  }

  updateTreatmentPlanById(normalizedCurrent.treatmentId, existing => ({
    ...existing,
    status: "Completed",
    updatedAt: new Date().toISOString()
  }));

  pushPatientNotification(
    `Your treatment for ${updated.service} has been fully completed.`,
    {
      patientId: updated.patientId,
      appointmentId: updated.id,
      treatmentId: updated.treatmentId || "",
      sessionId: updated.sessionId || "",
      eventType: "treatment_completed"
    }
  );

  showToast("Treatment completed.");
  refreshDentistUI();
}

function dedupeAppointments(records = []) {
  const map = new Map();

  safeArray(records).forEach((item, index) => {
    const key =
      String(item.id || "").trim() ||
      `${String(item.patientName || item.patient || "").trim()}__${String(item.service || "").trim()}__${String(item.schedule || "").trim()}__${index}`;

    const existing = map.get(key);

    if (!existing) {
      map.set(key, item);
      return;
    }

    const existingUpdated = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const currentUpdated = new Date(item.updatedAt || item.createdAt || 0).getTime();

    const existingCompleted = String(existing.status || "").trim() === "Completed";
    const currentCompleted = String(item.status || "").trim() === "Completed";

    if (currentUpdated > existingUpdated ||
        (currentUpdated === existingUpdated && (currentCompleted || !existingCompleted))) {
      map.set(key, item);
    }
  });

  return [...map.values()];
}

let pendingNextAdjustmentSourceId = null;

function getNextAdjustmentModal() {
  return document.getElementById("nextAdjustmentModal");
}

function closeNextAdjustmentModal() {
  getNextAdjustmentModal()?.classList.remove("active");
  pendingNextAdjustmentSourceId = null;
}

function scheduleNextAdjustment(id) {
  const current = getAppointments().find(apt => String(apt.id) === String(id));

  if (!current || !current.treatmentId) {
    showToast("Treatment case not found.");
    return;
  }

  const normalizedCurrent = normalizeAppointmentFinancials(current);
  const plan = getTreatmentPlanById(normalizedCurrent.treatmentId);

  if (!plan) {
    showToast("Treatment plan not found.");
    return;
  }

  pendingNextAdjustmentSourceId = String(id);

  const dateInput = document.getElementById("nextAdjustmentDate");
  const timeSelect = document.getElementById("nextAdjustmentTime");
  const notesInput = document.getElementById("nextAdjustmentNotes");

  if (!dateInput || !timeSelect || !notesInput) {
    showToast("Next adjustment modal UI is missing.");
    return;
  }

  dateInput.value = plan.nextSessionDate || normalizedCurrent.date || "";
  notesInput.value = "";

  const selectedTime =
    normalizedCurrent.timeDisplay ||
    convert24To12(normalizedCurrent.time || "") ||
    "11:00 AM";

  timeSelect.innerHTML = `
    <option value="09:00 AM">09:00 AM</option>
    <option value="10:00 AM">10:00 AM</option>
    <option value="11:00 AM">11:00 AM</option>
    <option value="01:00 PM">01:00 PM</option>
    <option value="02:00 PM">02:00 PM</option>
    <option value="03:00 PM">03:00 PM</option>
    <option value="04:00 PM">04:00 PM</option>
  `;
  timeSelect.value = normalizeTimeDisplay(selectedTime);

  getNextAdjustmentModal()?.classList.add("active");
}

function submitNextAdjustmentSchedule() {
  const id = pendingNextAdjustmentSourceId;
  const current = getAppointments().find(apt => String(apt.id) === String(id));

  if (!current || !current.treatmentId) {
    showToast("Treatment case not found.");
    return;
  }

  const normalizedCurrent = normalizeAppointmentFinancials(current);
  const plan = getTreatmentPlanById(normalizedCurrent.treatmentId);

  if (!plan) {
    showToast("Treatment plan not found.");
    return;
  }

  const dateValue = document.getElementById("nextAdjustmentDate")?.value?.trim() || "";
  const timeValue = document.getElementById("nextAdjustmentTime")?.value?.trim() || "";
  const notesValue = document.getElementById("nextAdjustmentNotes")?.value?.trim() || "";

  if (!dateValue) {
    showToast("Please select the next adjustment date.");
    return;
  }

  if (!timeValue) {
    showToast("Please select the next adjustment time.");
    return;
  }

  const timeDisplay = /am|pm/i.test(String(timeValue))
    ? normalizeTimeDisplay(timeValue)
    : convert24To12(timeValue);

  const schedule = buildSchedule(dateValue, timeDisplay);
  const appointmentId = createDentistEntityId("apt");
  const sessionId = `${appointmentId}-session`;

  const nextAppointment = normalizeAppointmentFinancials({
    ...normalizedCurrent,
    id: appointmentId,
    appointmentId,
    sessionId,
    service: "Orthodontic Adjustment",
    services: [{
      serviceName: "Orthodontic Adjustment",
      price: 0,
      paymentMode: "full",
      paymentStatus: "Paid",
      serviceStatus: "Pending",
      isLongTermTreatment: false
    }],
    treatmentId: normalizedCurrent.treatmentId,
    schedule,
    date: dateValue,
    time: convertDisplayTimeTo24(timeDisplay) || String(timeValue),
    timeDisplay,
    notes: notesValue,
    status: "Approved",
    visitStatus: "Approved",
    lifecycleStatus: "Approved",
    price: 0,
    subtotal: 0,
    paid: true,
    paymentStatus: "Paid",
    remainingBalance: 0,
    totalCollected: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: "",
    archived: false,
    archivedForDentist: false,
    archivedForPatient: false
  });

  const conflict = hasAppointmentConflict(nextAppointment, {
    excludeId: nextAppointment.id
  });

  if (conflict) {
    showToast("This time slot is already occupied by another approved appointment.");
    return;
  }

  const appointments = getAppointments();
  appointments.unshift(nextAppointment);
  saveAppointments(appointments);

  updateTreatmentPlanById(normalizedCurrent.treatmentId, existing => ({
    ...existing,
    status: "Active",
    nextSessionDate: dateValue,
    nextSessionTime: timeDisplay,
    nextSessionSchedule: schedule,
    sessions: [
      ...safeArray(existing.sessions),
      {
        sessionId,
        appointmentId,
        date: dateValue,
        time: convertDisplayTimeTo24(timeDisplay) || String(timeValue),
        timeDisplay,
        schedule,
        notes: notesValue,
        status: "Approved",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    updatedAt: new Date().toISOString()
  }));

  pushPatientNotification(
    `Your next orthodontic adjustment has been scheduled for ${schedule}.`,
    {
      patientId: normalizedCurrent.patientId,
      appointmentId,
      treatmentId: normalizedCurrent.treatmentId,
      sessionId,
      eventType: "treatment_adjustment_scheduled"
    }
  );

  closeNextAdjustmentModal();
  showToast("Next adjustment scheduled.");
  refreshDentistUI();
}

function markCancelled(id) {
  const appointments = getAppointments();
  const index = appointments.findIndex(a => String(a.id) === String(id));
  if (index === -1) return;

  const patientName = appointments[index].patientName || appointments[index].patient || "patient";
  const service = appointments[index].service || "appointment";
  const schedule = appointments[index].schedule || "";

  appointments[index].status = "Cancelled";
  appointments[index].updatedAt = new Date().toISOString();

  saveAppointments(appointments);

  addDentistNotification(`Appointment cancelled for ${patientName}.`);
  pushPatientNotification(`Your appointment for ${service} on ${schedule} was cancelled.`);

  showToast("Appointment cancelled.");
  refreshDentistUI();
}


async function approveRescheduleRequest(requestId) {
  const requests = getRescheduleRequests();
  const appointments = getAppointments();

  const reqIndex = requests.findIndex(r => String(r.id) === String(requestId));
  if (reqIndex === -1) {
    alert("Reschedule request not found.");
    return;
  }

  const req = requests[reqIndex];
  const aptIndex = appointments.findIndex(a => String(a.id) === String(req.appointmentId || req.sessionId));
  if (aptIndex === -1) {
    alert("Linked appointment not found.");
    return;
  }

  if (req.status && req.status !== "Pending") return showToast("This request has already been reviewed.");
  const current = appointments[aptIndex];
  const requested = splitSchedule(req.requestedSchedule);
  const candidate = normalizeAppointmentFinancials({
    ...appointments[aptIndex],
    date: requested.date,
    timeDisplay: normalizeTimeDisplay(requested.time24 || requested.timeDisplay),
    time: requested.time24 || convertDisplayTimeTo24(requested.timeDisplay || "") || current.time,
    schedule: buildSchedule(requested.date, requested.timeDisplay || current.timeDisplay || current.time),
    status: "Approved",
    visitStatus: "Approved",
    lifecycleStatus: "Approved"
  });

  if (hasAppointmentConflict(candidate, { excludeId: candidate.id })) {
    showToast("The requested slot is already occupied for this dentist.");
    return;
  }

  appointments[aptIndex] = candidate;

  appointments[aptIndex] = normalizeAppointmentFinancials({
    ...appointments[aptIndex],
    date: requested.date,
    timeDisplay: normalizeTimeDisplay(requested.time24 || requested.timeDisplay),
    time: requested.time24 || convertDisplayTimeTo24(requested.timeDisplay || "") || current.time,
    schedule: buildSchedule(requested.date, requested.timeDisplay || current.timeDisplay || current.time),
    status: "Approved",
    visitStatus: "Approved",
    lifecycleStatus: "Approved",
    updatedAt: new Date().toISOString(),
    previousSchedule: buildSchedule(
      splitSchedule(req.previousSchedule || appointments[aptIndex].previousSchedule || "").date,
      splitSchedule(req.previousSchedule || appointments[aptIndex].previousSchedule || "").timeDisplay
    ),
    rescheduleConfirmation: { requestId: req.id, confirmedAt: new Date().toISOString() },
    requestedSchedule: "",
    rescheduleReason: ""
  });

  requests.splice(reqIndex, 1);

  saveAppointments(appointments);
  saveRescheduleRequests(requests);
  if (appointments[aptIndex].treatmentId) {
    reconcileTreatmentPlanFromAppointment(appointments[aptIndex], { status: "Active" });
  }

  pushPatientNotification(
    `Your reschedule request for ${req.service} was approved. New schedule: ${req.requestedSchedule}.`,
    {
      patientId: appointments[aptIndex].patientId,
      appointmentId: appointments[aptIndex].id,
      treatmentId: appointments[aptIndex].treatmentId || "",
      sessionId: appointments[aptIndex].sessionId || "",
      eventType: "reschedule_approved"
    }
  );

  refreshDentistUI();
  const synced = await window.GmDentalSupabaseSync?.flushNow?.();
  showToast(synced === true ? "Reschedule confirmed. The new schedule is saved." : "Reschedule saved on this device; server sync is pending.");
}

function rejectRescheduleRequest(requestId) {
  const requests = getRescheduleRequests();
  const appointments = getAppointments();

  const reqIndex = requests.findIndex(r => String(r.id) === String(requestId));
  if (reqIndex === -1) {
    alert("Reschedule request not found.");
    return;
  }

  const req = requests[reqIndex];
  const aptIndex = appointments.findIndex(a => String(a.id) === String(req.appointmentId || req.sessionId));
  if (aptIndex === -1) {
    alert("Linked appointment not found.");
    return;
  }

  const current = normalizeAppointmentFinancials(appointments[aptIndex]);
  const previous = splitSchedule(req.previousSchedule || current.previousSchedule || current.schedule);
  const restoredDate = previous.date || current.date;
  const restoredTime = previous.time24 || convertDisplayTimeTo24(previous.timeDisplay || "") || current.time;
  const restoredSchedule = buildSchedule(restoredDate, previous.timeDisplay || current.timeDisplay || current.time);

  appointments[aptIndex] = normalizeAppointmentFinancials({
    ...current,
    date: restoredDate,
    time: restoredTime,
    schedule: restoredSchedule,
    status: "Reschedule Rejected",
    visitStatus: "Reschedule Rejected",
    statusBeforeReschedule: "Approved",
    updatedAt: new Date().toISOString(),
    requestedSchedule: "",
    rescheduleReason: "",
    previousSchedule: ""
  });

  requests.splice(reqIndex, 1);

  saveAppointments(appointments);
  saveRescheduleRequests(requests);
  if (appointments[aptIndex].treatmentId) {
    reconcileTreatmentPlanFromAppointment(appointments[aptIndex], { status: "Active" });
  }

  pushPatientNotification(
    `Your reschedule request for ${req.service} was rejected. Your original appointment remains on ${req.previousSchedule}.`,
    {
      patientId: appointments[aptIndex].patientId,
      appointmentId: appointments[aptIndex].id,
      treatmentId: appointments[aptIndex].treatmentId || "",
      sessionId: appointments[aptIndex].sessionId || "",
      eventType: "reschedule_rejected"
    }
  );

  pushDentistNotification(
    `Reschedule request rejected for ${req.patientName || "patient"}.`,
    {
      patientId: appointments[aptIndex].patientId,
      appointmentId: appointments[aptIndex].id,
      treatmentId: appointments[aptIndex].treatmentId || "",
      sessionId: appointments[aptIndex].sessionId || "",
      eventType: "reschedule_rejected"
    }
  );

  showToast("Reschedule request rejected. Original schedule remains active.");
  refreshDentistUI();
}
// ---------------------------
// HISTORY + ARCHIVE
// ---------------------------
function renderDiscontinuedPlans() {
  const body = document.getElementById("discontinuedPlansTableBody");
  if (!body) return;

  const plans = getTreatmentPlans().filter(plan =>
    normalizeTreatmentPlanStatus(plan.status || "") === "Discontinued"
  );

  body.innerHTML = "";

  if (!plans.length) {
    body.innerHTML = `<tr><td colspan="4">No discontinued treatments yet.</td></tr>`;
    return;
  }

  plans.forEach(plan => {
    const approvedAt = plan.discontinuationApprovedAt
      ? new Date(plan.discontinuationApprovedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";

    body.innerHTML += `
      <tr>
        <td>${escapeHtml(plan.patientName || "Unknown Patient")}</td>
        <td>${escapeHtml(plan.serviceName || plan.service || "Orthodontic Treatment")}</td>
        <td>${escapeHtml(plan.discontinuationReason || "—")}</td>
        <td>${approvedAt}</td>
      </tr>
    `;
  });
}

function isTreatmentSessionAppointment(apt) {
  const svc = normalizeServiceKey(apt.service || "");
  // Genuine treatment sessions: initial booking ("orthodontic treatment") or
  // dentist-scheduled follow-ups ("orthodontic adjustment")
  return svc.includes("orthodontic") || apt.serviceFlowType === "long_term_treatment";
}

function buildSessionNumberMap(allAppointments) {
  const byTreatment = {};
  safeArray(allAppointments).forEach(a => {
    const tid = String(a.treatmentId || "").trim();
    if (!tid || !String(a.sessionId || "").trim()) return;
    // Exclude non-session appointments (consultations, etc.) that share a treatmentId
    if (!isTreatmentSessionAppointment(a)) return;
    if (!byTreatment[tid]) byTreatment[tid] = [];
    byTreatment[tid].push(a);
  });
  const map = {};
  Object.keys(byTreatment).forEach(tid => {
    byTreatment[tid]
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      .forEach((a, idx) => { map[String(a.id)] = idx + 1; });
  });
  return map;
}

function getSessionLabel(apt, sessionNumberMap) {
  if (!apt.treatmentId) return apt.service || "-";
  const num = sessionNumberMap && sessionNumberMap[String(apt.id)];
  if (!num) return apt.service || "-";
  const base = (apt.service || "Session").replace(/\bTreatment\b/i, "Adjustment");
  return base;
}

function renderHistoryTable() {
  const body = document.getElementById("historyTableBody");
  if (!body) return;

  const allForHistory = getMyAppointments();
  const sessionNumberMap = buildSessionNumberMap(allForHistory);
  const appointments = allForHistory.filter(a =>
    ["Completed", "Cancelled", "Rejected"].includes(normalizeAppointmentStatus(a.status || "")) &&
    a.archivedForDentist !== true
  );

  const sort = document.getElementById('treatmentLogSort')?.value || 'newest';
  const compareText = (a, b) => String(a || '').localeCompare(String(b || ''), 'en', { sensitivity: 'base', numeric: true });
  const scheduleTime = item => {
    const parts = parseScheduleParts(item.schedule || '');
    const date = Date.parse(parts.datePart || '');
    const time = String(parts.timePart || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    let hours = time ? Number(time[1]) : 0;
    if (time?.[3]) hours = hours % 12 + (time[3].toUpperCase() === 'PM' ? 12 : 0);
    return (Number.isFinite(date) ? date : 0) + (hours * 60 + (time ? Number(time[2]) : 0)) * 60000;
  };
  appointments.sort((a, b) => {
    const name = compareText(a.patientName || a.patient, b.patientName || b.patient);
    if (sort === 'name' || sort === 'name-desc') return (sort === 'name-desc' ? -name : name) || scheduleTime(b) - scheduleTime(a);
    if (sort === 'service') return compareText(getSessionLabel(a, sessionNumberMap), getSessionLabel(b, sessionNumberMap)) || name;
    if (sort === 'status') return compareText(normalizeAppointmentStatus(a.status), normalizeAppointmentStatus(b.status)) || name;
    return (sort === 'oldest' ? scheduleTime(a) - scheduleTime(b) : scheduleTime(b) - scheduleTime(a)) || name;
  });

  body.innerHTML = "";

  if (!appointments.length) {
    body.innerHTML = `<tr><td colspan="5">No history records yet.</td></tr>`;
    return;
  }

  appointments.forEach(apt => {
    const safeStatus = normalizeAppointmentStatus(apt.status || "");
    const badgeClass = statusClassName(safeStatus);
    const appointmentId = escapeOnclickArg(apt.id);
    const isCompletedTreatmentSession = safeStatus === "Completed" && !!apt.treatmentId;
    const serviceLabel = getSessionLabel(apt, sessionNumberMap);
    const totalCollected = Number(normalizeAppointmentFinancials(apt).totalCollected || 0);
    const totalRefunded = getTotalRefunded(apt);
    const refundable = safeStatus === "Cancelled" && totalCollected > 0 && totalRefunded < totalCollected;
    const fullyRefunded = safeStatus === "Cancelled" && totalCollected > 0 && totalRefunded >= totalCollected;
    const refundMethodPending = apt.refundMethodPending === true;
    const chosenRefundMethod = apt.preferredRefundMethod || "";
    const chosenGcash = apt.refundGcashNumber || "";

    body.innerHTML += `
      <tr>
        <td>${escapeHtml(apt.patientName || apt.patient || "Unknown Patient")}</td>
        <td>${escapeHtml(serviceLabel)}</td>
        <td>${escapeHtml(apt.schedule || "-")}</td>
        <td>
          <span class="badge ${badgeClass}">${escapeHtml(safeStatus === "Reschedule Requested" ? "Awaiting Reschedule Confirmation" : safeStatus)}</span>
          ${fullyRefunded ? `<br><span class="badge refunded" style="margin-top:4px;display:inline-block;">Refunded</span>` : ""}
          ${refundable && totalRefunded > 0 ? `<br><span class="badge" style="margin-top:4px;display:inline-block;background:rgba(245,158,11,.12);color:#b45309;">Partial Refund</span>` : ""}
          ${refundMethodPending ? `<br><span class="badge" style="margin-top:4px;display:inline-block;background:rgba(245,158,11,.12);color:#b45309;">Awaiting Refund Choice</span>` : ""}
          ${!refundMethodPending && chosenRefundMethod ? `<br><small style="color:var(--text-muted);font-size:.75rem;">Refund via <strong>${escapeHtml(chosenRefundMethod)}</strong>${chosenGcash ? ` — ${escapeHtml(chosenGcash)}` : ""}</small>` : ""}
        </td>
        <td>
          ${
            safeStatus === "Rejected"
              ? `
                <button class="action-chip" onclick="restoreRejectedAppointment('${appointmentId}')">Undo Reject</button>
                <button class="action-chip secondary" onclick="openArchiveModal('${appointmentId}')">Archive</button>
              `
              : `
                ${isCompletedTreatmentSession ? `<button class="action-chip secondary" onclick="scheduleNextAdjustment('${appointmentId}')">Schedule Next Adjustment</button>` : ""}
                ${fullyRefunded ? `<span class="action-chip disabled" title="Fully refunded — ₱${totalRefunded.toLocaleString()}">&#10003; Refunded</span>` : ""}
                <button class="action-chip" onclick="openArchiveModal('${appointmentId}')">Archive</button>
              `
          }
        </td>
      </tr>
    `;
  });
}

function restoreRejectedAppointment(id) {
  const appointments = getAppointments();
  const index = appointments.findIndex(a => String(a.id) === String(id));
  if (index === -1) return;

  appointments[index].status = "Pending";
  appointments[index].requiresManualApproval = true;
  appointments[index].approvalMode = "manual";
  appointments[index].updatedAt = new Date().toISOString();

  saveAppointments(appointments);
  if (appointments[index].treatmentId) {
    reconcileTreatmentPlanFromAppointment(appointments[index], { status: "Active" });
  }

  pushPatientNotification(
    `Your appointment for ${appointments[index].service} on ${appointments[index].schedule} is under review again.`,
    {
      patientId: appointments[index].patientId,
      appointmentId: appointments[index].id,
      treatmentId: appointments[index].treatmentId || "",
      sessionId: appointments[index].sessionId || "",
      eventType: "appointment_reopened"
    }
  );

  pushDentistNotification(
    `Rejected appointment restored for ${appointments[index].patientName || appointments[index].patient || "patient"}.`,
    {
      patientId: appointments[index].patientId,
      appointmentId: appointments[index].id,
      treatmentId: appointments[index].treatmentId || "",
      sessionId: appointments[index].sessionId || "",
      eventType: "appointment_reopened"
    }
  );

  showToast("Rejected appointment restored to Pending.");
  refreshDentistUI();
}

function renderArchiveTable() {
  const body = document.getElementById("archiveTableBody");
  if (!body) return;

  const archive = getArchive();
  const archiveSessionMap = buildSessionNumberMap(archive);
  body.innerHTML = "";

  if (!archive.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5">No archived records yet.</td>
      </tr>
    `;
    return;
  }

    archive.forEach(item => {
      const safeStatus = normalizeAppointmentStatus(item.status || "Archived");
      const originalStatus = normalizeAppointmentStatus(item.statusBeforeArchive || "");
      const serviceLabel = getSessionLabel(item, archiveSessionMap);
      const totalCollected = Number(item.totalCollected || 0);
      const totalRefunded = getTotalRefunded(item);
      const refundable = originalStatus === "Cancelled" && totalCollected > 0 && totalRefunded < totalCollected;
      const fullyRefunded = originalStatus === "Cancelled" && totalCollected > 0 && totalRefunded >= totalCollected;
      const refundMethodPending = item.refundMethodPending === true;
      const chosenRefundMethod = item.preferredRefundMethod || "";
      const chosenGcash = item.refundGcashNumber || "";
      const itemId = escapeOnclickArg(item.id);

      body.innerHTML += `
        <tr>
          <td>${escapeHtml(item.patientName || item.patient || "Unknown Patient")}</td>
          <td>${escapeHtml(serviceLabel)}</td>
          <td>${escapeHtml(item.schedule || "-")}</td>
          <td>
            <span class="badge ${statusClassName(safeStatus)}">
              ${escapeHtml(safeStatus)}
            </span>
            ${fullyRefunded ? `<br><span class="badge refunded" style="margin-top:4px;display:inline-block;">Refunded</span>` : ""}
            ${refundable && totalRefunded > 0 ? `<br><span class="badge" style="margin-top:4px;display:inline-block;background:rgba(245,158,11,.12);color:#b45309;">Partial Refund</span>` : ""}
            ${refundMethodPending ? `<br><span class="badge" style="margin-top:4px;display:inline-block;background:rgba(245,158,11,.12);color:#b45309;">Awaiting Refund Choice</span>` : ""}
            ${!refundMethodPending && chosenRefundMethod ? `<br><small style="color:var(--text-muted);font-size:.75rem;">Refund via <strong>${escapeHtml(chosenRefundMethod)}</strong>${chosenGcash ? ` â€” ${escapeHtml(chosenGcash)}` : ""}</small>` : ""}
          </td>
          <td>
            ${fullyRefunded ? `<span class="action-chip disabled" title="Fully refunded — ₱${totalRefunded.toLocaleString()}">&#10003; Refunded</span>` : ""}
            <button class="action-chip danger" onclick="openDeleteArchivedModal('${itemId}')">Delete</button>
          </td>
        </tr>
      `;
    });
}

function openArchiveModal(id) {
  pendingArchiveId = id;
  document.getElementById("confirmArchiveModal")?.classList.add("active");
}

function closeArchiveModal() {
  pendingArchiveId = null;
  document.getElementById("confirmArchiveModal")?.classList.remove("active");
}

function getArchivableHistoryAppointments() {
  return getMyAppointments().filter(item =>
    ["Completed", "Cancelled", "Rejected"].includes(normalizeAppointmentStatus(item.status || item.statusBeforeArchive || "")) &&
    !isTrueFlag(item.archivedForDentist)
  );
}

function openArchiveAllHistoryModal() {
  if (!getArchivableHistoryAppointments().length) {
    showToast("No treatment log records to archive.");
    return;
  }

  document.getElementById("confirmArchiveAllHistoryModal")?.classList.add("active");
}

function closeArchiveAllHistoryModal() {
  document.getElementById("confirmArchiveAllHistoryModal")?.classList.remove("active");
}

function archiveAppointment(id) {
  const db = ensureClinicDbShape(getClinicDb());
  const activeAppointments = safeArray(db.appointments);
  const archivedAppointments = safeArray(db.archivedAppointments);
  const archiveOffset = activeAppointments.length;
  const matchesActiveId = (item, index) => appointmentMatchesId(item, id, index);
  const matchesArchivedId = (item, index) => appointmentMatchesId(item, id, index, archiveOffset);
  const activeIndex = activeAppointments.findIndex(matchesActiveId);
  const archivedIndex = archivedAppointments.findIndex(matchesArchivedId);
  let raw = activeIndex > -1
    ? activeAppointments[activeIndex]
    : archivedIndex > -1
      ? archivedAppointments[archivedIndex]
      : null;

  if (!raw) {
    const appointments = getAppointments();
    const fallbackIndex = appointments.findIndex(
      item => String(item.id || item.appointmentId || "") === String(id)
    );

    if (fallbackIndex === -1) {
      showToast("Appointment not found.");
      return;
    }

    raw = appointments[fallbackIndex];
  }

  const normalized = normalizeAppointmentFinancials(raw);
  const status = normalizeAppointmentStatus(
    raw.statusBeforeArchive || normalized.status || raw.status || ""
  );

  if (isTrueFlag(raw.archivedForDentist)) {
    showToast("Appointment is already archived.");
    refreshDentistUI();
    return;
  }

  const allowedStatuses = ["Completed", "Cancelled", "Rejected"];
  if (!allowedStatuses.includes(status)) {
    showToast("Only completed, cancelled, or rejected appointments can be archived.");
    return;
  }

  const archivedItem = {
    ...raw,
    id: getDirectAppointmentId(raw) || String(id),
    appointmentId: raw.appointmentId || raw.id || String(id),
    statusBeforeArchive: status,
    status: "Archived",
    archived: true,
    archivedForDentist: true,
    archivedAt: new Date().toISOString(),
    archivedBy: "dentist",
    archivedByDentistId: currentDentistUser?.id || raw.dentistId || "",
    archivedByDentistName: currentDentistUser?.name || currentDentistUser?.fullName || raw.dentistName || raw.dentist || "",
    archivedByDentistEmail: currentDentistUser?.email || raw.dentistEmail || "",
    updatedAt: new Date().toISOString()
  };

  db.appointments = activeAppointments.filter((item, index) => !matchesActiveId(item, index));
  db.archivedAppointments = [
    normalizeAppointmentFinancials(archivedItem),
    ...archivedAppointments.filter((item, index) => !matchesArchivedId(item, index))
  ];

  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();

  pushDentistNotification(
    `Appointment archived for ${raw.patientName || raw.patient || "patient"}.`,
    {
      patientId: raw.patientId,
      appointmentId: archivedItem.id,
      treatmentId: raw.treatmentId || "",
      sessionId: raw.sessionId || "",
      eventType: "appointment_archived"
    }
  );

  pushPatientNotification(
    `Your appointment for ${raw.service || "appointment"} has been archived by the clinic.`,
    {
      patientId: raw.patientId,
      appointmentId: archivedItem.id,
      treatmentId: raw.treatmentId || "",
      sessionId: raw.sessionId || "",
      eventType: "appointment_archived"
    }
  );

  showToast("Appointment archived.");
  showSection("archive");
  refreshDentistUI();
}

function archiveAllHistoryAppointments() {
  const targets = getArchivableHistoryAppointments();

  if (!targets.length) {
    showToast("No treatment log records to archive.");
    refreshDentistUI();
    return;
  }

  const targetIds = new Set(targets.map(item => String(item.id || item.appointmentId || "")));
  const now = new Date().toISOString();
  const db = ensureClinicDbShape(getClinicDb());
  const archivedById = new Set(
    safeArray(db.archivedAppointments).map((item, index) =>
      String(getDirectAppointmentId(item) || getAppointmentIdentity(item, index) || "")
    )
  );
  const newlyArchived = [];

  const activeAppointments = safeArray(db.appointments);
  const archivedAppointments = safeArray(db.archivedAppointments);
  const archiveOffset = activeAppointments.length;

  db.appointments = activeAppointments.filter((item, index) => {
    const itemId = String(getDirectAppointmentId(item) || "");
    const matchedTarget = targets.find(target =>
      targetIds.has(itemId) || appointmentMatchesId(item, target.id, index)
    );
    if (!matchedTarget) return true;

    const status = normalizeAppointmentStatus(item.status || "");
    const archivedItem = normalizeAppointmentFinancials({
      ...item,
      id: item.id || matchedTarget.id || itemId,
      appointmentId: item.appointmentId || item.id || matchedTarget.id || itemId,
      statusBeforeArchive: status,
      status: "Archived",
      archived: true,
      archivedForDentist: true,
      archivedAt: now,
      archivedBy: "dentist",
      archivedByDentistId: currentDentistUser?.id || item.dentistId || "",
      archivedByDentistName: currentDentistUser?.name || currentDentistUser?.fullName || item.dentistName || item.dentist || "",
      archivedByDentistEmail: currentDentistUser?.email || item.dentistEmail || "",
      updatedAt: now
    });

    const archivedId = String(getDirectAppointmentId(archivedItem) || getAppointmentIdentity(archivedItem, newlyArchived.length) || "");
    if (!archivedById.has(archivedId)) {
      newlyArchived.push(archivedItem);
      archivedById.add(archivedId);
    }

    return false;
  });

  db.archivedAppointments = [
    ...newlyArchived,
    ...archivedAppointments.map((item, index) => {
      const itemId = String(getDirectAppointmentId(item) || "");
      const shouldArchive = targetIds.has(itemId) || targets.some(target =>
        appointmentMatchesId(item, target.id, index, archiveOffset)
      );
      if (!shouldArchive) return item;
      return normalizeAppointmentFinancials({
        ...item,
        statusBeforeArchive: normalizeAppointmentStatus(item.statusBeforeArchive || item.status || ""),
        status: "Archived",
        archived: true,
        archivedForDentist: true,
        archivedAt: item.archivedAt || now,
        archivedBy: item.archivedBy || "dentist",
        archivedByDentistId: item.archivedByDentistId || currentDentistUser?.id || item.dentistId || "",
        archivedByDentistName: item.archivedByDentistName || currentDentistUser?.name || currentDentistUser?.fullName || item.dentistName || item.dentist || "",
        archivedByDentistEmail: item.archivedByDentistEmail || currentDentistUser?.email || item.dentistEmail || "",
        updatedAt: now
      });
    })
  ];

  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();

  showToast(`${targets.length} treatment log record${targets.length === 1 ? "" : "s"} archived.`);
  showSection("archive");
  refreshDentistUI();
}

function openDeleteArchivedModal(id) {
  pendingDeleteArchivedId = id;
  document.getElementById("confirmDeleteArchivedModal")?.classList.add("active");
}

// Expose for inline HTML handlers
window.openDeleteArchivedModal = openDeleteArchivedModal;

function closeDeleteArchivedModal() {
  pendingDeleteArchivedId = null;
  document.getElementById("confirmDeleteArchivedModal")?.classList.remove("active");
}

function deleteArchivedAppointment(id) {
  const db = ensureClinicDbShape(getClinicDb());
  const activeAppointments = safeArray(db.appointments);
  const archivedAppointments = safeArray(db.archivedAppointments);
  const archiveOffset = activeAppointments.length;
  const deletedRecords = archivedAppointments.filter((item, index) =>
    appointmentMatchesId(item, id, index, archiveOffset)
  );

  const matchesDeletedRecord = (item, index, offset = 0) => {
    if (appointmentMatchesId(item, id, index, offset)) return true;

    return deletedRecords.some((deleted, deletedIndex) => {
      const deletedId = getDirectAppointmentId(deleted) || getAppointmentIdentity(deleted, archiveOffset + deletedIndex);
      const itemIdentity = getAppointmentIdentity(item, index + offset);
      const deletedIdentity = getAppointmentIdentity(deleted, archiveOffset + deletedIndex);

      return (deletedId && appointmentMatchesId(item, deletedId, index, offset)) ||
        (itemIdentity && deletedIdentity && itemIdentity === deletedIdentity);
    });
  };

  db.archivedAppointments = archivedAppointments.filter(
    (item, index) => !matchesDeletedRecord(item, index, archiveOffset)
  );
  db.appointments = activeAppointments.filter(
    (item, index) => !matchesDeletedRecord(item, index)
  );

  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();

  showToast("Record deleted permanently.");
  refreshDentistUI();
}


function openClearArchiveModal() {
  document.getElementById("confirmClearArchiveModal")?.classList.add("active");
}

function closeClearArchiveModal() {
  document.getElementById("confirmClearArchiveModal")?.classList.remove("active");
}

function clearArchive() {
  const db = ensureClinicDbShape(getClinicDb());
  db.archivedAppointments = safeArray(db.archivedAppointments).filter(
    item => !isTrueFlag(item.archivedForDentist)
  );
  saveClinicDb(db);
  triggerGlobalSync?.();
  touchClinicSync();

  showToast("Archive cleared.");
  refreshDentistUI();
}

// Refund status display only. Staff Billing processes refunds.
function getTotalRefunded(apt) {
  return safeArray(apt.refunds).reduce((sum, r) => sum + Number(r.amount || 0), 0);
}

// ---------------------------
// ADD APPOINTMENT / PATIENT
// ---------------------------
function showAddAppointmentModal() {
  document.getElementById("addAppointmentModal")?.classList.add("active");
}

function closeAddAppointmentModal() {
  document.getElementById("addAppointmentModal")?.classList.remove("active");
}

function showAddPatientModal() {
  return window.GMPatientCreation.open();
}

function closePatientModal() {
  document.getElementById("patientModal")?.classList.remove("active");
}

function closeOverlayByBackdrop(event, modalId) {
  const content = event.currentTarget.querySelector(".service-modal-content");
  if (!content.contains(event.target)) {
    document.getElementById(modalId)?.classList.remove("active");
  }
}

function addAppointment() {
  const patientName = document.getElementById("a_patient")?.value.trim();
  const patientPhone = document.getElementById("a_patientPhone")?.value.trim();
  const service = document.getElementById("a_service")?.value.trim();
  const date = document.getElementById("a_date")?.value;
  const time24 = document.getElementById("a_time")?.value;
  const status = document.getElementById("a_status")?.value || "Pending";
  const notes = document.getElementById("a_notes")?.value.trim();

  if (!patientName || !service || !date || !time24) {
    showToast("Please complete the appointment form.");
    return;
  }

  const time12 = convert24To12(time24);
  const serviceInfo = findService(service);
  const treatmentId = isLongTermTreatmentService(service) ? createDentistEntityId("trt") : "";
  const appointmentId = createDentistEntityId("apt");
  const dentistName = currentDentistUser?.name || currentDentistUser?.fullName || "Dentist";

  const newAppointment = normalizeAppointmentFinancials({
    id: appointmentId,
    createdBy: "dentist",
    approvalMode: "manual",
    requiresManualApproval: status !== "Approved",
    patientName,
    patientPhone,
    patientId: String(patientName || patientPhone || appointmentId).trim(),
    dentist: dentistName,
    dentistName,
    dentistEmail: currentDentistUser?.email || "",
    dentistId: currentDentistUser?.id || "",
    service,
    price: serviceInfo?.price || 0,
    schedule: `${date} • ${time12}`,
    status: status === "Approved" ? "Approved" : "Pending",
    treatmentId,
    sessionId: treatmentId ? `${appointmentId}-session` : "",
    serviceFlowType: getServiceFlowType(service),
    paid: false,
    paymentMethod: "",
    downPayment: 0,
    amountPaidOnline: 0,
    amountPaidInClinic: 0,
    totalCollected: 0,
    notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  const appointments = getAppointments();
  appointments.unshift(newAppointment);
  saveAppointments(appointments);
  if (treatmentId) {
    upsertTreatmentPlanFromAppointment(newAppointment, { status: "Active" });
  }

  if (status === "Approved") {
    const result = tryApproveAppointmentSlot(newAppointment.id);

    if (!result.ok) {
      showToast(result.reason);
      refreshDentistUI();
      return;
    }
  }

  addDentistNotification(`New manual appointment added for ${patientName}.`);
  showToast("Appointment added.");
  closeAddAppointmentModal();
  refreshDentistUI();
}

function addPatient() {
  closePatientModal();
  return window.GMPatientCreation.open();
}

// ---------------------------
// QUICK NOTES
// ---------------------------
function getQuickNotesKey() {
  return `${STORAGE_KEYS.quickNotes}:${String(currentDentistUser?.id || currentDentistUser?.email || currentDentistUser?.name || "unknown").trim().toLowerCase()}`;
}

function saveQuickNotes() {
  const value = document.getElementById("quickNotes")?.value || "";
  localStorage.setItem(getQuickNotesKey(), value);
  showToast("Quick notes saved.");
}

function loadQuickNotes() {
  const box = document.getElementById("quickNotes");
  if (box) {
    box.value = localStorage.getItem(getQuickNotesKey()) || "";
  }
}

// ---------------------------
// PROFILE
// ---------------------------
function formatDentistProfileSchedule(schedules) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const time = value => {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return String(value || '');
    const hour = Number(match[1]);
    return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  };
  const shifts = (schedules || []).filter(s => !s.archived && s.day && s.start && s.end);
  const unique = [...new Map(shifts.map(s => [`${s.day}|${s.start}|${s.end}`, s])).values()];
  return unique.sort((a,b) => days.indexOf(a.day) - days.indexOf(b.day) || a.start.localeCompare(b.start))
    .map(s => `${s.day}: ${time(s.start)} - ${time(s.end)}`).join('\n') || 'No clinic schedule assigned yet.';
}

function refreshDentistProfileSchedule() {
  const field = document.getElementById('profileSchedule');
  if (!field) return;
  const db = getClinicDb();
  const records = (window.GMDefaultAccounts ? GMDefaultAccounts.normalizeDb(db) : db).dentists || [];
  const email = String(currentDentistUser?.email || '').trim().toLowerCase();
  const accountId = String(currentDentistUser?.id || '');
  const dentist = records.find(d => email && String(d.email || '').trim().toLowerCase() === email)
    || records.find(d => accountId && [d.accountId, d.userId, d.id].some(id => String(id || '') === accountId));
  field.value = formatDentistProfileSchedule(dentist?.schedules);
  field.rows = Math.max(2, field.value.split('\n').length);
  field.readOnly = true;
  const specialty = document.getElementById('profileSpecialty');
  if (specialty && specialty.disabled) specialty.value = dentist?.specialty || '';
}

function loadDentistProfile() {
  const sessionEmail = String(currentDentistUser?.email || "").trim().toLowerCase();
  const sessionName = currentDentistUser?.name || currentDentistUser?.fullName || "";

  const stored = getData(STORAGE_KEYS.dentistProfile, null);
  // The cached profile is only valid for the currently logged-in user. If the
  // stored profile belongs to a different account, ignore it so the previous
  // user's name doesn't shadow the new login.
  const savedBelongsToCurrentUser = stored
    && sessionEmail
    && String(stored.email || "").trim().toLowerCase() === sessionEmail;

  const saved = savedBelongsToCurrentUser
    ? stored
    : {
        fullName: sessionName,
        email: currentDentistUser?.email || "",
        specialty: "",
        phone: currentDentistUser?.mobile || "",
        schedule: ""
      };

  // The authoritative display name always comes from the logged-in session.
  // Clinic schedules and specialties come from the shared clinic roster.
  const displayName = sessionName || saved.fullName || "Dentist";
  const displayEmail = currentDentistUser?.email || saved.email || "";
  // Use the matching clinic record rather than relying only on a device cache.
  const profileDb = getClinicDb();
  const dentistRecords = (window.GMDefaultAccounts ? GMDefaultAccounts.normalizeDb(profileDb) : profileDb).dentists || [];
  const accountId = String(currentDentistUser?.id || "");
  const clinicProfile = dentistRecords.find(d => accountId && String(d.accountId || d.id || "") === accountId)
    || dentistRecords.find(d => sessionEmail && String(d.email || "").trim().toLowerCase() === sessionEmail);
  const specialty = clinicProfile?.specialty || currentDentistUser?.specialty || saved.specialty || "";


  const profileFields = {
    profileFullName: displayName,
    profileEmail: displayEmail,
    profileSpecialty: specialty,
    profilePhone: currentDentistUser?.mobile || saved.phone || "",
    profileSchedule: formatDentistProfileSchedule(clinicProfile?.schedules)
  };

  Object.entries(profileFields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = value;
      if (id === 'profileSchedule') {
        el.readOnly = true;
        el.rows = Math.max(2, String(value).split('\n').length);
      }
    }
  });

  const heading = document.getElementById("profileHeadingName");
  if (heading) heading.textContent = displayName;

  const headerName = document.getElementById("headerDentistName");
  if (headerName) headerName.textContent = displayName;

  const headerSpecialty = document.getElementById("headerDentistSpecialty");
  if (headerSpecialty) headerSpecialty.textContent = specialty;
}

function loadDentistPhoto() {
  const sessionEmail = String(currentDentistUser?.email || "").trim().toLowerCase();
  const perUserKey = sessionEmail
    ? `${STORAGE_KEYS.dentistProfilePhoto}:${sessionEmail}`
    : STORAGE_KEYS.dentistProfilePhoto;
  const saved = localStorage.getItem(perUserKey);

  const profileDisplay = document.getElementById("profileDisplay");
  const headerProfile = document.getElementById("header-profile-img");
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentDentistUser?.name || "Dentist")}&background=4e73df&color=fff`;

  if (profileDisplay) profileDisplay.src = saved || fallback;
  if (headerProfile) headerProfile.src = saved || fallback;
}

function initProfilePhotoUpload() {
  const photoUpload = document.getElementById("photoUpload");
  if (!photoUpload) return;

  photoUpload.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const image = event.target?.result;
      if (!image) return;

      const sessionEmail = String(currentDentistUser?.email || "").trim().toLowerCase();
      const perUserKey = sessionEmail
        ? `${STORAGE_KEYS.dentistProfilePhoto}:${sessionEmail}`
        : STORAGE_KEYS.dentistProfilePhoto;
      localStorage.setItem(perUserKey, image);
      loadDentistPhoto();
      showToast("Profile photo updated.");
    };
    reader.readAsDataURL(file);
  });
}

function initProfileEdit() {
  const btn = document.getElementById("editProfileBtn");
  if (!btn) return;

  let editing = false;

  btn.addEventListener("click", async () => {
    const editableIds = [
      "profileFullName",
      "profileEmail",
      "profileSpecialty",
      "profilePhone",
      "profileNewPassword",
      "profileConfirmPassword"
    ];

    if (!editing) {
      editableIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = false;
      });
      btn.textContent = "Save Profile";
      editing = true;
      return;
    }

    const newPassword = document.getElementById("profileNewPassword")?.value || "";
    const confirmPassword = document.getElementById("profileConfirmPassword")?.value || "";

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        showToast("Passwords do not match.");
        return;
      }
    }

    const verified = await window.GmAccountSecurity.update({
      name: document.getElementById("profileFullName")?.value.trim() || "",
      mobile: document.getElementById("profilePhone")?.value.trim() || "", newPassword
    });
    if (!verified) return;
    Object.assign(currentDentistUser, verified);
    const saved = {
      fullName: verified.name,
      email: currentDentistUser?.email || document.getElementById("profileEmail")?.value || "",
      specialty: document.getElementById("profileSpecialty")?.value || "",
      phone: document.getElementById("profilePhone")?.value || "",
      schedule: document.getElementById("profileSchedule")?.value || ""
    };

    setData(STORAGE_KEYS.dentistProfile, saved);

    editableIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = true;
      if (id === "profileNewPassword" || id === "profileConfirmPassword") {
        el.value = "";
      }
    });

    btn.textContent = "Edit Profile";
    editing = false;

    loadDentistProfile();
    showToast("Profile updated.");
  });
}

// ---------------------------
// THEME
// ---------------------------
function applyTheme(theme) {
  document.body.classList.toggle("dark", theme === "dark");
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function loadTheme() {
  const toggle = document.getElementById("darkModeToggle");
  const saved = localStorage.getItem(STORAGE_KEYS.theme) || "light";

  applyTheme(saved);

  if (toggle) {
    toggle.checked = saved === "dark";
    toggle.addEventListener("change", () => {
      applyTheme(toggle.checked ? "dark" : "light");
    });
  }
}

// ---------------------------
// SEARCH / FILTER EVENTS
// ---------------------------
function initFilters() {
  document.getElementById("scheduleSearch")?.addEventListener("input", renderScheduleTable);
  document.getElementById("statusFilter")?.addEventListener("change", renderScheduleTable);
}

// ---------------------------
// PROFILE MENU + LOGOUT
// ---------------------------
function toggleProfileDropdown(forceClose = null) {
  const menu = document.getElementById("profileDropdownMenu");
  if (!menu) return;

  if (forceClose === true) {
    menu.classList.remove("active");
    return;
  }

  menu.classList.toggle("active");
}

function logoutDentist() {
  clearCurrentUser();
  window.location.replace("../Landing/landing.html");
}

// ---------------------------
// CROSS PAGE SYNC
// ---------------------------

function refreshDentistUI() {
  refreshDentistProfileSchedule();
  renderDashboard();
  renderScheduleTable();
  renderRescheduleRequests();
  renderDiscontinuationRequests();
  renderPatients();
  renderServices();
  renderHistoryTable();
  renderDiscontinuedPlans();
  renderArchiveTable();
  renderDentistNotifications();
  renderBookedSlots();
  renderBookedSlotsModal();
  renderDentistBilling();
}

function renderDentistBilling() {
  const tbody = document.getElementById("dentistBillingTable");
  if (!tbody || !window.GMAdditionalFees) return;
  const query = (document.getElementById('billingSearch')?.value || '').trim().toLowerCase();
  const sort = document.getElementById('billingSort')?.value || 'name';
  const total = item => Math.max(0, GMAdditionalFees.serviceTotal(item) + GMAdditionalFees.calculate(item.additionalFees || []).total - Number(item.discount?.amount || 0));
  const filtered = (getClinicDb().appointments || []).filter(item => String(item.patient || item.patientName || '').toLowerCase().includes(query));
  filtered.sort((a, b) => {
    const name = String(a.patient || a.patientName || '').localeCompare(String(b.patient || b.patientName || ''), 'en', { sensitivity: 'base', numeric: true });
    return (sort === 'total-desc' ? total(b) - total(a) : sort === 'total' ? total(a) - total(b) : sort === 'name-desc' ? -name : name) || name;
  });
  const appointments = dentistListSlice(filtered, 'billing', renderDentistBilling);
  tbody.innerHTML = appointments.length ? appointments.map(item => {
    const fees = GMAdditionalFees.calculate(item.additionalFees || []);
    const serviceTotal = window.GMAdditionalFees.serviceTotal(item);
    return `<tr><td>${escapeHtml(item.patient || item.patientName || "-")}</td><td>${GMAdditionalFees.currency(serviceTotal)}</td><td>${GMAdditionalFees.currency(fees.total)}</td><td><strong>${GMAdditionalFees.currency(Math.max(0, serviceTotal + fees.total - Number(item.discount?.amount || 0)))}</strong></td><td><button class="btn-soft" type="button" data-dentist-fees="${escapeHtml(item.id)}"><i class="bi bi-pencil-square"></i> Manage</button></td></tr>`;
  }).join("") : `<tr><td colspan="5">No patient bills found.</td></tr>`;
  tbody.querySelectorAll("[data-dentist-fees]").forEach(button => button.addEventListener("click", () => openDentistAdditionalFeeModal(button.dataset.dentistFees)));
}

function openDentistAdditionalFeeModal(id) {
  if (document.getElementById("dentistAdditionalFeeModal")) return;
  const db = getClinicDb();
  const item = (db.appointments || []).find(appointment => appointment.id === id);
  if (!item) return;
  let selected = GMAdditionalFees.calculate(item.additionalFees || []).lines.map(line => ({ ...line }));
  const serviceTotal = window.GMAdditionalFees.serviceTotal(item);
  const modal = document.createElement("div"); modal.className = "modal fade"; modal.id = "dentistAdditionalFeeModal"; modal.innerHTML = `<div class="modal-dialog"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Additional Fees</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><p><strong>${escapeHtml(item.patient || item.patientName || "Patient")}</strong></p><div id="dentistFeePicker">${GMAdditionalFees.checkboxPickerHtml()}</div><button class="btn btn-outline-primary mt-2" type="button" id="addDentistFeeBtn">Add Selected Fees</button><div id="dentistFeeLines" class="mt-3"></div><p class="mt-3">Additional Fees Total: <strong id="dentistFeeTotal"></strong><br>Grand Total: <strong id="dentistGrandTotal"></strong></p></div><div class="modal-footer"><button class="btn btn-primary" type="button" id="saveDentistFeesBtn">Save Fees</button></div></div></div>`; document.body.appendChild(modal);
  const render = () => { const calculated = GMAdditionalFees.calculate(selected); const total = calculated.total; modal.querySelector("#dentistFeeLines").innerHTML = calculated.lines.map((line, index) => `<div class="d-flex justify-content-between border-bottom py-2"><span>${escapeHtml(line.feeName || line.name)}<small class="d-block">${escapeHtml(line.description || "")}</small><small class="d-block">Quantity: ${line.quantity} &middot; Unit price: ${GMAdditionalFees.currency(line.unitPrice)}</small></span><span>${GMAdditionalFees.currency(line.subtotal)} <button class="btn btn-sm btn-link text-danger" data-remove-dentist-fee="${index}">Remove</button></span></div>`).join("") || "No additional fees selected."; modal.querySelector("#dentistFeeTotal").textContent = GMAdditionalFees.currency(total); modal.querySelector("#dentistGrandTotal").textContent = GMAdditionalFees.currency(Math.max(0, serviceTotal + total - Number(item.discount?.amount || 0))); modal.querySelectorAll("[data-remove-dentist-fee]").forEach(button => button.onclick = () => { selected.splice(Number(button.dataset.removeDentistFee), 1); render(); }); };
  GMAdditionalFees.bindCheckboxPicker(modal.querySelector("#dentistFeePicker"));
  modal.querySelector("#addDentistFeeBtn").onclick = () => {
    try {
      GMAdditionalFees.addCheckedFees(modal.querySelector("#dentistFeePicker"), selected);
      render();
    } catch (error) { showToast(error.message, "error"); }
  };
  let savedLocally = false;
  modal.querySelector("#saveDentistFeesBtn").onclick = async () => {
    const button = modal.querySelector("#saveDentistFeesBtn");
    button.disabled = true;
    try {
      if (!savedLocally) {
        const latestDb = getClinicDb();
        const current = (latestDb.appointments || []).find(appointment => String(appointment.id) === String(id));
        if (!current) throw new Error("Appointment no longer exists. Close this dialog and refresh.");
        if (JSON.stringify(current.additionalFees || []) !== JSON.stringify(item.additionalFees || [])) throw new Error("Fees changed while this dialog was open. Close and reopen it to review the latest fees.");
        GMAdditionalFees.attachToAppointment(current, selected);
        saveClinicDb(latestDb);
        savedLocally = true;
        modal.querySelectorAll("select, input, #addDentistFeeBtn, [data-remove-dentist-fee]").forEach(control => { control.disabled = true; });
        renderDentistBilling();
      }
      const synced = await window.GmDentalSupabaseSync?.flushNow?.();
      if (synced !== true) throw new Error("Fees are saved on this device, but server sync failed. Close other editing tabs and click Retry Sync. Do not clear browser storage.");
      bootstrap.Modal.getInstance(modal)?.hide();
      showToast("Fees saved and synced.");
    } catch (error) {
      showToast(error.message);
      button.textContent = savedLocally ? "Retry Sync" : "Save Fees";
    } finally { button.disabled = false; }
  };
  modal.addEventListener("hidden.bs.modal", () => {
    bootstrap.Modal.getInstance(modal)?.dispose();
    modal.remove();
  }, { once: true });
  render(); new bootstrap.Modal(modal).show();
}

// Single canonical parseScheduleParts - handles bullet, mojibake variants
function parseScheduleParts(schedule) {
  const s = String(schedule || "").replace(/\u2022|\u00e2\u20ac\u00a2|\u00c3\u00a2\u00e2\u201a\u00ac\u00c2\u00a2/g, "\u2022");
  const parts = s.split("\u2022").map(function(p) { return p.trim(); });
  return {
    datePart: parts[0] || "",
    timePart: normalizeTimeDisplay(parts[1] || "")
  };
}

function initCrossPageSync() {
  window.addEventListener("storage", (event) => {
    const watchedKeys = [
      "gm_dental_db_v1",
      "gm_dental_sync_stamp",
      CLINIC_SYNC_KEYS.patientNotifications,
      CLINIC_SYNC_KEYS.dentistNotifications,
      CLINIC_SYNC_KEYS.clinicSyncStamp
    ];

    if (watchedKeys.includes(event.key)) {
      queueRefreshDentistUI(`storage:${event.key}`);
    }
  });
}

window.approveAppointment = approveAppointment;
window.completeAppointment = completeAppointment;
window.completeTreatmentCase = completeTreatmentCase;
window.scheduleNextAdjustment = scheduleNextAdjustment;
window.cancelApprovedAppointmentByDentist = cancelApprovedAppointmentByDentist;
window.openDentistCancelModal = openDentistCancelModal;
window.closeDentistCancelModal = closeDentistCancelModal;
window.confirmDentistCancel = confirmDentistCancel;
window.rejectAppointment = rejectAppointment;
window.approveRescheduleRequest = approveRescheduleRequest;
window.rejectRescheduleRequest = rejectRescheduleRequest;



// ---------------------------
// INIT
// ---------------------------
document.addEventListener("DOMContentLoaded", () => {
  lockPageHistory();
  showSection("dashboard");
  renderServices();
  loadQuickNotes();
  loadDentistProfile();
  loadDentistPhoto();
  initProfilePhotoUpload();
  initProfileEdit();
  loadTheme();
  initFilters();
  initScheduleTableActionDelegation();
  initCrossPageSync();
  migrateLegacyAppointmentsToClinicDb();
  repairApprovedScheduleConflicts();
  refreshDentistUI();
  void refreshConfirmedDentistCompletions();


  const notifBtn = document.getElementById("notifTrigger");
  const notifPanel = document.getElementById("notifPanel");
  const closeNotifBtn = document.getElementById("closeNotif");

  const openAllNotifModalBtn = document.getElementById("openAllNotifModal");
  const allNotifModal = document.getElementById("allNotifModal");
  const closeAllNotifModalBtn = document.getElementById("closeAllNotifModal");

  const markAllReadBtn = document.getElementById("markAllReadBtn");
  const modalMarkAllReadBtn = document.getElementById("modalMarkAllReadBtn");
  const clearAllNotifBtn = document.getElementById("clearAllNotifBtn");

  const clearNotifWarningModal = document.getElementById("clearNotifWarningModal");
  const cancelClearNotifBtn = document.getElementById("cancelClearNotifBtn");
  const confirmClearNotifBtn = document.getElementById("confirmClearNotifBtn");

  const profileMenuTrigger = document.getElementById("profileMenuTrigger");
  const profileDropdownMenu = document.getElementById("profileDropdownMenu");

  const confirmArchiveBtn = document.getElementById("confirmArchiveBtn");

  if (notifBtn && notifPanel) {
    notifBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDentistNotifPanel();
    });
  }

  if (closeNotifBtn) {
    closeNotifBtn.addEventListener("click", () => {
      toggleDentistNotifPanel(true);
    });
  }

  if (openAllNotifModalBtn && allNotifModal) {
    openAllNotifModalBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      allNotifModal.classList.add("active");
      renderDentistNotifications();
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

  if (markAllReadBtn) {
    markAllReadBtn.addEventListener("click", () => {
      markAllDentistNotificationsRead();
      renderDentistNotifications();
      showToast("All notifications marked as read.");
    });
  }

  if (modalMarkAllReadBtn) {
    modalMarkAllReadBtn.addEventListener("click", () => {
      markAllDentistNotificationsRead();
      renderDentistNotifications();
      showToast("All notifications marked as read.");
    });
  }

  if (clearAllNotifBtn && clearNotifWarningModal) {
    clearAllNotifBtn.addEventListener("click", () => {
      clearNotifWarningModal.classList.add("active");
    });
  }

  if (cancelClearNotifBtn && clearNotifWarningModal) {
    cancelClearNotifBtn.addEventListener("click", () => {
      clearNotifWarningModal.classList.remove("active");
    });
  }

  if (confirmClearNotifBtn && clearNotifWarningModal) {
    confirmClearNotifBtn.addEventListener("click", () => {
      clearAllDentistNotifications();
      renderDentistNotifications();
      clearNotifWarningModal.classList.remove("active");
      allNotifModal?.classList.remove("active");
      toggleDentistNotifPanel(true);
      showToast("All notifications cleared.");
    });
  }

  if (clearNotifWarningModal) {
    clearNotifWarningModal.addEventListener("click", (e) => {
      if (e.target === clearNotifWarningModal) {
        clearNotifWarningModal.classList.remove("active");
      }
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

   if (confirmArchiveBtn) {
     confirmArchiveBtn.addEventListener("click", () => {
       if (pendingArchiveId) {
         archiveAppointment(pendingArchiveId);
       }
       closeArchiveModal();
     });
   }

   const confirmArchiveAllHistoryBtn = document.getElementById("confirmArchiveAllHistoryBtn");
   if (confirmArchiveAllHistoryBtn) {
     confirmArchiveAllHistoryBtn.addEventListener("click", () => {
       archiveAllHistoryAppointments();
       closeArchiveAllHistoryModal();
     });
   }

   const confirmDeleteArchivedBtn = document.getElementById("confirmDeleteArchivedBtn");
   if (confirmDeleteArchivedBtn) {
     confirmDeleteArchivedBtn.addEventListener("click", () => {
       if (pendingDeleteArchivedId) {
         deleteArchivedAppointment(pendingDeleteArchivedId);
       }
       closeDeleteArchivedModal();
     });
   }

   const confirmClearArchiveBtn = document.getElementById("confirmClearArchiveBtn");
   if (confirmClearArchiveBtn) {
     confirmClearArchiveBtn.addEventListener("click", () => {
       clearArchive();
       closeClearArchiveModal();
     });
   }

   document.addEventListener("click", (e) => {
    if (notifPanel && notifBtn && !notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
      toggleDentistNotifPanel(true);
    }

    if (
      profileDropdownMenu &&
      profileMenuTrigger &&
      !profileDropdownMenu.contains(e.target) &&
      !profileMenuTrigger.contains(e.target)
    ) {
      toggleProfileDropdown(true);
    }
  });

  renderDentistNotifications();
});

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
