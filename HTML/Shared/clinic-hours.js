(function(root) {
  const time = typeof module === 'object' && module.exports ? require('./booking-time') : root.BookingTime;
  const minutes = value => { const m = String(value || '').match(/^(\d{2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
  function allows(date, start, duration, settings = {}, now = new Date()) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]));
    const today = `${parts.year}-${parts.month}-${parts.day}`;
    const current = Number(parts.hour) * 60 + Number(parts.minute);
    const testing = time?.local24Hours();
    const open = testing ? 0 : minutes(settings.openingTime || '09:00'), close = testing ? 1440 : minutes(settings.closingTime || '17:00');
    const weekday = new Date(date + 'T12:00:00Z').getUTCDay();
    return date >= today && weekday !== 0 && !(settings.workingDays === 'Monday - Friday' && weekday === 6) &&
      start >= open && start + duration <= close && (testing || !(start < 810 && start + duration > 780)) && (date !== today || (current < close && start > current));
  }
  const api = { allows, minutes };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.GMClinicHours = api;
})(typeof globalThis === 'object' ? globalThis : this);
