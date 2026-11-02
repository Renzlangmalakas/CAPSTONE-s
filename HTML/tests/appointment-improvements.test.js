const test=require('node:test'),assert=require('node:assert/strict');
const time=require('../Shared/booking-time'),eligibility=require('../Shared/dentist-services');
const {validateHistoryChanges}=require('../api/_history-permissions');
const {reschedule}=require('../api/_appointment-actions');
test('dependent duration is additive and flattened participant lines are not counted twice',()=>{
 const dep={id:'child',services:[{name:'Consultation'}]};
 assert.equal(time.duration({services:[{name:'Oral Prophylaxis'}],dependents:[dep]}),65);
 assert.equal(time.duration({services:[{name:'Oral Prophylaxis',participantId:'main'},{name:'Consultation',participantId:'child'}],dependents:[dep]}),65);
 assert.ok(time.overlaps(540,65,600,20));assert.ok(!time.overlaps(540,65,605,20));
});
test('multiple specializations allow each eligible service, exclude others',()=>{
 const d={specialty:'General Dentist, Orthodontist'};
 assert.ok(eligibility.canPerform(d,'Oral Prophylaxis'));assert.ok(eligibility.canPerform(d,'Retainers'));assert.ok(!eligibility.canPerform(d,'Root Canal Treatment'));
});
test('patient, staff and dentist cannot archive or delete history; unchanged records and admin allowed',()=>{
 const saved={appointments:[{id:'a',status:'Completed'}],archivedAppointments:[]};
 for(const role of ['patient','staff','dentist']){
 assert.throws(()=>validateHistoryChanges({appointments:[]},saved,role),/Only an administrator/);
 assert.throws(()=>validateHistoryChanges({appointments:[{id:'a',status:'Completed',archived:true}]},saved,role),/Only an administrator/);
 assert.doesNotThrow(()=>validateHistoryChanges(saved,saved,role));
 }
 assert.doesNotThrow(()=>validateHistoryChanges({appointments:[]},saved,'admin'));
});
test('assisted reschedule preserves participants, duration and payments, rejects overlap and nonstaff actors',()=>{
 const d={id:'d',name:'Doctor',schedules:[{day:'Wednesday',start:'09:00',end:'17:00'}]};
 const a={id:'a',dentistId:'d',patientEmail:'p@test',date:'2050-10-04',time:'09:00',status:'Approved',paid:500,services:[{name:'Consultation'}],dependents:[{id:'child',services:[{name:'Consultation'}]}]};
 const input={date:'2050-10-05',time:'09:00',reason:'Patient requested by phone'};
 for(const role of ['admin','staff']){const result=reschedule(a,input,[d],[a],{}, {role,email:'staff@test'});assert.equal(result.durationMinutes,40);assert.equal(result.paid,500);assert.deepEqual(result.dependents,a.dependents);assert.equal(result.rescheduleHistory.length,1);}
 assert.throws(()=>reschedule(a,input,[d],[a],{}, {role:'patient'}),/access/);
 assert.throws(()=>reschedule(a,input,[d],[a,{...a,id:'other',date:input.date,time:'09:20'}],{}, {role:'staff'}),/overlap/);
});
