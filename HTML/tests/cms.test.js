const test = require('node:test');
const assert = require('node:assert/strict');
const { defaults, validate, withDefaults, imageFields } = require('../Shared/site-content');
const { createCmsHandlers } = require('../api/_cms');
function fixture() {
  let row = { id: 'website', draft: {}, published: {}, revision: 0, published_at: null };
  const db = { from() { let change, revision;
    return { select() { return this; }, eq(key, value) { if (key === 'revision') revision = value; return this; }, update(value) { change = value; return this; }, async maybeSingle() {
      if (change && revision !== row.revision) return { data: null };
      if (change) row = { ...row, ...change };
      return { data: structuredClone(row) };
    } };
  } };
  return { handlers: createCmsHandlers(db), row: () => row };
}
function response() { return { code: 200, status(value) { this.code = value; return this; }, set() {}, end() { return this; }, json(value) { this.body = value; return this; } }; }
const admin = { role: 'admin', email: 'admin@example.com' };
test('CMS draft stays private until published; public response excludes draft and editor identity', async () => {
  const { handlers } = fixture();
  const content = { ...defaults, heroTitle: 'Private draft' };
  let res = response(); await handlers.save({ user: admin, body: { content, revision: 0, action: 'draft' } }, res);
  assert.equal(res.code, 200);
  res = response(); await handlers.published({}, res);
  assert.equal(res.body.content.heroTitle, defaults.heroTitle);
  assert.equal(res.body.draft, undefined); assert.equal(res.body.updated_by, undefined);
  res = response(); await handlers.save({ user: admin, body: { content, revision: 1, action: 'publish' } }, res);
  assert.equal(res.code, 200);
  res = response(); await handlers.published({}, res);
  assert.equal(res.body.content.heroTitle, 'Private draft');
  assert.ok(res.body.publishedAt);
});
test('CMS rejects patient and staff changes and stale revisions', async () => {
  const { handlers, row } = fixture();
  for (const role of ['patient', 'staff']) {
    const res = response(); await handlers.save({ user: { role }, body: { content: defaults, revision: 0, action: 'publish' } }, res);
    assert.equal(res.code, 403); assert.equal(row().revision, 0);
  }
  const req = { user: admin, body: { content: {...defaults,heroTitle:'Changed heading'}, revision: 0, action: 'draft' } };
  await handlers.save(req, response());
  const res = response(); await handlers.save(req, res);
  assert.equal(res.code, 409); assert.equal(row().revision, 1);
});
test('CMS validates numbers, image formats and text limits without accepting extra fields', () => {
  assert.throws(() => validate({ ...defaults, gcashNumber: '123' }));
  assert.throws(() => validate({ ...defaults, gcashQr: 'data:image/svg+xml;base64,AAAA' }));
  assert.throws(() => validate({ ...defaults, gcashQr: 'https://untrusted.example/qr.png' }));
  assert.throws(() => validate({ ...defaults, heroTitle: 'x'.repeat(161) }));
  assert.equal(validate({ ...defaults, arbitrary: 'extra' }).arbitrary, undefined);
  assert.equal(validate({ ...defaults, gcashQr: 'data:image/png;base64,AAAA' }).gcashQr, 'data:image/png;base64,AAAA');
});
test('CMS reports unavailable storage without pretending to save', async () => {
  const res = response(); await createCmsHandlers(null).save({ user: admin, body: { content: defaults, revision: 0, action: 'draft' } }, res);
  assert.equal(res.code, 503);
});

test('CMS uses existing text and landing pictures as defaults without replacing saved edits', () => {
  assert.equal(withDefaults({ heroTitle: '', aboutText: null }).heroTitle, defaults.heroTitle);
  assert.equal(withDefaults({ heroTitle: 'Saved heading' }).heroTitle, 'Saved heading');
  const fs = require('node:fs');
  const html = fs.readFileSync(require.resolve('../Landing/landing.html'), 'utf8');
  const paths = [...html.matchAll(/<img src="\.\.\/Images\/([^\"]+)"/g)].map(match => `/Images/${match[1]}`);
  assert.ok(paths.length > 10);
  for (const path of paths) {
    assert.equal(defaults.images[path], path);
    assert.ok(imageFields[path]);
  }
  assert.deepEqual(validate({ ...defaults, images: undefined }).images, defaults.images);
});

test('CMS validates landing uploads and keeps image drafts private until published', async () => {
  const path = '/Images/logo.jpg', image = 'data:image/webp;base64,AAAA';
  for (const invalid of ['javascript:alert(1)', 'https://example.com/image.png', 'data:image/svg+xml;base64,AAAA', 'x'.repeat(400001)]) {
    assert.throws(() => validate({ ...defaults, images: { [path]: invalid } }));
  }
  const { handlers } = fixture();
  const content = { ...defaults, images: { [path]: image } };
  let res = response(); await handlers.save({ user: admin, body: { content, revision: 0, action: 'draft' } }, res);
  assert.equal(res.code, 200);
  res = response(); await handlers.published({}, res); assert.equal(res.body.content.images[path], path);
  res = response(); await handlers.save({ user: admin, body: { content, revision: 1, action: 'publish' } }, res);
  assert.equal(res.code, 200);
  res = response(); await handlers.published({}, res); assert.equal(res.body.content.images[path], image);
  assert.equal(res.body.content.images['/Images/consultation.jpg'], '/Images/consultation.jpg');
});

test('new service photo keys survive draft/publish and reject unsafe images', async () => {
  const { serviceImageKey } = require('../Shared/site-content');
  assert.equal(serviceImageKey({ id: 'new-service-123', name: 'New treatment' }), 'service:new-service-123');
  assert.equal(serviceImageKey({ id: 'existing', name: 'Consultation' }), '/Images/consultation.jpg');
  const key = 'service:new-service-123';
  const photo = 'data:image/webp;base64,AAAA';
  const content = { ...defaults, images: { ...defaults.images, [key]: photo } };
  assert.equal(validate(content).images[key], photo);
  for (const value of ['https://example.com/image.jpg', 'data:image/svg+xml;base64,AAAA', 'x'.repeat(400001)]) {
    assert.throws(() => validate({ ...content, images: { [key]: value } }));
  }
  const { handlers } = fixture();
  await handlers.save({ user: admin, body: { content, revision: 0, action: 'draft' } }, response());
  let res = response(); await handlers.published({}, res); assert.equal(res.body.content.images[key], undefined);
  await handlers.save({ user: admin, body: { content, revision: 1, action: 'publish' } }, response());
  res = response(); await handlers.published({}, res); assert.equal(res.body.content.images[key], photo);
});

test('unchanged CMS draft returns 304 without revision increment',async()=>{const {handlers,row}=fixture();const res=response();await handlers.save({user:admin,body:{content:defaults,revision:0,action:'draft'}},res);assert.equal(res.code,304);assert.equal(row().revision,0);});
