const test=require('node:test');
const assert=require('node:assert/strict');
const {appointmentChanges,middleware,listHandler}=require('../api/_audit');
test('audit detects appointment and discount changes without copying sensitive fields',()=>{
 const old={id:'a',status:'Pending',discount:null};
 const changes=appointmentChanges([{id:'a',data:old}],[{...old,status:'Approved',discount:{amount:100,reason:'private'},password:'secret',patient:'Private Patient'}]);
 assert.equal(changes[0].action,'appointment.updated');
 assert.equal(changes[0].discountAfter,100);
 assert.ok(!JSON.stringify(changes).includes('private'));
 assert.ok(!JSON.stringify(changes).includes('secret'));
 assert.deepEqual(appointmentChanges([{id:'a',data:old}],[{...old,updatedAt:'new'}]),[]);
});
test('audit endpoint denies non-admins without querying database',async()=>{
 const handler=listHandler({from(){throw Error('Must not query');}});
 const res={status(code){this.code=code;return this;},json(body){this.body=body;}};
 await handler({user:{role:'staff'},query:{}},res);
 assert.equal(res.code,403);
});
test('audit awaits persistent insert and records authenticated actor, never request credentials',async()=>{
 let inserted,finish;
 const db={from:()=>({insert:rows=>{inserted=rows;return new Promise(resolve=>{finish=resolve;});}})};
 let sent=false;
 const req={method:'POST',path:'/api/appointments/a/complete',headers:{},socket:{},params:{id:'a'},user:{email:'doctor@example.com',role:'dentist'},body:{password:'secret',sessionToken:'secret'}};
 const res={statusCode:403,json(){sent=true;}};
 await middleware(db)(req,res,()=>{});
 res.json({message:'Not your assigned patient.'});
 assert.equal(sent,false);
 assert.equal(inserted.actor_email,'doctor@example.com');
 assert.ok(!JSON.stringify(inserted).includes('secret'));
 finish({error:null});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(sent,true);
});
test('discount report includes fees, granting dentist and correct net amount',()=>{
 const fs=require('fs'),vm=require('vm');
 const s=fs.readFileSync(require.resolve('../Admin/admin.js'),'utf8');
 const context={adminDiscountReport:{rows:[{patient_name:'Test',service_total:1000,additional_fees:200,original_price:1200,discount_amount:100,discounted_price:1100,dentist_name:'Dr. Test'}]},getAdminReportDateFilter:()=>({mode:'all'}),uniqueAdminRecords:x=>x,reportArray:x=>Array.isArray(x)?x:[],state:{appointments:[]},isRecordInDateFilter:()=>true,reportDateText:()=>'',normalizedStatus:x=>x};
 vm.runInNewContext(s.slice(s.indexOf('function buildAdminDiscountRows()'),s.indexOf('async function loadAdminDiscountedPrices()')),context);
 const row=context.buildAdminDiscountRows()[0];
 assert.equal(row['Before Discount'],'1200.00');assert.equal(row.Discount,'100.00');assert.equal(row['Final Total'],'1100.00');assert.equal(row['Granted By'],'Dr. Test');
});
