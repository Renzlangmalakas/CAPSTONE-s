const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../Staff/staff.js'),'utf8'),c={};
vm.runInNewContext(source.slice(source.indexOf('function filterStaffBillingDates('),source.indexOf('function renderStaffAdditionalFees(')),c);
test('billing date filters use local dates and Monday-Sunday weeks across year boundaries',()=>{
 const records=['2025-12-28','2025-12-29','2026-01-01','2026-01-04','2026-01-05','2026-02-01',''].map(date=>({date}));
 const filter=(period,date='')=>Array.from(c.filterStaffBillingDates(records,period,date,new Date(2026,0,1)),r=>r.date);
 assert.deepEqual(filter('today'),['2026-01-01']);
 assert.deepEqual(filter('week'),['2025-12-29','2026-01-01','2026-01-04']);
 assert.deepEqual(filter('month'),['2026-01-01','2026-01-04','2026-01-05']);
 assert.equal(filter('year').length,4);assert.deepEqual(filter('specific','2025-12-28'),['2025-12-28']);
 assert.equal(filter('all').length,7);
});
