const test = require('node:test'), assert = require('node:assert/strict');
const register = require('../api/_audit-events');
function fixture(resolve = async () => null) {
  let handler; const events=[];
  register({post:(_path,fn)=>handler=fn},{from:()=>({insert:async row=>{events.push(row);return {};}})},resolve);
  return {events,async call(role,body) {
    const res={statusCode:200,status(value){this.statusCode=value;return this;},json(value){this.body=value;return this;}};
    await handler({user:{id:'signed-id',email:'signed@example.test',role},body,headers:{},socket:{}},res);
    return res;
  }};
}
test('explicit patient history views retain signed identity and cannot impersonate admin exports',async()=>{
  const f=fixture();assert.equal((await f.call('patient',{type:'export',scope:'All dates'})).statusCode,403);
  assert.equal(f.events.length,0);
  await f.call('patient',{type:'history',email:'forged@test',outcome:'Denied'});
  assert.equal(f.events[0].actor_email,'signed@example.test');
  assert.equal(f.events[0].action,'Viewed own appointment history');assert.equal(f.events[0].outcome,'Success');
});
test('dentist history logging validates patient assignment and resolves name on server',async()=>{
  const denied=fixture();assert.equal((await denied.call('dentist',{type:'treatments',scope:'someone-else'})).statusCode,403);
  const allowed=fixture(async()=> 'Test Patient');await allowed.call('dentist',{type:'treatments',scope:'patient-id'});
  assert.equal(allowed.events[0].action,'Viewed patient medical history: Test Patient');
  assert.equal(allowed.events[0].resource,'patient-id');
});
test('revenue interaction requires the selected period and records it in full',async()=>{
  const f=fixture();assert.equal((await f.call('admin',{type:'revenue'})).statusCode,400);
  await f.call('admin',{type:'revenue',scope:'2026-11-01 to 2026-11-02'});
  assert.equal(f.events[0].action,'Viewed revenue: 2026-11-01 to 2026-11-02');
});
