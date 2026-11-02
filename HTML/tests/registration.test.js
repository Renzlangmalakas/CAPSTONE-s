const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function registration(existing = null) {
  let handler;
  let saved;
  const source = fs.readFileSync(path.join(__dirname, '../api/_app.js'), 'utf8');
  const start = source.indexOf('app.post("/register",');
  const end = source.indexOf('\n// ==============================', start);
  vm.runInNewContext(source.slice(start, end), {
    require,
    app: { post: (_route, fn) => { handler = fn; } },
    findVerifiedUserByEmail: async () => null,
    findPendingUserByEmail: async () => existing,
    mailer: { available() {} }, bcrypt: { hash: async () => 'hashed' },
    isValidEmail: () => true, isStrongPassword: () => true,
    generateOtp: () => '123456', crypto: { randomUUID: () => 'new-user' },
    upsertPendingUser: async user => { saved = user; }, sendVerificationEmail: async () => {}, console,
  });
  return {
    async submit(changes = {}) {
      const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
      await handler({ body: { name: 'Test', email: 'test@example.test', password: 'Password1!',
        mobile: '09123456789', address: '  147 Test Street, Antipolo  ', ...changes } }, res);
      return res;
    },
    get saved() { return saved; },
  };
}

test('registration rejects invalid contact numbers and accepts at most 12 digits', async () => {
  for (const mobile of ['1234567890123', '0912abc', '+639123456789']) {
    const f = registration();
    assert.equal((await f.submit({ mobile })).code, 400);
    assert.equal(f.saved, undefined);
  }
  const f = registration();
  assert.equal((await f.submit({ mobile: '639123456789' })).code, 201);
  assert.equal(f.saved.mobile, '639123456789');
});

test('registration rejects overlong and inappropriate names before saving', async () => {
  for (const name of ['A'.repeat(31), 'Fuck Test', 'Gago Test']) {
    const f = registration();
    assert.equal((await f.submit({ name })).code, 400);
    assert.equal(f.saved, undefined);
  }
});

test('registration and resend persist the trimmed address', async () => {
  for (const existing of [null, { id: 'pending-user' }]) {
    const f = registration(existing);
    assert.equal((await f.submit()).code, existing ? 200 : 201);
    assert.equal(f.saved.address, '147 Test Street, Antipolo');
  }
  for (const address of ['', ' ', 'a'.repeat(301)]) {
    assert.equal((await registration().submit({ address })).code, 400);
  }
});
