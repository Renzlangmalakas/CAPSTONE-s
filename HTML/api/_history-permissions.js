const flags = ['archived', 'archivedForPatient', 'archivedForDentist', 'archivedAt', 'archivedBy', 'deletedAt', 'deleted'];
function validateHistoryChanges(incoming, saved, role) {
  if (role === 'admin') return;
  const fail = () => { const e = new Error('Only an administrator can archive or delete appointment records.'); e.status = 403; throw e; };
  const keys = ['appointments','archivedAppointments'].filter(key => Array.isArray(incoming[key]));
  const previous = new Map(keys.flatMap(key => saved[key] || []).map(row => [String(row.id),row]));
  const next = new Map(keys.flatMap(key => incoming[key]).map(row => [String(row.id),row]));
  for (const [id,row] of previous) {
    const updated = next.get(id);
    if (!updated) fail();
    for (const flag of flags) {
      // Browser adapters may materialize the aggregate flag from role flags.
      if (flag === 'archived' && (row.archivedForPatient || row.archivedForDentist)) continue;
      if (JSON.stringify(updated[flag] || false) !== JSON.stringify(row[flag] || false)) fail();
    }
  }
  for (const [id,row] of next) if (!previous.has(id) && flags.some(flag => row[flag])) fail();
}
module.exports = { validateHistoryChanges };
