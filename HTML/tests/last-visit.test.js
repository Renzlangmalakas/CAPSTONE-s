const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../Dentist/dentist_page.js'), 'utf8');
const context = { parseScheduleParts: schedule => ({ datePart: schedule.split(' • ')[0] }) };
vm.runInNewContext(source.slice(source.indexOf('function completedPatientVisit('), source.indexOf('function renderPatients()')), context);
test('last visit excludes upcoming and unverified completion records', () => {
  for (const status of ['Approved', 'Waiting', 'Ongoing', 'Cancelled']) {
    assert.equal(context.completedPatientVisit({ status, date: '2026-10-10' }), null);
  }
  assert.equal(context.completedPatientVisit({ status: 'Completed', date: '2026-10-10' }), null);
});
test('last visit uses completed appointment date and can choose latest visit independent of row order', () => {
  const a = context.completedPatientVisit({ status: 'Completed', date: '2026-10-05', completedAt: '2026-10-05T09:00:00Z' });
  const b = context.completedPatientVisit({ status: 'Completed', date: '2026-10-01', completedAt: '2026-10-01T09:00:00Z' });
  assert.equal(a.label, '2026-10-05');
  assert.ok(a.timestamp > b.timestamp);
});
