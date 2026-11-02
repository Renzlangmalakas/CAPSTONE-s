const test = require('node:test');
const assert = require('node:assert/strict');
const time = require('../Shared/booking-time');
const hours = require('../Shared/clinic-hours');
test('24-hour preview retains duration limits and cannot activate on Vercel', () => {
  const previous = process.env.GM_LOCAL_24_HOURS, vercel = process.env.VERCEL;
  const now = new Date('2026-11-02T00:00:00+08:00');
  try {
    process.env.GM_LOCAL_24_HOURS = '1'; delete process.env.VERCEL;
    assert.equal(hours.allows('2026-11-02', 22 * 60, 60, {}, now), true);
    assert.equal(hours.allows('2026-11-02', 23 * 60 + 30, 60, {}, now), false);
    assert.equal(time.overlapsLunch(780, 30), false);
    process.env.VERCEL = '1';
    assert.equal(hours.allows('2026-11-02', 22 * 60, 60, {}, now), false);
    assert.equal(time.overlapsLunch(780, 30), true);
    delete process.env.VERCEL; delete process.env.GM_LOCAL_24_HOURS;
    assert.equal(time.local24Hours(), false);
  } finally {
    if (previous === undefined) delete process.env.GM_LOCAL_24_HOURS; else process.env.GM_LOCAL_24_HOURS = previous;
    if (vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = vercel;
  }
});
