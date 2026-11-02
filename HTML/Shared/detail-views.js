(function () {
  const body = document.getElementById('viewBody');
  if (!body) return;
  // Preserve existing values, badges, links, and handlers; only group their presentation.
  function prepare() {
    body.querySelectorAll('.detail-box').forEach(box => {
      box.parentElement.classList.add('gm-detail-grid');
      const label = box.querySelector(':scope > strong:first-child');
      if (!label || box.querySelector(':scope > .gm-detail-value')) return;
      box.classList.toggle('gm-detail-wide', /notes?|condition|address|description|reason|history|specialt/i.test(label.textContent));
      const value = document.createElement('div');
      value.className = 'gm-detail-value';
      while (label.nextSibling) value.appendChild(label.nextSibling);
      box.appendChild(value);
    });
  }
  new MutationObserver(prepare).observe(body, { childList: true });
  prepare();
  const close = document.getElementById('closeViewBtn');
  if (close) {
    close.setAttribute('aria-label', 'Close details');
    close.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
  }
})();
