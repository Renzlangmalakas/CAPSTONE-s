(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('cmsForm');
    form.noValidate = true;
    const status = document.getElementById('cmsStatus');
    const fields = {};
    let images = { ...GMSiteContent.defaults.images };
    const imagePreviews = {};
    let savedData = null;
    let revision = null, qr = '', dirty = false, busy = false, imageLoading = false;
    const api = `${window.GmDentalSupabaseSync?.apiBaseUrl || ''}/api/admin/site-content`;
    const groups = [
      ['Hero (top of the page)', [['heroTitle', 'Main heading'], ['heroDescription', 'Introduction', true]]],
      ['About the clinic', [['aboutTitle', 'About heading'], ['aboutText', 'About text', true]]],
      ['Clinic Information', [['clinicName', 'Clinic name'], ['phone', 'Contact numbers'], ['email', 'Clinic email'], ['address', 'Clinic address']]],
      ['Clinic Schedule', [['openingTime', 'Opening time'], ['closingTime', 'Closing time'], ['workingDays', 'Working days (Monday - Friday or Monday - Saturday)']]],
      ['Footer', [['footerText', 'Footer description', true]]],
      ['GCash payment details', [['gcashName', 'Recipient name'], ['gcashNumber', 'GCash mobile number']]]
    ];
    for (const [title, items] of groups) {
      const group = document.createElement('fieldset'); group.className = 'cms-group cms-text-group'; group.style.setProperty('--cms-columns', Math.min(items.length, 4));
      const legend = document.createElement('legend'); legend.textContent = title; group.append(legend);
      for (const [key, label, multiline] of items) {
        const wrap = document.createElement('div'); const text = document.createElement('label'); text.className = 'label'; text.htmlFor = `cms-${key}`; text.textContent = label;
        const input = document.createElement(multiline ? 'textarea' : 'input'); input.id = `cms-${key}`; input.className = 'input'; input.maxLength = GMSiteContent.limits[key]; input.required = false; input.placeholder = GMSiteContent.defaults[key];
        if (multiline) input.rows = key === 'aboutText' ? 6 : 3;
        if (key === 'gcashNumber') { input.inputMode = 'numeric'; input.pattern = '09[0-9]{9}'; }
        if (key === 'openingTime' || key === 'closingTime') input.type = 'time';
        if (key === 'email') input.type = 'email';
        input.value = GMSiteContent.defaults[key];
        const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn secondary'; reset.textContent = 'Reset';
        reset.addEventListener('click', () => { input.value = GMSiteContent.defaults[key]; dirty = true; });
        fields[key] = input; wrap.append(text, input, reset); group.append(wrap);
      }
      document.getElementById('cmsFields').append(group);
    }
    const pictures = document.createElement('fieldset'); pictures.className = 'cms-group cms-pictures';
    const pictureLegend = document.createElement('legend'); pictureLegend.textContent = 'Landing-page pictures'; pictures.append(pictureLegend);
    const pictureHelp = document.createElement('p'); pictureHelp.textContent = 'Add or replace your logo and service photos. New services appear automatically here. Save a draft to keep photos private, or publish to show them on the website. PNG, JPG or WebP, up to 5 MB each.'; pictures.append(pictureHelp);
    const pictureGrid = document.createElement('div'); pictureGrid.className = 'cms-picture-grid'; pictures.append(pictureGrid);
    function addPicture(path, title) {
      if (imagePreviews[path]) return;
      const original = GMSiteContent.defaults.images[path] || '';
      images[path] ??= original;
      const wrap = document.createElement('div'); wrap.className = 'cms-picture-card';
      const label = document.createElement('label'); label.className = 'label'; label.textContent = title;
      const preview = document.createElement('img'); preview.className = 'cms-qr'; if (images[path]) preview.src = images[path]; else preview.hidden = true; preview.alt = `${title} draft picture`; imagePreviews[path] = preview;
      const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/png,image/jpeg,image/webp'; fileInput.className = 'input';
      fileInput.id = `cms-picture-${Object.keys(imagePreviews).length}`; label.htmlFor = fileInput.id;
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn secondary'; reset.textContent = original ? 'Use original picture' : 'Remove photo';
      reset.addEventListener('click', () => { images[path] = original; preview.hidden = !original; if (original) preview.src = original; else preview.removeAttribute('src'); dirty = true; });
      fileInput.addEventListener('change', async event => {
        const file = event.target.files[0]; if (!file) return;
        imageLoading = true; lock(true);
        let url;
        try {
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Choose a PNG, JPG or WebP image up to 5 MB.');
          url = URL.createObjectURL(file); const image = new Image(); image.src = url; await image.decode();
          const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const data = canvas.toDataURL('image/webp', 0.8);
          if (data.length > 400000) throw new Error('This picture is too detailed. Choose a smaller image.');
          images[path] = data; preview.src = data; preview.hidden = false; dirty = true;
          status.textContent = `${title} picture selected. Save a draft or publish your changes.`;
        } catch (error) { status.textContent = error.message; }
        finally { if (url) URL.revokeObjectURL(url); imageLoading = false; event.target.value = ''; lock(false); }
      });
      const upload = document.createElement('button'); upload.type = 'button'; upload.className = 'btn primary'; upload.textContent = 'Add / replace photo'; upload.onclick = () => fileInput.click();
      fileInput.hidden = true;
      wrap.append(label, preview, fileInput, upload, reset); pictureGrid.append(wrap);
    }
    for (const [path, title] of Object.entries(GMSiteContent.imageFields).sort((a, b) => a[1].localeCompare(b[1], 'en', { sensitivity: 'base' }))) addPicture(path, title);
    const refreshPictures = document.createElement('button'); refreshPictures.type = 'button'; refreshPictures.className = 'btn secondary'; refreshPictures.textContent = 'Check for new services';
    pictures.insertBefore(refreshPictures, pictureGrid);
    let checkingServices = false;
    async function syncServicePictures() {
      if (checkingServices || busy || imageLoading) return;
      checkingServices = true;
      try {
        const response = await window.GmDentalApiFetch(`${window.GmDentalSupabaseSync?.apiBaseUrl || ''}/api/services`);
        if (!response.ok) throw new Error('Unable to check for new services. Try again.');
        const data = await response.json();
        for (const service of data.services || []) {
          const key = GMSiteContent.serviceImageKey(service);
          if (GMSiteContent.imageFields[key] || /^service:[a-zA-Z0-9_-]{1,100}$/.test(key)) addPicture(key, service.name);
        }
      } catch (error) { status.textContent = error.message; }
      finally { checkingServices = false; }
    }
    refreshPictures.onclick = syncServicePictures;
    setInterval(() => { if (!document.hidden && document.getElementById('cms').offsetParent) syncServicePictures(); }, 15000);
    document.getElementById('cmsFields').append(pictures);
    const faqGroup = document.createElement('fieldset'); faqGroup.className = 'cms-group';
    const faqLegend = document.createElement('legend'); faqLegend.textContent = 'FAQ questions';
    const faqList = document.createElement('div'); faqList.className = 'cms-faq-list';
    const addFaq = document.createElement('button'); addFaq.type = 'button'; addFaq.className = 'btn secondary'; addFaq.textContent = '+ Add question';
    const faqRows = [];
    function appendFaq(item = { question: '', answer: '' }) {
      if (faqRows.length >= 20) { status.textContent = 'You can add up to 20 questions.'; return; }
      const row = document.createElement('div'); row.className = 'cms-faq-row';
      const question = document.createElement('input'); question.className = 'input'; question.placeholder = 'Question'; question.setAttribute('aria-label', 'FAQ question'); question.maxLength = 200; question.value = item.question;
      const answer = document.createElement('textarea'); answer.className = 'input'; answer.placeholder = 'Answer'; answer.setAttribute('aria-label', 'FAQ answer'); answer.maxLength = 2000; answer.value = item.answer;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'btn secondary'; remove.textContent = 'Remove question';
      const entry = { question, answer }; faqRows.push(entry);
      remove.onclick = () => { faqRows.splice(faqRows.indexOf(entry), 1); row.remove(); dirty = true; };
      row.append(question, answer, remove); faqList.append(row);
    }
    addFaq.onclick = () => { appendFaq(); dirty = true; };
    faqGroup.append(faqLegend, faqList, addFaq); document.getElementById('cmsFields').append(faqGroup);
    const previewQr = () => { const image = document.getElementById('cmsQrPreview'); image.hidden = !qr; if (qr) image.src = qr; else image.removeAttribute('src'); };
    const typography = document.createElement('fieldset'); typography.className = 'cms-group cms-text-group';
    const typographyLegend = document.createElement('legend'); typographyLegend.textContent = 'Website typography';
    const typographyHelp = document.createElement('p'); typographyHelp.textContent = 'Choose the font and sizes for your public website. Preview on Computer, iPad and iPhone before publishing. Original restores the existing design.';
    typography.append(typographyLegend, typographyHelp);
    const typographyLabels = { fontFamily: 'Font style', textSize: 'Text size', headingSize: 'Heading size' };
    for (const [key, options] of Object.entries(GMSiteContent.typographyOptions)) {
      const wrap = document.createElement('div');
      const label = document.createElement('label'); label.className = 'label'; label.htmlFor = `cms-${key}`; label.textContent = typographyLabels[key];
      const select = document.createElement('select'); select.id = label.htmlFor; select.className = 'input';
      for (const [value, title] of Object.entries(options)) { const option = document.createElement('option'); option.value = value; option.textContent = title; select.append(option); }
      select.value = GMSiteContent.defaults[key]; fields[key] = select;
      const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'btn secondary'; reset.textContent = 'Reset';
      reset.onclick = () => { select.value = GMSiteContent.defaults[key]; select.dispatchEvent(new Event('input', { bubbles: true })); };
      select.addEventListener('change', () => select.dispatchEvent(new Event('input', { bubbles: true })));
      wrap.append(label, select, reset); typography.append(wrap);
    }
    const sample = document.createElement('div'); sample.style.cssText = 'grid-column:1/-1;padding:24px;border:1px solid var(--border,#334155);border-radius:16px;overflow-wrap:anywhere';
    const sampleLabel = document.createElement('p'); sampleLabel.textContent = 'Font preview';
    const sampleHeading = document.createElement('h2'); sampleHeading.textContent = 'Thoughtful care. A confident smile.';
    const sampleText = document.createElement('p'); sampleText.textContent = 'See how your website text will look before saving or publishing.';
    sample.append(sampleLabel, sampleHeading, sampleText); typography.append(sample);
    function updateTypographySample() {
      const fonts = { default: 'inherit', system: 'system-ui, sans-serif', arial: 'Arial, sans-serif', georgia: 'Georgia, serif', verdana: 'Verdana, sans-serif' };
      for (const element of [sampleHeading, sampleText]) element.style.fontFamily = fonts[fields.fontFamily.value] || 'inherit';
      sampleHeading.style.fontSize = ({small:'24px',medium:'32px',large:'40px'})[fields.headingSize.value] || '28px';
      sampleHeading.style.lineHeight = '1.2';
      sampleText.style.fontSize = fields.textSize.value === 'default' ? '16px' : `${fields.textSize.value}px`;
    }
    typography.addEventListener('input', updateTypographySample);
    updateTypographySample();
    document.getElementById('cmsFields').append(typography);

    const read = () => GMSiteContent.validate({ ...Object.fromEntries(Object.entries(fields).map(([key, input]) => [key, input.value.trim() || GMSiteContent.defaults[key]])), gcashQr: qr, images, faqs: faqRows.map(row => ({ question: row.question.value, answer: row.answer.value })) });
    function fill(data) {
      savedData = structuredClone(data);
      revision = data.revision;
      const draft = GMSiteContent.withDefaults(data.draft);
      for (const [key, input] of Object.entries(fields)) input.value = draft[key];
      updateTypographySample();
      faqRows.length = 0; faqList.replaceChildren(); draft.faqs.forEach(appendFaq);
      images = { ...draft.images };
      for (const [path, preview] of Object.entries(imagePreviews)) { preview.hidden = !images[path]; if (images[path]) preview.src = images[path]; else preview.removeAttribute('src'); }
      qr = draft.gcashQr; previewQr(); dirty = false;
      document.getElementById('cmsPublished').textContent = data.publishedAt ? `Last published: ${new Date(data.publishedAt).toLocaleString()}` : 'No CMS content published yet. The website uses its existing content.';
    }
    function lock(value) {
      busy = value;
      form.querySelectorAll('button, input, textarea, select').forEach(el => { el.disabled = value; });
      form.querySelectorAll('button[type="submit"]').forEach(el => { el.disabled = value || revision === null; });
      document.querySelectorAll('[form="cmsForm"]').forEach(el => { el.disabled = value || revision === null; });
      document.getElementById('cmsReload').disabled = value;
    }
    async function request(options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await window.GmDentalApiFetch(api, { ...options, signal: controller.signal });
        if (response.status === 401 || response.status === 403) throw new Error('Your administrator session has expired or is unavailable. Sign in again, then reload the CMS.');
        let data;
        try { data = await response.json(); }
        catch (error) {
          if (controller.signal.aborted) throw error;
          throw new Error('The CMS returned an invalid response. Please try Reload.');
        }
        if (!response.ok) throw new Error(data.message || 'Unable to load CMS. Please try Reload.');
        return data;
      } catch (error) {
        if (controller.signal.aborted) throw new Error(options.method === 'PUT'
          ? 'Saving took too long to confirm. Reload to check whether your changes were saved before trying again.'
          : 'Saved content could not load within 15 seconds. Check your connection, then click Reload.');
        throw error;
      } finally { clearTimeout(timer); }
    }
    async function load() {
      lock(true); status.textContent = 'Loading saved content...';
      try { fill(await request()); status.textContent = 'Ready. Save a draft or preview your changes before publishing.'; }
      catch (error) { status.textContent = `${error.message} You can edit and preview locally, but saving and publishing require a successful reload. Reload will ask before discarding your edits.`; }
      finally { lock(false); }
    }
    form.addEventListener('input', () => { dirty = true; });
    document.getElementById('cmsQrFile').addEventListener('change', async event => {
      const file = event.target.files[0]; if (!file) return;
      imageLoading = true; lock(true);
      try {
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Choose a PNG, JPG or WebP image up to 2 MB.');
        const data = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Unable to read the image.')); reader.readAsDataURL(file); });
        const image = new Image(); image.src = data; await image.decode();
        qr = data; dirty = true; previewQr(); status.textContent = 'QR image selected. Preview and scan it with GCash before publishing.';
      } catch (error) { status.textContent = error.message; }
      finally { imageLoading = false; event.target.value = ''; lock(false); }
    });
    document.getElementById('cmsRemoveQr').addEventListener('click', () => { qr = ''; dirty = true; previewQr(); status.textContent = 'QR removed from this draft. Publish to update the patient page.'; });
    document.getElementById('cmsReload').addEventListener('click', () => { if (!dirty || confirm('Discard unsaved CMS changes and reload?')) load(); });
    setupEditor();
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return;
      const action = event.submitter?.value;
      try {
        if (imageLoading) throw new Error('Wait for the image to finish loading.');
        if (revision === null) throw new Error('Load the CMS before saving.');
        const content = read(); lock(true); status.textContent = action === 'publish' ? 'Publishing...' : 'Saving draft...';
        const data = await request({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, revision, action }) });
        fill(data); status.textContent = action === 'publish' ? 'Published. The website and patient billing will use these details when opened or refreshed.' : 'Draft saved. Public content is unchanged.';
      } catch (error) { status.textContent = error.message; }
      finally { lock(false); }
    });

    function setupEditor() {
      const panel = document.querySelector('.cms-panel');
      const header = panel.querySelector('.panel-header');
      const heading = header.querySelector('h2');
      const actions = header.querySelector('.cms-header-actions');
      actions.querySelector('[value="publish"]').remove();
      const previewButton = document.getElementById('cmsPreview');
      previewButton.textContent = 'Preview'; actions.prepend(previewButton);
      const viewSite = actions.querySelector('a');
      const intro = header.nextElementSibling;
      intro.textContent = 'Edit this section, preview your draft, then publish when it is ready.';
      const layout = document.createElement('div'); layout.className = 'cms-workspace';
      const nav = document.createElement('nav'); nav.className = 'cms-section-nav'; nav.setAttribute('aria-label', 'Website content sections');
      const navTitle = document.createElement('p'); navTitle.textContent = 'YOUR WEBSITE'; nav.append(navTitle);
      panel.before(layout); layout.append(nav, panel);
      const sections = [...document.querySelectorAll('#cmsFields > fieldset')];
      const qrGroup = document.getElementById('cmsQrFile').closest('fieldset');
      const names = ['Top banner', 'About the clinic', 'Contact information', 'Opening hours', 'Footer', 'GCash payments', 'Pictures & logo', 'Frequently asked questions', 'Typography'];
      const pages = ['landing', 'about', 'contact', 'contact', 'landing', 'payment', 'services', 'about', 'landing'];
      let selected = 0;
      const buttons = sections.map((section, index) => {
        const button = document.createElement('button'); button.type = 'button';
        const number = document.createElement('span'); number.className = 'cms-section-number'; number.textContent = String(index + 1).padStart(2, '0');
        const label = document.createElement('span'); label.textContent = names[index];
        button.append(number, label); button.onclick = () => select(index); nav.append(button); return button;
      });
      function select(index) {
        if (index === 6) syncServicePictures();
        selected = index; heading.textContent = names[index];
        sections.forEach((section, i) => { section.hidden = i !== index; buttons[i].setAttribute('aria-current', i === index ? 'true' : 'false'); });
        qrGroup.hidden = index !== 5;
        viewSite.href = `../Landing/${pages[index] === 'payment' ? 'landing' : pages[index]}.html`;
      }
      select(0);
      const footer = form.querySelector('.cms-actions');
      footer.querySelector('[value="publish"]').textContent = 'Publish changes';
      const undo = document.createElement('button'); undo.type = 'button'; undo.className = 'btn secondary'; undo.textContent = 'Undo edits';
      undo.onclick = () => { if (savedData) { fill(savedData); status.textContent = 'Restored your last saved draft.'; updateState(); } };
      const state = document.createElement('span'); state.className = 'cms-draft-state'; state.setAttribute('role', 'status'); footer.append(undo, state);
      function updateState() { state.textContent = dirty ? 'Unsaved changes' : 'No unsaved changes'; undo.disabled = busy || !dirty || !savedData; }
      form.addEventListener('input', updateState);
      form.addEventListener('click', () => queueMicrotask(updateState));
      new MutationObserver(updateState).observe(status, { childList: true });
      updateState();
      const dialog = document.createElement('dialog'); dialog.className = 'cms-device-preview'; dialog.setAttribute('aria-labelledby', 'cmsPreviewTitle');
      dialog.innerHTML = `<div class="cms-preview-toolbar"><strong id="cmsPreviewTitle">Website preview</strong><div class="cms-device-tabs" role="group" aria-label="Preview device"><button type="button" data-width="1440" aria-pressed="true">Computer</button><button type="button" data-width="1024" aria-pressed="false">iPad</button><button type="button" data-width="430" aria-pressed="false">iPhone</button></div><span class="cms-preview-note">Private draft preview</span><button type="button" class="btn secondary" id="cmsClosePreview">Close</button></div><div class="cms-preview-stage"><div class="cms-preview-frame-wrap"><iframe title="Website draft preview" sandbox="allow-scripts allow-same-origin"></iframe></div></div>`;
      document.body.append(dialog);
      const frame = dialog.querySelector('iframe'); const wrap = dialog.querySelector('.cms-preview-frame-wrap'); const stage = dialog.querySelector('.cms-preview-stage');
      let width = 1440, snapshot, requestId = 0;
      function fit() {
        const availableWidth = Math.max(1, stage.clientWidth - 24);
        const availableHeight = Math.max(1, stage.clientHeight - 24);
        // Desktop uses the available window; smaller devices keep their CSS width.
        const viewportWidth = width === 1440 ? Math.max(1200, availableWidth) : width;
        const preferredScale = width === 1440 ? 1 : 1.25;
        const scale = Math.min(preferredScale, availableWidth / viewportWidth);
        wrap.dataset.device = width === 430 ? 'iphone' : width === 1024 ? 'ipad' : 'computer';
        const height = availableHeight / scale;
        frame.style.width = `${viewportWidth}px`; frame.style.height = `${height}px`; frame.style.transform = `scale(${scale})`;
        wrap.style.width = `${viewportWidth * scale}px`; wrap.style.height = `${availableHeight}px`;
      }
      new ResizeObserver(() => { if (dialog.open) fit(); }).observe(stage);
      dialog.querySelectorAll('[data-width]').forEach(button => button.onclick = () => {
        width = Number(button.dataset.width); dialog.querySelectorAll('[data-width]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); fit();
      });
      dialog.querySelector('#cmsClosePreview').onclick = () => dialog.close();
      dialog.addEventListener('close', () => { document.documentElement.classList.remove('cms-preview-open'); requestId++; frame.srcdoc = ''; previewButton.focus(); });
      previewButton.addEventListener('click', async () => {
        try {
          if (imageLoading || busy) throw new Error('Wait for content to finish loading.');
          snapshot = read();
          dialog.querySelector('#cmsPreviewTitle').textContent = `Preview - ${names[selected]}`;
          dialog.querySelector('.cms-preview-note').textContent = dirty ? 'Showing your unsaved edits' : 'Showing your saved draft';
          document.documentElement.classList.add('cms-preview-open');
          dialog.showModal(); fit();
          const id = ++requestId;
          if (pages[selected] === 'payment') {
            frame.onload = () => {
              const doc = frame.contentDocument;
              doc.getElementById('name').textContent = snapshot.gcashName;
              doc.getElementById('number').textContent = snapshot.gcashNumber;
              const img = doc.querySelector('img'); img.hidden = !snapshot.gcashQr; if (snapshot.gcashQr) img.src = snapshot.gcashQr;
            };
            frame.srcdoc = '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px system-ui;background:#edf4fc;color:#17314f;padding:24px}article{max-width:450px;margin:auto;padding:24px;background:white;border-radius:20px;overflow-wrap:anywhere}img{width:100%;max-width:280px}h1{font-size:24px}</style><article><h1>GCash payment details</h1><p>Payment information preview</p><h2 id="name"></h2><p id="number"></p><img alt="Draft GCash QR"></article></html>';
            return;
          }
          const url = new URL(`../Landing/${pages[selected]}.html`, location.href);
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) throw new Error('Unable to load website preview. Please try again.');
          const html = await response.text(); if (id !== requestId || !dialog.open) return;
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const base = doc.createElement('base'); base.href = url.href; doc.head.prepend(base);
          const flag = doc.createElement('script'); flag.textContent = 'window.GMCmsPreview = true;'; base.after(flag);
          const scrollStyle = doc.createElement('style');
          scrollStyle.textContent = `
            html { --preview-scroll-track:#edf2f7; --preview-scroll-thumb:#94a3b8; scrollbar-width:thin; scrollbar-color:var(--preview-scroll-thumb) var(--preview-scroll-track); }
            html[data-theme="dark"] { --preview-scroll-track:#0c1827; --preview-scroll-thumb:#52677e; color-scheme:dark; }
            ::-webkit-scrollbar { width:8px; height:8px; }
            ::-webkit-scrollbar-track { background:var(--preview-scroll-track); }
            ::-webkit-scrollbar-thumb { background:var(--preview-scroll-thumb); border:2px solid var(--preview-scroll-track); border-radius:12px; }
            ::-webkit-scrollbar-thumb:hover { background:#7891ac; }
            ::-webkit-scrollbar-button { display:none; width:0; height:0; }
            ::-webkit-scrollbar-corner { background:var(--preview-scroll-track); }
          `;
          doc.head.append(scrollStyle);
          frame.onload = () => {
            const win = frame.contentWindow;
            win.GMApplySiteContent?.(snapshot);
            win.document.addEventListener('click', event => {
              const link = event.target.closest('a'); if (link && !link.getAttribute('href')?.startsWith('#')) event.preventDefault();
            }, true);
            win.document.addEventListener('submit', event => event.preventDefault(), true);
            if (selected === 4) win.document.querySelector('footer')?.scrollIntoView();
            if (selected === 7) win.document.querySelector('.faq-wrap')?.scrollIntoView();
          };
          frame.srcdoc = '<!doctype html>' + doc.documentElement.outerHTML;
        } catch (error) { if (dialog.open) dialog.close(); status.textContent = error.message; }
      });
    }

    window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
    load();
  });
})();
