(function (root) {
  "use strict";
  const accounts = [
  {
    "name": "Dr. Carla Mendoza",
    "email": "carla.mendoza@gmdental.com",
    "role": "dentist",
    "specialty": "Periodontist, General Dentist"
  },
  {
    "name": "Dr. Imelda Mappala",
    "email": "imelda.mappala@gmdental.com",
    "role": "dentist",
    "specialty": "All Services"
  },
  {
    "name": "Dr. Sofia Ramirez",
    "email": "sofia.ramirez@gmdental.com",
    "role": "dentist",
    "specialty": "Endodontist, General Dentist"
  },
  {
    "name": "Dr. Daniel Santos",
    "email": "daniel.santos@gmdental.com",
    "role": "dentist",
    "specialty": "Orthodontist, General Dentist"
  },
  {
    "name": "Dr. Andrea Cruz",
    "email": "andrea.cruz@gmdental.com",
    "role": "dentist",
    "specialty": "Oral Surgeon, General Dentist"
  },
  {
    "name": "Dr. Paolo Villanueva",
    "email": "paolo.villanueva@gmdental.com",
    "role": "dentist",
    "specialty": "Cosmetic Dentist, General Dentist"
  },
  {
    "name": "Dr. Miguel Torres",
    "email": "miguel.torres@gmdental.com",
    "role": "dentist",
    "specialty": "Prosthodontist, General Dentist"
  },
  {
    "name": "Dr. Maria Reyes",
    "email": "maria.reyes@gmdental.com",
    "role": "dentist",
    "specialty": "Pediatric Dentist, General Dentist"
  },
  {
    "name": "Administrator",
    "email": "gannalmappaladentallclinic@gmail.com",
    "role": "admin"
  },
  {
    "name": "Anna Reyes",
    "email": "queengpt18@gmail.com",
    "role": "staff"
  },
  {
    "name": "Mark Villanueva",
    "email": "kingchatgpt09@gmail.com",
    "role": "staff"
  }
];
  // Existing clinic booking roster; saved working hours take precedence.
  const workingDays = {
    "maria.reyes@gmdental.com": ["Wednesday", "Thursday"],
    "carla.mendoza@gmdental.com": ["Tuesday", "Friday"],
    "imelda.mappala@gmdental.com": ["Monday", "Wednesday", "Friday", "Saturday"],
    "sofia.ramirez@gmdental.com": ["Monday", "Friday"],
    "daniel.santos@gmdental.com": ["Wednesday", "Saturday"],
    "andrea.cruz@gmdental.com": ["Wednesday", "Friday"],
    "paolo.villanueva@gmdental.com": ["Tuesday", "Thursday"],
    "miguel.torres@gmdental.com": ["Tuesday", "Saturday"]
  };
  function defaultSchedules(account) {
    return (workingDays[account?.email] || []).map(day => ({ day, start: "09:00", end: "17:00" }));
  }
  const key = value => String(value || "").toLowerCase().replace(/^dr\.?\s*/, "").replace(/\b[a-z]\.?(?=\s|$)/g, "").replace(/\s+/g, " ").trim();
  const emailKey = value => String(value || "").trim().toLowerCase();
  function match(row, role) {
    return accounts.find(a => (!role || a.role === role) &&
      (emailKey(row.email) === a.email || key(row.name) === key(a.name) ||
       (a.role === "dentist" && emailKey(row.email) === a.email.replace(".com", ".test")) ||
       (a.role === "admin" && emailKey(row.email) === "admin@test.com") ||
       (a.name === "Dr. Daniel Santos" && emailKey(row.email) === "dentist@test.com") ||
       (a.name === "Anna Reyes" && emailKey(row.email) === "staff@test.com")));
  }
  const placeholder = name => /^(assigned? dentist|unassigned|not assigned|pending|n\/a)$/i.test(String(name || "").trim());
  function merge(rows = [], role, addDefaults = true) {
    const result = [], positions = new Map();
    for (const row of rows) {
      if (!row || placeholder(row.name)) continue;
      // Retired legacy profiles must not be restored by old browser snapshots.
      if ((role || row.role) === "dentist" && ["gerald", "santos", "reyes"].includes(key(row.name))) continue;
      const account = match(row, role || row.role);
      const item = account ? { ...row, name: account.name, email: account.email } : { ...row };
      // Recover known accounts by email before discarding empty staff profiles.
      if ((role || item.role) === "staff" &&
          (!String(item.name || "").trim() || /^unnamed\s+staff$/i.test(String(item.name).trim()))) continue;
      const identity = account ? account.email : key(item.name) || emailKey(item.email) || item.id;
      if (!positions.has(identity)) { positions.set(identity, result.length); result.push(item); }
      else {
        const existing = result[positions.get(identity)];
        for (const [field, value] of Object.entries(item)) if (!existing[field] && value) existing[field] = value;
        if (Array.isArray(item.schedules)) existing.schedules = [...new Map([...(existing.schedules || []), ...item.schedules].map(s => [JSON.stringify(s), s])).values()];
      }
    }
    if (addDefaults) for (const a of accounts.filter(a => a.role === role)) {
      if (!positions.has(a.email)) result.push({ ...a, id: "default-" + a.email.split("@")[0], schedules: [], archived: false });
    }
    for (const item of result) {
      if ((role || item.role) === "staff") item.position = "All Staff Positions";
      const account = match(item, role || item.role);
      if (account?.role !== "dentist") continue;
      if (!Array.isArray(item.schedules) || !item.schedules.length) item.schedules = defaultSchedules(account);
      if (!item.specialty || /^(dentist|general)$/i.test(item.specialty)) item.specialty = account.specialty;
      // Preserve the clinic-authorized all-services capability across legacy duplicate profiles.
      if (account.specialty === "All Services") item.specialty = "All Services";
    }
    return result;
  }
  function isUnknownPatient(name) {
    return /^(patient|unknown(?: patient)?|unnamed patient)$/i.test(String(name || '').trim());
  }
  function isRemovedSamplePatient(row = {}) {
    // These two contactless legacy records were explicitly selected for removal.
    return ["juan dela cruz", "maria santos"].includes(key(row.name || row.patientName || row.patient)) &&
      !String(row.email || row.patientEmail || "").trim() &&
      !String(row.contact || row.mobile || row.phone || row.patientPhone || "").trim() &&
      !row.accountId && !row.userId;
  }
  function removeLegacySamplePatients(db) {
    // Match the old fixtures by multiple fields, never by a person's name alone.
    const samples = [
      { name: "Juan Dela Cruz", age: 30, contact: "09123456789", address: "Quezon City", service: "Consultation", date: "2026-03-25", time: "10:00", staffTime: "09:00" },
      { name: "Maria Santos", age: 25, contact: "09987654321", address: "Manila", service: "Orthodontic Treatment (Braces)", date: "2026-03-26", time: "14:00", staffTime: "10:30", staffService: "Orthodontic Adjustment" },
      { name: "Pedro Reyes", age: 10, contact: "09112223333", address: "Quezon City", service: "Consultation", date: "2026-03-27", time: "09:00", staffTime: "13:00", staffService: "Oral Prophylaxis" }
    ];
    const removedNames = new Set();
    for (const field of ["appointments", "archivedAppointments"]) {
      if (!Array.isArray(db[field])) continue;
      db[field] = db[field].filter(row => {
        if (row.patientEmail || row.email || row.patientId || row.patient_id) return true;
        const sample = samples.find(item => key(row.patientName || row.patient) === key(item.name));
        if (!sample) return true;
        const oldAdmin = row.service === sample.service && row.date === sample.date && row.time === sample.time;
        const oldStaff = row.service === (sample.staffService || sample.service) && row.time === sample.staffTime &&
          ["Waiting", "Confirmed"].includes(row.status) && row.total != null && row.method != null;
        if (oldAdmin || oldStaff) removedNames.add(key(sample.name));
        return !oldAdmin && !oldStaff;
      });
    }
    if (Array.isArray(db.patients)) db.patients = db.patients.filter(row => {
      if (isRemovedSamplePatient(row)) return false;
      if (row.email || row.accountId || row.userId) return true;
      const sample = samples.find(item => key(row.name) === key(item.name));
      if (!sample) return true;
      const exactFixture = Number(row.age) === sample.age && row.address === sample.address &&
        String(row.contact || row.mobile || "") === sample.contact;
      const emptyDerivedRecord = removedNames.has(key(row.name)) &&
        !row.age && !row.address && !row.contact && !row.mobile && !row.condition;
      return !exactFixture && !emptyDerivedRecord;
    });
    return db;
  }
  function isDeletedPatient(db, row) {
    return (db.deletedPatients || []).some(deleted => {
      const id = row.patientId || row.patient_id || row.id;
      if (id && String(id) === String(deleted.id)) return true;
      const email = emailKey(row.patientEmail || row.email);
      if (email && deleted.email) return email === emailKey(deleted.email);
      return !email && key(row.patientName || row.patient || row.name) === key(deleted.name);
    });
  }
  function normalizeDb(db) {
    db.deletedPatients = [...new Map([
      ...(db.deletedPatients || []),
      ...(db.patients || []).filter(row => row.deletedAt)
    ].map(row => [String(row.id), row])).values()];
    if (Array.isArray(db.patients)) db.patients = db.patients.filter(row => !isDeletedPatient(db, row));
    removeLegacySamplePatients(db);
    if (Array.isArray(db.patients)) db.patients = db.patients.filter(row => !isUnknownPatient(row.name));
    const removedIds = new Set();
    const placeholderRecord = row => {
      const names = [row.patientName, row.patient].filter(value => String(value || "").trim());
      return names.length > 0 && names.every(isUnknownPatient);
    };
    for (const field of ["appointments", "archivedAppointments"]) {
      for (const row of db[field] || []) if (placeholderRecord(row)) removedIds.add(String(row.id));
    }
    for (const field of ["appointments", "archivedAppointments", "treatmentPlans", "patientClinicalNotes", "rescheduleRequests", "history", "payments"]) {
      if (Array.isArray(db[field])) db[field] = db[field].filter(row => !placeholderRecord(row) && !removedIds.has(String(row.appointmentId || "")));
    }
    const remap = new Map();
    if (Array.isArray(db.dentists)) {
      const old = db.dentists;
      db.dentists = merge(old, "dentist");
      for (const row of old) {
        const a = match(row, "dentist");
        const next = db.dentists.find(d => a ? d.email === a.email : key(d.name) === key(row.name));
        if (next && row.id) remap.set(row.id, next.id);
      }
    }
    if (Array.isArray(db.staff)) db.staff = merge(db.staff, "staff");
    for (const collection of Object.values(db)) if (Array.isArray(collection)) for (const row of collection) {
      for (const field of ["dentistId", "dentist_id"]) if (remap.has(row[field])) row[field] = remap.get(row[field]);
      const a = match({ name: row.dentist }, "dentist");
      if (a) row.dentist = a.name;
    }
    // Normalize native database shifts before joining them to the roster.
    db.dentistSchedules = (db.dentistSchedules || []).map(row => ({
      ...row,
      day: row.day || ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][row.dayOfWeek ?? row.day_of_week],
      start: String(row.start || row.startTime || row.start_time || '').slice(0,5),
      end: String(row.end || row.endTime || row.end_time || '').slice(0,5),
      archived: Boolean(row.archived || row.isActive === false || row.is_active === false)
    }));
    // Separate saved schedule rows are also used by the clinic database.
    for (const dentist of db.dentists || []) {
      const saved = (db.dentistSchedules || []).filter(row => !row.archived &&
        ((row.dentistId || row.dentist_id) === dentist.id ||
         key(row.dentist || row.dentistName) === key(dentist.name)))
        .filter(row => row.day && row.start && row.end)
        .map(({ day, start, end }) => ({ day, start, end }));
      if (saved.length) dentist.schedules = [...new Map(saved.map(row => [JSON.stringify(row), row])).values()];
    }
    return db;
  }
  const api = { accounts, key, match, merge, placeholder, normalizeDb, isUnknownPatient, removeLegacySamplePatients, isRemovedSamplePatient, isDeletedPatient };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GMDefaultAccounts = api;
})(typeof window !== "undefined" ? window : globalThis);
