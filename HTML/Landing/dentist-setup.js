(() => {
  const invitation = new URLSearchParams(location.hash.slice(1));
  const token = invitation.get('token') || '', email = invitation.get('email') || '';
  const form = document.getElementById('setupForm'), status = document.getElementById('status');
  document.getElementById('email').value = email;
  if (!token || !email) { form.hidden = true; status.textContent = 'Open the invitation link from your email to set up your account.'; return; }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const password = document.getElementById('password').value;
    if (password !== document.getElementById('confirm').value) { status.textContent = 'Passwords do not match.'; return; }
    const button = document.getElementById('submit'); button.disabled = true; status.textContent = 'Setting up your account...';
    try {
      const response = await fetch('/api/dentist-invitations/accept', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        email, token, password, name:document.getElementById('name').value,
        mobile:document.getElementById('mobile').value,address:document.getElementById('address').value
      })});
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Could not set up your account.');
      form.reset(); form.hidden = true; history.replaceState(null,'',location.pathname);
      status.textContent = result.message; document.getElementById('login').hidden = false;
    } catch(error) { status.textContent = error.message || 'Could not set up your account. Please try again.'; }
    finally { button.disabled = false; }
  });
})();
