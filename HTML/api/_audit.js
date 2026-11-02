const { isDeepStrictEqual } = require('node:util');
const tracked = ['paymentPreference', 'status', 'visitStatus', 'date', 'time', 'dentistIds', 'dentistId', 'service', 'services', 'discount', 'additionalFees', 'totalCollected', 'paid', 'archived', 'archivedForPatient', 'archivedForDentist'];
function appointmentChanges(before, after) {
  const saved = new Map((before || []).map(row => [String(row.id), row.data || row]));
  return (after || []).flatMap(row => {
    const old = saved.get(String(row.id));
    const fields = tracked.filter(key => !isDeepStrictEqual(old?.[key], row[key]));
    if (old && !fields.length) return [];
    return [{ id: String(row.id), action: old ? 'appointment.updated' : 'appointment.created', fields,
      status: row.status || '', previousStatus: old?.status || '',
      ...(fields.includes('discount') ? { discountBefore: Number(old?.discount?.amount || 0), discountAfter: Number(row.discount?.amount || 0) } : {}) }];
  });
}
function describeEvent(event, actor, req, payload, status) {
  const who = `${actor.role || 'User'} ${actor.name || actor.email || 'Unknown user'}`;
  const path = req.route?.path || req.path;
  let action;
  if (event.action === 'appointment.created') action = `created appointment ${event.resource}`;
  else if (event.action === 'appointment.updated') action = `updated appointment ${event.resource}: ${event.details.fields.join(', ')}` + (event.details.fields.includes('status') ? ` (${event.details.previousStatus || 'unset'} → ${event.details.status})` : '');
  else if (event.action === 'service.updated') action = `updated service ${event.details.name}: ${event.details.fields.join(', ')}` + (event.details.fields.includes('price') ? ` (price PHP ${event.details.priceBefore} → PHP ${event.details.priceAfter})` : '');
  else if (event.action === 'service.created') action = `created service ${event.details.name} at PHP ${event.details.priceAfter}`;
  else if (req.path === '/login') action = 'signed in';
  else if (req.path === '/reset-password') action = 'reset their password';
  else if (req.path === '/api/account' && req.body?.newPassword) action = 'changed their password' + (['name', 'mobile', 'address', 'profileTitle'].some(key => key in req.body) ? ' and updated their profile' : '');
  else if (req.path === '/api/account') action = `updated their profile (${['name', 'mobile', 'address', 'profileTitle'].filter(key => key in (req.body || {})).join(', ')})`;
  else if (path.endsWith('/arrive')) action = `marked patient arrived for appointment ${req.params?.id || payload?.appointment?.id || event.resource}`;
  else if (path.endsWith('/complete')) action = `completed appointment ${req.params?.id || payload?.appointment?.id || event.resource}`;
  else if (path === '/api/appointments/book') action = `booked appointment ${payload?.appointment?.id || ''}`;
  else if (path === '/api/admin/site-content') action = req.body?.action === 'publish' ? 'published website content' : 'saved website content draft';
  else if (path === '/api/account/verification-code') action = 'requested an account verification code';
  else if (path === '/api/account/verify-password') action = 'verified their current password';
  else if (event.action === 'clinic.sync') action = 'saved clinic records (no appointment or service changes)';
  else action = `${req.method === 'DELETE' ? 'deleted' : 'submitted'} ${path.replace(/^\/api\//, '').replace(/\//g, ' ')}`;
  return `${who} ${status >= 400 ? '— failed: ' : ''}${action}.`;
}
function serviceChanges(before, after) {
  const key = require('../Shared/service-catalog').key;
  return (after || []).flatMap(row => {
    const old = (before || []).find(saved => String(saved.id) === String(row.id)) || (before || []).find(saved => key(saved.name) === key(row.name));
    const fields = ['name', 'price', 'archived', 'description', 'duration'].filter(field => field in row && String(old?.[field] ?? '') !== String(row[field] ?? ''));
    if (old && !fields.length) return [];
    return [{ action: old ? 'service.updated' : 'service.created', resource: String(row.id || row.name), details: { name: row.name, fields, priceBefore: old?.price ?? 0, priceAfter: row.price } }];
  });
}
function middleware(db, findActor) {
  return async (req, res, next) => {
    if (!db || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    const login = req.path === '/login';
    const reset = req.path === '/reset-password';
    if (!req.user && !login && !reset) return next();
    let actorRecord;
    if (findActor && (req.user?.email || reset && req.body?.email)) {
      try { actorRecord = await findActor(req.user?.email || String(req.body.email).trim().toLowerCase()); } catch { /* Fall back to verified session identity. */ }
    }
    let before, beforeServices;
    const snapshot = req.path === '/api/clinic-db';
    if (snapshot) {
      const read = await db.from('clinic_appointments').select('id,data');
      if (!read.error) before = read.data;
      if (req.user?.role === 'admin') {
        const services = await db.from('services').select('id,name,price,archived,description,duration');
        if (!services.error) beforeServices = services.data;
      }
    }
    const original = res.json.bind(res);
    res.json = payload => {
      const status = res.statusCode;
      const identity = req.user || (status < 400 && payload?.user ? payload.user : reset && status < 400 ? actorRecord : null);
      const actor = identity ? { ...identity, name: actorRecord?.name || identity.name } : null;
      if (!actor) return original(payload);
      const changes = snapshot && status < 400 && before ? appointmentChanges(before, payload?.db?.appointments || req.body?.db?.appointments) : null;
      const events = (changes || []).map(change => ({ action: change.action, resource: change.id, details: change }));
      if (snapshot && status < 400 && beforeServices) events.push(...serviceChanges(beforeServices, payload?.db?.services || []));
      if (!events.length) events.push({ action: login ? 'account.login' : snapshot ? 'clinic.sync' : `${req.method} ${req.route?.path || req.path}`, resource: req.path, details: { httpStatus: status } });
      for (const event of events) event.details = { ...event.details, description: describeEvent(event, actor, req, payload, status) };
      // Store only allowlisted metadata, never request bodies, passwords or tokens.
      const rows = events.map(event => ({ ...event, actor_email: actor.email, actor_role: actor.role,
        outcome: status < 400 ? 'success' : 'failed' }));
      Promise.resolve(db.from('clinic_audit_log').insert(rows)).then(result => {
        if (result.error) console.error('Audit log write failed:', result.error.code);
        original(payload);
      }).catch(() => { console.error('Audit log write failed'); original(payload); });
      return res;
    };
    next();
  };
}
function listHandler(db) {
  return async (req, res) => {
    if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
    const offset = Math.max(0, Math.min(1000000, Number.parseInt(req.query.offset, 10) || 0));
    let query = db.from('clinic_audit_log').select('*').order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 199);
    for (const [key, operator] of [['from', 'gte'], ['to', 'lt']]) {
      if (!req.query[key]) continue;
      const date = new Date(req.query[key]);
      if (!Number.isFinite(date.getTime())) return res.status(400).json({ message: 'Invalid date filter.' });
      query = query[operator]('created_at', date.toISOString());
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ message: 'Unable to load audit log.' });
    return res.json({ rows: data, hasMore: data.length === 200 });
  };
}
module.exports = { appointmentChanges, serviceChanges, describeEvent, middleware, listHandler };
