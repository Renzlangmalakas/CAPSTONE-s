(function(root) {
  const time = typeof module === 'object' && module.exports ? require('../Shared/booking-time') : root.BookingTime;
  function slots(date, dentists, appointments, appointment, now = new Date()) {
    if (!dentists.length) return [];
    const day = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const length = time.duration(appointment);
    const result = [];
    for (let start = 0; start + length <= 1440; start += 15) {
      if (time.overlapsLunch(start, length)) continue;
      if (new Date(`${date}T${time.clock(start)}:00`) <= now) continue;
      if (!dentists.every(d => (d.schedules || []).some(s => String(s.day).toLowerCase() === day.toLowerCase() && start >= time.minutes(s.start) && start + length <= time.minutes(s.end)))) continue;
      if (appointments.some(a => String(a.id) !== String(appointment.id) && a.date === date && !/cancel|reject|declin/i.test(a.status || '') &&
        dentists.some(d => (a.dentistIds || [a.dentistId]).some(id => id && String(id) === String(d.id)) || (!a.dentistId && !a.dentistIds?.length && [a.dentist, a.dentistName].includes(d.name))) &&
        time.overlaps(start, length, time.minutes(a.time), time.duration(a)))) continue;
      result.push(time.clock(start));
    }
    return result;
  }
  const api = { slots };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StaffAvailability = api;
})(typeof globalThis === 'object' ? globalThis : this);
