(function (root) {
  'use strict';
  function pageInfo(total, requested, size) {
    const pages = Math.max(1, Math.ceil(total / size));
    const page = Math.max(1, Math.min(requested, pages));
    const start = (page - 1) * size;
    return { page, pages, start, end: Math.min(start + size, total) };
  }
  if (typeof module === 'object' && module.exports) module.exports = { pageInfo };
  if (!root.document) return;
  const states = new Map();
  function refresh(table) {
    let state = states.get(table);
    if (!state) {
      const nav = document.createElement('nav');
      nav.className = 'gm-pagination';
      nav.setAttribute('aria-label', 'Table pages');
      state = { nav, page: 1, size: 10, signature: null };
      states.set(table, state);
    }
    const { nav } = state;
    const wrapper = table.parentElement;
    const anchor = wrapper.matches('.table-wrap, .table-responsive, .table-modern, .dentist-schedule-scroll') ? wrapper : table;
    if (anchor.nextElementSibling !== nav) anchor.after(nav);
    const all = Array.from(table.tBodies).flatMap(body => Array.from(body.rows));
    // Keep existing search visibility and empty-state rows separate from pagination.
    const rows = all.filter(row => !row.hidden && row.style.display !== 'none' &&
      !(row.cells.length === 1 && row.cells[0].colSpan > 1));
    const signature = JSON.stringify(rows.map(row => row.textContent));
    if (state.signature !== signature) state.page = 1;
    state.signature = signature;
    const info = pageInfo(rows.length, state.page, state.size);
    state.page = info.page;
    all.forEach(row => row.classList.remove('gm-page-hidden'));
    rows.forEach((row, index) => row.classList.toggle('gm-page-hidden', index < info.start || index >= info.end));
    nav.replaceChildren();
    nav.hidden = rows.length === 0;
    const summary = document.createElement('span');
    summary.className = 'gm-page-summary';
    summary.textContent = `Showing ${rows.length ? info.start + 1 : 0}\u2013${info.end} of ${rows.length}`;
    summary.setAttribute('aria-live', 'polite');
    nav.append(summary);
    const label = document.createElement('label');
    label.textContent = 'Rows per page ';
    const select = document.createElement('select');
    for (const size of [10, 25, 50]) {
      const option = document.createElement('option');
      option.value = size; option.textContent = size; option.selected = size === state.size;
      select.append(option);
    }
    select.addEventListener('change', () => { state.size = Number(select.value); state.page = 1; refresh(table); });
    label.append(select); nav.append(label);
    const controls = document.createElement('div'); controls.className = 'gm-page-buttons';
    function button(text, page, disabled, current) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = text; btn.disabled = disabled;
      btn.setAttribute('aria-label', /^\d+$/.test(text) ? `Page ${text}` : `${text} page`);
      if (current) btn.setAttribute('aria-current', 'page');
      btn.addEventListener('click', () => {
        state.page = page; refresh(table);
        const active = nav.querySelector('[aria-current="page"]');
        active?.focus({ preventScroll: true });
      });
      controls.append(btn);
    }
    button('Previous', info.page - 1, info.page === 1);
    const pages = [...new Set([1, info.page - 1, info.page, info.page + 1, info.pages])]
      .filter(page => page > 0 && page <= info.pages).sort((a, b) => a - b);
    pages.forEach((page, index) => {
      if (index && page - pages[index - 1] > 1) {
        const gap = document.createElement('span'); gap.textContent = '\u2026'; controls.append(gap);
      }
      button(String(page), page, false, page === info.page);
    });
    button('Next', info.page + 1, info.page === info.pages);
    nav.append(controls);
  }
  function scan() {
    for (const [table, state] of states) {
      if (!table.isConnected) { state.nav.remove(); states.delete(table); }
    }
    document.querySelectorAll('table:not([data-pagination="off"])').forEach(refresh);
  }
  function start() {
    scan();
    let pending = false;
    new MutationObserver(records => {
      const relevant = records.some(record => {
        const element = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (element?.closest('.gm-pagination')) return false;
        if (element?.closest('table')) return true;
        return [...record.addedNodes, ...record.removedNodes].some(node =>
          node.nodeType === 1 && (node.matches('table') || node.querySelector('table')));
      });
      if (!relevant) return;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; scan(); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})(typeof globalThis === 'object' ? globalThis : this);
