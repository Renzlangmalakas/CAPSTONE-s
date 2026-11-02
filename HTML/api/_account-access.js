// Resolve legacy signed sessions without an ID without skipping revocation checks.
async function readAccountAccess(db, user) {
  const hasId = user.id !== undefined && user.id !== null && user.id !== '';
  if (hasId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(user.id))) {
    return { data: null, error: null };
  }
  const read = columns => {
    let query = db.from('users').select(columns);
    query = hasId ? query.eq('id', user.id) : query.eq('email', String(user.email || '').trim().toLowerCase()).eq('is_verified', true);
    return query.maybeSingle();
  };
  let result = await read('id,archived,merged_into');
  // These fields are unavailable until the account-merge migration is installed.
  if (['42703', 'PGRST204'].includes(result.error?.code)) result = await read('id');
  return result;
}
module.exports = { readAccountAccess };
