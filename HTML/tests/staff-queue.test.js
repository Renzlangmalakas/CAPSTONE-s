const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = require('node:fs').readFileSync(require.resolve('../Staff/staff.js'), 'utf8');
const c = { BookingTime: require('../Shared/booking-time') };
vm.runInNewContext(source.slice(source.indexOf('function getActivePatientQueue('), source.indexOf('// Premium/stability overrides')), c);
test('queue excludes closed, archived and other-day bookings', () => {
  const rows = ['Cancelled', 'Completed', 'Rejected', 'Approved'].map((status, id) => ({ id, status, date: '2026-10-07', time: '09:00' }));
  rows.push({ id: 4, status: 'Approved', date: '2026-10-08' }, { id: 5, status: 'Approved', date: '2026-10-07', archived: true });
  assert.deepEqual(Array.from(c.getActivePatientQueue(rows, '2026-10-07'), r => r.id), [3]);
});
test('serving and arrived patients lead; remaining appointments sort by actual time with no duplicates', () => {
  const rows = [
    { id: 'afternoon', time: '1:00 PM' }, { id: 'morning', time: '9:00 AM' },
    { id: 'arrived', time: '10:00', arrivedAt: '2026-10-07T01:00:00Z' },
    { id: 'serving', time: '10:30', status: 'In Progress' }, { id: 'morning', time: '9:00 AM' }
  ].map(r => ({ status: 'Approved', date: '2026-10-07', ...r }));
  assert.deepEqual(Array.from(c.getActivePatientQueue(rows, '2026-10-07'), r => r.id), ['serving', 'arrived', 'morning', 'afternoon']);
});
