(function () {
  let context, bound = false;
  const byId = id => document.getElementById(id);
  const el = (tag, text, className) => { const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node; };
  const label = minutes => `${Math.floor(minutes / 60) % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${minutes < 720 ? 'AM' : 'PM'}`;
  function render(value) {
    context = value || context;
    const grid = byId('dentistScheduleGrid');
    if (!grid || !context) return;
    const date = byId('scheduleDate'), filter = byId('scheduleDentist');
    if (!date.value) date.value = context.today;
    const dentists = (context.db.dentists || []).filter(d => !d.archived);
    const previous = filter.value;
    filter.replaceChildren(new Option('All dentists', ''), ...dentists.map(d => new Option(d.name, String(d.id))));
    if (dentists.some(d => String(d.id) === previous)) filter.value = previous;
    const shown = dentists.filter(d => !filter.value || String(d.id) === filter.value);
    const appointments = context.appointments.filter(a => a.date === date.value && !/cancel|reject|declin/i.test(a.status || ''));
    byId('scheduleSummary').textContent = `${appointments.filter(a => !filter.value || assigned(a, shown[0])).length} appointment(s) on ${date.value}`;
    grid.replaceChildren();
    if (!shown.length) { grid.append(el('p', 'No dentists available.')); return; }
    grid.style.gridTemplateColumns = `86px repeat(${shown.length}, minmax(230px, 1fr))`;
    const axis = el('div', '', 'schedule-axis'); axis.append(el('div', 'PHT', 'schedule-doctor-heading'));
    const hours = el('div', '', 'schedule-day');
    for (let minute = 540; minute < 1020; minute += 30) { const mark = el('span', label(minute), 'schedule-hour'); mark.style.top = `${(minute - 540) * 2}px`; hours.append(mark); }
    axis.append(hours); grid.append(axis);
    const weekday = new Date(date.value + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    for (const dentist of shown) {
      const column = el('div', '', 'schedule-doctor');
      const records = appointments.filter(a => assigned(a, dentist)).sort((a,b) => BookingTime.minutes(a.time) - BookingTime.minutes(b.time));
      const heading = el('div', '', 'schedule-doctor-heading'); heading.append(el('strong', dentist.name), el('small', `${records.length} appointment(s)`)); column.append(heading);
      const day = el('div', '', 'schedule-day');
      const shifts = (dentist.schedules || []).filter(s => String(s.day).toLowerCase() === weekday.toLowerCase());
      for (let minute = 540; minute < 1020; minute += 15) {
        if (!shifts.some(s => minute >= BookingTime.minutes(s.start) && minute + 15 <= BookingTime.minutes(s.end))) { const block = el('div', '', 'schedule-off-duty'); block.style.top = `${(minute - 540) * 2}px`; block.title = 'Not on duty'; day.append(block); }
      }
      const lunch = el('div', 'Lunch break | 1:00 - 1:30 PM', 'schedule-lunch'); day.append(lunch);
      for (const appointment of records) {
        const start = BookingTime.minutes(appointment.time), end = start + BookingTime.duration(appointment);
        if (!Number.isFinite(start) || end <= 540 || start >= 1020) continue;
        const button = el('button', '', 'schedule-appointment'); button.type = 'button';
        button.style.top = `${(Math.max(540, start) - 540) * 2}px`; button.style.minHeight = `${Math.max(38, (Math.min(end, 1020) - Math.max(540, start)) * 2 - 3)}px`;
        button.dataset.status = /complet/i.test(appointment.status) ? 'completed' : /progress|ongoing/i.test(appointment.status) ? 'ongoing' : 'waiting';
        button.append(el('strong', appointment.patient || appointment.patientName || 'Patient'), el('span', `${label(start)} - ${label(end)}`), el('small', appointment.service || appointment.serviceName || 'Appointment'), el('small', appointment.status || 'Waiting'));
        if (BookingTime.overlapsLunch(start, end - start)) button.append(el('small', 'Overlaps lunch - reschedule'));
        button.onclick = () => context.edit(appointment.id); day.append(button);
      }
      column.append(day); grid.append(column);
    }
    if (!bound) {
      bound = true;
      date.onchange = filter.onchange = () => render();
      byId('scheduleToday').onclick = () => { date.value = context.today; render(); };
      const move = delta => { const next = new Date(date.value + 'T12:00:00'); next.setDate(next.getDate() + delta); date.value = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,'0')}-${String(next.getDate()).padStart(2,'0')}`; render(); };
      byId('schedulePrev').onclick = () => move(-1); byId('scheduleNext').onclick = () => move(1);
    }
  }
  function assigned(a, d) { return d && ((a.dentistIds || [a.dentistId]).some(id => String(id) === String(d.id)) || (!a.dentistId && !a.dentistIds?.length && [a.dentist, a.dentistName].includes(d.name))); }
  window.GMStaffSchedule = { render };
})();
