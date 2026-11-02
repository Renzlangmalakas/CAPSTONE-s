const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const roster=require('../Shared/default-accounts');
const source=fs.readFileSync(require.resolve('../Dentist/dentist_page.js'),'utf8');
test('all dentist accounts refresh their complete schedule after clinic sync',()=>{
 const dentists=roster.merge([],'dentist');
 for(const dentist of dentists){
  const field={value:'old single day'};
  const db={dentists,dentistSchedules:[]};
  const context={document:{getElementById:()=>field},getClinicDb:()=>db,currentDentistUser:{email:dentist.email},window:{GMDefaultAccounts:roster},GMDefaultAccounts:roster};
  vm.runInNewContext(source.slice(source.indexOf('function formatDentistProfileSchedule('),source.indexOf('function loadDentistProfile()')),context);
  context.refreshDentistProfileSchedule();
  assert.equal(field.value.split('\n').length,dentist.name.includes('Imelda')?4:2);
  assert.equal(field.readOnly,true);
  db.dentistSchedules=[{dentistId:dentist.id,day:'Tuesday',start:'10:00',end:'16:00'}];
  context.refreshDentistProfileSchedule();
  assert.equal(field.value,'Tuesday: 10:00 AM - 4:00 PM');
 }
});
