const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
test('database startup failure rejects requests and waits before retrying', async () => {
 const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
 const start = source.indexOf('function ensureBootstrapped()');
 const end = source.indexOf('\nif (require.main', start);
 let calls = 0, now = 0;
 const context = {bootstrapPromise:null,bootstrapRetryAt:0,Date:{now:()=>now},console:{error(){}},bootstrap:async()=>{calls++;throw Error('unavailable');}};
 vm.runInNewContext(source.slice(start,end),context);
 assert.equal(await context.ensureBootstrapped(),false);
 assert.equal(await context.ensureBootstrapped(),false);
 assert.equal(calls,1);
 now=60001;
 assert.equal(await context.ensureBootstrapped(),false);
 assert.equal(calls,2);
});
