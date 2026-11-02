const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('FDI chart has unique permanent and primary tooth numbers', () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve('../Dentist/patient-record.js'), 'utf8'), context);
  const adult = context.dentalToothNumbers('adult');
  const child = context.dentalToothNumbers('child');
  assert.equal(new Set(adult).size, 32);
  assert.equal(new Set(child).size, 20);
  assert.ok(adult.includes(18) && adult.includes(48));
  assert.ok(child.includes(55) && child.includes(85));
  assert.ok(!child.some(n => adult.includes(n)));
});
test('clinical note normalization preserves treatment fields and isolates patients', () => {
  const source = fs.readFileSync(require.resolve('../Dentist/dentist_page.js'), 'utf8');
  const records = [{ id:'a',patientKey:'patient-a',text:'Filling',tooth:'21',condition:'Recorded condition',treatment:'Filling',treatmentStatus:'Completed',before:'Before',after:'After' },
    { id:'b',patientKey:'patient-b',text:'Other patient' }];
  const context = vm.createContext({ window:{GMDentistAccess:require("../Shared/dentist-access")}, currentDentistUser:{id:"dentist-test"}, getClinicDb:()=>({patientClinicalNotes:records,appointments:[{patientId:"patient-a",dentistId:"dentist-test"}]}),ensureClinicDbShape:x=>x,safeArray:x=>x });
  for(const name of ['getPatientClinicalNotes','getPatientNotesForKey']) {
    const start=source.indexOf(`function ${name}(`);
    vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),context);
  }
  const notes=context.getPatientNotesForKey('patient-a');
  assert.equal(notes.length,1);
  assert.equal(notes[0].tooth,'21');
  assert.equal(notes[0].after,'After');
  assert.equal(notes[0].treatmentStatus,'Completed');
});
