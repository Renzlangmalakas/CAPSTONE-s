const test = require('node:test');
const assert = require('node:assert/strict');
const access = require('../Shared/dentist-access');
const { validateAssignment } = require('../api/_appointment-assignment');
const dentists = [{ id: 'd1', name: 'General', specialty: 'General Dentist' }, { id: 'd2', name: 'Endo', specialty: 'Endodontist' }, { id: 'd3', name: 'Other', specialty: 'Orthodontist' }];
const saved = { id: 'a', patient: 'Patient', patientId: 'p', dentistId: 'd1' };
const appointment = { ...saved, dentistIds: ['d1', 'd2'], services: [{ serviceName: 'Oral Prophylaxis' }, { serviceName: 'Root Canal Treatment' }] };
test('every selected dentist must qualify for all chosen services', () => {
  assert.throws(() => validateAssignment(appointment, saved, 'staff', dentists));
  validateAssignment({ ...appointment, dentistIds: ['d1'], services: [{ serviceName: 'Oral Prophylaxis' }] }, saved, 'staff', dentists);
  validateAssignment(appointment, saved, 'staff', dentists.map(d => ({ ...d, specialties: ['General Dentist', 'Endodontist'] }))); 
  assert.throws(() => validateAssignment({ ...appointment, dentistIds: ['d1'] }, saved, 'staff', dentists));
  assert.throws(() => validateAssignment({ ...appointment, dentistIds: ['d1', 'd2', 'd3'] }, saved, 'staff', dentists));
});
test('patient cannot be renamed and only staff may grant shared access', () => {
  assert.throws(() => validateAssignment({ ...appointment, patient: 'Someone else' }, saved, 'staff', dentists));
  for (const role of ['patient', 'dentist']) assert.throws(() => validateAssignment(appointment, saved, role, dentists));
});
test('each selected dentist sees the appointment and linked findings; unrelated dentist cannot', () => {
  const db = { dentists, appointments: [appointment], patients: [{ id: 'p', name: 'Patient' }], patientClinicalNotes: [{ id: 'n', patientId: 'p', appointmentId: 'a', dentistId: 'd1' }] };
  for (const id of ['d1', 'd2']) {
    const result = access.scope(db, { id });
    assert.equal(result.appointments.length, 1);
    assert.equal(result.patients.length, 1);
    assert.equal(result.patientClinicalNotes.length, 1);
  }
  assert.equal(access.scope(db, { id: 'd3' }).appointments.length, 0);
  assert.throws(() => access.writable({ appointments: [{ ...appointment, dentistIds: ['d1', 'd2', 'd3'] }] }, db, { id: 'd1' }));
});
