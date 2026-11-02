(function(root){
  const present = value => value !== null && value !== undefined && String(value).trim() !== '' && !['—','-','Not recorded'].includes(String(value).trim());
  function ageFromDob(value, today = new Date()) {
    const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return '';
    const [year,month,day] = match.slice(1).map(Number);
    const born = new Date(year,month-1,day);
    if (born.getFullYear() !== year || born.getMonth() !== month-1 || born.getDate() !== day || born > today) return '';
    const age = today.getFullYear()-year - (today.getMonth()+1<month || today.getMonth()+1===month && today.getDate()<day ? 1 : 0);
    return age >= 0 && age <= 120 ? age : '';
  }
  function enrich(patient, accounts) {
    const rows=(accounts||[]).filter(a=>a.role==='patient');
    const norm=v=>String(v||'').trim().toLowerCase();
    const ids=[patient.id,patient.userId,patient.user_id,patient.accountId].filter(Boolean).map(String);
    let matches=rows.filter(a=>ids.includes(String(a.id)));
    if(!matches.length&&patient.email) matches=rows.filter(a=>norm(a.email)===norm(patient.email));
    if(!matches.length&&!patient.email) matches=rows.filter(a=>norm(a.name)===norm(patient.name));
    const account=matches.length===1?matches[0]:null;
    return {...patient,
      email: account?.email || patient.email || '',
      contact: patient.contact || patient.phone || patient.mobile || account?.contact || account?.mobile || '',
      age: present(patient.age) ? patient.age : ageFromDob(patient.dob || account?.dob),
      gender: patient.gender || patient.sex || account?.gender || account?.sex || '',
      address: patient.address || account?.address || '',
      createdAt: account?.createdAt || account?.created_at || patient.createdAt || patient.created_at || patient.dateCreated || patient.registeredAt || ''
    };
  }
  function view(patient, profiles = [], appointments = [], accounts = []) {
    const norm = v => String(v || '').trim().toLowerCase();
    const related = row => Boolean(patient.id) && [row.id,row.patientId].some(id => norm(id) === norm(patient.id))
      || Boolean(patient.email) && norm(row.email || row.patientEmail) === norm(patient.email);
    const result = {...patient};
    const sources = [...profiles.filter(related), ...appointments.filter(related)];
    for (const [field,aliases] of Object.entries({age:['age','patientAge'],gender:['gender','sex','patientGender'],address:['address','patientAddress'],contact:['contact','phone','mobile','patientPhone'],dob:['dob','dateOfBirth']})) {
      if (present(result[field])) continue;
      result[field] = '';
      for (const row of [patient,...sources]) {
        const value = aliases.map(key => row[key]).find(present);
        if (present(value)) { result[field] = value; break; }
      }
    }
    return enrich(result,accounts);
  }
  const api={enrich, view, ageFromDob, cleanContact:value=>String(value||'').replace(/[^0-9]/g,'').slice(0,11)};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GMAdminPatientDetails=api;
})(typeof window!=='undefined'?window:globalThis);
