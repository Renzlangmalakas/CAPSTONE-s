const test = require('node:test');
const assert = require('node:assert/strict');
const { pageInfo } = require('../Shared/table-pagination');

test('pagination covers every record once including a partial final page', () => {
  const seen = [];
  for (let page = 1; page <= 3; page++) {
    const info = pageInfo(23, page, 10);
    assert.equal(info.pages, 3);
    for (let index = info.start; index < info.end; index++) seen.push(index);
  }
  assert.deepEqual(seen, Array.from({ length: 23 }, (_, i) => i));
});
test('empty and shrinking filtered tables clamp to a valid page', () => {
  assert.deepEqual(pageInfo(0, 5, 10), { page: 1, pages: 1, start: 0, end: 0 });
  assert.deepEqual(pageInfo(12, 5, 10), { page: 2, pages: 2, start: 10, end: 12 });
  assert.deepEqual(pageInfo(23, 1, 25), { page: 1, pages: 1, start: 0, end: 23 });
});
