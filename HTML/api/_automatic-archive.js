// Derived on every read, so archiving does not depend on a user visiting on
// the exact cutoff day or on a browser timer. No clinical records are deleted.
function eligibleDate(record) {
  if (!/^(completed|cancelled|rejected|reschedule rejected|no show|no-show)$/i.test(record.status || record.lifecycleStatus || '')) return '';
  const raw = record.completedAt || record.cancelledAt || record.rejectedAt || record.date || record.schedule;
  const value = String(raw || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!value) return '';
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) return '';
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 6);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0,10);
}
function applyAutomaticArchive(db, now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p => [p.type,p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  for (const key of ['appointments','archivedAppointments']) {
    for (const row of db[key] || []) {
      const eligible = eligibleDate(row);
      if (!eligible || eligible > today) continue;
      row.archivedForPatient = true;
      row.archivedForDentist = true;
      row.autoArchived = true;
      row.autoArchiveDate = eligible;
    }
  }
  return db;
}
module.exports = {eligibleDate, applyAutomaticArchive};
