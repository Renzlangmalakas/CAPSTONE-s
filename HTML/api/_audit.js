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
// Compatibility entry point; committed changes are audited by database triggers.
const {middleware,listHandler}=require('./_audit-v2');
module.exports={appointmentChanges,serviceChanges,describeEvent,middleware,listHandler};
