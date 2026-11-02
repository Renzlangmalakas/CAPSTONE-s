(() => {
  'use strict';
  async function load() {
    if (window.GMCmsPreview) return;
    try {
      const base = window.GM_DENTAL_API_BASE || localStorage.getItem('gm_dental_api_base') || (['localhost', '127.0.0.1'].includes(location.hostname) || location.protocol === 'file:' ? 'http://localhost:3000' : '');
      const response = await fetch(`${base}/api/site-content`, { cache: 'no-store' });
      if (!response.ok) return;
      const { content, publishedAt } = await response.json();
      if (!content) return;
      if (publishedAt) applyContent(content);
    } catch { /* Keep the page usable while offline. */ }
  }
  let photoCatalog = [], photoCatalogRequest;
  function loadPhotoCatalog() {
    if (photoCatalogRequest) return;
    const base = window.GM_DENTAL_API_BASE || localStorage.getItem('gm_dental_api_base') || (['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://localhost:3000' : '');
    photoCatalogRequest = fetch(`${base}/api/services`, { cache: 'no-store' })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Service photos unavailable')))
      .then(data => { photoCatalog = data.services || []; window.GMRefreshServicePhotos(); })
      .catch(() => { photoCatalogRequest = null; });
  }
  window.GMRefreshServicePhotos = () => {
    document.querySelectorAll('[data-service-image]').forEach(image => {
      const key = image.dataset.serviceImage;
      const images = window.GMClinicSettings?.images || {};
      let value = images[key] ?? window.GMSiteContent?.defaults.images[key];
      // CMS uploads for renamed services retain service IDs; carousel slides retain asset keys.
      const label = window.GMSiteContent?.imageFields[key];
      if (label && window.GMServiceCatalog && (!value || value === key)) {
        const service = photoCatalog.find(item => GMServiceCatalog.key(item.name) === GMServiceCatalog.key(label));
        const replacement = service && images[`service:${service.id}`];
        if (replacement) value = replacement;
      }
      const safe = typeof value === 'string' && (/^data:image\/(png|jpeg|webp);base64,/.test(value) || (key.startsWith('/Images/') && value === key));
      image.hidden = !safe;
      if (safe) image.src = value; else image.removeAttribute('src');
    });
  };
  function applyContent(content) {
      window.GMClinicSettings = content;
      loadPhotoCatalog();
      window.GMRefreshServicePhotos();
      if (typeof window.renderCalendar === 'function') window.renderCalendar();
      if (typeof window.generateTimeSlots === 'function') window.generateTimeSlots();
      const set = (selector, value) => { document.querySelectorAll(selector).forEach(el => { el.textContent = value; }); };
      if (document.body.dataset.landingPage || document.querySelector('.hero-title')) {
        let typography = document.getElementById('cms-typography');
        if (!typography) { typography = document.createElement('style'); typography.id = 'cms-typography'; document.head.append(typography); }
        typography.textContent = window.GMSiteContent?.typographyCss(content) || '';

        document.querySelectorAll('img').forEach(image => {
          if (image.dataset.serviceImage) return;
          const source = image.getAttribute('src');
          if (!source) return;
          const path = image.dataset.cmsOriginalPath || new URL(source, document.baseURI).pathname;
          if (path.startsWith('/Images/')) image.dataset.cmsOriginalPath = path;
          const replacement = content.images?.[path];
          if (replacement && (replacement === path || /^data:image\/(png|jpeg|webp);base64,/.test(replacement))) image.src = replacement;
        });
        if (content.footerText) set('.footer-grid > div:first-child > p', content.footerText);
        set('.footer-grid > div:first-child > h3', content.clinicName);
        const faq = document.querySelector('.faq-wrap');
        if (faq && Array.isArray(content.faqs)) {
          faq.replaceChildren();
          for (const entry of content.faqs) {
            const item = document.createElement('div'); item.className = 'faq-item';
            const button = document.createElement('button'); button.className = 'faq-question'; button.type = 'button'; button.setAttribute('aria-expanded', 'false');
            const title = document.createElement('span'); title.textContent = entry.question; const icon = document.createElement('i'); icon.className = 'bi bi-plus-lg'; button.append(title, icon);
            const answer = document.createElement('div'); answer.className = 'faq-answer'; const text = document.createElement('p'); text.textContent = entry.answer; answer.append(text);
            button.onclick = () => { item.classList.toggle('active'); button.setAttribute('aria-expanded', String(item.classList.contains('active'))); };
            item.append(button, answer); faq.append(item);
          }
        }
        set('.hero-title', content.heroTitle);
        set('.home-address', content.address);
        set('.home-hours', content.hours);
        set('.hero-description', content.heroDescription);
        set('.about-card h3', content.aboutTitle);
        const paragraphs = document.querySelectorAll('.about-card > p');
        if (paragraphs[0]) { paragraphs[0].textContent = content.aboutText; paragraphs[0].style.whiteSpace = 'pre-wrap'; }
        paragraphs.forEach((el, i) => { if (i) el.hidden = true; });
        set('.topbar-left span:first-child', String(content.phone || '').replace(/09228724320/g, '+63 922 872 4320').replace(/09494687363/g, '+63 949 468 7363'));
        set('.topbar-left span:nth-child(2)', content.hours);
        const contact = document.querySelector('.contact-list');
        if (contact) { contact.replaceChildren(); for (const value of [content.phone, content.clinicName, content.email, content.address]) { const el = document.createElement('div'); el.textContent = value; contact.append(el); } }
        set('.contact-mini-card:first-child span', content.hours);
      }
      const number = document.querySelector('.gcash-account-number');
      if (number) {
        number.textContent = content.gcashNumber;
        set('.gcash-account-info > div:first-child', content.gcashName);
        const fallback = document.getElementById('qrUnavailable');
        fallback.textContent = `Send your GCash payment to ${content.gcashNumber}. Check the recipient name before confirming your transfer.`;
        const image = document.querySelector('.gcash-qr-code');
        if (/^data:image\/(png|jpeg|webp);base64,/.test(content.gcashQr || '')) {
          image.onload = () => { image.hidden = false; fallback.hidden = true; };
          image.onerror = () => { image.hidden = true; fallback.hidden = false; };
          image.src = content.gcashQr;
        } else { image.hidden = true; fallback.hidden = false; }
      }

  }
  window.GMApplySiteContent = applyContent;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();

