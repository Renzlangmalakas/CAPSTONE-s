(function (root) {
  'use strict';
  const durations = {
    'consultation': 20, 'oral prophylaxis': 45, 'restorative treatment': 60,
    'tooth extraction': 120, 'odontectomy': 150, 'root canal treatment': 120,
    'complete denture': 120, 'partial denture stayplate': 90,
    'partial denture casted': 120, 'flexible denture': 120,
    'crowns and bridges': 120, 'orthodontic treatment': 60, 'retainers': 30,
    'mouth guard': 30, 'whitening': 90, 'periapical x ray': 10, 'panoramic x ray': 15
  };
  const aliases = {
    'teeth cleaning': 'oral prophylaxis', 'oral prophylaxis teeth cleaning': 'oral prophylaxis',
    'dental fillings': 'restorative treatment', 'filling': 'restorative treatment',
    'tooth filling': 'restorative treatment', 'teeth whitening': 'whitening',
    'braces': 'orthodontic treatment', 'orthodontic treatment braces': 'orthodontic treatment',
    'root canal': 'root canal treatment', 'xray': 'periapical x ray', 'x ray': 'periapical x ray'
  };
  const key = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function serviceDuration(service) {
    const name = key(typeof service === 'string' ? service : service.serviceName || service.name || service.service);
    return durations[aliases[name] || name] || 60;
  }
  function duration(appointment = {}) {
    const services = Array.isArray(appointment.services) && appointment.services.length
      ? appointment.services : String(appointment.service || appointment.serviceName || 'Consultation').split(/\s*\+\s*/);
    return Math.max(Number(appointment.durationMinutes) || 0, services.reduce((sum, service) => sum + serviceDuration(service), 0));
  }
  function minutes(time) {
    const match = String(time || '').trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (!match) return NaN;
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    if (minute > 59 || (match[3] ? hour < 1 || hour > 12 : hour > 23)) return NaN;
    if (match[3]) hour = hour % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0);
    return hour * 60 + minute;
  }
  const overlaps = (start, length, otherStart, otherLength) =>
    Number.isFinite(start) && Number.isFinite(otherStart) && start < otherStart + otherLength && otherStart < start + length;
  const clock = value => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const overlapsLunch = (start, length) => overlaps(start, length, 13 * 60, 30);
  const api = { overlapsLunch, durations, serviceDuration, duration, minutes, overlaps, clock };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BookingTime = api;
})(typeof globalThis === 'object' ? globalThis : this);
