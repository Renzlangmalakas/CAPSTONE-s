const eligibility = require('../Shared/dentist-services');
function validateAssignment(record, saved, role, dentists) {
  const time = require('../Shared/booking-time');
  const scheduleChanged = !saved || record.date !== saved.date || record.time !== saved.time || time.duration(record) !== time.duration(saved);
  if (scheduleChanged && !/cancel|reject|complet/i.test(record.status || '') && time.overlapsLunch(time.minutes(record.time), time.duration(record))) {
    const error = new Error('All dentists take lunch from 1:00 PM to 1:30 PM. Select a time that does not overlap the break.');
    error.status = 400; throw error;
  }
  if (role === 'staff' && saved) {
    const sameName = String(record.patient || record.patientName || '') === String(saved.patient || saved.patientName || '');
    if (!sameName || saved.patientId && String(record.patientId || '') !== String(saved.patientId)) {
      const error = new Error('The patient on an existing appointment cannot be changed.');
      error.status = 403; throw error;
    }
  }

  const ids = Array.isArray(record.dentistIds) ? record.dentistIds : [];
  const oldIds = Array.isArray(saved?.dentistIds) ? saved.dentistIds : [];
  if (JSON.stringify(ids) === JSON.stringify(oldIds) && (role !== 'staff' || !ids.length || JSON.stringify(record.services) === JSON.stringify(saved?.services))) return;
  if (role !== 'staff') {
    const error = new Error('Only staff can change shared dentist access.');
    error.status = 403; throw error;
  }
  const chosen = ids.map(id => dentists.find(d => String(d.id) === String(id) && !d.archived));
  const names = (record.services || []).map(s => s.serviceName || s.name).filter(Boolean);
  if (!chosen.length || chosen.some(d => !d) || !names.length ||
      chosen.some(d => !names.every(name => eligibility.canPerform(d, name))) ||
      names.some(name => !chosen.some(d => eligibility.canPerform(d, name)))) {
    throw new Error('Select dentists qualified for all selected services.');
  }
}
module.exports = { validateAssignment };
