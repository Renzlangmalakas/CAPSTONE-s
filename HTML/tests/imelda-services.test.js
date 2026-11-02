const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const defaults = require('../Shared/default-accounts');
const eligibility = require('../Shared/dentist-services');
const catalog = require('../Shared/service-catalog');
test('stale duplicate Imelda profiles retain all-services eligibility for three specialist services', () => {
  const dentists = defaults.merge([
    { id: 'old', name: 'Dr. Imelda Mappala', email: 'imelda.mappala@gmdental.com', specialty: 'General Dentist' },
    { id: 'new', name: 'Dr. Imelda Mappala', email: 'imelda.mappala@gmdental.com', specialty: 'All Services' }
  ], 'dentist', false);
  assert.equal(dentists.length, 1);
  assert.equal(dentists[0].specialty, 'All Services');
  assert.equal(['Root Canal Treatment', 'Flexible Denture', 'Retainers'].every(name => eligibility.canPerform(dentists[0], name)), true);
});
test('Imelda is eligible for every catalog service in Staff and patient booking', () => {
  const imelda = defaults.merge([], 'dentist').find(d => d.email === 'imelda.mappala@gmdental.com');
  const source = fs.readFileSync(require.resolve('../Patient/patient.js'), 'utf8');
  const start = source.indexOf('function dentistCanPerformService(');
  const end = source.indexOf('function dentistCanPerformSelectedServices', start);
  const c = { getDentistSpecialtyTokens: d => [d.specialty.toLowerCase()] };
  vm.runInNewContext(source.slice(start, end), c);
  for (const service of catalog.defaults) {
    assert.equal(eligibility.canPerform(imelda, service.name), true);
    assert.equal(c.dentistCanPerformService(imelda, service.name), true);
  }
  assert.equal(eligibility.canPerform({ specialty: 'General Dentist' }, 'Root Canal Treatment'), false);
});
test('default Saturday duty includes Imelda and Daniel from 9 AM to 5 PM', () => {
  const dentists = defaults.merge([], 'dentist');
  for (const email of ['imelda.mappala@gmdental.com', 'daniel.santos@gmdental.com']) {
    assert.deepEqual(dentists.find(d => d.email === email).schedules.find(s => s.day === 'Saturday'), { day: 'Saturday', start: '09:00', end: '17:00' });
  }
});
