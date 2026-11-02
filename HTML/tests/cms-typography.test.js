const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, typographyCss } = require('../Shared/site-content');
test('old CMS drafts retain the original typography', () => {
  const data = validate({});
  assert.equal(data.fontFamily, 'default');
  assert.equal(typographyCss(data), '');
});
test('typography survives draft validation and restores defaults', () => {
  const data = validate({ fontFamily: 'georgia', textSize: '18', headingSize: 'large' });
  assert.equal(data.fontFamily, 'georgia');
  assert.equal(data.textSize, '18');
  assert.match(typographyCss(data), /Georgia, serif/);
  assert.match(typographyCss(data), /font-size:18px/);
  assert.match(typographyCss(data), /clamp\(36px,4.5vw,64px\)/);
  assert.equal(typographyCss(validate({ ...data, fontFamily: 'default', textSize: 'default', headingSize: 'default' })), '');
});
test('typography rejects arbitrary CSS and unsupported sizes', () => {
  for (const input of [{fontFamily:'serif; color:red'}, {textSize:'100'}, {headingSize:'huge'}]) assert.throws(() => validate(input), /Choose a valid/);
  assert.equal(typographyCss({fontFamily:'serif; color:red',textSize:'100',headingSize:'huge'}), '');
});
