const time = require('../Shared/booking-time');

function createBookingHandler({ supabase, getClinicHours = async () => ({}) }) {
  return async (req, res) => {
    if (!supabase) return res.status(503).json({ message: 'The clinic database is not configured.' });
    const input = req.body?.appointment;
    if (!input || !input.id || !input.dentistId || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !Number.isFinite(time.minutes(input.time))) {
      return res.status(400).json({ message: 'A dentist, date and valid appointment time are required.' });
    }
    if (req.user.role !== 'patient' || String(input.patientEmail || '').toLowerCase() !== String(req.user.email || '').toLowerCase()) {
      return res.status(403).json({ message: 'You can only book an appointment for your own account.' });
    }
    const durationMinutes = time.duration({ ...input, durationMinutes: 0 });
    const start = time.minutes(input.time);
    if (time.overlapsLunch(start, durationMinutes)) return res.status(400).json({ message: 'Dentist lunch break is 1:00 PM to 1:30 PM. Select another time.' });
    let settings;
    try { settings = await getClinicHours(); } catch { return res.status(503).json({ message: 'Clinic hours could not be checked. Please retry.' }); }
    if (!require('../Shared/clinic-hours').allows(input.date, start, durationMinutes, settings)) return res.status(400).json({ message: 'The clinic is closed or this appointment time has passed. Select another available date and time within clinic hours.' });
    if (start < 540 || start + durationMinutes > 1020) return res.status(400).json({ message: 'The service must finish before the clinic closes at 5:00 PM.' });
    const appointment = { ...input, status: 'Approved', lifecycleStatus: 'Approved', durationMinutes,
      endTime: time.clock(start + durationMinutes) };
    try {
      // The database trigger serializes reservations and checks the full interval.
      const { data, error } = await supabase.from('clinic_appointments')
        .insert({ id: appointment.id, data: appointment, updated_at: appointment.updatedAt }).select('data').single();
      if (error) throw error;
      return res.status(201).json({ appointment: data.data });
    } catch (error) {
      const conflict = ['23P01', '23505'].includes(error.code);
      return res.status(conflict ? 409 : 500).json({ message: conflict
        ? 'That time is no longer available for the full service duration. Please choose another time.'
        : 'Could not reserve your appointment. Please try again.' });
    }
  };
}
module.exports = { createBookingHandler };
