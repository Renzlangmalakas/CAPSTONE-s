const crypto = require('node:crypto');

function createSessions(secret) {
  function sign(payload) {
    return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  }
  return {
    issue(user) {
      const payload = Buffer.from(JSON.stringify({ email: user.email, role: user.role, exp: Date.now() + 8 * 60 * 60 * 1000 })).toString('base64url');
      return `${payload}.${sign(payload)}`;
    },
    verify(token) {
      try {
        const [payload, signature, extra] = String(token || '').split('.');
        if (!payload || !signature || extra) return null;
        const actual = Buffer.from(signature, 'base64url');
        const expected = Buffer.from(sign(payload), 'base64url');
        if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
        return claims.email && claims.exp > Date.now() ? claims : null;
      } catch { return null; }
    }
  };
}
module.exports = { createSessions };
