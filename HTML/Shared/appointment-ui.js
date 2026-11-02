(function () {
  'use strict';
  const role = document.body.dataset.portalRole;
  const invalid = /\b(invalid|required|cannot|can't|could not|failed|error|not found|not available|unavailable|please|choose|select|enter|only|must|at least|no longer|without numbers|unable|not confirmed|not saved|not synced|reconnect|rejected|exceeds|too large|too small)\b/i;
  const originalToast = window.showToast;
  if (originalToast) window.showToast = function(message, type) {
    const error = ['error','danger','warning'].includes(type) || (!type && invalid.test(String(message)));
    originalToast(message, error ? 'error' : type);
    document.querySelectorAll('#toastMessage,#globalToast,#toastWrap .toast:last-child,.app-toast').forEach(el => {
      el.classList.toggle('gm-validation-error', error);
      el.setAttribute('role', error ? 'alert' : 'status');
      if (error) {
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('class', 'gm-warning-icon');
        icon.setAttribute('aria-hidden', 'true');
        icon.setAttribute('fill', 'none');
        icon.setAttribute('stroke', 'currentColor');
        icon.setAttribute('stroke-width', '1.8');
        icon.setAttribute('stroke-linecap', 'round');
        icon.setAttribute('stroke-linejoin', 'round');
        icon.innerHTML = '<path d="M10.3 3.9 2.1 18.1A2 2 0 0 0 3.8 21h16.4a2 2 0 0 0 1.7-2.9L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 4h.01"/>';
        const text = document.createElement('span');
        text.className = 'gm-warning-text';
        text.textContent = String(message);
        el.replaceChildren(icon, text);
      }
    });
  };
  document.addEventListener('invalid', event => {
    event.target.setAttribute('aria-invalid','true');
    window.showToast?.(event.target.validationMessage || 'Please check this field.', 'error');
  }, true);
  document.addEventListener('input', event => { if (event.target.validity?.valid) event.target.removeAttribute('aria-invalid'); });
  const forbidden = role === 'patient' ? /archiveAppointment|archiveAllHistory|clearAppointments|clearArchive|deleteHistory|deleteAppointment|restoreAppointment|restoreFromArchive|openDelete|permanentDelete|permanentlyDelete|showDelete/ : /archiveAppointment|archiveAllHistory|openArchive|clearArchive/;
  function scan() {
    if (role !== 'admin') document.querySelectorAll('[onclick]').forEach(button => {
      if (forbidden.test(button.getAttribute('onclick'))) button.hidden = true;
    });
    if (role === 'patient') {
      const email = document.getElementById('profileEmail');
      if (email) { email.disabled = true; email.readOnly = true; email.setAttribute('aria-description','Your sign-in email cannot be changed.'); }
    }
    document.querySelectorAll('#historyTableBody,#appointmentsTable').forEach(body => {
      const table = body.closest('table');
      if (!table || table.dataset.dateFilter) return;
      const headers = Array.from(table.tHead?.rows[0]?.cells || []).map(c => c.textContent.trim());
      const index = headers.findIndex(text => /date|schedule/i.test(text));
      if (index < 0) return;
      table.dataset.dateFilter = 'true';
      const bar = document.createElement('div'); bar.className = 'gm-history-dates';
      bar.innerHTML = '<label>From date<input type="date" aria-label="History from date"></label><label>To date<input type="date" aria-label="History to date"></label><button type="button">Clear dates</button><span role="status"></span>';
      const logToolbar = role === 'dentist' && body.id === 'historyTableBody'
        ? document.querySelector('.treatment-log-toolbar') : null;
      if (logToolbar) logToolbar.prepend(bar);
      else table.parentElement.before(bar);
      const [from,to] = bar.querySelectorAll('input');
      function apply() {
        const bad = from.value && to.value && from.value > to.value;
        bar.querySelector('[role=status]').classList.toggle('is-error', Boolean(bad));
        bar.querySelector('[role=status]').textContent = bad ? 'From date must be before to date.' : '';
        const rows = Array.from(body.rows).filter(row => row.cells.length > index);
        let matches = 0;
        for (const row of rows) {
          const text = row.cells[index].textContent.trim();
          const iso = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
          const parsed = iso ? null : new Date(text.split(/[•·]/)[0].trim());
          const date = iso || (parsed && !isNaN(parsed) ? `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,'0')}-${String(parsed.getDate()).padStart(2,'0')}` : '');
          const hide = Boolean(bad || (from.value || to.value) && (!date || from.value && date < from.value || to.value && date > to.value));
          if (row.hidden !== hide) row.hidden = hide;
          if (!hide) matches++;
        }
        if (!bad && (from.value || to.value)) bar.querySelector('[role=status]').textContent = `${matches} matching records`;
      }
      from.onchange = to.onchange = apply;
      const clear = bar.querySelector('button');
      const refreshFrom = setupHistoryCalendar(from);
      const refreshTo = setupHistoryCalendar(to);
      clear.onclick = () => {from.value='';to.value='';refreshFrom();refreshTo();apply();};
      new MutationObserver(apply).observe(body,{childList:true,subtree:true,characterData:true});
      apply();
    });
  }
  scan();
  let queued = false;
  new MutationObserver(records => {
    if (!records.some(record => record.addedNodes.length)) return;
    if (!queued) {queued = true;requestAnimationFrame(()=>{queued=false;scan();});}
  }).observe(document.body,{childList:true,subtree:true});
})();
