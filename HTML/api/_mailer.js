// Per-instance backoff complements scheduled-only reminders. It is not a
// distributed rate limiter: other serverless instances have separate state.
function createMailer(transport, { now = Date.now, cooldownMs = 15 * 60 * 1000 } = {}) {
  let retryAt = 0;
  let pending = Promise.resolve();
  function available() {
    if (now() < retryAt) {
      const error = new Error('Email service is temporarily unavailable. Please try again later.');
      error.code = 'EMAIL_COOLDOWN';
      error.retryAfter = Math.ceil((retryAt - now()) / 1000);
      throw error;
    }
  }
  return {
    available,
    sendMail(message) {
      const task = pending.then(async () => {
        available();
        try { return await transport.sendMail(message); }
        catch (error) {
          // Stop queued sends after authentication or temporary provider errors.
          if (error.code === 'EAUTH' || Number(error.responseCode) >= 400 && Number(error.responseCode) < 500 || ['ETIMEDOUT', 'ECONNECTION'].includes(error.code)) {
            retryAt = now() + cooldownMs;
          }
          throw error;
        }
      });
      pending = task.catch(() => {});
      return task;
    }
  };
}
module.exports = { createMailer };
