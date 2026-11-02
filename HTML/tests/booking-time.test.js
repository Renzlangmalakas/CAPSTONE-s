const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const time = require('../Shared/booking-time');
const { createBookingHandler } = require('../api/_booking');

test('all 17 services reserve their fixed duration and combinations add up', () => {
  const expected = [20,45,60,120,150,120,120,90,120,120,120,60,30,30,90,10,15];
  assert.deepEqual(Object.values(time.durations), expected);
  assert.equal(time.duration({ services: [{ name: 'Consultation' }, { serviceName: 'Oral Prophylaxis' }] }), 65);
  assert.equal(time.duration({ service: 'Consultation + Periapical X-Ray' }), 30);
  assert.equal(time.duration({ service: 'Tooth Extraction', durationMinutes: 30 }), 120);
  assert.equal(time.duration({ service: 'Root Canal' }), 120);
});

test('overlap checks both directions, containment and exact end boundaries', () => {
  assert.ok(time.overlaps(540,150,600,20));
  assert.ok(time.overlaps(600,20,540,150));
  assert.ok(time.overlaps(530,180,540,150));
  assert.ok(!time.overlaps(690,20,540,150));
  assert.ok(!time.overlaps(520,20,540,150));
  assert.equal(time.minutes('12:00 AM'), 0);
  assert.equal(time.minutes('12:00 PM'), 720);
  assert.ok(Number.isNaN(time.minutes('25:00')));
});

function patientFunction(name, globals = {}) {
  const source = fs.readFileSync(require.resolve('../Patient/patient.js'), 'utf8');
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  const context = vm.createContext({ BookingTime: time, bookingAvailabilityValue: (key, read) => read(), selectedBookingDuration: () => 150,
    convertDisplayTimeTo24: value => time.clock(time.minutes(value)), normalizeDayName: v => v,
    getDayNameFromDate: () => 'Monday', ...globals });
  context.getBookingServices = () => context.selectedBookingServices || [];
  context.withBookingAvailabilitySnapshot = render => render();
  const implementationStart = source.indexOf(`function ${name}FromSnapshot(`);
  if (implementationStart >= 0) {
    const implementationEnd = source.indexOf('\n}', implementationStart) + 2;
    vm.runInContext(source.slice(implementationStart, implementationEnd), context);
  }
  vm.runInContext(source.slice(start, end), context);
  return context[name];
}

test('full service must fit one dentist shift and clinic closing time', () => {
  const works = patientFunction('dentistWorksOnDateAndTime');
  const dentist = { schedules: [{ day: 'Monday', start: '09:00', end: '12:00' }, { day: 'Monday', start: '13:00', end: '17:00' }] };
  assert.ok(works(dentist, '2026-10-05', '9:30 AM'));
  assert.ok(!works(dentist, '2026-10-05', '10:00 AM'));
  assert.ok(works(dentist, '2026-10-05', '2:30 PM'));
  assert.ok(!works(dentist, '2026-10-05', '2:35 PM'));
  assert.ok(!works({}, '2026-10-05', '4:00 PM'));
  assert.ok(works({}, '2026-10-05', '4:40 PM', 20));
});

test('archived active reservations still block time and cancellations release it', () => {
  const records = [{ id: 'a', date: '2026-10-05', time: '09:00', service: 'Odontectomy', status: 'Approved', archivedForPatient: true, dentistId: 'd' }];
  const occupied = patientFunction('isClinicSlotOccupied', {
    normalizeBookingDate: v => v, getBookingAppointmentsForDate: () => records,
    resolveDentistReferenceValues: v => [typeof v === 'string' ? v : v.dentistId],
    getOperationalAppointmentStatus: a => a.status,
    isActiveLifecycleStatus: s => s === 'Approved',
    getAppointmentTimeCandidates24: a => new Set([a.time])
  });
  assert.ok(occupied('2026-10-05', '10:00 AM', '', 'd', 20));
  assert.ok(!occupied('2026-10-05', '11:30 AM', '', 'd', 20));
  assert.ok(!occupied('2026-10-05', '10:00 AM', '', 'other', 20));
  records[0].status = 'Cancelled';
  assert.ok(!occupied('2026-10-05', '10:00 AM', '', 'd', 20));
});

test('booking API computes duration itself and reports database conflicts', async () => {
  let stored;
  let conflict = false;
  const handler = createBookingHandler({ supabase: { from() { return {
    insert(row) { stored = row; return this; }, select() { return this; },
    async single() { return conflict ? { error: { code: '23P01' } } : { data: stored }; }
  }; } } });
  const req = { user: { role: 'patient', email: 'test@example.com' }, body: { appointment: {
    id: 'test-booking', dentistId: 'd', patientEmail: 'test@example.com', date: '2050-10-05', time: '09:00', service: 'Odontectomy', durationMinutes: 5
  } } };
  const res = { status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } };
  await handler(req, res);
  assert.equal(res.code, 201);
  assert.equal(stored.data.durationMinutes, 150);
  assert.equal(stored.data.endTime, '11:30');
  conflict = true;
  await handler(req, res);
  assert.equal(res.code, 409);
  req.body.appointment.time = '16:00';
  await handler(req, res);
  assert.equal(res.code, 400);
});

test('patient picker hides overlapping starts but shows the exact freed boundary', () => {
  const classes = () => ({ add() {}, contains() { return false; } });
  const container = { children: [], appendChild(child) { this.children.push(child); } };
  const render = patientFunction('generateTimeSlots', {
    document: { getElementById: () => container, createElement: () => ({ classList: classes() }) },
    getAllBookingTimeSlots: () => ['9:00 AM','9:15 AM','9:20 AM','9:30 AM'],
    selectedBookingServices: [{ name: 'Consultation' }], selectedDate: '2026-10-05', selectedTime: '',
    currentPeriod: 'morning', selectedDentistObj: null,
    getCurrentPatientIdentity: () => ({ email: 'test@example.com' }),
    getAvailableDentistsForDateTime: (date, t) => time.minutes(t) < 560 ? [] : [{ id: 'd' }],
    patientHasConflict: () => false, updateSummary() {}
  });
  render();
  assert.deepEqual(container.children.map(b => b.innerText || b.textContent), ['9:20 AM','9:30 AM']);
});


test('monthly availability reads one collection per render and refreshes after changes', () => {
  const source = fs.readFileSync(require.resolve('../Patient/patient.js'), 'utf8');
  const begin = source.indexOf('var bookingAvailabilitySnapshot = null;');
  const end = source.indexOf('function getAvailableDentistsForDateTime(', begin);
  let reads = 0;
  let records = [{ id: 'one', date: '2026-10-05' }];
  const context = vm.createContext({ buildCanonicalAppointmentCollections: () => { reads++; return records; },
    normalizeBookingDate: value => value, splitSchedule: () => ({ date: '' }) });
  vm.runInContext(source.slice(begin, end), context);
  context.withBookingAvailabilitySnapshot(() => {
    for (let i = 0; i < 3000; i++) assert.equal(context.getBookingAppointmentsForDate('2026-10-05').length, 1);
    assert.equal(context.getBookingAppointmentsForDate('2026-10-06').length, 0);
  });
  assert.equal(reads, 1);
  records = [];
  context.withBookingAvailabilitySnapshot(() => assert.equal(context.getBookingAppointmentsForDate('2026-10-05').length, 0));
  assert.equal(reads, 2);
  assert.throws(() => context.withBookingAvailabilitySnapshot(() => { throw new Error('render failed'); }));
  assert.equal(context.bookingAvailabilitySnapshot, null);
});

test('availability refresh bypasses blocked write sync and uses server reservations over stale local copies', async () => {
  const source = fs.readFileSync(require.resolve('../Patient/patient.js'), 'utf8');
  const begin = source.indexOf('var bookingAvailabilitySnapshot = null;');
  const end = source.indexOf('function getAvailableDentistsForDateTime(', begin);
  let calls = 0;
  let fail = false;
  const stored = { id: 'reserved', date: '2026-10-08', time: '09:00', status: 'Approved' };
  const context = vm.createContext({
    window: {
      GmDentalSupabaseSync: { pull() { throw new Error('Write sync is blocked'); } },
      async GmDentalApiFetch(url, options) {
        calls++;
        assert.equal(url, '/api/clinic-db');
        assert.equal(options.cache, 'no-store');
        return { ok: !fail, json: async () => ({ db: { appointments: [stored] } }) };
      }
    },
    buildCanonicalAppointmentCollections: () => [{ ...stored, status: 'Cancelled' }, { id: 'local-draft', date: stored.date }],
    normalizeBookingDate: value => value, splitSchedule: () => ({ date: '' }),
    generateCalendar() {}, generateTimeSlots() {}, renderFreeConsultCalendar() {}, renderFreeConsultTimeSlots() {},
    selectedDentistObj: {}, selectedTime: '', setDentistAvailabilityHint() {}
  });
  vm.runInContext(source.slice(begin, end), context);
  assert.deepEqual(await Promise.all([context.refreshBookingReservations(), context.refreshBookingReservations()]), [true, true]);
  assert.equal(calls, 1);
  const records = context.getBookingAppointmentsForDate(stored.date);
  assert.equal(records.find(row => row.id === stored.id).status, 'Approved');
  assert.equal(records.length, 2);
  fail = true;
  assert.equal(await context.refreshBookingReservations(), false);
  assert.equal(context.getBookingAppointmentsForDate(stored.date).find(row => row.id === stored.id).status, 'Approved');
  assert.equal(context.bookingReservationsRequest, null);
});

test('October 8 consecutive reservations hide cleaning starts before noon', () => {
  const records = [
    { id: 'first', time: '09:00', service: 'Consultation' },
    { id: 'second', time: '09:20', service: 'Consultation' },
    { id: 'third', time: '09:40', service: 'Consultation + Tooth Extraction' }
  ].map(row => ({ ...row, date: '2026-10-08', status: 'Approved', dentistId: 'fallback-general-1' }));
  const occupied = patientFunction('isClinicSlotOccupied', {
    normalizeBookingDate: value => value, getBookingAppointmentsForDate: () => records,
    resolveDentistReferenceValues: value => [typeof value === 'string' ? value : value.dentistId],
    getOperationalAppointmentStatus: row => row.status, isActiveLifecycleStatus: status => status === 'Approved',
    getAppointmentTimeCandidates24: row => new Set([row.time])
  });
  for (let start = 540; start < 720; start += 5) {
    assert.equal(occupied('2026-10-08', time.clock(start), '', 'fallback-general-1', 45), true);
  }
  assert.equal(occupied('2026-10-08', '12:00 PM', '', 'fallback-general-1', 45), false);
});
