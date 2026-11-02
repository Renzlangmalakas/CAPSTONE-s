const protectedCollections = new Set(['appointments','archivedAppointments','treatmentPlans','payments','rescheduleRequests','history']);
function writableSnapshot(db, role) {
  if (role !== 'admin') return db;
  // Full snapshots include read-only data. Omit it rather than rejecting an
  // unrelated clinic-content update or writing a stale billing snapshot.
  return Object.fromEntries(Object.entries(db).filter(([key]) => !protectedCollections.has(key)));
}
module.exports = {writableSnapshot};
