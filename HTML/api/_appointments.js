function preserveCompletion(incoming, existing) {
  // An older browser snapshot cannot undo a confirmed reschedule. A new
  // request is valid only when it was based on the latest confirmation.
  if (existing?.rescheduleConfirmation && incoming.rescheduleConfirmation?.confirmedAt !== existing.rescheduleConfirmation.confirmedAt) {
    incoming = { ...incoming };
    for (const key of ['status','visitStatus','lifecycleStatus','date','time','timeDisplay','schedule','requestedSchedule','previousSchedule','rescheduleReason','rescheduleConfirmation']) incoming[key] = existing[key];
  }

  if (existing?.status === "Cancelled") {
    return { ...incoming, status: "Cancelled", visitStatus: "Cancelled", lifecycleStatus: "Cancelled",
      cancelledBy: existing.cancelledBy, autoCancelled: existing.autoCancelled,
      cancelledAt: existing.cancelledAt || existing.updatedAt, cancellationReason: existing.cancellationReason,
      updatedAt: new Date(Math.max(Date.parse(incoming.updatedAt) || 0, Date.parse(existing.updatedAt) || 0)).toISOString() };
  }
  if (!existing || existing.status !== "Completed") return incoming;
  return { ...incoming, status: "Completed", visitStatus: "Completed", lifecycleStatus: "Completed",
    overallCaseStatus: "Completed", completedAt: existing.completedAt || existing.updatedAt,
    updatedAt: new Date(Math.max(Date.parse(incoming.updatedAt) || 0, Date.parse(existing.updatedAt) || 0)).toISOString() };
}

function createCompleteAppointmentHandler({ supabase, findUser }) {
  return async (req, res) => {
    if (req.user.role !== "dentist") return res.status(403).json({ message: "Dentist access is required." });
    if (!supabase) return res.status(503).json({ message: "The clinic database is not configured." });
    try {
      const { data: row, error } = await supabase.from("clinic_appointments").select("id,data,updated_at").eq("id", req.params.id).maybeSingle();
      if (error) throw error;
      if (!row) return res.status(404).json({ message: "Appointment not found on the server. Sync the booking first." });
      const appointment = { ...row.data, id: row.id };
      if (req.user.role === "dentist") {
        const user = await findUser(req.user.email);
        const assigned = require('../Shared/dentist-access').assigned(appointment, user);
        if (!assigned) return res.status(403).json({ message: "This appointment belongs to another dentist." });
      }
      if (appointment.status === "Completed") return res.json({ appointment });
      if (!["approved", "confirmed", "ongoing", "in progress"].includes(String(appointment.status || "").trim().toLowerCase())) return res.status(409).json({ message: "Only approved or ongoing appointments can be completed." });
      const now = new Date().toISOString();
      const completed = { ...appointment, status: "Completed", visitStatus: "Completed", lifecycleStatus: "Completed",
        overallCaseStatus: "Completed", completedAt: now, updatedAt: now };
      let query = supabase.from("clinic_appointments").update({ data: completed, updated_at: now }).eq("id", row.id);
      if (row.updated_at) query = query.eq("updated_at", row.updated_at);
      const { data: saved, error: saveError } = await query.select("data").maybeSingle();
      if (saveError) throw saveError;
      if (!saved) return res.status(409).json({ message: "The appointment changed while saving. Refresh its details and try again." });
      return res.json({ appointment: saved.data });
    } catch (error) {
      console.error("Appointment completion failed:", error.message);
      return res.status(500).json({ message: "Could not save appointment completion.", detail: error.message });
    }
  };
}
module.exports = { preserveCompletion, createCompleteAppointmentHandler };
