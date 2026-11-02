(function () {
  let active = false;
  const sessionKey = 'gm_dental_current_user';
  function session() {
    try { return JSON.parse(sessionStorage.getItem(sessionKey) || '{}'); } catch { return {}; }
  }
  async function request(path, body, method = 'POST') {
    const base = window.GmDentalSupabaseSync?.apiBaseUrl || '';
    const response = await window.GmDentalApiFetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if(response.status===304)return {user:session(),message:'No changes to save.'};
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'Unable to verify your account. Please try again.');
    return result;
  }
  window.GmAccountSecurity = {
    update(changes, verifyOnly = false) {
      if (active) return Promise.resolve(null);
      active = true;
      return new Promise(resolve => {
        const dialog = document.createElement('dialog');
        dialog.className = 'gm-account-security';
        dialog.setAttribute('aria-labelledby', 'gm-security-title');
        dialog.innerHTML = `<form>
          <h2 id="gm-security-title">Verify account changes</h2>
          <p class="gm-security-description"></p>
          <label for="gm-current-password">Current password</label>
          <input id="gm-current-password" type="password" autocomplete="current-password" required maxlength="72" />
          <div class="gm-code-fields" hidden>
            <label for="gm-email-code">Email verification code</label>
            <input id="gm-email-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" />
            <button type="button" class="gm-resend">Send a new code</button>
          </div>
          <p class="gm-security-status" role="status" aria-live="polite"></p>
          <div class="gm-security-actions"><button type="button" class="gm-cancel">Cancel</button><button type="submit" class="gm-submit"></button></div>
        </form>`;
        const form = dialog.querySelector('form');
        const password = dialog.querySelector('#gm-current-password');
        const otp = dialog.querySelector('#gm-email-code');
        const submit = dialog.querySelector('.gm-submit');
        const status = dialog.querySelector('.gm-security-status');
        let codeSent = false;
        let busy = false;
        const changingPassword = !!changes.newPassword;
        if (verifyOnly) dialog.querySelector('#gm-security-title').textContent = 'Verify current password';
        dialog.querySelector('.gm-security-description').textContent = verifyOnly
          ? 'Enter your current password to unlock the new password fields.'
          : changingPassword
          ? `Enter your current password to send a verification code to ${session().email || 'your registered email'}. Then enter the code to save your new password.`
          : 'Enter your current password to save your name, phone number, or profile role.';
        submit.textContent = verifyOnly ? 'Verify and continue' : changingPassword ? 'Send verification code' : 'Verify and save';
        function close(result) {
          password.value = '';
          otp.value = '';
          dialog.close();
          dialog.remove();
          active = false;
          resolve(result);
        }
        dialog.querySelector('.gm-cancel').onclick = () => { if (!busy) close(null); };
        dialog.addEventListener('cancel', event => { event.preventDefault(); if (!busy) close(null); });
        async function sendCode() {
          if (!password.value) throw new Error('Enter your current password first.');
          const result = await request('/api/account/verification-code', { currentPassword: password.value });
          codeSent = true;
          dialog.querySelector('.gm-code-fields').hidden = false;
          otp.required = true;
          submit.textContent = 'Verify and save';
          status.textContent = result.message;
          otp.focus();
        }
        async function run(task) {
          if (busy) return;
          busy = true;
          dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
          status.textContent = 'Verifying…';
          status.classList.remove('is-error');
          try { await task(); }
          catch (error) { status.classList.add('is-error'); status.textContent = error.message; }
          finally {
            busy = false;
            dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
          }
        }
        dialog.querySelector('.gm-resend').onclick = () => run(sendCode);
        form.onsubmit = event => {
          event.preventDefault();
          run(async () => {
            if (verifyOnly) {
              await request('/api/account/verify-password', { currentPassword: password.value });
              close(true);
              return;
            }
            if (changingPassword && !codeSent) { await sendCode(); return; }
            const result = await request('/api/account', { ...changes, currentPassword: password.value, otp: otp.value }, 'PATCH');
            const updated = { ...session(), ...result.user, sessionToken: result.sessionToken };
            sessionStorage.setItem(sessionKey, JSON.stringify(updated));
            window.dispatchEvent(new Event('gm-account-saved'));
            close(updated);
          });
        };
        document.body.appendChild(dialog);
        dialog.showModal();
        password.focus();
      });
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    for (const id of ['adminEmail', 'staffEmail', 'profileEmail']) {
      const input = document.getElementById(id);
      if (input) { input.readOnly = true; input.title = 'Your registered email is used for account verification.'; }
    }
    const field = document.getElementById('adminPassword') || document.getElementById('staffPassword') || document.getElementById('profileNewPassword');
    if (field) {
      const confirm = document.getElementById('adminConfirm') || document.getElementById('staffConfirmPassword') || document.getElementById('profileConfirmPassword');
      const groups = [field.parentElement, confirm.parentElement];
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'gm-change-password';
      toggle.textContent = 'Change Password';
      toggle.setAttribute('aria-expanded', 'false');
      groups.forEach((group, index) => { group.id = `gm-password-field-${index}`; });
      toggle.setAttribute('aria-controls', groups.map(group => group.id).join(' '));
      groups[0].before(toggle);
      function collapse() {
        groups.forEach(group => { group.hidden = true; });
        field.value = '';
        confirm.value = '';
        toggle.textContent = 'Change Password';
        toggle.setAttribute('aria-expanded', 'false');
      }
      collapse();
      toggle.addEventListener('click', async () => {
        if (toggle.getAttribute('aria-expanded') === 'true') { collapse(); return; }
        const verified = await window.GmAccountSecurity.update({}, true);
        if (!verified) return;
        // Patient and Dentist fields are unlocked by their existing edit action.
        if (field.disabled) document.getElementById('editProfileBtn')?.click();
        groups.forEach(group => { group.hidden = false; });
        toggle.textContent = 'Cancel Password Change';
        toggle.setAttribute('aria-expanded', 'true');
        field.focus();
      });
      window.addEventListener('gm-account-saved', collapse);
      const hint = document.createElement('p');
      hint.className = 'gm-account-hint';
      hint.textContent = 'Saving account details requires your current password. A new password also requires a code sent to your registered email. Use at least 8 characters with uppercase, lowercase, a number, and a special character.';
      field.parentElement.appendChild(hint);
    }
  });
})();
