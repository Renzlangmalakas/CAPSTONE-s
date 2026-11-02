const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const roster = require('../Shared/default-accounts');

test('Maria reuses her existing profile and unnamed staff are removed without losing named staff', () => {
  const db = roster.normalizeDb({
    dentists: [{ id: 'maria-existing', name: 'Dr. Maria Reyes', email: 'maria.reyes@gmdental.test', schedules: [{ day: 'Wednesday', start: '09:00', end: '13:00' }] }],
    staff: [{ id: 'empty' }, { id: 'blank', name: '  ' }, { id: 'placeholder', name: 'Unnamed Staff' },
      { id: 'anna', email: 'queengpt18@gmail.com' }, { id: 'custom', name: 'Other Staff', position: 'Assistant' }]
  });
  const maria = db.dentists.filter(d => d.email === 'maria.reyes@gmdental.com');
  assert.equal(maria.length, 1);
  assert.equal(maria[0].id, 'maria-existing');
  assert.equal(maria[0].schedules[0].end, '13:00');
  assert.ok(!db.staff.some(s => ['empty', 'blank', 'placeholder'].includes(s.id)));
  assert.equal(db.staff.find(s => s.id === 'anna').name, 'Anna Reyes');
  assert.ok(db.staff.some(s => s.id === 'custom'));
  assert.equal(db.staff.length, 3);
});

test('default roster contains eight dentists, one administrator and two staff', () => {
  assert.equal(roster.accounts.length, 11);
  assert.equal(new Set(roster.accounts.map(a => a.email )).size, 11);
  assert.equal(roster.accounts.filter(a => a.role === 'dentist').length, 8);
  assert.equal(roster.accounts.find(a => a.name === 'Dr. Daniel Santos').email, 'daniel.santos@gmdental.com');
});

test('duplicate names and old emails merge while schedules and appointment links survive', () => {
  const db = {
    dentists: [
      { id: 'original', name: 'Dr. Imelda G. Mappala', schedules: [{ day: 'Monday' }] },
      { id: 'duplicate', name: 'dr. imelda mappala', email: 'imelda.mappala@gmdental.test', schedules: [{ day: 'Friday' }] },
      { id: 'placeholder', name: 'Assigned Dentist' }
    ],
    appointments: [{ dentistId: 'duplicate', dentist: 'Dr. Imelda G. Mappala' }],
    dentistSchedules: [{ dentist_id: 'duplicate', day: 'Tuesday' }],
    staff: []
  };
  roster.normalizeDb(db);
  assert.equal(db.dentists.length, 8);
  const imelda = db.dentists.find(d => d.name === 'Dr. Imelda Mappala');
  assert.equal(imelda.id, 'original');
  assert.equal(imelda.schedules.length, 2);
  assert.equal(db.appointments[0].dentistId, 'original');
  assert.equal(db.dentistSchedules[0].dentist_id, 'original');
  assert.equal(db.appointments[0].dentist, imelda.name);
  assert.equal(db.staff.length, 2);
  const once = JSON.stringify(db);
  roster.normalizeDb(db);
  assert.equal(JSON.stringify(db), once);
});

test('custom dentists and archived records retain their saved state', () => {
  const rows = roster.merge([{ id: 'custom', name: 'Dr. Someone Else', archived: true },
    { id: 'carla', name: 'Dr. Carla Mendoza', archived: true }], 'dentist');
  assert.equal(rows.find(r => r.id === 'custom').archived, true);
  assert.equal(rows.find(r => r.id === 'carla').archived, true);
});

test('missing hours use the booking roster and saved working hours take precedence', () => {
  const rows = roster.merge([
    { id: 'daniel', name: 'Dr. Daniel Santos', schedules: [{ day: 'Tuesday', start: '10:00', end: '18:00' }] },
    { id: 'andrea', name: 'Dr. Andrea Cruz', specialty: 'Dentist', schedules: [] }
  ], 'dentist');
  assert.ok(rows.every(row => row.schedules.length));
  assert.deepEqual(rows.find(r => r.id === 'daniel').schedules, [{ day: 'Tuesday', start: '10:00', end: '18:00' }]);
  assert.deepEqual(rows.find(r => r.id === 'andrea').schedules, [{ day: 'Wednesday', start: '09:00', end: '17:00' }]);
  assert.equal(rows.find(r => r.id === 'andrea').specialty, 'Oral Surgeon');
  const db = roster.normalizeDb({ dentists: rows, dentistSchedules: [
    { dentistId: 'andrea', day: 'Saturday', start: '10:00', end: '14:00' }
  ] });
  assert.deepEqual(db.dentists.find(r => r.id === 'andrea').schedules, [{ day: 'Saturday', start: '10:00', end: '14:00' }]);
});

test('account reconciliation reuses IDs and passwords, removes duplicates and is repeatable', async () => {
  let rows = [
    { id: 'old-admin', email: 'admin@test.com', name: 'Admin', role: 'admin', password: 'saved-hash' },
    { id: 'old-dentist', email: 'imelda.mappala@gmdental.test', name: 'Dr. Imelda G. Mappala', role: 'dentist', password: 'dentist-hash' },
    { id: 'extra', email: 'extra@example.com', name: 'Dr. Imelda Mappala', role: 'dentist', password: 'extra-hash' }
  ];
  const supabase = { from() { return {
    select: async () => ({ data: rows }),
    update: patch => ({ eq: async (_, id) => { Object.assign(rows.find(r => r.id === id), patch); return {}; } }),
    delete: () => ({ eq: async (_, id) => { rows = rows.filter(r => r.id !== id); return {}; } }),
    upsert: async row => { if (!rows.some(r => r.email === row.email)) rows.push(row); return {}; }
  }; } };
  const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
  const start = source.indexOf('async function seedSupabaseUsers()');
  const end = source.indexOf('\nasync function findVerifiedUserByEmail', start);
  const context = { supabase, defaultAccounts: roster, seedUsers: roster.accounts,
    usersHasRoleColumn: true, toDbUser: x => x, deterministicUuid: (_, email) => email,
    decodeConditionRole: () => ({}) };
  vm.runInNewContext(source.slice(start, end), context);
  await context.seedSupabaseUsers();
  assert.equal(rows.length, 11);
  assert.equal(rows.find(r => r.id === 'old-admin').password, 'saved-hash');
  assert.equal(rows.find(r => r.id === 'old-dentist').email, 'imelda.mappala@gmdental.com');
  assert.equal(rows.find(r => r.id === 'old-dentist').password, 'dentist-hash');
  assert.ok(!rows.some(r => r.id === 'extra'));
  const once = JSON.stringify(rows);
  await context.seedSupabaseUsers();
  assert.equal(JSON.stringify(rows), once);
});
