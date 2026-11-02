const catalog = require('../Shared/service-catalog');

function createPublicServicesHandler(db) {
  return async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!db) return res.status(503).json({ message: 'Service prices are temporarily unavailable.' });
    try {
      const { data, error } = await db.from('services').select('id,name,price,description,duration,archived,updated_at');
      if (error) throw error;
      const services = catalog.merge(data || []).filter(service => !service.archived)
        .map(({ id, name, price, description, displayDuration }) => ({ id, name, price, description, displayDuration }));
      return res.json({ services });
    } catch {
      return res.status(503).json({ message: 'Service prices are temporarily unavailable.' });
    }
  };
}
module.exports = { createPublicServicesHandler };
