const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function fixture(env = {}) {
 const source = fs.readFileSync(require.resolve('../api/_app'), 'utf8');
 const start = source.indexOf('app.post("/api/patient-chat"');
 const end = source.indexOf('// SCHEDULED APPOINTMENT REMINDERS', start);
 let handler, request;
 vm.runInNewContext(source.slice(start,end), {app:{post:(_,fn)=>handler=fn},process:{env},AbortSignal,console,
 fetch:async (url,options)=>{request={url,options};return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'Select a service to start booking.'}]}}]})}}});
 return {async call(message){const res={statusCode:200,status(code){this.statusCode=code;return this},json(body){this.body=body;return this}};await handler({body:{message}},res);return res},request:()=>request};
}
test('chat uses the replacement model and returns a provider reply',async()=>{
 const f=fixture({GEMINI_API_KEY:'test-key'});const res=await f.call('How do I book?');
 assert.equal(res.statusCode,200);assert.match(res.body.reply,/service/);
 assert.match(f.request().url,/gemini-3\.1-flash-lite:generateContent$/);
 assert.ok(f.request().options.signal);
});
test('chat supports a configured model and validates input before calling provider',async()=>{
 const f=fixture({GEMINI_MODEL:'test-model'});await f.call('Hello');assert.match(f.request().url,/test-model:generateContent$/);
 for(const message of ['',null,{},'x'.repeat(2001)]){const invalid=fixture();assert.equal((await invalid.call(message)).statusCode,400);assert.equal(invalid.request(),undefined)}
});
