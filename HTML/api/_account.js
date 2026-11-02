const bcrypt = require('bcrypt');
const crypto = require('node:crypto');

// Authentication identity always comes from the signed session, never the form.
function createAccountHandlers({ findUser, readCode, saveCode, commit, sendCode, publicUser, sessions, strongPassword, now = Date.now }) {
  const fail = (status, message) => Object.assign(new Error(message), { status });
  async function authenticate(req) {
    if (!req.user?.email) throw fail(401, 'Please sign in again.');
    const user = await findUser(req.user.email);
    const password = req.body?.currentPassword;
    if (!user || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72 || !(await bcrypt.compare(password, user.password))) {
      throw fail(403, 'Your current password is incorrect.');
    }
    return user;
  }
  function handler(fn) {
    return async (req, res) => {
      try { await fn(req, res); }
      catch (error) {
        if (!error.status) console.error('Account update failed:', error.code || 'storage or email unavailable');
        const emailMessages = {
          EMAIL_NOT_CONFIGURED: 'Verification email is not configured. Please contact the clinic administrator. Your password has not changed.',
          EAUTH: 'Verification email could not be sent because the email provider rejected the clinic login. Please contact the clinic administrator. Your password has not changed.',
          EMAIL_COOLDOWN: 'Verification email is temporarily paused. Please try again later. Your password has not changed.'
        };
        res.status(error.status || 503).json({ message: error.status ? error.message : emailMessages[error.code] || 'Account service is unavailable. Please try again.' });
      }
    };
  }
  return {
    verifyPassword: handler(async (req, res) => {
      await authenticate(req);
      res.json({ verified: true });
    }),
    requestCode: handler(async (req, res) => {
      const user = await authenticate(req);
      const previous = await readCode(user.email);
      if (previous?.sentAt && now() - previous.sentAt < 60000) throw fail(429, 'Please wait one minute before requesting another code.');
      const otp = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      const entry = { purpose: 'account-change', otpHash: await bcrypt.hash(otp, 10), attempts: 0, sentAt: now(), expiresAt: now() + 10 * 60 * 1000 };
      if (!(await saveCode(user.email, entry, previous))) throw fail(409, 'Another code was requested. Please try again.');
      try { await sendCode(user, otp); }
      catch (error) { await saveCode(user.email, null, entry); throw error; }
      res.json({ message: 'Verification code sent to your registered email. It expires in 10 minutes.' });
    }),
    update: handler(async (req, res) => {
      const user = await authenticate(req);
      const body = req.body || {};
      if ('role' in body && body.role !== user.role) throw fail(403, 'Account access roles cannot be changed in profile settings.');
      if ('email' in body && body.email !== user.email) throw fail(400, 'The registered email cannot be changed here.');
      const changes = {};
      if ('name' in body) {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 120) throw fail(400, 'Enter a full name of up to 120 characters.');
        changes.name = body.name.trim();
      }
      if ('mobile' in body) {
        if (typeof body.mobile !== 'string' || (body.mobile.trim() && !/^[+\d\s().-]{7,25}$/.test(body.mobile.trim()))) throw fail(400, 'Enter a valid phone number.');
        changes.mobile = body.mobile.trim();
      }
      if ('profileTitle' in body) {
        if (!['admin', 'staff'].includes(user.role)) throw fail(403, 'Only Admin and Staff have a profile role field.');
        if (typeof body.profileTitle !== 'string' || !body.profileTitle.trim() || body.profileTitle.trim().length > 80) throw fail(400, 'Enter a role title of up to 80 characters.');
        changes.profile_title = body.profileTitle.trim();
      }
      let entry;
      if (body.newPassword) {
        if (typeof body.newPassword !== 'string' || Buffer.byteLength(body.newPassword) > 72 || !strongPassword(body.newPassword)) throw fail(400, 'Use at least 8 characters with uppercase, lowercase, a number, and a special character (maximum 72 bytes).');
        entry = await readCode(user.email);
        if (!entry || entry.purpose !== 'account-change' || entry.expiresAt <= now() || entry.attempts >= 5) throw fail(400, 'Request a new email verification code.');
        // Consume an attempt with a compare-and-set before checking the code.
        const attempted = { ...entry, attempts: entry.attempts + 1 };
        if (!(await saveCode(user.email, attempted, entry))) throw fail(409, 'Verification changed. Please retry.');
        entry = attempted;
        if (!/^\d{6}$/.test(body.otp || '') || !(await bcrypt.compare(String(body.otp), entry.otpHash))) throw fail(400, 'Invalid verification code.');
        if (await bcrypt.compare(body.newPassword, user.password)) throw fail(400, 'Choose a password different from your current password.');
        changes.password = await bcrypt.hash(body.newPassword, 10);
        changes.verification_token = null;
      }
      if (Object.entries(changes).every(([key,value])=>value===(key==='profile_title'?user.profileTitle:user[key]))) return res.status(304).end();
      // The password and OTP token are checked again by the database update.
      // A simultaneous request cannot reuse a consumed code or old password.
      const updated = await commit(user, changes, entry);
      if (!updated) throw fail(409, 'Your account changed during verification. Please sign in again and retry.');
      res.json({ message: 'Account updated.', user: publicUser(updated), sessionToken: sessions.issue(updated) });
    })
  };
}
module.exports = { createAccountHandlers };
