'use strict';

// All writes, conflict checks and the audit event happen in one database RPC.
module.exports = function registerPatientMerge(app, db) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  for (const execute of [false, true]) {
    app.post(`/api/admin/patient-merge/${execute ? 'confirm' : 'preview'}`, async (req, res) => {
      if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      if (!db) return res.status(503).json({ message: 'Database unavailable. No records were changed.' });
      const { sourceId, destinationId, fingerprint, confirmed, moveUpcoming } = req.body || {};
      if (!uuid.test(sourceId || '') || !uuid.test(destinationId || '') || sourceId === destinationId) {
        return res.status(400).json({ message: 'Select two different patient accounts.' });
      }
      if (execute && (confirmed !== true || !/^[a-f0-9]{32}$/.test(fingerprint || ''))) {
        return res.status(400).json({ message: 'Preview the accounts and explicitly confirm the transfer first.' });
      }
      try {
        const { data, error } = await db.rpc('merge_patient_history', {
          source_id: sourceId, destination_id: destinationId, admin_id: req.user.id,
          execute_merge: execute, expected_fingerprint: fingerprint || null,
          move_upcoming: moveUpcoming === true
        });
        if (error) {
          if (['PGRST202', '42883'].includes(error.code)) return res.status(503).json({ message: 'Account merging is not enabled yet. The database migration is awaiting installation.' });
          const safe = ['P0001', '23P01', '23505', '42501'].includes(error.code);
          return res.status(error.code === '42501' ? 403 : safe ? 409 : 503).json({
            message: safe ? error.message : 'The transfer could not complete. No records were changed. Please refresh and try again.'
          });
        }
        if (execute) res.locals.auditChanged = true;
        res.set('Cache-Control', 'private, no-store');
        return res.json(data);
      } catch {
        return res.status(503).json({ message: 'Unable to confirm the result. Refresh the accounts before retrying.' });
      }
    });
  }
};
