const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createMailer } = require('../api/_mailer');

test('SMTP auth failure stops queued attempts and allows recovery after cooldown', async () => {
  let calls = 0, time = 0;
  const mailer = createMailer({ async sendMail() { calls++; if (calls === 1) throw Object.assign(new Error('blocked'), { code: 'EAUTH', responseCode: 454 }); return 'sent'; } }, { now: () => time, cooldownMs: 1000 });
  const results = await Promise.allSettled([mailer.sendMail({}), mailer.sendMail({}), mailer.sendMail({})]);
  assert.equal(calls, 1);
  assert.ok(results.every(r => r.status === 'rejected'));
  assert.equal(results[1].reason.code, 'EMAIL_COOLDOWN');
  assert.throws(() => mailer.available(), { code: 'EMAIL_COOLDOWN' });
  time = 1001;
  assert.equal(await mailer.sendMail({}), 'sent');
  assert.equal(calls, 2);
});

test('clinic snapshot writes succeed without calling any email reminder service', async () => {
  const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
  const start = source.indexOf('async function handleClinicDbWrite(');
  const end = source.indexOf('\napp.post("/api/appointments/:id/manage"', start);
  let written;
  const context = { require:name=>require('../api/'+name.replace('./','')),readClinicDbFromSupabase:async()=>({appointments:[{id:'fixture'}]}), clinicTableMap: { appointments: {} }, notificationTargets: [], requireSupabase: () => true, requireServiceRoleKey: () => true,
    processAppointmentEmailReminders: () => { throw new Error('SMTP must not run during sync'); },
    writeClinicDbToSupabase: async db => { written = db; }, console,
    isSupabaseRlsError: () => false, isMissingSupabaseTable: () => false };
  vm.runInNewContext(source.slice(start, end), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const db = { appointments: [{ id: 'fixture' }] };
  await context.handleClinicDbWrite({ user: { role: "staff" }, body: { db } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(written, db);
});
