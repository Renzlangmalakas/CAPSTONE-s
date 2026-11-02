'use strict';
const express = require('express');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
// Resolve the backend's local configuration relative to HTML, regardless of launch directory.
process.chdir(root);
// Process-only testing override: never written to clinic settings or production.
process.env.GM_LOCAL_24_HOURS = '1';
const app = express();
app.get('/', (_req, res) => res.redirect('/Landing/landing.html'));
for (const directory of ['Landing', 'Patient', 'Dentist', 'Admin', 'Staff', 'Shared', 'Images']) {
  app.use(`/${directory}`, express.static(path.join(root, directory), { dotfiles: 'deny' }));
}
app.use(require('../api/_app'));
const port = Number(process.env.PORT || 3000);
app.listen(port, '127.0.0.1', () => console.log(`Local preview: http://localhost:${port}`));
