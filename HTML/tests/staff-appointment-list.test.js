const test=require('node:test'); const assert=require('node:assert/strict'); const {select}=require('../Staff/appointment-list');
const records=[{id:'old',date:'2026-10-26',createdAt:'2026-10-27'},{id:'future',date:'2026-10-30',createdAt:'2026-10-27'},{id:'today',date:'2026-10-27',createdAt:'2026-10-25'},{id:'older',date:'2026-10-20'}];
test('default shows today before future visits and excludes past visits',()=>assert.deepEqual(select(records,'current','2026-10-27').map(x=>x.id),['today','future']));
test('past visits remain accessible newest date first',()=>assert.deepEqual(select(records,'past','2026-10-27').map(x=>x.id),['old','older']));
test('recently added shows newest current bookings, never past visits',()=>assert.deepEqual(select(records,'recent','2026-10-27').map(x=>x.id),['future','today']));
test('view sorting does not mutate or remove source records',()=>{select(records,'current','2026-10-27');assert.deepEqual(records.map(x=>x.id),['old','future','today','older']);});
