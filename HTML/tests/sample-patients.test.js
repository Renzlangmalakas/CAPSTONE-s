const test = require('node:test');
const assert = require('node:assert/strict');
const { removeLegacySamplePatients } = require('../Shared/default-accounts');

test('removes saved sample patients and their original appointments', () => {
  const db = { patients: [
    { name: 'Juan Dela Cruz', age: 30, address: 'Quezon City', contact: '09123456789' },
    { name: 'Maria Santos', age: 25, address: 'Manila', contact: '09987654321' },
    { name: 'Pedro Reyes', age: 10, address: 'Quezon City', contact: '09112223333' },
  ], appointments: [
    { patient: 'Juan Dela Cruz', service: 'Consultation', date: '2026-03-25', time: '10:00' },
    { patient: 'Maria Santos', service: 'Orthodontic Adjustment', time: '10:30', status: 'Confirmed', total: 1500, method: 'GCash' },
  ] };
  removeLegacySamplePatients(db);
  assert.equal(db.patients.length, 0);
  assert.equal(db.appointments.length, 0);
  assert.deepEqual(removeLegacySamplePatients(db), db);
});

test('preserves registered patients, different people with the same name, and real appointments', () => {
  const patients = [
    { name: 'Juan Dela Cruz', age: 30, address: 'Quezon City', contact: '09123456789', email: 'real@example.test' },
    { name: 'Maria Santos', age: 42, address: 'Antipolo', contact: '09900000000' },
    { name: 'RenZXiao', email: 'patient@example.test' },
  ];
  const appointments = [
    { patient: 'Juan Dela Cruz', patientId: 'real-id', service: 'Consultation', date: '2026-03-25', time: '10:00' },
    { patient: 'Maria Santos', service: 'Consultation', date: '2026-10-10', time: '10:00' },
  ];
  assert.deepEqual(removeLegacySamplePatients({ patients, appointments }), { patients, appointments });
});

test('removes empty records derived from sample appointments without removing unrelated records', () => {
  const db = { patients: [{ name: 'Juan Dela Cruz' }, { name: 'Maria Santos' }], appointments: [
    { patient: 'Juan Dela Cruz', service: 'Consultation', date: '2026-03-25', time: '10:00' },
  ] };
  removeLegacySamplePatients(db);
  assert.deepEqual(db.patients, []);
});

test('explicitly removed contactless records stay removed without the original sample appointments', () => {
  const db = { patients: [
    { id: 'old-juan', name: 'Juan Dela Cruz', age: 30, contact: '' },
    { id: 'old-maria', name: 'Maria Santos', email: '', contact: '' },
    { id: 'real-maria', name: 'Maria Santos', contact: '09900000000' },
  ], appointments: [] };
  removeLegacySamplePatients(db);
  assert.deepEqual(db.patients.map(row => row.id), ['real-maria']);
  const { isRemovedSamplePatient } = require('../Shared/default-accounts');
  assert.equal(isRemovedSamplePatient({ patientName: 'Juan Dela Cruz', patientId: 'old-juan' }), true);
  assert.equal(isRemovedSamplePatient({ patientName: 'Juan Dela Cruz', patientEmail: 'real@example.test' }), false);
});
