(function () {
  const byId = id => document.getElementById(id);
  const modal = byId('rescheduleModal');
  if (!modal) return;
  const dateInput = byId('newDateInput'), timeInput = byId('newTimeInput');
  const iso = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  let month = new Date();
  function appointment() {
    return getAppointmentsShared().find(a => String(a.id) === String(byId('rescheduleAppointmentId').value));
  }
  function available(date, target = appointment()) {
    if (!target || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const db = getClinicDb();
    const ids = target.dentistIds?.length ? target.dentistIds : target.dentistId ? [target.dentistId] : [];
    const dentists = (db.dentists || []).filter(d => !d.archived && (ids.length
      ? ids.some(id => String(id) === String(d.id))
      : [target.dentist, target.dentistName].includes(d.name)));
    if (!dentists.length || (ids.length && dentists.length !== new Set(ids.map(String)).size)) return [];
    return StaffAvailability.slots(date, dentists, db.appointments || [], target)
      .filter(time => GMClinicHours.allows(date, BookingTime.minutes(time), BookingTime.duration(target), window.GMClinicSettings || {}));
  }
  function times() {
    const previous = timeInput.value;
    const slots = available(dateInput.value);
    timeInput.replaceChildren(new Option(slots.length ? 'Select an available time' : 'No available times', ''));
    slots.forEach(time => timeInput.add(new Option(new Date(`2000-01-01T${time}:00`).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),time)));
    timeInput.value = slots.includes(previous) ? previous : '';
    timeInput.disabled = !slots.length;
    byId('rescheduleAvailability').textContent = slots.length ? 'Available times for all dentists assigned to this appointment.' : 'Choose a green date. Off-duty days, lunch breaks and booked times are unavailable.';
  }
  function render() {
    byId('rescheduleMonth').textContent = month.toLocaleDateString('en-US',{month:'long',year:'numeric'});
    const grid = byId('rescheduleDays'); grid.replaceChildren();
    for (let i=0;i<new Date(month.getFullYear(),month.getMonth(),1).getDay();i++) grid.append(document.createElement('span'));
    const days = new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let day=1;day<=days;day++) {
      const date = new Date(month.getFullYear(),month.getMonth(),day), value=iso(date);
      const button=document.createElement('button'); button.type='button';button.textContent=day;
      button.disabled=!available(value).length;
      button.className=value===dateInput.value?'selected':'';
      button.setAttribute('aria-label',date.toLocaleDateString('en-US',{dateStyle:'full'}));
      button.setAttribute('aria-pressed',String(value===dateInput.value));
      button.onclick=()=>{dateInput.value=value;timeInput.value='';render();};grid.append(button);
    }
    times();
  }
  byId('reschedulePrev').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);render();};
  byId('rescheduleNext').onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);render();};
  modal.addEventListener('show.bs.modal',()=>{month=new Date();dateInput.value='';timeInput.value='';render();});
  window.PatientRescheduleCalendar={available,refresh:render};
})();
