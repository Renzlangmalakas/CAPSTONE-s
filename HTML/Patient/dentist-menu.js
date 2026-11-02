(() => {
  const select = document.getElementById('dentistSelect');
  if (!select) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'dentist-menu';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'dentistMenuButton';
  trigger.className = 'dentist-menu-trigger';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'dentistMenuOptions');
  const options = document.createElement('div');
  options.id = 'dentistMenuOptions';
  options.className = 'dentist-menu-options';
  options.setAttribute('role', 'group');
  options.setAttribute('aria-label', 'Available dentists');
  options.hidden = true;
  wrapper.append(trigger, options);
  select.after(wrapper);
  select.hidden = true;
  const label = document.querySelector('label[for="dentistSelect"]');
  if (label) label.htmlFor = trigger.id;
  const close = () => { options.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  function refresh() {
    wrapper.hidden = select.classList.contains("d-none");
    trigger.textContent = select.selectedOptions[0]?.textContent || 'Choose your dentist';
    const available = [...select.options].filter(option => option.value && !option.disabled);
    trigger.disabled = select.disabled || !available.length;
    options.replaceChildren();
    for (const option of available) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option.textContent;
      button.setAttribute('aria-pressed', String(option.selected));
      button.onclick = () => {
        select.value = option.value;
        close();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        refresh();
        if (!wrapper.hidden) trigger.focus();
        else document.querySelector(".selected-dentist-change-btn")?.focus();
      };
      options.append(button);
    }
    if (trigger.disabled) close();
  }
  trigger.onclick = () => { const open = options.hidden; options.hidden = !open; trigger.setAttribute('aria-expanded', String(open)); };
  wrapper.addEventListener('keydown', event => {
    if (event.key === 'Escape') { close(); trigger.focus(); }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      const buttons = [...options.querySelectorAll('button')];
      if (!buttons.length || trigger.disabled) return;
      event.preventDefault(); options.hidden = false; trigger.setAttribute('aria-expanded', 'true');
      let index = buttons.indexOf(document.activeElement);
      index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[index].focus();
    }
  });
  document.addEventListener('click', event => { if (!wrapper.contains(event.target)) close(); });
  wrapper.addEventListener('focusout', event => { if (!wrapper.contains(event.relatedTarget)) close(); });
  select.addEventListener('change', refresh);
  new MutationObserver(refresh).observe(select, { childList: true, subtree: true, attributes: true, characterData: true });
  refresh();
})();
