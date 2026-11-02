(function () {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clinic = () => GMDefaultAccounts.normalizeDb(JSON.parse(localStorage.getItem('gm_dental_db_v1') || '{}'));
  function open() {
    if (document.querySelector('.gm-patient-create')) return;
    const user = JSON.parse(sessionStorage.getItem('gm_dental_current_user') || '{}');
    const role = document.body.dataset.portalRole;
    const patientId = crypto.randomUUID(), appointmentId = crypto.randomUUID();
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const catalog = (clinic().services || []).filter(s => !s.archived && s.active !== false);
    const dialog = document.createElement('dialog'); dialog.className = 'gm-patient-create';
    dialog.setAttribute('aria-labelledby','patientCreateTitle');
    const origin = document.activeElement;
    dialog.innerHTML = `<form><header><div><h2 id="patientCreateTitle">Add Patient & Appointment</h2><p>Save the patient record and first appointment together. New patient logins use the entered email and password patient123. Existing passwords stay unchanged.</p></div><button type="button" data-close aria-label="Close">&times;</button></header><div class="pc-body"><div class="pc-fields">
      <label>Full name<input name="name" autocomplete="name" maxlength="150" required></label>
      <label>Age<input name="age" inputmode="numeric" maxlength="3" pattern="([0-9]|[1-9][0-9]|1[01][0-9]|120)" title="Enter an age from 0 to 120" required></label>
      <label>Contact number<input name="contact" type="tel" inputmode="numeric" autocomplete="tel" maxlength="12" pattern="(09[0-9]{9}|639[0-9]{9})" placeholder="09123456789 or 639123456789" required></label>
      <label>Email<input name="email" type="email" autocomplete="email" maxlength="160" required></label>
      <label>Gender<select name="gender" required><option value="">Select gender</option><option>Male</option><option>Female</option></select></label>
      <label>Address<input name="address" autocomplete="street-address" maxlength="400" required></label>
      <label class="pc-wide">Medical notes / dental concern<textarea name="condition" rows="3" maxlength="1000" placeholder="Relevant conditions and notes, or None" required></textarea></label>
      </div><fieldset class="pc-services"><legend>Services</legend>${catalog.map((s,i)=>`<label><input type="checkbox" value="${i}"><span>${esc(s.name)}<small>PHP ${Number(s.price || 0).toFixed(2)}</small></span></label>`).join('')}</fieldset>
      <div class="pc-fields"><label>Appointment date<input name="date" type="date" min="${today}" value="${today}" required></label>
      <label>Dentist<select name="dentistId" required disabled></select></label>
      <label>Available time<select name="time" required disabled></select></label><p class="pc-hint" role="status"></p></div>
      <p class="pc-error" role="alert"></p></div><footer><button type="button" data-close>Cancel</button><button type="submit" class="pc-save">Save Patient & Appointment</button></footer></form>`;
    document.body.append(dialog); dialog.showModal();
    const form = dialog.querySelector('form'), field = name => form.elements.namedItem(name), error = dialog.querySelector('.pc-error');
    const selected = () => [...dialog.querySelectorAll('.pc-services input:checked')].map(el=>catalog[Number(el.value)]);
    function slots(d, db) {
      const appointment = {id:appointmentId,services:selected().map(s=>({serviceName:s.name,price:s.price}))};
      if (!field('date').value) return [];
      return StaffAvailability.slots(field('date').value,[d],[...(db.appointments || []),...(db.archivedAppointments || [])],appointment)
        .filter(t=>GMClinicHours.allows(field('date').value,BookingTime.minutes(t),BookingTime.duration(appointment),window.GMClinicSettings || {}));
    }
    function renderTimes() {
      const db=clinic(), d=(db.dentists || []).find(d=>String(d.id)===field('dentistId').value), old=field('time').value;
      const times=d?slots(d,db):[];
      field('time').innerHTML='<option value="">Select a time</option>'+times.map(t=>`<option value="${t}">${t}</option>`).join('');
      field('time').value=times.includes(old)?old:'';field('time').disabled=!times.length;
    }
    function renderDentists() {
      const db=clinic(), services=selected(), old=field('dentistId').value;
      const dentists=(db.dentists || []).filter(d=>!d.archived && d.active!==false && services.length &&
        (role!=='dentist' || String(d.email || '').toLowerCase()===String(user.email || '').toLowerCase()) &&
        services.every(s=>GMDentistServices.canPerform(d,s.name)) && slots(d,db).length);
      field('dentistId').innerHTML='<option value="">'+(!services.length?'Select services first':dentists.length?'Select a dentist':'No available dentist for this date')+'</option>'+dentists.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('');
      field('dentistId').disabled=!dentists.length;
      field('dentistId').value=dentists.some(d=>String(d.id)===old)?old:dentists.length===1?String(dentists[0].id):'';
      dialog.querySelector('.pc-hint').textContent='Only qualified dentists with enough available time on the selected date are listed.';
      renderTimes();
    }
    for (const [name,invalid] of [['name',/[^\p{L}\p{M} .'\u2019-]/gu],['age',/[^0-9]/g],['contact',/[^0-9]/g]]) {
      const input=field(name); const clean=()=>{input.value=input.value.replace(invalid,'');};
      input.addEventListener('input',e=>{if(!e.isComposing)clean();});input.addEventListener('compositionend',clean);
    }
    dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());
    dialog.addEventListener('close',()=>{dialog.remove();origin?.focus();},{once:true});
    dialog.querySelector('.pc-services').onchange=renderDentists;field('date').onchange=renderDentists;field('dentistId').onchange=renderTimes;
    let saving=false, saved=false;
    dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
    form.onsubmit=async e=>{
      e.preventDefault();if(saving || !form.reportValidity())return;
      error.textContent='';
      if(!selected().length || !field('dentistId').value || !field('time').value){error.textContent='Select services, an available dentist, and a time.';return;}
      saving=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
      const button=dialog.querySelector('.pc-save');button.textContent=saved?'Refreshing records...':'Saving...';button.setAttribute('aria-busy','true');
      try {
        if(!saved){
          const patient={id:patientId};for(const name of ['name','age','contact','email','gender','address','condition'])patient[name]=field(name).value.trim();
          const response=await GmDentalApiFetch(`${window.GmDentalSupabaseSync?.apiBaseUrl || ''}/api/patients-with-appointment`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient,appointment:{id:appointmentId,date:field('date').value,time:field('time').value,dentistId:field('dentistId').value,services:selected().map(s=>({id:s.id}))}})});
          const result=await response.json();if(!response.ok)throw new Error(result.message || 'Could not save patient.');saved=true;
          dialog.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);
        }
        const synced=await window.GmDentalSupabaseSync?.pull?.({force:true});
        if(synced!==true)throw new Error('Patient and appointment saved. Refreshing the list failed; click Refresh Records to retry.');
        dialog.close();window.showToast?.('Patient record and appointment created.','success');
      }catch(err){error.textContent=err.message;}
      finally {saving=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);button.textContent=saved?'Refresh Records':'Save Patient & Appointment';button.removeAttribute('aria-busy');}
    };
    renderDentists();
  }
  window.GMPatientCreation={open};
})();
