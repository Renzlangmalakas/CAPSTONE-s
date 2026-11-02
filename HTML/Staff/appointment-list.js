(function(root) {
  function select(records, view = 'current', today) {
    const date = item => String(item.date || item.appointmentDate || '').slice(0, 10);
    const timestamp = item => Date.parse(item.createdAt || item.created_at || '') || 0;
    return records.filter(item => view === 'past' ? date(item) && date(item) < today : (!date(item) || date(item) >= today))
      .sort((a, b) => {
        if (view === 'recent') return timestamp(b) - timestamp(a) || date(a).localeCompare(date(b));
        if (view === 'past') return date(b).localeCompare(date(a)) || String(b.time || '').localeCompare(String(a.time || ''));
        return (date(a) || '9999').localeCompare(date(b) || '9999') || String(a.time || '').localeCompare(String(b.time || '')) || timestamp(b) - timestamp(a);
      });
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { select };
  else root.StaffAppointmentList = { select };
})(typeof window !== 'undefined' ? window : globalThis);
