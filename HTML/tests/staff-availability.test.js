const test = require('node:test');
const assert = require('node:assert/strict');
const { slots } = require('../Staff/staff-availability');
const dentist = { id: 'd', name: 'Doctor', schedules: [{ day: 'Saturday', start: '09:00', end: '12:00' }] };
const appointment = { id: 'a', service: 'Consultation' };
const now = new Date('2026-10-07T08:00:00');
test('availability respects duty, duration, existing bookings and excluded appointment', () => {
  assert.equal(slots('2026-10-09', [dentist], [], appointment, now).length, 0);
  const booked = [{ id: 'b', dentistId: 'd', date: '2026-10-10', time: '09:00', service: 'Root Canal Treatment' }];
  assert.equal(slots('2026-10-10', [dentist], booked, appointment, now)[0], '11:00');
  assert.equal(slots('2026-10-10', [dentist], booked, { ...appointment, id: 'b' }, now)[0], '09:00');
  assert.equal(slots('2026-10-10', [dentist], [], { services: [{ serviceName: 'Root Canal Treatment' }, { serviceName: 'Tooth Extraction' }] }, now).length, 0);
});
test('multiple dentists require overlapping shifts and no dentists means no slots', () => {
  const other = { ...dentist, id: 'e', schedules: [{ day: 'Saturday', start: '11:00', end: '14:00' }] };
  assert.equal(slots('2026-10-10', [dentist, other], [], appointment, now)[0], '11:00');
  assert.equal(slots('2026-10-10', [], [], appointment, now).length, 0);
});
