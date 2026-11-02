const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function dashboard() {
  const source = fs.readFileSync(path.join(__dirname, '../Patient/patient.js'), 'utf8');
  const elements = { totalVisitsCount: {}, upcomingAppointmentsCount: {} };
  const state = { appointments: [], plans: [] };
  const context = vm.createContext({
    Date,
    document: { getElementById: id => elements[id] },
    getPatientAppointmentsShared: ({ includeArchived }) => state.appointments.filter(a =>
      includeArchived || (!a.archived && !a.archivedForPatient)),
    getActiveTreatmentCaseRecordsForPatient: () => state.plans,
    toTitleCaseLabel: value => value,
  });
  for (const name of ['normalizeAppointmentLifecycleStatus', 'isActiveLifecycleStatus',
    'parseAppointmentDateTime', 'getUpcomingPatientAppointments', 'getNextUpcomingAppointment',
    'renderPatientDashboardStats']) {
    const start = source.indexOf(`function ${name}(`);
    const end = source.indexOf('\nfunction ', start + 1);
    vm.runInContext(source.slice(start, end), context);
  }
  return { state, elements, context };
}

test('visit count updates on completion and retains archived completed visits', () => {
  const { state, elements, context } = dashboard();
  context.renderPatientDashboardStats();
  assert.equal(elements.totalVisitsCount.textContent, '0');
  state.appointments = [
    { status: 'Approved' }, { status: 'Cancelled' }, { status: 'Rejected' },
    { status: 'Completed' },
    { status: 'Archived', visitStatus: 'Archived', statusBeforeArchive: 'Completed', archivedForPatient: true },
    { status: 'Archived', statusBeforeArchive: 'Cancelled', archivedForPatient: true },
  ];
  context.renderPatientDashboardStats();
  assert.equal(elements.totalVisitsCount.textContent, '2');
  state.appointments[0].status = 'Completed';
  context.renderPatientDashboardStats();
  assert.equal(elements.totalVisitsCount.textContent, '3');
});

test('upcoming records exclude past, closed, archived and invalid appointments and duplicate plan sessions', () => {
  const { state, elements, context } = dashboard();
  state.appointments = [
    { service: 'Cleaning', status: 'Approved', schedule: '2000-01-01 • 09:00' },
    { service: 'Cleaning', status: 'Approved', schedule: '2099-01-01 • 09:00', treatmentId: 'plan-1' },
    { service: 'Cleaning', status: 'Completed', schedule: '2099-01-02 • 09:00' },
    { service: 'Cleaning', status: 'Cancelled', schedule: '2099-01-02 • 09:00' },
    { service: 'Cleaning', status: 'Approved', schedule: '2099-01-02 • 09:00', archivedForPatient: true },
    { service: 'Cleaning', status: 'Approved', schedule: 'invalid' },
  ];
  state.plans = [{ recordType: 'treatment_plan', treatmentId: 'plan-1', service: 'Cleaning', schedule: '2099-01-01 • 09:00' }];
  context.renderPatientDashboardStats();
  assert.equal(elements.upcomingAppointmentsCount.textContent, '1');
  assert.equal(context.getNextUpcomingAppointment().schedule, '2099-01-01 • 09:00');
  state.appointments = [state.appointments[0]];
  state.plans = [];
  context.renderPatientDashboardStats();
  assert.equal(elements.upcomingAppointmentsCount.textContent, '0');
  assert.equal(context.getNextUpcomingAppointment(), null);
});
