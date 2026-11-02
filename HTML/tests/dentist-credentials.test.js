const test = require('node:test');
const assert = require('node:assert/strict');
const {createDentistCredentialsHandler} = require('../api/_dentist-credentials');
async function run({role='admin',accountRole='dentist',password='Correct password',fail=false,missing=false}={}) {
  const sent=[];
  const handler=createDentistCredentialsHandler({findUser:async()=>missing?null:({email:'doctor@example.com',name:'Doctor',role:accountRole,password:'hash'}),
    verifyPassword:async(p,h)=>p==='Correct password'&&h==='hash',
    sendMail:async msg=>{if(fail)throw new Error('SMTP failure');sent.push(msg);return {accepted:[msg.to]};},
    from:'clinic@example.com',loginUrl:'https://clinic.example/login'});
  const res={code:200,status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
  await handler({user:{role},body:{email:'doctor@example.com',password}},res);
  return {res,sent};
}
test('only an admin can send credentials',async()=>{
  const {res,sent}=await run({role:'dentist'});assert.equal(res.code,403);assert.equal(sent.length,0);
});
test('sends verified credentials to the registered dentist email',async()=>{
  const {res,sent}=await run();assert.equal(res.code,200);assert.equal(sent.length,1);
  assert.equal(sent[0].to,'doctor@example.com');assert.match(sent[0].text,/Correct password/);
  assert.match(sent[0].text,/https:\/\/clinic.example\/login/);assert.ok(!JSON.stringify(res.body).includes('Correct password'));
});
test('missing accounts, other roles and incorrect passwords cannot trigger mail',async()=>{
  for(const options of [{missing:true},{accountRole:'staff'},{password:'wrong'}]) {
    const {res,sent}=await run(options);assert.ok(res.code>=400);assert.equal(sent.length,0);
  }
});
test('SMTP failure is reported without exposing credentials or deleting accounts',async()=>{
  const {res,sent}=await run({fail:true});assert.equal(res.code,503);assert.equal(sent.length,0);
  assert.match(res.body.message,/account is unchanged/);assert.ok(!JSON.stringify(res.body).includes('Correct password'));
});

