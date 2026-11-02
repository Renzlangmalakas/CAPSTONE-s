(() => {
  const month = document.getElementById('regBirthMonth');
  const day = document.getElementById('regBirthDay');
  const year = document.getElementById('regBirthYear');
  const dob = document.getElementById('regDOB');
  const mobile = document.getElementById('regMobile');
  const fullName = document.getElementById('regName');
  const validateName = () => fullName?.setCustomValidity(window.GMNameValidation.validate(fullName.value));
  fullName?.addEventListener('beforeinput', event => {
    if (!event.isComposing && event.inputType === 'insertText' && /\p{N}/u.test(event.data || '')) event.preventDefault();
  });
  function cleanName() {
    const cursor = fullName.selectionStart;
    const value = fullName.value;
    fullName.value = value.replace(/\p{N}/gu, '');
    if (cursor !== null && value !== fullName.value) {
      const position = value.slice(0, cursor).replace(/\p{N}/gu, '').length;
      fullName.setSelectionRange(position, position);
    }
    validateName();
  }
  fullName?.addEventListener('input', event => { if (!event.isComposing) cleanName(); });
  fullName?.addEventListener('compositionend', cleanName);
  const form = document.getElementById('registerFormElement');
  form?.addEventListener('submit', event => {
    validateName();
    if (fullName && !fullName.checkValidity()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      fullName.reportValidity();
    }
  }, true);
  if (!month || !day || !year || !dob) return;

  const today = new Date();
  for (let i = 0; i < 12; i++) {
    month.add(new Option(new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' }), String(i + 1)));
  }
  for (let value = today.getFullYear(); value >= today.getFullYear() - 120; value--) {
    year.add(new Option(String(value), String(value)));
  }

  function updateBirthDate() {
    const selectedDay = day.value;
    const daysInMonth = month.value ? new Date(Number(year.value) || 2000, Number(month.value), 0).getDate() : 31;
    day.length = 1;
    for (let value = 1; value <= daysInMonth; value++) day.add(new Option(String(value), String(value)));
    day.value = Number(selectedDay) <= daysInMonth ? selectedDay : '';
    dob.value = '';
    month.setCustomValidity('');
    day.setCustomValidity('');
    year.setCustomValidity('');
    const fields = [month, day, year];
    if (!fields.some(field => field.value)) return;
    const missing = fields.find(field => !field.value);
    if (missing) {
      missing.setCustomValidity('Please select a complete date of birth.');
      return;
    }
    const selected = new Date(Number(year.value), Number(month.value) - 1, Number(day.value));
    if (selected > today) {
      year.setCustomValidity('Date of birth cannot be in the future.');
      return;
    }
    dob.value = `${year.value}-${month.value.padStart(2, '0')}-${day.value.padStart(2, '0')}`;
  }
  [month, day, year].forEach(field => field.addEventListener('change', updateBirthDate));
  mobile?.addEventListener('input', () => {
    mobile.value = mobile.value.replace(/\D/g, '').slice(0, 12);
  });
  form?.addEventListener('reset', () => { fullName?.setCustomValidity(''); setTimeout(updateBirthDate, 0); });
  updateBirthDate();
})();
