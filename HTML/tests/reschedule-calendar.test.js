const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const BookingTime=require('../Shared/booking-time'),StaffAvailability=require('../Staff/staff-availability'),GMClinicHours=require('../Shared/clinic-hours');
function fixture(){
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,{value:'a',addEventListener(){}});return nodes.get(id)};
 const date='2099-01-05';const day=new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'long'});
 const target={id:'a',date,time:'09:00',dentistIds:['d1','d2'],services:[{duration:30,price:500}]};
 const db={dentists:[{id:'d1',schedules:[{day,start:'09:00',end:'12:00'}]},{id:'d2',schedules:[{day,start:'10:00',end:'12:00'}]}],appointments:[target,{id:'busy',date,time:'10:00',dentistId:'d2',status:'Approved',services:[{duration:30}]}]};
 const c={window:{},document:{getElementById:get},getAppointmentsShared:()=>[target],getClinicDb:()=>db,BookingTime,StaffAvailability,GMClinicHours};
 vm.runInNewContext(fs.readFileSync(require.resolve('../Patient/reschedule-calendar.js'),'utf8'),c);
 return {api:c.window.PatientRescheduleCalendar,db,target,date};
}
test('reschedule offers shared dentist duty slots and excludes booked times',()=>{
 const f=fixture(),slots=f.api.available(f.date,f.target);
 assert.ok(slots.length);assert.ok(!slots.includes('09:00'));assert.ok(!slots.includes('10:00'));assert.ok(slots.includes('11:00'));
});
test('reschedule cannot offer dates when an assigned dentist is unavailable',()=>{
 const f=fixture();f.db.dentists[1].archived=true;assert.equal(f.api.available(f.date,f.target).length,0);
});
