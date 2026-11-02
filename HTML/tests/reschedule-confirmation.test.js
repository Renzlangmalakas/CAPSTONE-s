const test=require('node:test'),assert=require('node:assert/strict');
const {preserveCompletion}=require('../api/_appointments');
test('stale snapshots cannot reopen a confirmed reschedule or restore the old display time',()=>{
 const saved={status:'Approved',visitStatus:'Approved',lifecycleStatus:'Approved',date:'2026-10-12',time:'14:00',timeDisplay:'2:00 PM',schedule:'2026-10-12 2:00 PM',requestedSchedule:'',rescheduleConfirmation:{confirmedAt:'2026-10-12T05:00:00Z'}};
 const result=preserveCompletion({...saved,status:'Reschedule Requested',timeDisplay:'1:35 PM',rescheduleConfirmation:undefined},saved);
 assert.equal(result.status,'Approved');assert.equal(result.timeDisplay,'2:00 PM');
 const next={...saved,status:'Reschedule Requested',requestedSchedule:'2026-10-15 10:00 AM'};
 assert.equal(preserveCompletion(next,saved).status,'Reschedule Requested');
});
