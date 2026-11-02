const test = require('node:test');
const assert = require('node:assert/strict');
const { allows } = require('../Shared/clinic-hours');
test('clinic closing blocks same-day bookings while future dates remain bookable', () => {
  const closed = new Date('2026-10-07T09:00:00Z');
  assert.equal(allows('2026-10-07', 540, 20, {}, closed), false);
  assert.equal(allows('2026-10-08', 540, 20, {}, closed), true);
  assert.equal(allows('2026-10-08', 1020, 20, {}, closed), false);
  assert.equal(allows('2026-10-08', 1000, 20, {}, closed), true);
});
test('past time, service duration, and published shorter hours are respected', () => {
  const now = new Date('2026-10-07T02:00:00Z');
  assert.equal(allows('2026-10-07', 540, 20, {}, now), false);
  assert.equal(allows('2026-10-07', 615, 20, {}, now), true);
  assert.equal(allows('2026-10-07', 960, 90, {}, now), false);
  assert.equal(allows('2026-10-08', 960, 20, { closingTime: '16:00' }, now), false);
});
