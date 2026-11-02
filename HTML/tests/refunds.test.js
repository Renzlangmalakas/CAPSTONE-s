const test=require('node:test'),assert=require('node:assert/strict');
const {validateRefunds}=require('../api/_refunds');
const saved={status:'Cancelled',totalCollected:500,preferredRefundMethod:'GCash',refunds:[]};
const refund={id:'refund1',amount:500,method:'GCash',reference:'123456789',proofImage:'data:image/jpeg;base64,AAAA'};
test('GCash refunds require staff, proof, reference and the correct amount',()=>{
 for(const [role,patch] of [['patient',{}],['staff',{proofImage:''}],['staff',{reference:''}],['staff',{amount:501}],['staff',{method:'Cash'}],['staff',{amount:NaN}]]) {
  assert.throws(()=>validateRefunds({refunds:[{...refund,...patch}]},saved,role));
 }
 const record={refunds:[refund]};validateRefunds(record,saved,'staff');assert.equal(record.refunds.length,1);
});
test('saved refunds survive stale snapshots and cannot be changed or double refunded',()=>{
 const paid={...saved,refunds:[refund]};const stale={refunds:[]};validateRefunds(stale,paid,'patient');assert.deepEqual(stale.refunds,[refund]);
 assert.throws(()=>validateRefunds({refunds:[{...refund,amount:1}]},paid,'staff'));
 assert.throws(()=>validateRefunds({refunds:[refund,{...refund,id:'refund2'}]},paid,'staff'));
});
test('cash refunds do not require an image',()=>{
 const record={refunds:[{id:'cash1',amount:500,method:'Cash'}]};validateRefunds(record,{...saved,preferredRefundMethod:'Cash'},'staff');assert.equal(record.refunds.length,1);
});
