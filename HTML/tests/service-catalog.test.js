const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../Shared/service-catalog');

test('service catalog includes all 17 patient services with descriptions and durations', () => {
  assert.equal(catalog.defaults.length, 17);
  assert.equal(new Set(catalog.defaults.map(row => catalog.key(row.name))).size, 17);
  assert.ok(catalog.defaults.every(row => row.description && row.chairMinutes > 0 && row.includes.length));
});
test('catalog merges aliases while preserving saved prices, IDs and archive settings', () => {
  const rows = catalog.merge([
    { id: 'old', name: 'Oral Prophylaxis', price: 1000, updatedAt: '2026-09-01' },
    { id: 'saved', name: 'Oral Prophylaxis (Teeth Cleaning)', price: 1250, updatedAt: '2026-10-01' },
    { id: 'whitening', name: 'Teeth Whitening', price: 3000 },
    { id: 'archived', name: 'Mouth   Guard', price: 6000, archived: true }
  ]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map(row => row.id), ['archived', 'saved', 'whitening']);
  const saved = rows.find(row => row.id === 'saved');
  assert.equal(saved.price, 1250);
  assert.equal(saved.chairMinutes, 45); assert.ok(saved.description);
  assert.equal(rows[2].price, 3000); assert.equal(rows[0].archived, true);
  assert.deepEqual(catalog.merge([]), []);
});
test('service import is additive and matches legacy aliases including archived entries', () => {
  const sql = require('./import-service-catalog.cjs').sql();
  assert.match(sql, /WHERE NOT EXISTS/);
  assert.match(sql, /oral prophylaxis teeth cleaning/);
  assert.match(sql, /mouth guard/);
  assert.doesNotMatch(sql, /\bDELETE\b|\bUPDATE\b/);
});

test('alphabetical ordering ignores case, handles numbers, and leaves input order untouched', () => {
 const input = [{id:'z',name:'Zirconia',price:1},{id:'b',name:'braces 10',price:2},{id:'a',name:'Braces 2',price:3},{id:'c',name:'Consultation',price:4}];
 assert.deepEqual(catalog.merge(input).map(s=>s.id), ['a','b','c','z']);
 assert.deepEqual(input.map(s=>s.id), ['z','b','a','c']);
 assert.deepEqual(catalog.defaults.map(s=>s.name), [...catalog.defaults].sort(catalog.compareNames).map(s=>s.name));
});
