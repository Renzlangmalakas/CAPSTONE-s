/* Presentation-only enhancements shared by all four portals. */
(() => {
  function start() {
    const sidebar = document.querySelector('.sidebar');
    const trigger = document.getElementById('mobileSidebarToggle');
    const backdrop = document.getElementById('sidebarBackdrop');
    const mobile = matchMedia('(max-width: 1024px)');
    if (sidebar) {
      sidebar.id ||= 'portalSidebar';
      trigger?.setAttribute('aria-controls', sidebar.id);
      let wasOpen = false;
      const syncNavigation = () => {
        const open = mobile.matches && document.body.classList.contains('sidebar-open');
        sidebar.inert = mobile.matches && !open;
        trigger?.setAttribute('aria-expanded', String(open));
        if (open && !wasOpen) sidebar.querySelector('button,a,[tabindex="0"]')?.focus({preventScroll:true});
        if (!open && wasOpen && mobile.matches) trigger?.focus({preventScroll:true});
        wasOpen = open;
      };
      document.addEventListener('keydown', event => {
        if (!mobile.matches || !document.body.classList.contains('sidebar-open')) return;
        if (event.key === 'Escape') { event.preventDefault(); backdrop?.click(); }
        if (event.key === 'Tab') {
          const controls = [...sidebar.querySelectorAll('a[href],button:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
      });
      new MutationObserver(syncNavigation).observe(document.body,{attributes:true,attributeFilter:['class']});
      mobile.addEventListener('change',syncNavigation);
      syncNavigation();
    }
    function labelTables() {
      document.querySelectorAll('table').forEach(table => {
        if (table.matches('[data-responsive="scroll"]') || table.closest('.dentist-schedule-scroll')) return;
        const headers = [...(table.tHead?.rows[0]?.cells || [])];
        if (!headers.length || headers.some(cell => cell.colSpan > 1 || cell.rowSpan > 1)) return;
        table.classList.add('portal-card-table');
        [...table.tBodies].forEach(body => [...body.rows].forEach(row => [...row.cells].forEach((cell,index) => {
          if (cell.colSpan === 1 && headers[index]) cell.dataset.label = headers[index].textContent.trim();
        })));
      });
    }
    let queued = false;
    new MutationObserver(records => {
      if (!records.some(record => !record.target.closest?.('.gm-pagination') && [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches('table,tbody,tr,td,th') || node.querySelector('table'))))) return;
      if (!queued) { queued=true; requestAnimationFrame(() => { queued=false;labelTables(); }); }
    }).observe(document.body,{childList:true,subtree:true});
    labelTables();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
