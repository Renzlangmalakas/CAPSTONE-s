const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeNotification, notificationRow } = require('../api/_notifications');

test('notification text, destination, read state and appointment metadata survive storage', () => {
  const input = { id: 'local-id', text: 'Appointment approved', target: 'patient', read: true,
    patientId: 'patient-1', appointmentId: 'visit-1', eventType: 'approval', createdAt: '2026-10-04T00:00:00Z' };
  const row = notificationRow(input, 'db-id');
  assert.equal(row.body, input.text);
  assert.equal(row.role_target, 'patient');
  assert.equal(row.is_read, true);
  const restored = normalizeNotification(row);
  assert.equal(restored.text, input.text);
  assert.equal(restored.patientId, input.patientId);
  assert.equal(restored.appointmentId, input.appointmentId);
  assert.equal(restored.read, true);
  assert.equal(restored.target, 'patient');
  restored.read = false;
  assert.equal(notificationRow(restored, 'db-id').is_read, false);
});

test('empty legacy rows are rejected and staff messages are supported', () => {
  assert.equal(normalizeNotification({ id: 'empty', title: null, body: null }, 'admin'), null);
  assert.equal(normalizeNotification({ message: 'Payment received' }, 'staff').body, 'Payment received');
  assert.equal(normalizeNotification({ body: 'Unknown destination' }), null);
});
