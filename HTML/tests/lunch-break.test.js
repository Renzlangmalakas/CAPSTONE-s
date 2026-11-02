const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../Shared/booking-time');
const hours = require('../Shared/clinic-hours');
const { slots } = require('../Staff/staff-availability');
const { validateAssignment } = require('../api/_appointment-assignment');
test('lunch boundaries allow ending at 1 PM and starting at 1:30 PM', () => {
  for (const [start, duration, blocked] of [[720,60,false],[765,20,true],[780,20,true],[795,20,true],[810,20,false]]) {
    assert.equal(time.overlapsLunch(start,duration), blocked);
    assert.equal(hours.allows('2050-10-05',start,duration,{},new Date('2026-10-07')), !blocked);
  }
});
test('staff slots exclude every service interval overlapping lunch', () => {
 const dentist = { id:'d', schedules:[{day:'Wednesday',start:'09:00',end:'17:00'}] };
 const available = slots('2050-10-05',[dentist],[],{id:'new',service:'Consultation'},new Date('2026-10-07'));
 assert.ok(available.includes('13:30'));
 assert.ok(!available.includes('13:00'));
 assert.ok(!available.includes('12:45'));
});
test('API prevents moving appointments into lunch while preserving existing bookings', () => {
 const old = {patient:'Test',date:'2050-10-05',time:'12:45',service:'Consultation',status:'Approved'};
 assert.doesNotThrow(() => validateAssignment(old,old,'staff',[]));
 assert.throws(() => validateAssignment({...old,time:'13:00'},old,'staff',[]), /lunch/);
});
