const time = require('../Shared/booking-time');
const eligibility = require('../Shared/dentist-services');
function patientDetails(input = {}) {
  const p = {id:String(input.id || ''),name:String(input.name || '').trim(),contact:String(input.contact || '').trim(),email:String(input.email || '').trim().toLowerCase(),age:Number(input.age),gender:String(input.gender || '').trim(),address:String(input.address || '').trim(),condition:String(input.condition || '').trim()};
  if (!/^[0-9a-f-]{36}$/i.test(p.id) || !p.name || (!/^[\p{L}\p{M} .'\u2019-]+$/u.test(p.name) || !/\p{L}/u.test(p.name)) || p.name.length > 150) throw new Error('Enter a valid full name without numbers.');
  if (!/^(09\d{9}|639\d{9})$/.test(p.contact)) throw new Error('Enter an 11-digit mobile number starting with 09, or 639 followed by 9 digits (numbers only).');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw new Error('Enter a valid patient email.');
  if (!/^\d{1,3}$/.test(String(input.age ?? '')) || !Number.isInteger(p.age) || p.age < 0 || p.age > 120) throw new Error('Enter an age from 0 to 120.');
  if (!['Male','Female'].includes(p.gender) || !p.address || !p.condition) throw new Error('Complete the gender, address, and condition fields (use None if applicable).');
  return p;
}
function walkInAppointment(input, patient, db) {
  const dentist = db.dentists.find(d=>String(d.id)===String(input.dentistId) && !d.archived);
  const selected = (input.services || []).map(line=>db.services.find(s=>String(s.id)===String(line.id) && !s.archived && s.active!==false));
  if (!dentist || !selected.length || selected.some(s=>!s || !eligibility.canPerform(dentist,s.name))) throw new Error('Select services and a qualified dentist.');
  const services=selected.map(s=>({serviceName:s.name,price:Number(s.price)||0,totalPaid:0}));
  const total=services.reduce((sum,s)=>sum+s.price,0);
  return {id:String(input.id),patientId:patient.id,patient:patient.name,patientName:patient.name,patientEmail:patient.email,patientPhone:patient.contact,patientAddress:patient.address,age:patient.age,gender:patient.gender,patientCondition:patient.condition,
    dentist:dentist.name,dentistName:dentist.name,dentistEmail:dentist.email||'',dentistId:dentist.id,dentistIds:[dentist.id],services,service:services.map(s=>s.serviceName).join(' + '),date:input.date,time:input.time,status:'Approved',lifecycleStatus:'Approved',paymentStatus:'Unpaid',total,price:total,serviceTotal:total,paid:0,totalCollected:0,walkIn:true,durationMinutes:time.duration({services})};
}
module.exports={patientDetails,walkInAppointment};
