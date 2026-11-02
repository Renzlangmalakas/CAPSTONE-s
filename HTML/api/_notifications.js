const roles = ['admin', 'dentist', 'patient', 'staff'];
const firstText = (...values) => values.find(value => typeof value === 'string' && value.trim())?.trim() || '';

function normalizeNotification(record = {}, target) {
  const item = { ...(record.data || {}), ...record };
  delete item.data;
  const body = firstText(item.body, item.text, item.message);
  const title = firstText(item.title);
  if (!body && !title) return null;
  const role = target || item.target || item.roleTarget || item.role_target;
  if (!roles.includes(role)) return null;
  const read = item.is_read ?? item.isRead ?? item.read ?? false;
  delete item.is_read;
  delete item.isRead;
  return { ...item, target: role, title: title || 'Clinic notification',
    body: body || title, text: body || title, message: body || title,
    read };
}

function notificationRow(record, id) {
  const item = normalizeNotification(record);
  if (!item) return null;
  return { id, role_target: item.target, title: item.title, body: item.body,
    is_read: Boolean(item.read), created_at: item.createdAt || item.created_at,
    data: item };
}

module.exports = { normalizeNotification, notificationRow };
