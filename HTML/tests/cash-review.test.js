const test = require('node:test');
const assert = require('node:assert/strict');
const { createCashReviewHandler } = require('../api/_cash-payments');

function fixture({ role = 'staff', fail = false, conflict = false } = {}) {
  const state = { writes: 0, row: { id: 'bill', updated_at: '2026-10-02T06:00:00Z', data: {
    id: 'bill', status: 'Completed', price: 500, totalCollected: 0, remainingBalance: 500,
    services: [{ serviceName: 'Consultation', price: 500, totalPaid: 0 }],
    paymentProofs: [{ id: 'cash', method: 'cash', status: 'pending', amount: 500, balanceAtSubmission: 500,
      allocations: [{ serviceIndex: 0, serviceName: 'Consultation', amount: 500, paymentMode: 'full' }] }]
  } } };
  const supabase = { from(table) {
    assert.equal(table, 'clinic_appointments');
    let update;
    const filters = {};
    return { select() { return this; }, eq(k, v) { filters[k] = v; return this; },
      update(value) { update = value; return this; }, async maybeSingle() {
        if (!update) return { data: structuredClone(state.row) };
        if (fail) return { error: { message: 'Save failed' } };
        if (conflict || filters.updated_at !== state.row.updated_at) return { data: null };
        state.writes++; state.row = { ...state.row, ...update };
        return { data: structuredClone(state.row) };
      } };
  } };
  const handler = createCashReviewHandler({ supabase });
  const req = { user: { role, email: 'reviewer@example.com' }, body: {
    collection: 'appointments', recordId: 'bill', proofId: 'cash', action: 'approve', confirmed: true
  } };
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, end(){return this;}, json(body) { this.body = body; return this; } });
  return { state, handler, req, response };
}

test('cash approval persists once, credits the bill, and preserves completed visit status', async () => {
  const f = fixture(); const res = f.response();
  await f.handler(f.req, res);
  assert.equal(res.code, 200);
  assert.equal(f.state.row.data.paymentProofs[0].status, 'verified');
  assert.equal(f.state.row.data.totalCollected, 500);
  assert.equal(f.state.row.data.remainingBalance, 0);
  assert.equal(f.state.row.data.status, 'Completed');
  await f.handler(f.req, f.response());
  assert.equal(f.state.writes, 1);
});

test('concurrent reviewers cannot credit the same payment twice', async () => {
  const f = fixture(); const responses = [f.response(), f.response()];
  await Promise.all(responses.map(res => f.handler(f.req, res)));
  assert.deepEqual(responses.map(res => res.code).sort(), [200, 409]);
  assert.equal(f.state.writes, 1);
  assert.equal(f.state.row.data.totalCollected, 500);
});

test('cash review fails without changing the payment on save error or stale bill', async () => {
  for (const options of [{ fail: true }, { conflict: true }]) {
    const f = fixture(options); const res = f.response();
    await f.handler(f.req, res);
    assert.equal(res.code, options.fail ? 500 : 409);
    assert.equal(f.state.row.data.paymentProofs[0].status, 'pending');
    assert.equal(f.state.row.data.totalCollected, 0);
  }
});

test('cash review checks staff role and cash confirmation; rejection does not credit money', async () => {
  for (const role of ['patient', 'dentist']) {
    const f = fixture({ role }); const res = f.response(); await f.handler(f.req, res);
    assert.equal(res.code, 403); assert.equal(f.state.writes, 0);
  }
  const f = fixture({ role: 'staff' }); const res = f.response();
  f.req.body.confirmed = false; await f.handler(f.req, res); assert.equal(res.code, 400);
  f.req.body.action = 'reject'; f.req.body.reason = 'Cash not received';
  const rejected = f.response();
  await f.handler(f.req, rejected);
  assert.equal(rejected.code, 200);
  assert.equal(f.state.row.data.paymentProofs[0].status, 'rejected');
  assert.equal(f.state.row.data.totalCollected, 0);
});

test('payment approval card stays on failure and disappears only after the server saves', async () => {
  const fs = require('node:fs'), vm = require('node:vm');
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; }
    setAttribute() {}
    addEventListener(event, fn) { this.listeners[event] = fn; }
    querySelectorAll(tag) { return this.children.flatMap(child => [ ...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag) ]); }
  }
  const host = new Element('section'), f = fixture();
  let local = JSON.stringify({ appointments: [f.state.row.data] }), render, fail = true, requests = 0;
  const context = {
    console, Intl, Date, Set,
    localStorage: { getItem: () => local, setItem: (_, value) => { local = value; } },
    sessionStorage: { getItem: () => JSON.stringify({ role: 'staff', email: 'staff@example.com' }) },
    document: { createElement: tag => new Element(tag), getElementById: () => host, addEventListener: (_, fn) => { render = fn; } },
    StorageEvent: class {},
    window: { addEventListener() {}, dispatchEvent() {}, GmDentalSupabaseSync: { apiBaseUrl: '' },
      async GmDentalApiFetch(url, options) {
        requests++;
        assert.equal(url, '/api/payments/cash-review');
        assert.equal(JSON.parse(options.body).confirmed, true);
        if (fail) return { ok: false, json: async () => ({ message: 'Server save failed' }) };
        const res = f.response(); await f.handler(f.req, res);
        return { ok: true, json: async () => res.body };
      } }
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../Shared/receipt-review'), 'utf8'), context);
  render();
  const approve = host.querySelectorAll('button').find(button => button.textContent === 'Approve');
  await approve.listeners.click();
  assert.equal(requests, 0);
  host.querySelectorAll('input')[0].checked = true;
  await approve.listeners.click();
  assert.equal(JSON.parse(local).appointments[0].paymentProofs[0].status, 'pending');
  assert.equal(host.querySelectorAll('article').length, 1);
  assert.ok(host.querySelectorAll('p').some(item => item.textContent === 'Server save failed'));
  fail = false;
  await approve.listeners.click();
  assert.equal(JSON.parse(local).appointments[0].totalCollected, 500);
  assert.equal(host.querySelectorAll('article').length, 0);
  assert.ok(host.querySelectorAll('p').some(item => item.textContent === 'No payments awaiting approval.'));
});
