const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { describeEvent, serviceChanges } = require('../api/_audit');
const { createPublicServicesHandler } = require('../api/_public-services');

test('password audit identifies the person and action without exposing secrets', () => {
  const description = describeEvent({action:'PATCH /api/account'}, {role:'patient',name:'Lorenz'},
    {path:'/api/account',body:{newPassword:'secret',otp:'123456'}}, {}, 200);
  assert.equal(description, 'patient Lorenz changed their password.');
  assert.ok(!description.includes('secret'));
  assert.match(describeEvent({}, {role:'patient',name:'Lorenz'}, {path:'/api/account',body:{newPassword:'secret'}}, {}, 400), /failed/);
});
test('service price audit reports actual old and new price', () => {
  const events = serviceChanges([{id:'1',name:'Consultation',price:500}], [{id:'1',name:'Consultation',price:750}]);
  assert.equal(events.length,1);
  const description = describeEvent(events[0],{role:'admin',name:'Admin'}, {}, {}, 200);
  assert.match(description,/Consultation/); assert.match(description,/500 → PHP 750/);
});
test('public service prices reflect persisted changes, omit archived services and private fields', async () => {
  let price = 750;
  const db = { from: () => ({select: async () => ({ data: [{id:'1',name:'Consultation',price,password:'secret'}, {id:'2',name:'Hidden',price:1,archived:true}] })}) };
  const res = { set(key,value){this.cache=value;}, json(value){this.body=value;return this;}, status(code){this.code=code;return this;} };
  const handler = createPublicServicesHandler(db);
  await handler({},res); assert.equal(res.body.services[0].price,750); assert.equal(res.body.services.length,1);
  assert.ok(!JSON.stringify(res.body).includes('secret')); assert.equal(res.cache,'no-store');
  price=999; await handler({},res); assert.equal(res.body.services[0].price,999);
});
test('arrival button uses Philippine calendar day and refuses repeats and closed records', () => {
  const source=fs.readFileSync(require.resolve('../Staff/staff.js'),'utf8');
  const context={Intl,Date};
  vm.runInNewContext(source.slice(source.indexOf('function canMarkArrived('),source.indexOf('const pendingArrivals')),context);
  const now=new Date('2026-10-25T17:00:00Z');
  const item={date:'2026-10-26',status:'Confirmed'};
  assert.equal(context.canMarkArrived(item,now),true);
  for (const changes of [{date:'2026-10-27'},{date:'2026-10-25'},{arrivedAt:'saved'},{status:'Cancelled'},{status:'Completed'}]) assert.equal(context.canMarkArrived({...item,...changes},now),false);
});
