const test=require('node:test'),assert=require('node:assert/strict');
const {eligibleDate,applyAutomaticArchive}=require('../api/_automatic-archive');
const {validateHistoryChanges}=require('../api/_history-permissions');
test('six calendar months clamps month-end and excludes active or undated records',()=>{
 assert.equal(eligibleDate({status:'Completed',date:'2026-08-31'}),'2027-02-28');
 assert.equal(eligibleDate({status:'Approved',date:'2025-01-01'}),'');
 assert.equal(eligibleDate({status:'Completed'}),'');
 assert.equal(eligibleDate({status:'Cancelled',date:'2026-01-01',cancelledAt:'2026-04-10T12:00:00Z'}),'2026-10-10');
});
test('archives exactly at the cutoff for both roles, keeps records and remains idempotent',()=>{
 const db={appointments:[{id:'old',status:'Completed',date:'2026-05-02'},{id:'recent',status:'Completed',date:'2026-05-03'},{id:'active',status:'Approved',date:'2025-01-01'}]};
 applyAutomaticArchive(db,new Date('2026-11-02T04:00:00Z'));
 assert.equal(db.appointments.length,3);assert.ok(db.appointments[0].archivedForPatient);assert.ok(db.appointments[0].archivedForDentist);
 assert.equal(db.appointments[1].archivedForPatient,undefined);assert.equal(db.appointments[2].archivedForPatient,undefined);
 const snapshot=JSON.stringify(db);applyAutomaticArchive(db,new Date('2026-11-03T04:00:00Z'));assert.ok(db.appointments[1].archivedForPatient);
 const saved=JSON.parse(snapshot);applyAutomaticArchive(saved,new Date('2026-11-03T04:00:00Z'));assert.doesNotThrow(()=>validateHistoryChanges(db,saved,'patient'));
});
