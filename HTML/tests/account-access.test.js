const test = require('node:test');
const assert = require('node:assert/strict');
const { readAccountAccess } = require('../api/_account-access');
const id = '00000000-0000-4000-8000-000000000001';
function database(results) {
  const calls = [];
  return { calls, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    return { select(columns) { call.columns = columns; return this; },
      eq(key, value) { call.filters.push([key, value]); return this; },
      async maybeSingle() { return results.shift(); } };
  } };
}
test('legacy session resolves its signed email and requires a verified account', async () => {
  const db = database([{data: {id}, error: null}]);
  assert.equal((await readAccountAccess(db, {email: 'Dentist@example.test'})).data.id, id);
  assert.deepEqual(db.calls[0].filters, [['email','dentist@example.test'],['is_verified',true]]);
  assert.equal(db.calls[0].columns, 'id,archived,merged_into');
});
test('current sessions use ID and never fall back to another account by email', async () => {
  const db = database([{data:null,error:null}]);
  assert.equal((await readAccountAccess(db, {id,email:'other@example.test'})).data,null);
  assert.deepEqual(db.calls[0].filters,[['id',id]]);
});
test('legacy schema fallback preserves the verified email constraints', async () => {
  const db = database([{error:{code:'42703'}},{data:{id},error:null}]);
  await readAccountAccess(db,{email:'dentist@example.test'});
  assert.equal(db.calls[1].columns,'id');
  assert.deepEqual(db.calls[1].filters,db.calls[0].filters);
});
test('archived and merged account states are preserved for middleware denial', async () => {
  const data = {id,archived:true,merged_into:'replacement'};
  assert.deepEqual((await readAccountAccess(database([{data,error:null}]),{email:'old@example.test'})).data,data);
});
test('invalid session IDs do not reach the UUID query', async () => {
  const db=database([]);
  assert.equal((await readAccountAccess(db,{id:'undefined',email:'dentist@example.test'})).data,null);
  assert.equal(db.calls.length,0);
});
test('database outages are not bypassed', async () => {
  const error={code:'08006'}; const db=database([{error}]);
  assert.equal((await readAccountAccess(db,{id})).error,error);
  assert.equal(db.calls.length,1);
});
