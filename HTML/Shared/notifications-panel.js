(function () {
  const panel = document.getElementById('notifPanel');
  const toggle = document.getElementById('notifToggle');
  if (!panel || !toggle) return;
  // Escape transformed headers and their stacking/overflow contexts.
  document.body.appendChild(panel);
  toggle.setAttribute('aria-controls', panel.id);
  toggle.setAttribute('aria-expanded', 'false');
  panel.setAttribute('aria-label', 'Notifications');
  panel.setAttribute('role', 'region');
  function position() {
    const open = panel.classList.contains('show');
    toggle.setAttribute('aria-expanded', String(open));
    if (!open) return;
    const viewport = window.visualViewport;
    const width = viewport ? viewport.width : window.innerWidth;
    const height = viewport ? viewport.height : window.innerHeight;
    const x = viewport ? viewport.offsetLeft : 0;
    const y = viewport ? viewport.offsetTop : 0;
    const anchor = toggle.getBoundingClientRect();
    const panelWidth = Math.min(380, width - 24);
    const top = Math.max(y + 12, Math.min(anchor.bottom + 10, y + height - 180));
    panel.style.setProperty('--notification-left', `${Math.max(x + 12, Math.min(anchor.right - panelWidth, x + width - panelWidth - 12))}px`);
    panel.style.setProperty('--notification-top', `${top}px`);
    panel.style.setProperty('--notification-width', `${panelWidth}px`);
    panel.style.setProperty('--notification-height', `${Math.min(480, y + height - top - 12)}px`);
  }
  new MutationObserver(position).observe(panel, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', position);
  window.visualViewport?.addEventListener('resize', position);
  document.addEventListener('scroll', event => {
    if (panel.contains(event.target)) return;
    panel.classList.remove('show');
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.classList.contains('show')) {
      panel.classList.remove('show');
      toggle.focus();
    }
  });
})();
