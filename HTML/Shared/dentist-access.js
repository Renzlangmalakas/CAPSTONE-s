(function(root) {
  const norm = value => String(value || '').trim().toLowerCase();
  const name = value => norm(value).replace(/\bdr\.?\s*/g, '').replace(/\s+/g, ' ');
  const rows = value => Array.isArray(value) ? value : [];
  function identity(db, user) {
    return {...user, dentistIds: [user.id, ...rows(db.dentists).filter(d => norm(d.email) === norm(user.email) && user.email).map(d => d.id)].filter(Boolean)};
  }
  function assigned(record, user) {
    if (!record || !user) return false;
    if (rows(record.dentistIds).length) return [user.id, ...rows(user.dentistIds)].filter(Boolean).some(id => record.dentistIds.some(selected => norm(selected) === norm(id)));
    if (record.dentistId) return [user.id, ...rows(user.dentistIds)].filter(Boolean).some(id => norm(record.dentistId) === norm(id));
    if (record.dentistEmail) return !!user.email && norm(record.dentistEmail) === norm(user.email);
    return !!name(user.name || user.fullName) && name(record.dentistName || record.dentist) === name(user.name || user.fullName);
  }
  const patientKey = r => norm(r.patientKey || r.patientId || r.patientEmail || r.email || r.patientName || r.patient || r.name);
  function scope(db, user) {
    user = identity(db,user);
    const all = [...rows(db.appointments), ...rows(db.archivedAppointments)];
    const mine = all.filter(a => assigned(a, user));
    const keys = new Set(mine.map(patientKey).filter(Boolean));
    const ids = new Set(mine.map(a => String(a.id)));
    const patient = r => r.id && keys.has(norm(r.id)) || keys.has(patientKey(r));
    function record(r) {
      if (!patient(r)) return false;
      if (r.appointmentId) return ids.has(String(r.appointmentId));
      if (r.dentistId || r.dentistEmail || r.dentist || r.dentistName) return assigned(r,user);
      if (r.createdBy && name(r.createdBy) !== 'dentist') return name(r.createdBy) === name(user.name || user.fullName) || norm(r.createdBy) === norm(user.email);
      // Ambiguous legacy findings are never shared between two dentists.
      return !all.some(a => patientKey(a) === patientKey(r) && !assigned(a,user));
    }
    const result = {};
    for (const key of ['services','additionalFees','dentists','dentistSchedules']) result[key] = rows(db[key]);
    result.appointments = rows(db.appointments).filter(a => assigned(a,user));
    result.archivedAppointments = rows(db.archivedAppointments).filter(a => assigned(a,user));
    result.patients = rows(db.patients).filter(patient);
    for (const key of ['patientClinicalNotes','treatmentPlans','rescheduleRequests','history','payments']) result[key] = rows(db[key]).filter(r => r.appointmentId ? ids.has(String(r.appointmentId)) : record(r));
    result.notifications = {admin:[], staff:[], patient:[], dentist:rows(db.notifications?.dentist).filter(r => r.appointmentId ? ids.has(String(r.appointmentId)) : assigned(r,user))};
    result.staff = [];
    return result;
  }
  function writable(incoming, saved, user) {
    user = identity(saved,user);
    const visible = scope(saved,user);
    const output = {};
    const denied = () => { const e = new Error('You can only access records for patients assigned to you. Refresh your patient list.'); e.status=403; throw e; };
    const allAppointments = [...rows(saved.appointments),...rows(saved.archivedAppointments)];
    for (const key of ['appointments','archivedAppointments']) {
      if (!Array.isArray(incoming[key])) continue;
      output[key] = incoming[key].map(r => {
        const old = allAppointments.find(a => String(a.id) === String(r.id));
        if (JSON.stringify(rows(r.dentistIds)) !== JSON.stringify(rows(old?.dentistIds))) denied();
        if (!assigned(r,user) || old && (!assigned(old,user) || patientKey(old) !== patientKey(r))) denied();
        if (!old && allAppointments.some(a => patientKey(a) === patientKey(r) && !assigned(a,user)) && !visible.appointments.some(a => patientKey(a) === patientKey(r))) denied();
        return r;
      });
    }
    const extended = scope({...saved, appointments:[...rows(saved.appointments), ...rows(output.appointments)]},user);
    const keys = new Set([...extended.appointments,...extended.archivedAppointments].map(patientKey));
    for (const key of ['patientClinicalNotes','treatmentPlans','rescheduleRequests']) {
      if (!Array.isArray(incoming[key])) continue;
      output[key] = incoming[key].map(r => {
        const old = rows(saved[key]).find(a => String(a.id) === String(r.id));
        if (old && rows(visible[key]).some(a => String(a.id) === String(r.id)) && JSON.stringify(old) === JSON.stringify(r)) return old;
        if (old && (!rows(visible[key]).some(a => String(a.id) === String(r.id)) || patientKey(old) !== patientKey(r))) denied();
        if (!keys.has(patientKey(r))) denied();
        if (r.appointmentId && ![...extended.appointments,...extended.archivedAppointments].some(a => String(a.id) === String(r.appointmentId) && patientKey(a) === patientKey(r))) denied();
        if ((r.dentistId || r.dentistEmail) && !assigned(r,user)) denied();
        return {...r, dentistId:user.id, dentistEmail:user.email};
      });
    }
    // Directory/catalog snapshots are read-only for dentists. Do not echo or
    // rewrite other users' rows when a scoped browser syncs its snapshot.
    if (incoming.notifications) {
      output.notifications = {admin:[],staff:[],patient:[],dentist:[]};
      for (const target of ['dentist','patient','admin']) output.notifications[target] = rows(incoming.notifications[target]).filter(r =>
        r.appointmentId && [...extended.appointments,...extended.archivedAppointments].some(a => String(a.id) === String(r.appointmentId)));
    }
    return output;
  }
  const api = {identity,assigned,patientKey,scope,writable};
  if (typeof module === 'object' && module.exports) module.exports=api;
  else root.GMDentistAccess=api;
})(typeof globalThis === 'object' ? globalThis : this);
