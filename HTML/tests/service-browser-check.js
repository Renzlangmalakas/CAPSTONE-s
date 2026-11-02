(async () => {
  const read = path => fetch(path, { cache: 'no-store' }).then(response => {
    if (!response.ok) throw new Error(path + ': ' + response.status);
    return response.text();
  });
  const [catalogSource, adminSource, patientSource] = await Promise.all([
    read('/service-catalog.js'), read('/Admin/admin.js'), read('/Patient/patient.js')
  ]);
  const extract = (source, name, last = false) => {
    const start = last ? source.lastIndexOf('function ' + name + '(') : source.indexOf('function ' + name + '(');
    if (start < 0) throw new Error('Missing function: ' + name);
    return source.slice(start, source.indexOf('\n}', start) + 2);
  };
  const frame = document.createElement('iframe');
  document.body.replaceChildren(frame);
  const win = frame.contentWindow;
  win.document.body.innerHTML = '<table><tbody id="servicesTable"></tbody></table><div id="serviceGrid"></div>';
  win.eval(catalogSource);
  const rows = win.GMServiceCatalog.defaults.map((row, index) => ({ ...row, id: String(index) }));
  rows.find(row => row.name === 'Whitening').price = 3000;
  rows.find(row => row.name === 'Mouth Guard').archived = true;
  win.state = { services: win.GMServiceCatalog.merge(rows) };
  win.qs = selector => win.document.querySelector(selector);
  win.formatMoney = value => 'PHP ' + value;
  win.safeOn = () => {};
  win.eval(extract(patientSource, 'escapeHtml'));
  win.eval(extract(adminSource, 'renderServices', true));
  win.renderServices();
  const adminCount = win.document.querySelectorAll('#servicesTable tr').length;
  win.services = win.state.services.filter(row => !row.archived);
  win.eval(extract(patientSource, 'renderServices'));
  win.renderServices();
  const patientCount = win.document.querySelectorAll('.service-card').length;
  const whitening = [...win.document.querySelectorAll('.service-card')].find(card => card.textContent.includes('Whitening'));
  if (adminCount !== 16 || patientCount !== 16 || !whitening.textContent.includes('3,000')) throw new Error('Catalog rendering mismatch');
  return { adminCount, patientCount, savedPriceUsed: true, archivedServiceHidden: true };
})()
