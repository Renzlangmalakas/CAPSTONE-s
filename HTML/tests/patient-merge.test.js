const test = require('node:test');
const assert = require('node:assert/strict');
const register = require('../api/_patient-merge');
const sourceId='00000000-0000-4000-8000-000000000001';
const destinationId='00000000-0000-4000-8000-000000000002';
function setup(result={data:{merged:true}}) {
  const routes={},calls=[];
  register({post:(url,fn)=>routes[url]=fn},{rpc:async(...args)=>{calls.push(args);return result;}});
  const res={locals:{},statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;},set(){return this;}};
  return {routes,calls,res};
}
for(const role of ['patient','staff','dentist',undefined]) test(`merge denies ${role || 'anonymous'} before database access`,async()=>{
  const {routes,calls,res}=setup();await routes['/api/admin/patient-merge/confirm']({user:{role},body:{}},res);
  assert.equal(res.statusCode,403);assert.equal(calls.length,0);
});
test('confirmation requires preview fingerprint and explicit boolean',async()=>{
  const {routes,calls,res}=setup();await routes['/api/admin/patient-merge/confirm']({user:{role:'admin'},body:{sourceId,destinationId,confirmed:'true'}},res);
  assert.equal(res.statusCode,400);assert.equal(calls.length,0);
});
test('identical source and destination are rejected',async()=>{
  const {routes,calls,res}=setup();await routes['/api/admin/patient-merge/preview']({user:{role:'admin'},body:{sourceId,destinationId:sourceId}},res);
  assert.equal(res.statusCode,400);assert.equal(calls.length,0);
});
test('verified session supplies admin identity; request identity cannot override it',async()=>{
  const {routes,calls,res}=setup();await routes['/api/admin/patient-merge/confirm']({user:{role:'admin',id:'trusted'},body:{sourceId,destinationId,adminId:'forged',confirmed:true,fingerprint:'a'.repeat(32),moveUpcoming:true}},res);
  assert.equal(calls.length,1);assert.equal(calls[0][1].admin_id,'trusted');assert.equal(calls[0][1].move_upcoming,true);assert.equal(res.locals.auditChanged,true);
});
test('database conflict is presented without claiming a successful merge',async()=>{
  const {routes,res}=setup({error:{code:'P0001',message:'Records changed since the preview.'}});
  await routes['/api/admin/patient-merge/confirm']({user:{role:'admin'},body:{sourceId,destinationId,confirmed:true,fingerprint:'a'.repeat(32)}},res);
  assert.equal(res.statusCode,409);assert.match(res.body.message,/Records changed/);assert.equal(res.locals.auditChanged,undefined);
});
test('internal database details are not exposed',async()=>{
  const {routes,res}=setup({error:{code:'XX000',message:'secret internal SQL'}});
  await routes['/api/admin/patient-merge/preview']({user:{role:'admin'},body:{sourceId,destinationId}},res);
  assert.equal(res.statusCode,503);assert.doesNotMatch(res.body.message,/secret/);
});
