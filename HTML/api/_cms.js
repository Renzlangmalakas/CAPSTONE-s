const { withDefaults, validate } = require('../Shared/site-content');
const TABLE = 'clinic_site_content';
function createCmsHandlers(db) {
  async function read() {
    if (!db) throw new Error('CMS database is unavailable.');
    const { data, error } = await db.from(TABLE).select('*').eq('id', 'website').maybeSingle();
    if (error || !data) throw new Error('CMS storage is not ready. Apply the clinic_site_content database migration.');
    return data;
  }
  const content = data => withDefaults(data || {});
  const sendError = (res, error) => res.status(503).json({ message: error.message });
  return {
    async published(_req, res) {
      res.set('Cache-Control', 'no-store');
      try { const row = await read(); res.json({ content: content(row.published), publishedAt: row.published_at }); }
      catch (error) { sendError(res, error); }
    },
    async get(req, res) {
      if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      res.set('Cache-Control', 'no-store');
      try { const row = await read(); res.json({ draft: content(row.draft), published: content(row.published), revision: row.revision, publishedAt: row.published_at }); }
      catch (error) { sendError(res, error); }
    },
    async save(req, res) {
      if (req.user?.role !== 'admin') return res.status(403).json({ message: 'Administrator access is required.' });
      let draft;
      try {
        draft = validate(req.body?.content);
        if (!Number.isSafeInteger(req.body?.revision) || req.body.revision < 0) throw new Error('Reload the CMS before saving.');
        if (!['draft', 'publish'].includes(req.body?.action)) throw new Error('Choose Save Draft or Publish.');
      } catch (error) { return res.status(400).json({ message: error.message }); }
      try {
        const current=await read();
        if(current.revision!==req.body.revision)return res.status(409).json({message:'Content changed. Reload before saving.'});
        if(require('node:util').isDeepStrictEqual(validate(content(current.draft)),draft) && (req.body.action==='draft'||require('node:util').isDeepStrictEqual(validate(content(current.published)),draft)))return res.status(304).end();
        const now = new Date().toISOString();
        const change = { draft, revision: req.body.revision + 1, updated_at: now, updated_by: req.user.id || req.user.email || 'admin' };
        if (req.body.action === 'publish') Object.assign(change, { published: draft, published_at: now });
        const { data, error } = await db.from(TABLE).update(change).eq('id', 'website').eq('revision', req.body.revision).select('*').maybeSingle();
        if (error) throw new Error('Unable to save content. Please try again.');
        if (!data) return res.status(409).json({ message: 'Another administrator changed this content. Reload the CMS before saving; your edits have not been published.' });
        res.json({ draft: content(data.draft), published: content(data.published), revision: data.revision, publishedAt: data.published_at });
      } catch (error) { sendError(res, error); }
    }
  };
}
module.exports = { createCmsHandlers };
