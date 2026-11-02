(function(root){
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
      createdAt: account?.createdAt || account?.created_at || patient.createdAt || patient.created_at || patient.dateCreated || patient.registeredAt || ''
    };
  }
  const api={enrich, cleanContact:value=>String(value||'').replace(/[^0-9]/g,'').slice(0,11)};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GMAdminPatientDetails=api;
})(typeof window!=='undefined'?window:globalThis);
