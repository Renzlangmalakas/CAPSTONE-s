(function () {
  const CLINIC_DB_KEY = "gm_dental_db_v1";
  const SYNC_STAMP_KEY = "gm_dental_sync_stamp";
  const GLOBAL_SYNC_KEY = "gm_dental_global_sync";
  const LOCAL_CHANGE_STAMP_KEY = "gm_dental_local_change_stamp";
  const LAST_PUSHED_STAMP_KEY = "gm_dental_last_pushed_stamp";

  const API_BASE_URL =
    window.GM_DENTAL_API_BASE ||
    localStorage.getItem("gm_dental_api_base") ||
    (window.location.protocol === "file:" || ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? "http://localhost:3000"
      : "");

  if (!API_BASE_URL && !window.location.origin) return;

  let isApplyingRemote = false;
  let pushTimer = 0;
  let pushInFlight = null;
  let pushFailures = 0;
  let nextPushAt = 0;
  let unloadStamp = 0;
  const CONFLICT_PAUSE_KEY = "gm_dental_sync_conflict_paused";
  let conflictPaused = localStorage.getItem(CONFLICT_PAUSE_KEY) === "true";
  let consecutiveConflicts = 0;
  let pullInFlight = false;
  let pullFailures = 0;
  let nextPullAt = 0;
  const recoveredConflictIds = new Set();

  const originalSetItem = localStorage.setItem.bind(localStorage);

  function sessionToken() {
    try { return JSON.parse(sessionStorage.getItem("gm_dental_current_user") || "{}").sessionToken || ""; }
    catch { return ""; }
  }

  window.GmDentalApiFetch = function (url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = sessionToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, { ...options, headers });
  };

  function apiUrl(path) {
    return `${API_BASE_URL}${path}`;
  }

  function getLocalClinicDb() {
    try {
      const db = JSON.parse(localStorage.getItem(CLINIC_DB_KEY) || "{}");
      const user = JSON.parse(sessionStorage.getItem("gm_dental_current_user") || "{}");
      return user.role === "dentist" && window.GMDentistAccess ? window.GMDentistAccess.scope(db,user) : db;
    } catch {
      return {};
    }
  }

  // Remove previously downloaded cross-account rows before the dentist UI reads
  // this shared browser cache. Server checks remain authoritative.
  try {
    const user = JSON.parse(sessionStorage.getItem("gm_dental_current_user") || "{}");
    if (user.role === "dentist" && window.GMDentistAccess) {
      originalSetItem(CLINIC_DB_KEY, JSON.stringify(getLocalClinicDb()));
    }
  } catch { /* An unreadable cache will be replaced on the next successful pull. */ }

  function hasClinicRows(db) {
    return [
      "patients",
      "dentists",
      "staff",
      "appointments",
      "dentistSchedules",
      "services",
      "additionalFees",
      "payments",
      "archivedAppointments",
      "rescheduleRequests",
      "patientClinicalNotes",
      "treatmentPlans",
      "history",
      "notifications"
    ].some((key) => {
      const value = db?.[key];
      if (Array.isArray(value)) return value.length;
      if (key === "notifications" && value && typeof value === "object") {
        return Object.values(value).some((group) => Array.isArray(group) && group.length);
      }
      return false;
    });
  }

  function getLocalChangeStamp() {
    return Number(localStorage.getItem(LOCAL_CHANGE_STAMP_KEY) || 0);
  }

  function getLastPushedStamp() {
    return Number(localStorage.getItem(LAST_PUSHED_STAMP_KEY) || 0);
  }

  function markLocalDirty() {
    originalSetItem(LOCAL_CHANGE_STAMP_KEY, String(Math.max(Date.now(), getLocalChangeStamp() + 1, getLastPushedStamp() + 1)));
  }

  function markLastPushed(stamp) {
    originalSetItem(LAST_PUSHED_STAMP_KEY, String(stamp));
  }

  function hasUnpushedChanges() {
    return getLocalChangeStamp() > getLastPushedStamp();
  }

  function notifyLocalPages() {
    const stamp = String(Date.now());
    originalSetItem(SYNC_STAMP_KEY, stamp);
    originalSetItem(GLOBAL_SYNC_KEY, stamp);

    try {
      window.dispatchEvent(new StorageEvent("storage", { key: CLINIC_DB_KEY }));
      window.dispatchEvent(new StorageEvent("storage", { key: SYNC_STAMP_KEY }));
      window.dispatchEvent(new StorageEvent("storage", { key: GLOBAL_SYNC_KEY }));
    } catch {
      window.dispatchEvent(new CustomEvent("gm-dental-supabase-sync"));
    }
  }

  function applyRemoteClinicDb(db) {
    if (db && window.GMDefaultAccounts) window.GMDefaultAccounts.normalizeDb(db);
    if (!db || typeof db !== "object" || Array.isArray(db) || !Object.keys(db).length) return;
    isApplyingRemote = true;
    try {
      originalSetItem(CLINIC_DB_KEY, JSON.stringify(db));
      // Remote state matches what we just wrote; clear dirty so we don't push back.
      const stamp = Date.now();
      originalSetItem(LOCAL_CHANGE_STAMP_KEY, String(stamp));
      originalSetItem(LAST_PUSHED_STAMP_KEY, String(stamp));
      notifyLocalPages();
    } finally {
      isApplyingRemote = false;
    }
  }

  function showSyncConflict(message) {
    if (!document.body || !document.createElement || !document.getElementById) return;
    let notice = document.getElementById('clinicSyncConflict');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'clinicSyncConflict';
      notice.setAttribute('role', 'alert');
      notice.style.cssText = 'position:fixed;bottom:20px;left:20px;max-width:480px;padding:16px;background:#fff3cd;color:#664d03;border:1px solid #ffecb5;border-radius:8px;z-index:10000;';
      document.body.appendChild(notice);
    }
    notice.textContent = message + ' ';
    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = 'Download saved changes';
    download.onclick = () => {
      const blob = new Blob([localStorage.getItem('gm_dental_sync_conflict_drafts') || '[]'], { type: 'application/json' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'unsaved-appointment-changes.json';
      link.click();
      URL.revokeObjectURL(url);
    };
    notice.appendChild(download);
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.textContent = 'Dismiss';
    dismiss.style.marginLeft = '8px';
    dismiss.onclick = () => notice.remove();
    notice.appendChild(dismiss);
  }

  async function recoverAppointmentConflict(error, sentDb) {
    // Keep a recoverable copy before replacing any rejected local record.
    const localDb = getLocalClinicDb();
    const id = error.appointmentId;
    const draft = id ? (localDb.appointments || []).find(row => String(row.id) === String(id)) : localDb;
    const drafts = JSON.parse(localStorage.getItem('gm_dental_sync_conflict_drafts') || '[]');
    drafts.push({ appointmentId: id || null, savedAt: new Date().toISOString(), reason: error.message, data: draft });
    originalSetItem('gm_dental_sync_conflict_drafts', JSON.stringify(drafts));
    if (!id) return false;
    if (recoveredConflictIds.has(String(id))) return false;
    // Count the attempt before awaiting the read. Edits made while recovery
    // runs must not allow the same rejected appointment to retry indefinitely.
    recoveredConflictIds.add(String(id));
    const response = await window.GmDentalApiFetch(apiUrl('/api/clinic-db'));
    if (!response.ok) return false;
    const remoteDb = (await response.json()).db;
    if (!remoteDb || !Array.isArray(remoteDb.appointments)) return false;
    const latestDb = getLocalClinicDb();
    const sent = (sentDb.appointments || []).find(row => String(row.id) === String(id));
    const current = (latestDb.appointments || []).find(row => String(row.id) === String(id));
    // An edit made during the request must get its own save attempt.
    if (JSON.stringify(current) !== JSON.stringify(sent)) return true;
    const saved = remoteDb.appointments.find(row => String(row.id) === String(id));
    const replace = (rows, includeSaved) => {
      const result = (Array.isArray(rows) ? rows : []).filter(row => String(row.id) !== String(id));
      if (saved && includeSaved) result.push(saved);
      return result;
    };
    latestDb.appointments = replace(latestDb.appointments, true);
    latestDb.archivedAppointments = replace(latestDb.archivedAppointments, saved?.archived === true || saved?.archivedForPatient === true);
    isApplyingRemote = true;
    try {
      // Update legacy mirrors too, so normalization cannot resurrect the rejected copy.
      for (const key of ['appointments', 'archivedAppointments']) {
        const rows = JSON.parse(localStorage.getItem(key) || '[]');
        originalSetItem(key, JSON.stringify(replace(rows, key === 'appointments' || saved?.archived === true || saved?.archivedForPatient === true)));
      }
      originalSetItem(CLINIC_DB_KEY, JSON.stringify(latestDb));
      markLocalDirty();
      notifyLocalPages();
    } finally {
      isApplyingRemote = false;
    }
    showSyncConflict(`Appointment ${id}: ${error.message || 'An appointment change was rejected.'} ${saved ? 'The server version has been restored.' : 'The rejected appointment has been removed from this device.'} Your attempted change is saved as a draft. Please review this appointment before trying again.`);
    return true;
  }

  async function pullClinicDb(options = {}) {
    if (pullInFlight || document.visibilityState === 'hidden' || !sessionToken() || (options.force !== true && Date.now() < nextPullAt)) return false;
    pullInFlight = true;
    try { return await performPull(); }
    finally { pullInFlight = false; }
  }

  async function performPull() {
    // Never pull-and-overwrite when local has changes that haven't been pushed.
    // Push first so the local change reaches the server, then accept the
    // round-tripped state.
    if (hasUnpushedChanges()) {
      try {
        if (await pushClinicDb() !== true || hasUnpushedChanges()) return false;
      } catch (error) {
        console.warn("Supabase push (before pull) failed:", error.message || error);
        return false;
      }
    }

    try {
      const stampAtRead = getLocalChangeStamp();
      const response = await window.GmDentalApiFetch(apiUrl("/api/clinic-db"));
      if (!response.ok) throw new Error(`Clinic read failed (${response.status})`);

      const result = await response.json();
      pullFailures = 0;
      nextPullAt = Date.now() + 30000;
      if (getLocalChangeStamp() !== stampAtRead || hasUnpushedChanges() || pushInFlight) return;
      const remoteDb = result.db || {};
      if (!hasClinicRows(remoteDb)) {
        const localDb = getLocalClinicDb();
        if (hasClinicRows(localDb)) schedulePush(250);
        return;
      }

      applyRemoteClinicDb(remoteDb);
      return true;
    } catch (error) {
      pullFailures += 1;
      nextPullAt = Date.now() + Math.min(300000, 30000 * 2 ** Math.min(pullFailures, 4));
      console.warn("Supabase pull failed:", error.message || error);
      return false;
    }
  }

  async function pushClinicDb() {
    if (localStorage.getItem(CONFLICT_PAUSE_KEY) === 'true') conflictPaused = true;
    if (isApplyingRemote || conflictPaused) return false;
    if (!hasUnpushedChanges()) return true;
    if (Date.now() < nextPushAt) return false;

    // Coalesce concurrent push requests so a flushNow during an in-flight push
    // just awaits the same operation rather than racing.
    if (pushInFlight) return pushInFlight;

    const sendSnapshot = async () => {
      const db = getLocalClinicDb();
      if (!db || typeof db !== "object" || !Object.keys(db).length) return;

      const stampAtSend = getLocalChangeStamp() || Date.now();

      try {
        const response = await window.GmDentalApiFetch(apiUrl("/api/clinic-db"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ db })
        });

        if (!response.ok) {
          pushFailures += 1;
          nextPushAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(pushFailures, 6));
          const error = await response.json().catch(() => ({}));
          console.warn("Clinic sync rejected:", response.status, error.message || "Request failed");
          if (response.status === 409) {
            let recovered = false;
            try { recovered = await recoverAppointmentConflict(error, db); }
            catch (recoveryError) { console.warn('Conflict recovery failed:', recoveryError.message); }
            consecutiveConflicts += 1;
            conflictPaused = !recovered || consecutiveConflicts >= 2;
            if (conflictPaused) originalSetItem(CONFLICT_PAUSE_KEY, 'true');
            // Keep the backoff across successive rejected appointments.
            // A full snapshot can contain several conflicts.
            if (conflictPaused) {
              showSyncConflict('Sync is paused because the server rejected a change. Your local changes are still saved. Please review your appointments.');
            }
          }
          return false;
        }

        const result = await response.json();
        pushFailures = 0;
        nextPushAt = 0;
        recoveredConflictIds.clear();
        consecutiveConflicts = 0;
        markLastPushed(stampAtSend);
        if (getLocalChangeStamp() === stampAtSend && result.db) {
          applyRemoteClinicDb(result.db);
        }
        return true;
      } catch (error) {
        pushFailures += 1;
        nextPushAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(pushFailures, 6));
        console.warn("Supabase push failed:", error.message || error);
        return false;
      }
    };
    // All tabs share the same snapshot and dirty stamps. Serialize their saves
    // and recheck after acquiring the lock, since another tab may have saved it.
    pushInFlight = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("gm-dental-clinic-sync", () =>
        hasUnpushedChanges() ? sendSnapshot() : true)
      : sendSnapshot();

    try {
      return await pushInFlight;
    } finally {
      pushInFlight = null;
      if (hasUnpushedChanges()) schedulePush(Math.min(60000, 1000 * 2 ** Math.min(pushFailures, 6)));
    }
  }

  function schedulePush(delay = 250) {
    if (isApplyingRemote || conflictPaused || localStorage.getItem(CONFLICT_PAUSE_KEY) === "true") return;
    window.clearTimeout(pushTimer);
    pushTimer = window.setTimeout(pushClinicDb, delay);
  }

  async function flushNow() {
    window.clearTimeout(pushTimer);
    pushTimer = 0;
    let result = await pushClinicDb();
    if (result === true && hasUnpushedChanges()) result = await pushClinicDb();
    return result === true && !hasUnpushedChanges();
  }

  // Fire-and-forget push on page unload so changes made just before refresh
  // still reach Supabase even if the debounced timer hasn't fired yet.
  function flushOnUnload() {
    if (localStorage.getItem(CONFLICT_PAUSE_KEY) === "true" || conflictPaused || !hasUnpushedChanges() || pushInFlight || Date.now() < nextPushAt) return;
    const stamp = getLocalChangeStamp();
    if (unloadStamp === stamp) return;
    const db = getLocalClinicDb();
    if (!hasClinicRows(db)) return;
    unloadStamp = stamp;

    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ db, sessionToken: sessionToken() })], { type: "application/json" });
        // Server accepts POST /api/clinic-db with the same semantics as PUT.
        navigator.sendBeacon(apiUrl("/api/clinic-db"), blob);
      } else {
        window.GmDentalApiFetch(apiUrl("/api/clinic-db"), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ db }),
          keepalive: true
        }).catch(() => {});
      }
    } catch {
      /* best-effort only */
    }
  }

  const storageSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function patchedSetItem(key, value) {
    const previous = this.getItem(key);
    const result = storageSetItem.call(this, key, value);
    if (this === localStorage && key === CLINIC_DB_KEY && previous !== String(value) && !isApplyingRemote) {
      markLocalDirty();
      schedulePush();
    }
    return result;
  };

  window.addEventListener("storage", (event) => {
    if (event.key === CLINIC_DB_KEY && !isApplyingRemote) {
      // Another tab updated the DB. Pull the authoritative server state;
      // do not echo the event back as a new full-database write.
      pullClinicDb();
    }
  });

  window.addEventListener("pagehide", flushOnUnload);
  window.addEventListener("beforeunload", flushOnUnload);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushOnUnload();
    else pullClinicDb();
  });

  window.GmDentalSupabaseSync = {
    pull: pullClinicDb,
    push: pushClinicDb,
    flushNow,
    apiBaseUrl: API_BASE_URL
  };

  if (conflictPaused) showSyncConflict('Sync is paused after conflicting edits. Your changes are saved locally. Please review your appointments.');
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", pullClinicDb, { once: true });
  } else {
    pullClinicDb();
  }

  window.setInterval(pullClinicDb, /\/Dentist\//i.test(window.location.pathname) ? 15000 : 60000);
})();
