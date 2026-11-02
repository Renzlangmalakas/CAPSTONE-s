(function(root){
 const norm=v=>String(v||'').trim().toLowerCase();
 const list=v=>Array.isArray(v)?v:[];
 function own(row,user){return Boolean(user.email)&&[row.patientEmail,row.email,row.userEmail,row.ownerEmail].some(v=>norm(v)===norm(user.email)) || Boolean(user.id)&&[row.userId,row.accountId].some(v=>v&&String(v)===String(user.id));}
 function scope(db,user){
  const appointments=list(db.appointments).filter(a=>own(a,user)),archived=list(db.archivedAppointments).filter(a=>own(a,user));
  const ids=new Set([...appointments,...archived].map(a=>String(a.id))),patients=new Set([user.email,...appointments.map(a=>a.patientId),...archived.map(a=>a.patientId)].filter(Boolean).map(String));
  const linked=r=>own(r,user)||r.appointmentId&&ids.has(String(r.appointmentId))||r.patientId&&patients.has(String(r.patientId))||r.patientKey&&patients.has(String(r.patientKey));
  return {appointments,archivedAppointments:archived,patients:list(db.patients).filter(r=>own(r,user)||patients.has(String(r.id))),patientClinicalNotes:list(db.patientClinicalNotes).filter(linked),treatmentPlans:list(db.treatmentPlans).filter(linked),rescheduleRequests:list(db.rescheduleRequests).filter(linked),payments:list(db.payments).filter(linked),history:list(db.history).filter(linked),services:list(db.services),additionalFees:list(db.additionalFees),dentists:list(db.dentists).map(({id,name,email,specialty,schedules,archived})=>({id,name,email,specialty,schedules,archived})),dentistSchedules:list(db.dentistSchedules),staff:[],notifications:{admin:[],staff:[],dentist:[],patient:list(db.notifications?.patient).filter(linked)}};
 }
 function writable(incoming,db,user){
  const before=scope(db,user),out={};const denied=()=>{const e=Error('Patients can only update their own permitted records and cannot change clinic pricing, clinical findings, or settings.');e.status=403;throw e;};
  const clean=v=>{if(Array.isArray(v))return v.map(clean);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).filter(([k])=>!['updatedAt','updated_at','createdAt','created_at'].includes(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,clean(v)]));return v;};const same=(a,b)=>JSON.stringify(clean(a))===JSON.stringify(clean(b));
  for(const [key,rows] of Object.entries(incoming)){
   if(key==='notifications')continue;
   if(!Array.isArray(rows))denied();
   if(!['appointments','archivedAppointments','treatmentPlans','rescheduleRequests'].includes(key)){
    if(!same(rows,before[key]||[]))denied();continue;
   }
   out[key]=rows.map(row=>{
    const old=list(before[key]).find(r=>String(r.id)===String(row.id));
    if(!old){
      if(key==='treatmentPlans'){
       const appointment=before.appointments.find(a=>a.treatmentId && String(a.treatmentId)===String(row.treatmentId||row.id));
       const price=appointment&&(list(appointment.services).find(s=>s.isLongTermTreatment)?.price||appointment.price);
       if(!appointment||!own(row,user)||Number(row.totalCost)!==Number(price)||Number(row.amountPaid||0)!==0||list(row.sessions).length)denied();
      }else if(key!=='rescheduleRequests'||!before.appointments.some(a=>String(a.id)===String(row.appointmentId)))denied();
      return row;
    }
    if(!own(old,user)&&!before[key].includes(old))denied();
    for(const field of ['patientId','patientKey','patientEmail','email','userId','dentistId','dentistIds','dentistEmail','price','total','totalCost','serviceTotal','additionalFees','additionalFeesTotal','discount','archived','archivedForPatient','archivedForDentist','deletedAt'])if(!same(row[field],old[field]))denied();
    if(key==='appointments'||key==='archivedAppointments'){
     const prices=x=>list(x.services).map(s=>({id:s.id,name:s.serviceName||s.name,price:s.price,duration:s.durationMinutes}));if(!same(prices(row),prices(old)))denied();
    }
    return row;
   });
  }
  out.notifications={admin:[],staff:[],dentist:[],patient:[]};
  const ownedIds=new Set([...before.appointments,...before.archivedAppointments].map(a=>String(a.id)));
  for(const target of ['admin','staff','dentist','patient'])for(const row of list(incoming.notifications?.[target])){
   if(!ownedIds.has(String(row.appointmentId))&&!own(row,user))denied();
   out.notifications[target].push(row);
  }
  return out;
 }
 const api={scope,writable,own};if(typeof module==='object'&&module.exports)module.exports=api;else root.GMPatientAccess=api;
})(typeof globalThis==='object'?globalThis:this);
