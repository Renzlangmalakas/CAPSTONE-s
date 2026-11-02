const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../api/_app'),'utf8');
function handler(context){const start=source.indexOf("app.post('/api/clinical-notes'");const end=source.indexOf("\napp.get('/api/patient-db'",start);context.app={post:(_path,fn)=>{context.handler=fn;}};vm.runInNewContext(source.slice(start,end),context);return context.handler;}
function fixture(){let writes=[];const tables={appointments:[{id:'appt',patientId:'patient',dentistId:'dentist'}],archivedAppointments:[],dentists:[{id:'dentist',email:'dentist@example.com'}]};
const context={clinicTableMap:Object.fromEntries(Object.keys(tables).map(k=>[k,{table:k}])),readJsonTable:async table=>tables[table],require:name=>name.includes('sync-records')?require('../api/_sync-records'):require('../Shared/dentist-access'),supabase:{from:table=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})}),upsert:row=>{writes.push({table,row});return {select:()=>({single:async()=>({data:{data:row.data}})})};}})}};
const response={statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};
return {context,writes,response,run:handler(context)};}
test('tooth save writes one clinical note, without full snapshot sync',async()=>{const f=fixture();await f.run({user:{id:'dentist',email:'dentist@example.com',role:'dentist'},body:{note:{id:'note-1',patientKey:'patient',recordDate:'2026-11-02',condition:'Healthy',treatment:'Review',dentistId:'dentist',appointmentId:'appt'}}},f.response);assert.equal(f.response.statusCode,200);assert.equal(f.writes.length,1);assert.equal(f.writes[0].table,'clinic_patient_clinical_notes');assert.equal(f.response.body.note.id,'note-1');});
test('tooth save rejects another dentist patient without writing',async()=>{const f=fixture();await f.run({user:{id:'other',email:'other@example.com',role:'dentist'},body:{note:{id:'note-1',patientKey:'patient',recordDate:'2026-11-02',condition:'Healthy',treatment:'Review'}}},f.response);assert.equal(f.response.statusCode,403);assert.equal(f.writes.length,0);});
test('tooth save denies non-dentists',async()=>{const f=fixture();await f.run({user:{role:'patient'},body:{}},f.response);assert.equal(f.response.statusCode,403);assert.equal(f.writes.length,0);});

test('targeted save uses exact appointment keys, supports separate account and roster IDs, and skips full snapshots',async()=>{
 const f=fixture();const queries=[];f.context.readJsonTable=()=>{throw Error('No full-table reads');};
 f.context.supabase.from=table=>({select:()=>({eq:(field,value)=>{
 queries.push([table,field,value]);const data=table==='dentists'?[{id:'roster',email:'dentist@example.com'}]:table==='appointments'?{data:{id:'appt',patientId:'patient',dentistId:'roster'}}:null;
 return {then(resolve){return Promise.resolve({data}).then(resolve);},maybeSingle:async()=>({data})};
 }}),upsert:row=>{f.writes.push(row);return {select:()=>({single:async()=>({data:{data:row.data}})})};}});
 await f.run({user:{id:'account',name:'Dr Test',email:'dentist@example.com',role:'dentist'},body:{authorizationAppointmentId:'appt',note:{id:'note-fast',patientKey:'patient',recordDate:'2026-11-02',condition:'Healthy',treatment:'Review',dentistId:'account',appointmentId:'appt',before:'Before details',after:'After details',recordDate:'2026-11-02'}}},f.response);
 assert.equal(f.response.statusCode,200);assert.equal(f.writes.length,1);assert.equal(f.response.body.note.before,'Before details');assert.equal(f.response.body.note.after,'After details');assert.equal(f.response.locals.auditChanged,true);assert.ok(queries.filter(x=>x[0].includes('Appointments')||x[0]==='appointments').every(x=>x[1]==='id'&&x[2]==='appt'));
});

test('invalid dates are rejected before any database write',async()=>{const f=fixture();await f.run({user:{role:'dentist'},body:{note:{id:'invalid',patientKey:'p',condition:'Healthy',treatment:'Review',recordDate:'2026-02-30'}}},f.response);assert.equal(f.response.statusCode,400);assert.match(f.response.body.message,/date/);assert.equal(f.writes.length,0);});
