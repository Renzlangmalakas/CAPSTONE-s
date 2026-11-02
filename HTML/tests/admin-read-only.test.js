const test=require('node:test'),assert=require('node:assert/strict');
const {writableSnapshot}=require('../api/_admin-read-only');
test('admin sync cannot change appointments or billing, but can manage clinic content',()=>{
  const db={appointments:[{id:'a',status:'Completed'}],archivedAppointments:[],treatmentPlans:[],payments:[{amount:500}],history:[],rescheduleRequests:[],services:[{name:'Consultation'}],patients:[]};
  const result=writableSnapshot(db,'admin');
  assert.deepEqual(Object.keys(result).sort(),['patients','services']);
  assert.equal(writableSnapshot(db,'staff'),db);
  assert.equal(writableSnapshot(db,'dentist'),db);
});
test('cash approval endpoint rejects admin before reading or writing payments',async()=>{
  const handler=require('../api/_cash-payments').createCashReviewHandler({supabase:{from(){throw Error('Must not access payments');}}});
  const res={status(code){this.code=code;return this;},json(body){this.body=body;}};
  await handler({user:{role:'admin'},body:{action:'approve'}},res);
  assert.equal(res.code,403);
});
test('admin cannot complete appointments through direct API calls',async()=>{
  const handler=require('../api/_appointments').createCompleteAppointmentHandler({supabase:{from(){throw Error('Must not access appointments');}}});
  const res={status(code){this.code=code;return this;},json(body){this.body=body;}};
  await handler({user:{role:'admin'},params:{id:'a'}},res);
  assert.equal(res.code,403);
});
