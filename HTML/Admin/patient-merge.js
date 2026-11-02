/* Admin-only account recovery. The server independently enforces every permission. */
(() => {
  'use strict';
  const button = document.getElementById('mergeAccountsBtn');
  if (!button) return;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const labels = { profiles:'Original patient profiles (retained as history)', clinic_appointments:'Appointments (including billing and uploads)', clinic_archived_appointments:'Archived appointments', clinic_patient_clinical_notes:'Medical / tooth records', clinic_treatment_plans:'Treatment plans', clinic_reschedule_requests:'Reschedule requests', appointments:'Legacy appointments', payments:'Payment records', treatment_logs:'Visit / treatment logs', notifications:'Account notifications' };
  const dialog = document.createElement('dialog');
  dialog.className = 'patient-merge-dialog';
  document.body.appendChild(dialog);
  let accounts = [], preview = null, busy = false;
  const get = id => dialog.querySelector(`#${id}`);
  const api = async (path, body) => {
    const response = await window.GmDentalApiFetch(`${API_BASE_URL}/api/admin/${path}`, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {cache:'no-store'});
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Unable to complete this request.');
    return data;
  };
  function error(message) { const el=get('mergeMessage'); el.textContent=message; el.className='merge-error'; }
  function reset() { preview=null; get('mergePreview').replaceChildren(); get('mergeMessage').textContent=''; }
  function populate(side) {
    const term=get(`${side}Search`).value.trim().toLowerCase(), select=get(`${side}Account`), selected=select.value;
    const rows=accounts.filter(a=>[a.name,a.email,a.mobile,a.id,...(a.patientIds||[])].join(' ').toLowerCase().includes(term));
    select.innerHTML='<option value="">Select patient account</option>'+rows.map(a=>`<option value="${escape(a.id)}">${escape(a.name)} — ${escape(a.email)}${a.archived?' (Archived)':''}</option>`).join('');
    if(rows.some(a=>a.id===selected)) select.value=selected;
    reset();
  }
  function renderPreview(data) {
    preview=data;
    const card=(title,a)=>`<section class="merge-summary"><h3>${title}</h3><strong>${escape(a.name)}</strong><p>${escape(a.email)}</p><small>ID: ${escape(a.id)}<br>Created: ${escape(a.createdAt ? new Date(a.createdAt).toLocaleString() : 'Not recorded')}</small></section>`;
    get('mergePreview').innerHTML=`<div class="merge-columns">${card('Source (Old)',data.source)}${card('Destination (New)',data.destination)}</div>
      <h3>Records to transfer</h3><dl class="merge-counts">${Object.entries(data.counts).map(([k,v])=>`<div><dt>${escape(labels[k]||k)}</dt><dd>${v}</dd></div>`).join('')}</dl>
      <p>Record IDs, medical notes, payment evidence and attachments are preserved. The replacement account keeps its name, email, password and contact number. Original profile details are retained in the merge history.</p>
      ${data.conflicts.length ? `<div class="merge-error" role="alert"><strong>Review required</strong><ul>${data.conflicts.map(c=>`<li>${escape(c)}</li>`).join('')}</ul></div>` : `
      ${data.upcoming ? `<label class="merge-check"><input id="mergeUpcoming" type="checkbox"> Move ${data.upcoming} active/upcoming appointment(s) to the new account?</label>`:''}
      <label class="merge-check"><input id="mergeConfirm" type="checkbox"> This will transfer all history from ${escape(data.source.name)} (${escape(data.source.email)}) to ${escape(data.destination.name)} (${escape(data.destination.email)}). The old account will be archived and cannot be used to log in. Proceed?</label>
      <button id="mergeExecute" class="btn danger" type="button" disabled>Confirm account history transfer</button>`}`;
    const execute=get('mergeExecute');
    if(!execute)return;
    const ready=()=>{execute.disabled=!get('mergeConfirm').checked || (data.upcoming>0&&!get('mergeUpcoming').checked);};
    get('mergeConfirm').addEventListener('change',ready); get('mergeUpcoming')?.addEventListener('change',ready);
    execute.addEventListener('click', async()=>{
      if(busy||execute.disabled)return;
      busy=true; execute.disabled=true; execute.textContent='Transferring history…';
      dialog.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
      try {
        if(window.GmDentalSupabaseSync?.flushNow && !await window.GmDentalSupabaseSync.flushNow()) throw new Error('Finish syncing your pending changes before merging. No transfer was submitted.');
        const result=await api('patient-merge/confirm',{sourceId:data.source.id,destinationId:data.destination.id,fingerprint:data.fingerprint,confirmed:true,moveUpcoming:!!get('mergeUpcoming')?.checked});
        get('mergePreview').innerHTML=`<section class="merge-summary" role="status"><h3>Account history transferred</h3><p>${escape(data.source.email)} is archived. All transferred records now belong to ${escape(data.destination.email)}.</p><button id="mergeViewNew" class="btn primary" type="button">View new account</button></section>`;
        get('mergeViewNew').onclick=()=>{
          dialog.close();
          openViewModal('History transferred successfully',`${card('Active replacement account',data.destination)}<p>Transferred history is linked to patient ID ${escape(result.patientId)}.</p><p>Original account: ${escape(data.source.email)} — Archived</p>`);
        };
        // Refresh authoritative account badges without treating cached profiles as new accounts.
        Promise.resolve().then(async()=>{
          await window.GmDentalSupabaseSync?.pull({force:true});
          if(typeof syncAccountsFromDatabase==='function') await syncAccountsFromDatabase({skipClinicMirror:true});
        }).catch(()=>{ /* A refresh failure must not misreport a committed merge as failed. */ });
        get('mergeViewNew').click();
      } catch(e) { error(e.message); resetAfterFailure(); }
      finally {busy=false; get('mergeClose').disabled=false;}
    });
  }
  function resetAfterFailure(){
    preview=null; get('mergePreview').replaceChildren();
    dialog.querySelectorAll('input,select,button').forEach(el=>el.disabled=false);
  }
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  button.addEventListener('click', async()=>{
    if(busy)return;
    preview=null;
    dialog.innerHTML=`<header><div><h2>Merge patient accounts</h2><p>Recover history into a replacement patient account.</p></div><button id="mergeClose" class="btn secondary" aria-label="Close merge accounts" type="button">✕</button></header>
      <div class="merge-body"><div class="merge-columns">${['source','destination'].map((side,i)=>`<section><label for="${side}Search">${i?'Destination (New)':'Source (Old)'}</label><input id="${side}Search" class="input" type="search" placeholder="Search name, email, contact or ID"><label class="sr-only" for="${side}Account">Select ${side} account</label><select id="${side}Account" class="input"><option>Loading accounts…</option></select></section>`).join('')}</div>
      <button id="mergeReview" class="btn primary" type="button" disabled>Preview transfer</button><p id="mergeMessage" role="alert"></p><div id="mergePreview"></div></div>`;
    get('mergeClose').onclick=()=>{if(!busy)dialog.close();}; dialog.showModal();
    try {
      const data=await api('users');
      accounts=data.users.filter(a=>a.role==='patient'&&a.is_verified&&!a.archived&&!a.merged_into);
      for(const side of ['source','destination']){
        populate(side); get(`${side}Search`).oninput=()=>populate(side); get(`${side}Account`).onchange=reset;
      }
      get('mergeReview').disabled=false;
      get('mergeReview').onclick=async()=>{
        if(busy)return;
        const sourceId=get('sourceAccount').value,destinationId=get('destinationAccount').value;
        if(!sourceId||!destinationId||sourceId===destinationId)return error('Select two different patient accounts.');
        reset(); busy=true;
        dialog.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);
        try {
          if(window.GmDentalSupabaseSync?.flushNow && !await window.GmDentalSupabaseSync.flushNow()) throw new Error('Finish syncing your pending changes before previewing this transfer.');
          renderPreview(await api('patient-merge/preview',{sourceId,destinationId}));
        }
        catch(e){error(e.message);}
        finally {busy=false; dialog.querySelectorAll('input,select,button').forEach(el=>{if(el.id!=='mergeExecute')el.disabled=false;});}
      };
    } catch(e){error(e.message);}
  });
})();
