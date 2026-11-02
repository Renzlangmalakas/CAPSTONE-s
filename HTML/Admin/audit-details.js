(function () {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const display = value => value == null || value === '' ? 'Not recorded' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  window.openAuditDetails = function (row, opener) {
    if (!row) return;
    document.querySelector('.audit-detail-dialog')?.close();
    const dialog = document.createElement('dialog');
    dialog.className = 'audit-detail-dialog';
    dialog.setAttribute('aria-labelledby', 'audit-detail-title');
    const fields = [['Date / time',row.created_at],['Account',row.actor_email],['Role',row.actor_role],['Outcome',row.outcome],['Account ID',row.actor_id],['Record ID',row.resource],['IP address',row.ip_address],['Module',row.module],['Device / user agent',row.user_agent]];
    dialog.innerHTML = `<header><div><p>Audit event</p><h2 id="audit-detail-title">${escape(row.action || 'Event details')}</h2></div><button type="button" aria-label="Close audit details" class="audit-dialog-close">&times;</button></header>
      <div class="audit-dialog-body"><dl class="audit-metadata">${fields.map(([label,value])=>`<div${label==='Device / user agent'?' class="audit-wide"':''}><dt>${label}</dt><dd>${escape(display(value))}</dd></div>`).join('')}</dl>
      <section class="audit-changes" aria-label="Record changes"><article><h3>Before state</h3><pre>${escape(display(row.before_state))}</pre></article><article><h3>After state</h3><pre>${escape(display(row.after_state))}</pre></article></section>
      ${row.error_reason ? `<section class="audit-error-detail"><h3>Error reason</h3><p>${escape(row.error_reason)}</p></section>` : ''}
      <details class="audit-raw-details"><summary>Full event details</summary><pre>${escape(display(row.details))}</pre></details></div>
      <footer><button type="button" class="audit-dialog-done">Close details</button></footer>`;
    dialog.querySelector('.audit-dialog-close').onclick = dialog.querySelector('.audit-dialog-done').onclick = () => dialog.close();
    dialog.addEventListener('click', event => { if(event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => { dialog.remove(); opener?.focus(); });
    document.body.appendChild(dialog);
    dialog.showModal();
  };
})();
