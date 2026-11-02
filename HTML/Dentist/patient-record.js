/* Patient records use the existing shared clinical-note collection. */
let dentalRecordState = null;
let dentalRecordOpener = null;

function openDentalRecord(encodedKey, encodedName) {
  const key = decodeURIComponent(encodedKey);
  const appointments = getMyAppointments().filter(apt => getPatientClinicalKey(apt) === key);
  if (!appointments.length) { showToast('This patient is not in your appointment records.'); return; }
  dentalRecordOpener = document.activeElement;
  const db = ensureClinicDbShape(getClinicDb());
  const profile = db.patients.find(p => String(p.id || '').toLowerCase() === key || getPatientClinicalKey(p) === key) || {};
  dentalRecordState = { key, name: decodeURIComponent(encodedName), appointments, profile: { ...appointments[0], ...profile }, tooth: '', dentition: 'adult' };
  document.getElementById('dentalRecordModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'dentalRecordModal';
  modal.className = 'dental-record-overlay';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'dentalRecordTitle');
  modal.innerHTML = `<div class="dental-record-panel">
    <header><div><small>PATIENT RECORD</small><h2 id="dentalRecordTitle">${escapeHtml(dentalRecordState.name)}</h2></div><button type="button" aria-label="Close patient record" onclick="closeDentalRecord()">×</button></header>
    <div class="dental-record-info" id="dentalRecordInfo"></div>
    <div class="dental-record-layout"><aside>
      <div class="dental-record-toolbar"><h3>Odontogram</h3><select aria-label="Dentition" id="recordDentition"><option value="adult">Permanent teeth</option><option value="child">Primary teeth</option></select></div>
      <p>Select a tooth to view its records.</p><div id="dentalChart" class="dental-chart"></div>
      <div class="dental-legend"><span>● Completed</span><span>● Pending</span></div>
      <button type="button" class="btn-glass" id="allDentalRecords">View all records</button>
    </aside><main>
      <div class="dental-record-toolbar"><h3 id="recordHistoryTitle">Treatment history</h3><button type="button" class="btn-gradient" id="newDentalEntry">Add record</button></div>
      <form id="dentalRecordForm" hidden>
        <h4>New treatment record</h4><div class="dental-fields">
        <label>Tooth<select id="recordTooth" required></select></label>
        <label>Date<input id="recordDate" type="date" required></label>
        <label>Condition<select id="recordCondition" required><option value="">Select condition</option>${['Tooth decay / Caries', 'Broken / Fractured tooth', 'Chipped tooth', 'Missing tooth', 'Tooth sensitivity', 'Gingivitis', 'Periodontitis', 'Dental abscess', 'Impacted tooth', 'Plaque / Calculus buildup', 'Tooth discoloration', 'Malocclusion', 'Healthy / No findings', 'Other'].map(condition => `<option value="${condition}">${condition}</option>`).join('')}</select><input id="recordConditionOther" maxlength="200" placeholder="Specify condition" aria-label="Other condition" hidden></label>
        <label>Treatment<input id="recordTreatment" maxlength="200" required placeholder="Enter treatment"></label>
        <label>Status<select id="recordStatus"><option>Pending</option><option>Completed</option></select></label>
        <label>Appointment<select id="recordAppointment"><option value="">Not linked</option>${appointments.map((a, i) => `<option value="${i}">${escapeHtml(a.date || a.schedule || '')} · ${escapeHtml(a.service || 'Appointment')}</option>`).join('')}</select></label>
        <label>Before treatment<textarea id="recordBefore" maxlength="4000" rows="3"></textarea></label>
        <label>After treatment<textarea id="recordAfter" maxlength="4000" rows="3"></textarea></label>
        </div><div class="dental-form-actions"><button type="button" class="btn-glass" id="cancelDentalEntry">Cancel</button><button class="btn-gradient" type="submit">Save record</button></div>
      </form><div id="dentalRecordHistory"></div>
      <details class="dental-appointments"><summary>Appointment history (${appointments.length})</summary>${appointments.map(a => `<article><strong>${escapeHtml(a.service || 'Appointment')}</strong><p>${escapeHtml(a.schedule || a.date || '')} · ${escapeHtml(a.status || '')}</p></article>`).join('')}</details>
    </main></div></div>`;
  document.body.appendChild(modal);
  const refreshRecordCalendar = setupRecordCalendar(document.getElementById('recordDate'));
  const p = dentalRecordState.profile;
  document.getElementById('dentalRecordInfo').innerHTML = Object.entries({
    Email: p.email || p.patientEmail, Phone: p.phone || p.contact || p.patientPhone,
    Age: p.age, Gender: p.gender, Address: p.address || p.patientAddress
  }).map(([label, value]) => `<div><small>${label}</small><strong>${escapeHtml(String(value ?? 'Not recorded'))}</strong></div>`).join('');
  document.getElementById('recordDentition').onchange = event => { dentalRecordState.dentition = event.target.value; dentalRecordState.tooth = ''; renderDentalRecord(); };
  document.getElementById('allDentalRecords').onclick = () => { dentalRecordState.tooth = ''; renderDentalRecord(); };
  document.getElementById('newDentalEntry').onclick = () => {
    const form = document.getElementById('dentalRecordForm'); form.reset(); form.hidden = false;
    document.getElementById('recordConditionOther').hidden = true;
    document.getElementById('recordConditionOther').required = false;
    document.getElementById('recordTooth').value = dentalRecordState.tooth || '';
    const now = new Date(); document.getElementById('recordDate').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    refreshRecordCalendar();
    document.getElementById('recordCondition').focus();
  };
  document.getElementById('cancelDentalEntry').onclick = () => { document.getElementById('dentalRecordForm').hidden = true; };
  document.getElementById('recordCondition').onchange = event => {
    const other = document.getElementById('recordConditionOther');
    other.hidden = event.target.value !== 'Other';
    other.required = !other.hidden;
    if (!other.hidden) other.focus();
  };
  document.getElementById('dentalRecordForm').onsubmit = saveDentalRecord;
  modal.onclick = event => { if (event.target === modal) closeDentalRecord(); };
  modal.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeDentalRecord();
    if (event.key !== 'Tab') return;
    const controls = [...modal.querySelectorAll('button,input,select,textarea,summary')].filter(e => e.getClientRects().length);
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  renderDentalRecord();
  modal.querySelector('header button').focus();
}

function dentalToothNumbers(dentition) {
  const quadrants = dentition === 'child' ? [5,6,7,8] : [1,2,3,4];
  const count = dentition === 'child' ? 5 : 8;
  return quadrants.flatMap(q => Array.from({ length: count }, (_, i) => q * 10 + i + 1));
}

function renderDentalRecord() {
  const state = dentalRecordState;
  if (!state) return;
  const notes = getPatientNotesForKey(state.key);
  const numbers = dentalToothNumbers(state.dentition);
  const count = numbers.length / 4;
  const top = [...numbers.slice(0,count).reverse(), ...numbers.slice(count,count*2)];
  const bottom = [...numbers.slice(count*3).reverse(), ...numbers.slice(count*2,count*3)];
  const tooth = (number, i, lower) => {
    const angle = Math.PI * i / (count*2-1);
    const x = 150 - 110*Math.cos(angle), y = lower ? 260 + 160*Math.sin(angle) : 200 - 160*Math.sin(angle);
    const labelX = -26*Math.cos(angle), labelY = (lower ? 1 : -1)*27*Math.sin(angle);
    const records = notes.filter(n => String(n.tooth) === String(number));
    const status = records[0]?.treatmentStatus || '';
    return `<button type="button" class="dental-tooth ${status === 'Completed' ? 'done' : status === 'Pending' ? 'pending' : ''}" style="left:${x/3}%;top:${y/4.6}%;--number-x:${labelX}px;--number-y:${labelY}px" data-tooth="${number}" aria-label="Tooth ${number}${status ? ', '+status : ''}" aria-pressed="${String(state.tooth) === String(number)}"><span>${number}</span><svg viewBox="0 0 32 38" aria-hidden="true"><path d="M5 4 Q10 0 16 4 Q23 0 27 5 Q32 13 26 22 L23 34 Q20 40 17 24 Q15 21 13 28 Q10 41 7 32 L4 21 Q0 10 5 4Z"/></svg></button>`;
  };
  document.getElementById('dentalChart').innerHTML = `<span class="dental-chart-label">Upper</span>${top.map((n,i)=>tooth(n,i,false)).join('')}${bottom.map((n,i)=>tooth(n,i,true)).join('')}<span class="dental-chart-label lower">Lower</span>`;
  document.querySelectorAll('[data-tooth]').forEach(button => { button.onclick = () => { state.tooth = button.dataset.tooth; renderDentalRecord(); }; });
  document.getElementById('recordTooth').innerHTML = '<option value="">General / whole mouth</option>'+numbers.map(n=>`<option value="${n}">Tooth ${n}</option>`).join('');
  document.getElementById('recordTooth').required = false;
  document.getElementById('recordTooth').value = state.tooth;
  document.getElementById('recordHistoryTitle').textContent = state.tooth ? `Tooth ${state.tooth} · Treatment history` : 'Treatment history';
  const visible = state.tooth ? notes.filter(n => String(n.tooth) === String(state.tooth)) : notes;
  document.getElementById('dentalRecordHistory').innerHTML = visible.length ? visible.map(n => `<article class="dental-entry"><div class="dental-record-toolbar"><strong>${escapeHtml(n.treatment || 'Clinical finding')}</strong><span class="dental-status ${n.treatmentStatus === 'Completed' ? 'done' : ''}">${escapeHtml(n.treatmentStatus || 'Note')}</span></div><small>${escapeHtml(n.recordDate || formatClinicalNoteDate(n.createdAt))} · ${escapeHtml(n.createdBy)}${n.tooth ? ' · Tooth '+escapeHtml(String(n.tooth)) : ''}</small>${n.condition ? `<p><b>Condition:</b> ${escapeHtml(n.condition)}</p>` : ''}${n.before ? `<p><b>Before treatment:</b> ${escapeHtml(n.before)}</p>` : ''}${n.after ? `<p><b>After treatment:</b> ${escapeHtml(n.after)}</p>` : ''}${!n.treatment ? `<p>${escapeHtml(n.text)}</p>` : ''}</article>`).join('') : '<div class="dental-empty">No records yet. Add a treatment record or select another tooth.</div>';
}

async function saveDentalRecord(event) {
  event.preventDefault();
  if (!dentalRecordState) return;
  const read = id => document.getElementById(id).value.trim();
  const condition = read('recordCondition') === 'Other' ? read('recordConditionOther') : read('recordCondition'), treatment = read('recordTreatment');
  if (!condition || !treatment) { showToast('Enter a condition and treatment.'); return; }
  const appointmentIndex = read('recordAppointment');
  const note = { id: createDentistEntityId('note'), patientKey: dentalRecordState.key, patientName: dentalRecordState.name,
    tooth: read('recordTooth'), condition, treatment, treatmentStatus: read('recordStatus'), recordDate: read('recordDate'),
    before: read('recordBefore'), after: read('recordAfter'),
    appointmentId: appointmentIndex === '' ? '' : dentalRecordState.appointments[Number(appointmentIndex)]?.id || '',
    dentistId: currentDentistUser?.id || '', dentistEmail: currentDentistUser?.email || '',
    text: `${treatment}: ${condition}`, createdAt: new Date().toISOString(),
    createdBy: currentDentistUser?.fullName || currentDentistUser?.name || 'Dentist' };
  const form = document.getElementById('dentalRecordForm');
  const button = form.querySelector('button[type="submit"]');
  if (button.disabled) return;
  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    savePatientClinicalNotes([note, ...getPatientClinicalNotes()]);
    const synced = await window.GmDentalSupabaseSync?.flushNow?.();
    if (!synced) {
      showToast('Record saved on this device, but server sync failed. Reconnect before refreshing.');
      return;
    }
    form.hidden = true;
  dentalRecordState.tooth = note.tooth;
  renderDentalRecord(); renderPatients();
  showToast('Patient record saved.');
  } catch (error) { showToast(error.message || 'Could not save the treatment record.'); }
  finally { button.disabled = false; button.textContent = 'Save record'; }
}

function closeDentalRecord() {
  document.getElementById('dentalRecordModal')?.remove();
  dentalRecordState = null;
  dentalRecordOpener?.focus();
}
