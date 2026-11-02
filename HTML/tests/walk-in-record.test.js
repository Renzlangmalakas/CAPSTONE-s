const test=require('node:test'),assert=require('node:assert/strict');
const {patientDetails,walkInAppointment}=require('../api/_walk-in');
const valid={id:'00000000-0000-4000-8000-000000000001',name:'Test Patient',contact:'09123456789',email:'patient@example.com',age:'0',gender:'Female',address:'Test address',condition:'None'};
test('walk-in patient information validates required fields and preserves infant age',()=>{
 assert.equal(patientDetails(valid).age,0);
 assert.equal(patientDetails({...valid,contact:'639123456789'}).contact,'639123456789');
 for(const change of [{gender:'Other'},{gender:'Prefer not to say'},{name:'Patient123'},{name:'!!!'},{age:'1e2'},{age:'-1'},{age:'1.5'},{contact:'+639123456789'},{email:'bad'},{contact:'123'},{age:''},{age:121},{address:''},{condition:''}])assert.throws(()=>patientDetails({...valid,...change}));
});
test('walk-in uses catalog prices, links patient and rejects unqualified dentist',()=>{
 const p=patientDetails(valid),db={dentists:[{id:'d',name:'Doctor',specialty:'General Dentist'}],services:[{id:'c',name:'Consultation',price:500},{id:'r',name:'Root Canal Treatment',price:1000}]};
 const a=walkInAppointment({id:'a',dentistId:'d',services:[{id:'c',price:0}],date:'2050-01-03',time:'09:00'},p,db);
 assert.equal(a.price,500);assert.equal(a.patientId,p.id);assert.equal(a.patientEmail,p.email);assert.equal(a.durationMinutes,20);
 assert.throws(()=>walkInAppointment({dentistId:'d',services:[{id:'r'}]},p,db),/qualified/);
});
