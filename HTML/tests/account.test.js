const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { createAccountHandlers } = require('../api/_account');

test('verified profile updates allow an optional empty phone number but reject invalid text', async () => {
  const f = await fixture('dentist');
  assert.equal((await f.call('update', { currentPassword: 'OldPassword1!', name: 'Updated Dentist', mobile: '' })).statusCode, 200);
  assert.equal(f.user.name, 'Updated Dentist');
  assert.equal((await f.call('update', { currentPassword: 'OldPassword1!', mobile: 'invalid' })).statusCode, 400);
  assert.equal((await f.call('verifyPassword', { currentPassword: 'wrong' })).statusCode, 403);
});

async function fixture(role = 'staff') {
  let user = { email: 'account@example.test', name: 'Before', mobile: '09123456789', role, password: await bcrypt.hash('OldPassword1!', 4) };
  let code;
  let emailed;
  let writes = 0;
  let time = 100000;
  let mailFails = false;
  const handlers = createAccountHandlers({
    findUser: async email => email === user.email ? { ...user } : null,
    readCode: async () => code && { ...code },
    saveCode: async (_email, next, previous) => {
      if (JSON.stringify(code || null) !== JSON.stringify(previous || null)) return false;
      code = next; return true;
    },
    commit: async (old, changes, entry) => {
      if (old.password !== user.password || (entry && JSON.stringify(entry) !== JSON.stringify(code))) return null;
      user = { ...user, ...changes, profileTitle: changes.profile_title || user.profileTitle };
      if (entry) code = null;
      writes++; return user;
    },
    sendCode: async (target, otp) => { if (mailFails) throw new Error('SMTP unavailable'); emailed = { email: target.email, otp }; },
    publicUser: ({ password, verification_token, ...safe }) => safe,
    sessions: { issue: () => 'signed-session' }, strongPassword: value => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value),
    now: () => time
  });
  return {
    async call(action, body, identity = { email: user.email, role }) {
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await handlers[action]({ user: identity, body }, res);
      return res;
    },
    get user() { return user; }, get code() { return code; }, get emailed() { return emailed; }, get writes() { return writes; },
    advance(ms) { time += ms; }, failMail() { mailFails = true; }
  };
}

test('all account types require the current password before saving details', async () => {
  for (const role of ['admin', 'staff', 'dentist', 'patient']) {
    const f = await fixture(role);
    for (const currentPassword of [undefined, 'wrong']) {
      assert.equal((await f.call('update', { name: 'After', currentPassword })).statusCode, 403);
      assert.equal(f.user.name, 'Before');
    }
    const result = await f.call('update', { name: 'After', mobile: '09987654321', currentPassword: 'OldPassword1!' });
    assert.equal(result.statusCode, 200);
    assert.equal(f.user.name, 'After');
    assert.equal(f.user.mobile, '09987654321');
    assert.equal(result.body.user.password, undefined);
  }
});

test('unlocking password fields verifies the current password without sending email or changing the account', async () => {
  for (const role of ['admin', 'staff', 'dentist', 'patient']) {
    const f = await fixture(role);
    assert.equal((await f.call('verifyPassword', {})).statusCode, 403);
    assert.equal((await f.call('verifyPassword', { currentPassword: 'wrong' })).statusCode, 403);
    const result = await f.call('verifyPassword', { currentPassword: 'OldPassword1!' });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.verified, true);
    assert.equal(f.writes, 0);
    assert.equal(f.emailed, undefined);
  }
});

test('only Admin and Staff can update display titles; nobody can self-promote', async () => {
  for (const role of ['admin', 'staff', 'dentist', 'patient']) {
    const f = await fixture(role);
    const result = await f.call('update', { currentPassword: 'OldPassword1!', profileTitle: 'Clinic Manager' });
    assert.equal(result.statusCode, ['admin', 'staff'].includes(role) ? 200 : 403);
    if (role !== 'admin') assert.equal((await f.call('update', { currentPassword: 'OldPassword1!', role: 'admin', name: 'Promoted' })).statusCode, 403);
    assert.equal(f.user.role, role);
  }
});

test('password updates require old password and a one-use emailed code', async () => {
  const f = await fixture();
  const change = { currentPassword: 'OldPassword1!', newPassword: 'NewPassword2!' };
  assert.equal((await f.call('update', change)).statusCode, 400);
  assert.equal((await f.call('requestCode', { currentPassword: 'wrong' })).statusCode, 403);
  assert.equal(f.emailed, undefined);
  assert.equal((await f.call('requestCode', change)).statusCode, 200);
  assert.equal(f.emailed.email, f.user.email);
  assert.equal((await f.call('update', { ...change, otp: f.emailed.otp, currentPassword: 'wrong' })).statusCode, 403);
  const result = await f.call('update', { ...change, otp: f.emailed.otp, name: 'After' });
  assert.equal(result.statusCode, 200);
  assert.equal(await bcrypt.compare('NewPassword2!', f.user.password), true);
  assert.equal(await bcrypt.compare('OldPassword1!', f.user.password), false);
  assert.equal(f.code, null);
  assert.equal((await f.call('update', { ...change, otp: f.emailed.otp })).statusCode, 403);
});

test('codes expire, are throttled, and lock after five wrong attempts', async () => {
  const f = await fixture();
  const body = { currentPassword: 'OldPassword1!' };
  await f.call('requestCode', body);
  assert.equal((await f.call('requestCode', body)).statusCode, 429);
  for (let i = 0; i < 5; i++) assert.equal((await f.call('update', { ...body, newPassword: 'NewPassword2!', otp: 'bad' })).statusCode, 400);
  assert.equal((await f.call('update', { ...body, newPassword: 'NewPassword2!', otp: f.emailed.otp })).statusCode, 400);
  f.advance(61000);
  await f.call('requestCode', body);
  f.advance(600001);
  assert.equal((await f.call('update', { ...body, newPassword: 'NewPassword2!', otp: f.emailed.otp })).statusCode, 400);
  assert.equal(f.writes, 0);
});

test('email failure leaves no usable code and does not change the account', async () => {
  const f = await fixture();
  f.failMail();
  assert.equal((await f.call('requestCode', { currentPassword: 'OldPassword1!' })).statusCode, 503);
  assert.equal(f.code, null);
  assert.equal(f.writes, 0);
});

test('parallel password saves cannot reuse an email code', async () => {
  const f = await fixture();
  await f.call('requestCode', { currentPassword: 'OldPassword1!' });
  const body = { currentPassword: 'OldPassword1!', newPassword: 'NewPassword2!', otp: f.emailed.otp };
  const results = await Promise.all([f.call('update', body), f.call('update', body)]);
  assert.equal(results.filter(result => result.statusCode === 200).length, 1);
  assert.equal(f.writes, 1);
});

test('session identity cannot be replaced by a form email', async () => {
  const f = await fixture();
  assert.equal((await f.call('update', { currentPassword: 'OldPassword1!', email: 'other@example.test', name: 'Other' })).statusCode, 400);
  assert.equal((await f.call('update', { currentPassword: 'OldPassword1!', name: 'Other' }, null)).statusCode, 401);
  assert.equal(f.writes, 0);
});
