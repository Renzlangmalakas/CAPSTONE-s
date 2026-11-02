const time = require('../Shared/booking-time');
const terminal = row => /^(completed|cancelled|rejected|reschedule rejected|no show|no-show)$/i.test(row.status || row.lifecycleStatus || '');
function validateSchedule(record, input, dentists, appointments, settings, actor) {
  const fail = message => { const error = new Error(message); error.status = 400; throw error; };
  if (terminal(record) || record.archived) fail('Only active appointments can be rescheduled.');
  const date = String(input.date || ''), start = time.minutes(input.time), duration = time.duration(record);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(start) || !String(input.reason || '').trim()) fail('Enter a date, valid time, and reschedule reason.');
  if (!require('../Shared/clinic-hours').allows(date, start, duration, settings)) fail('Choose a future time within clinic hours that fits the complete appointment.');
  const ids = record.dentistIds?.length ? record.dentistIds.map(String) : [String(record.dentistId || '')];
  const assigned = dentists.filter(d => ids.includes(String(d.id)) || d.email && d.email === record.dentistEmail || d.name === (record.dentistName || record.dentist));
  if (!assigned.length || assigned.some(d => d.archived)) fail('The assigned dentist is unavailable.');
  const day = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', {weekday:'long',timeZone:'UTC'}).toLowerCase();
  for (const dentist of assigned) {
    if (!dentist.schedules?.some(s => String(s.day).toLowerCase() === day && (time.local24Hours() || start >= time.minutes(s.start) && start + duration <= time.minutes(s.end)))) fail('The complete appointment must fit the dentist schedule.');
  }
  for (const other of appointments) {
    if (String(other.id) === String(record.id) || terminal(other) || other.archived || other.date !== date) continue;
    const otherIds = other.dentistIds?.length ? other.dentistIds.map(String) : [String(other.dentistId || '')];
    const sharedDentist = assigned.some(d => otherIds.includes(String(d.id)) || d.name === (other.dentistName || other.dentist));
    const samePatient = record.patientEmail && record.patientEmail === other.patientEmail;
    if ((sharedDentist || samePatient) && time.overlaps(start, duration, time.minutes(other.time), time.duration(other))) fail('This time overlaps another appointment.');
  }
  return {...record, date, time: time.clock(start), schedule: `${date} ${time.clock(start)}`, durationMinutes: duration, endTime: time.clock(start + duration), updatedAt:new Date().toISOString(),
    rescheduleHistory:[...(record.rescheduleHistory || []), {previousDate:record.date, previousTime:record.time, date, time:time.clock(start), reason:String(input.reason).trim(), type:'assisted', recordedBy:actor.email, recordedAt:new Date().toISOString()}]};
}
function reschedule(record, input, dentists, appointments, settings, actor) {
  if (!['admin','staff'].includes(actor.role)) { const error = new Error('Admin or staff access required.'); error.status = 403; throw error; }
  return validateSchedule(record, input, dentists, appointments, settings, actor);
}
module.exports = {reschedule, validateSchedule, terminal};
