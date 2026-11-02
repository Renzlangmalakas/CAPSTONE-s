const test=require('node:test'),assert=require('node:assert/strict'),{validate}=require('../Shared/name-validation');
test('names respect 30-character maximum without rejecting ordinary surname substrings',()=>{
 assert.equal(validate('A'.repeat(30)),'');assert.match(validate('A'.repeat(31)),/30/);
 for(const name of ['Maria Reyes','Juan Dela Cruz',"Anne O'Connor",'Dickson Santos','Cassie Cruz']) assert.equal(validate(name),'');
});
test('expanded word list and multiword phrases are rejected case-insensitively',()=>{
 for(const name of ['Gagi','kupalin','puchangina','katarantaduhan','bwakanangina','tarantadong','motherfucking','assclown','fuckgirl','Pak You','Walang Hiya','Buwaka ng Ina','Animal Ka','Demonyo Ka','Son Of A Gun','Screw This','Suck It','Up Yours','Juan screw-off','hayop-ka']) assert.match(validate(name),/inappropriate/,name);
 for(const name of ['Cassie Cruz','Dickson Santos','Michelle Reyes','Brigitte Santos','Ashleigh Cruz']) assert.equal(validate(name),'',name);
});
test('common English and Tagalog profanity and obfuscation are blocked',()=>{
 for(const name of ['Fuck Test','GAGO Cruz','Putang Ina','T4nga Test','f u c k','Shit Test']) assert.match(validate(name),/inappropriate/);
});

test('numbers are rejected while international names and punctuation are accepted',()=>{
 for(const name of ['Juan123','123','Maria \uff12','Jose \u0663','Ana \u00b2']) assert.match(validate(name),/numbers/);
 for(const name of ['Jos\u00e9 Reyes','Mar\u00eda-Jos\u00e9 Cruz',"Anne O\u2019Connor",'\u674e\u660e']) assert.equal(validate(name),'');
});
