// Only explicit, authenticated UI interactions use this endpoint; polling never does.
module.exports = function registerAuditEvents(app, db, resolvePatient) {
  app.post('/api/audit-events', async (req, res) => {
    const user = req.user, body = req.body || {};
    const labels = {
      admin: { revenue: 'Viewed revenue: ', export: 'Exported records: ' },
      staff: { revenue: "Viewed today's revenue" },
      patient: { history: 'Viewed own appointment history', treatments: 'Viewed own treatment records' },
      dentist: { treatments: 'Viewed patient medical history: ' }
    };
    const label = labels[user?.role]?.[body.type];
    if (!label) return res.status(403).json({message:'This audit interaction is not permitted.'});
    const scope = typeof body.scope === 'string' ? body.scope : '';
    if (scope.length > 200 || (label.endsWith(': ') && !scope)) return res.status(400).json({message:'A valid report range is required.'});
    try {
      const audit = require('./_audit-v2');
      const meta = audit.storage.getStore()?.meta || audit.metadata(req);
      const patient = user.role === 'dentist' ? await resolvePatient(user, scope) : null;
      if (user.role === 'dentist' && !patient) return res.status(403).json({message:'This patient is not assigned to your account.'});
      const action = label + (label.endsWith(': ') ? patient || scope : '');
      const {error} = await db.from('clinic_audit_log').insert({created_at:new Date().toISOString(),actor_id:user.id,actor_email:user.email,actor_role:user.role,action,module:body.type==='revenue'?'Billing':body.type==='export'?'Reports':'Patients',resource:scope||user.id,outcome:'Success',before_state:{},after_state:{},details:{description:action,access:true},ip_address:meta.ip,user_agent:meta.agent,request_id:meta.requestId,location:meta.location});
      if(error)throw error;
      res.json({recorded:true});
    } catch { res.status(503).json({message:'The audit event could not be recorded.'}); }
  });
};
