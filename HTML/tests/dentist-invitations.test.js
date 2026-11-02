const test=require('node:test'),assert=require('node:assert/strict');
const {createDentistInvitations}=require('../api/_dentist-invitations');
function setup() {
  let row=null, time=1000, fail=false;const messages=[];
  const handlers=createDentistInvitations({read:async()=>row,now:()=>time,
    hashPassword:async value=>'hash:'+value,
    savePending:async invite=>{row={id:invite.id,email:invite.email,role:invite.role,password:invite.password,is_verified:false,verification_token:invite.marker};return row;},
    complete:async(old,fields)=>{if(row.is_verified || row.verification_token!==old.verification_token)return null; row={...row,...fields,is_verified:true,verification_token:null};return row;},
    sendMail:async message=>{if(fail)throw Error('SMTP');messages.push(message);return {accepted:[message.to]};},from:'clinic@example.com',setupUrl:'https://example.com/setup'});
  async function call(method,body,role='admin') {const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};await handlers[method]({user:{role},body},res);return res;}
  return {call,messages,row:()=>row,expire:()=>time+=25*3600000,fail:()=>fail=true};
}
const email='new@example.com';
function completion(s) {return {email,token:s.messages.at(-1).text.match(/token=([a-f0-9]{64})/)[1],name:'New Dentist',password:'Dentist chosen password',mobile:'09123456789'};}
test('email-only invitation lets the dentist select credentials and is single use',async()=>{
  const s=setup();assert.equal((await s.call('invite',{email})).code,200);
  assert.equal(s.row().is_verified,false);const body=completion(s);
  assert.ok(!s.row().verification_token.includes(body.token));
  assert.equal((await s.call('accept',body,'')).code,200);
  assert.equal(s.row().name,'New Dentist');assert.equal(s.row().role,'dentist');
  assert.equal(s.row().password,'hash:Dentist chosen password');
  assert.equal((await s.call('accept',body,'')).code,410);
  assert.equal((await s.call('invite',{email})).code,409);
});
test('invitations require admin and reject expired or replaced tokens',async()=>{
  const s=setup();assert.equal((await s.call('invite',{email},'dentist')).code,403);
  await s.call('invite',{email});const old=completion(s);await s.call('invite',{email});
  assert.equal((await s.call('accept',old)).code,410);
  const latest=completion(s);s.expire();assert.equal((await s.call('accept',latest)).code,410);
});
test('failed email does not activate an account and invalid passwords cannot complete setup',async()=>{
  const s=setup();await s.call('invite',{email});
  assert.equal((await s.call('accept',{...completion(s),password:'short'})).code,400);
  s.fail();assert.equal((await s.call('invite',{email})).code,503);assert.equal(s.row().is_verified,false);
});
test('admin invitation button submits only the new email',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');const source=fs.readFileSync(require.resolve('../Admin/admin.js'),'utf8');
  const a=source.indexOf('async function sendDentistCredentials()'),b=source.indexOf('async function createDentistAccount',a);
  const elements={'#accUserRole':{value:'dentist'},'#accDentistEmail':{value:email,reportValidity:()=>true},'#dentistCredentialsStatus':{},'#sendDentistCredentialsBtn':{}};
  let payload;const c=vm.createContext({qs:id=>elements[id],API_BASE_URL:'',window:{GmDentalApiFetch:async(url,options)=>{payload=JSON.parse(options.body);return {ok:true,json:async()=>({message:'Invitation sent'})};}}});
  vm.runInContext(source.slice(a,b),c);await c.sendDentistCredentials();assert.deepEqual(payload,{email,role:"dentist"});
});

test('staff invitations bind the staff role and ignore a role supplied during acceptance',async()=>{
 const s=setup();assert.equal((await s.call('invite',{email,role:'staff'})).code,200);
 assert.match(s.messages[0].subject,/staff/);
 assert.equal((await s.call('invite',{email,role:'dentist'})).code,409);
 assert.equal((await s.call('accept',{...completion(s),name:'New Staff',role:'admin'})).code,200);
 assert.equal(s.row().role,'staff');
 assert.equal(s.row().name,'New Staff');
 assert.equal((await s.call('accept',completion(s))).code,410);
});
test('admin role cannot be requested through invitations',async()=>{
 const s=setup();assert.equal((await s.call('invite',{email,role:'admin'})).code,400);
 assert.equal(s.messages.length,0);
});
