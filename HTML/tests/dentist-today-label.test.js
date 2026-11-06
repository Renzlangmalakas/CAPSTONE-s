const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(require.resolve('../Patient/patient.js'),'utf8');const ctx={Intl,Date};vm.runInNewContext(s.slice(s.indexOf('function dentistTodayScheduleLabel('),s.indexOf('function populateDentistDropdownFromSnapshot(')),ctx);
test('dentist today label uses clinic timezone, active schedule and unknown fallback',()=>{
 const now=new Date('2026-11-05T17:00:00Z');
 assert.equal(ctx.dentistTodayScheduleLabel({schedules:[{day:'Friday'}]},now),'Available today (scheduled)');
 assert.equal(ctx.dentistTodayScheduleLabel({schedules:[{day:'Thursday'}]},now),'Not available today');
 assert.equal(ctx.dentistTodayScheduleLabel({schedules:[{day:'Friday',isActive:false}]},now),'Not available today');
 assert.equal(ctx.dentistTodayScheduleLabel({},now),'Schedule not available');
});
