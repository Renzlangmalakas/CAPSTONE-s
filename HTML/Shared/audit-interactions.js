(function () {
  window.recordAuditInteraction = async function (type, scope = '') {
    if (!window.GmDentalApiFetch) return;
    const response = await window.GmDentalApiFetch(`${window.GmDentalSupabaseSync?.apiBaseUrl || ''}/api/audit-events`, {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,scope})
    });
    if (!response.ok) throw new Error('The activity could not be recorded in the audit log.');
  };
  const report = (type, scope) => window.recordAuditInteraction(type,scope).catch(error => {
    console.error(error.message);
    if (typeof window.showToast === 'function') window.showToast(error.message);
  });
  document.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const button = event.target.closest('[data-section],[data-section-jump],[onclick]');
    if (!button) return;
    const section = button.dataset.section || button.dataset.sectionJump || button.getAttribute('onclick') || '';
    const role = document.body.dataset.portalRole;
    if (role === 'patient' && /history/i.test(section)) report('history');
    if ((role === 'admin' || role === 'staff') && section === 'revenue') {
      report('revenue', document.querySelector('#revenueDateFilter')?.selectedOptions[0]?.textContent || 'Today');
    }
  });
  document.addEventListener('change', event => {
    if (!event.isTrusted || !['revenueDateFilter','revenueDateSpecific','revenueStartDate','revenueEndDate'].includes(event.target.id)) return;
    const start=document.querySelector('#revenueStartDate')?.value, end=document.querySelector('#revenueEndDate')?.value;
    const mode=document.querySelector('#revenueDateFilter');
    if (mode?.value==='custom' && (!start||!end||end<start)) return;
    report('revenue',mode?.value==='custom'?`${start} to ${end}`:document.querySelector('#revenueDateSpecific')?.value||mode?.selectedOptions[0]?.textContent||'Selected period');
  });
})();
