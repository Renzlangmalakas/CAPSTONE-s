const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('../Shared/dentist-access');
const a={id:'doctor-a',email:'a@test',name:'Same Name'}, b={id:'doctor-b',email:'b@test',name:'Same Name'};
const first={id:'apt-a',patientId:'patient-a',dentistId:a.id,dentistName:a.name};
const second={id:'apt-b',patientId:'patient-b',dentistId:b.id,dentistName:b.name};
const db={appointments:[first,second],patients:[{id:'patient-a'},{id:'patient-b'}],patientClinicalNotes:[
  {id:'note-a',patientKey:'patient-a',dentistId:a.id,text:'Private A'},
  {id:'note-b',patientKey:'patient-b',dentistId:b.id,text:'Private B'}]};
test('dentist ID overrides matching names and emails',()=>{
  assert.equal(access.assigned(second,a),false);
  assert.equal(access.assigned({...second,dentistEmail:a.email},a),false);
  assert.equal(access.assigned({},a),false);
  assert.equal(access.assigned({dentistEmail:a.email},a),true);
});
test('verified directory email resolves a separate booking dentist ID',()=>{
  const saved={...db,dentists:[{id:'roster-a',email:a.email}],appointments:[{...first,dentistId:'roster-a'}]};
  assert.equal(access.scope(saved,a).appointments.length,1);
  assert.equal(access.scope(saved,b).appointments.length,0);
});
test('snapshot exposes only assigned patients, appointments and findings',()=>{
  const scoped=access.scope(db,a);
  assert.deepEqual(scoped.appointments,[first]);
  assert.deepEqual(scoped.patients,[{id:'patient-a'}]);
  assert.equal(scoped.patientClinicalNotes.length,1);
  assert.equal(scoped.patientClinicalNotes[0].id,'note-a');
  assert.ok(!JSON.stringify(scoped).includes('Private B'));
});
test('another doctor cannot steal an appointment or modify its notes',()=>{
  assert.throws(()=>access.writable({appointments:[{...second,dentistId:a.id}]},db,a),{status:403});
  assert.throws(()=>access.writable({patientClinicalNotes:[{...db.patientClinicalNotes[1],patientKey:'patient-a',dentistId:a.id}]},db,a),{status:403});
  assert.throws(()=>access.writable({patientClinicalNotes:[{id:'new',patientKey:'patient-b'}]},db,a),{status:403});
});
test('scoped writes preserve attribution and omit unrelated directory data',()=>{
  const result=access.writable({appointments:[first],patients:db.patients,patientClinicalNotes:[{id:'new',patientKey:'patient-a',text:'Finding'}]},db,a);
  assert.equal(result.patientClinicalNotes[0].dentistId,a.id);
  assert.equal(result.patients,undefined);
  assert.equal(db.patientClinicalNotes.length,2);
});
test('findings linked to another doctors appointment remain private even for a shared patient',()=>{
  const shared={...db,appointments:[first,{...second,patientId:'patient-a'}],patientClinicalNotes:[{id:'private',patientKey:'patient-a',appointmentId:'apt-b'}]};
  assert.equal(access.scope(shared,a).patientClinicalNotes.length,0);
});
