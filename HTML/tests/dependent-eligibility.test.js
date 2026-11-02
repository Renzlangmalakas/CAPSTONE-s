const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require.resolve('../Patient/patient.js'),'utf8');
test('dependent panel prompts before dentist selection and exposes only eligible services',()=>{
 const nodes={};const node=id=>nodes[id]||=( {value:'',innerHTML:'',disabled:false,classList:{add(){}},focus(){}} );
 const ctx={document:{getElementById:node},selectedDentistObj:null,editingDependentIndex:-1,bookingDependents:[],services:[{name:'Consultation'},{name:'Root Canal Treatment'}],dentistCanPerformService:require('../Shared/dentist-services').canPerform,escapeHtml:String,formatBillingCurrency:()=>'',BookingTime:require('../Shared/booking-time')};
 vm.runInNewContext(source.slice(source.indexOf('function addDependent('),source.indexOf('function closeDependentModal(')),ctx);
 ctx.addDependent();assert.match(node('dependentServicesList').innerHTML,/Select dentist first to see eligible services/);assert.ok(node('saveDependentButton').disabled);
 ctx.selectedDentistObj={specialty:'General Dentist'};ctx.addDependent();assert.match(node('dependentServicesList').innerHTML,/Consultation/);assert.doesNotMatch(node('dependentServicesList').innerHTML,/Root Canal/);assert.equal(node('saveDependentButton').disabled,false);
});
