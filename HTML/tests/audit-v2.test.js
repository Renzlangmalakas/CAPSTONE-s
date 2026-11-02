const test=require('node:test'),assert=require('node:assert/strict');
const audit=require('../api/_audit-v2'),access=require('../Shared/patient-access');
function run({status=200,method='PUT',path='/api/clinic-db',events=[],payload={},user={id:'u',email:'u@example.com',role:'staff'}}={}){
 const inserts=[];const db={from:()=>({insert:async row=>{inserts.push(row);return {};},select:()=>({eq:()=>({limit:async()=>({data:events})})})})};
 return new Promise(resolve=>{const req={method,path,headers:{'user-agent':'Browser'},socket:{remoteAddress:'127.0.0.1'},user,body:{},params:{}};
 const res={statusCode:status,status(n){this.statusCode=n;return this;},json(body){resolve({status:this.statusCode,body,inserts});return this;},end(){resolve({status:this.statusCode,inserts});}};
 audit.middleware(db,()=>user)(req,res,()=>res.json(payload));});
}
test('unchanged writes return 304 and create no audit event',async()=>{const r=await run();assert.equal(r.status,304);assert.equal(r.inserts.length,0);});
test('committed changes return success without duplicate request-level events',async()=>{const r=await run({events:[{id:1}],payload:{saved:true}});assert.equal(r.status,200);assert.equal(r.inserts.length,0);});
test('denied attempts retain actor, device, reason and security flag',async()=>{const r=await run({status:403,user:{id:'p',email:'patient@example.com',role:'patient'},payload:{message:'Patients cannot change prices.'}});assert.equal(r.inserts[0].outcome,'Denied');assert.equal(r.inserts[0].security_event,true);assert.equal(r.inserts[0].error_reason,'Patients cannot change prices.');assert.equal(r.inserts[0].actor_id,'p');assert.equal(r.inserts[0].user_agent,'Browser');assert.match(r.inserts[0].created_at,/Z$/);});
test('background snapshot reads do not fabricate user view events',async()=>{const r=await run({method:'GET',payload:{db:{patients:[{id:'p1'}]}}});assert.equal(r.inserts.length,0);});
test('CSV retains long values, escapes quotes, and neutralizes formulas',()=>{const full='a'.repeat(10000)+'"';assert.equal(audit.csvCell(full),'"'+full.replace(/"/g,'""')+'"');assert.equal(audit.csvCell('=1+1'),'"\'=1+1"');});
const db={appointments:[{id:'a',patientEmail:'me@test',patientId:'p1',price:500},{id:'b',patientEmail:'other@test',patientId:'p2',price:800}],patients:[{id:'p1'},{id:'p2'}],patientClinicalNotes:[{id:'n1',patientKey:'p1'},{id:'n2',patientKey:'p2'}]};
test('patient scope excludes other patients and clinical notes',()=>{const scoped=access.scope(db,{email:'me@test'});assert.deepEqual(scoped.appointments.map(r=>r.id),['a']);assert.deepEqual(scoped.patientClinicalNotes.map(r=>r.id),['n1']);});
test('patient cannot inject another appointment or change prices',()=>{assert.throws(()=>access.writable({appointments:[db.appointments[1]]},db,{email:'me@test'}),{status:403});assert.throws(()=>access.writable({appointments:[{...db.appointments[0],price:1}]},db,{email:'me@test'}),{status:403});assert.throws(()=>access.writable({services:[{id:1,price:1}]},db,{email:'me@test'}),{status:403});});
test('a patient can submit an unchanged own snapshot',()=>{const user={email:'me@test'};assert.doesNotThrow(()=>access.writable(access.scope(db,user),db,user));});
test('CSV exports beyond one page and applies every requested filter',async()=>{
 const ranges=[],filters=[];const db={from:()=>{const q={select(){return q;},order(){return q;},gte(k,v){filters.push([k,v]);return q;},lt(k,v){filters.push([k,v]);return q;},eq(k,v){filters.push([k,v]);return q;},async range(a,b){ranges.push([a,b]);return {data:Array.from({length:a===0?1000:1},(_,i)=>({actor_email:'user@example.com',action:'Updated Service Price',resource:String(a+i),before_state:{price:100},after_state:{price:200}}))};}};return q;}};
 const res={set(){},send(body){this.body=body;},status(){return this;},json(body){throw Error(JSON.stringify(body));}};
 await audit.listHandler(db)({user:{role:'admin'},query:{export:'csv',from:'2026-01-01',to:'2026-12-31',user:'user@example.com',role:'staff',action:'Updated Service Price',outcome:'Success'}},res);
 assert.deepEqual(ranges,[[0,999],[1000,1999]]);assert.equal(res.body.split('\r\n').length,1002);assert.ok(filters.some(([k,v])=>k==='actor_role'&&v==='staff'));assert.ok(filters.some(([k])=>k==='created_at'));assert.match(res.body,/before_state/);assert.match(res.body,/1000/);
});
test('concurrent request contexts keep audit identity isolated',async()=>{
 const original=global.fetch,captured=[];global.fetch=async(_url,opts)=>{captured.push(JSON.parse(Buffer.from(opts.headers.get('x-clinic-audit-context'),'base64').toString()));return {};};
 try{await Promise.all(['a','b'].map(email=>audit.storage.run({req:{user:{email,role:'staff'}},meta:{requestId:email}},async()=>{await Promise.resolve();await audit.contextualFetch('https://example.invalid');})));assert.deepEqual(captured.map(x=>x.email).sort(),['a','b']);assert.ok(captured.every(x=>x.email===x.requestId));}finally{global.fetch=original;}
});
