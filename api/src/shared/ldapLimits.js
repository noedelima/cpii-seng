// Per-instance guard. Activation also requires an externally enforced global
// limit: instances do not share memory. DTI must supply the policy explicitly.
const { createHash } = require('crypto');
let windowStart = 0;
let total = 0;
let running = 0;
const accounts = new Map();

function policy() {
  const read = name => Number(process.env[name]);
  const p = {
    concurrent: read('LDAP_MAX_CONCURRENT'),
    account: read('LDAP_ACCOUNT_ATTEMPTS'),
    global: read('LDAP_GLOBAL_ATTEMPTS'),
    window: read('LDAP_WINDOW_SECONDS'),
  };
  return process.env.LDAP_GLOBAL_LIMIT_ENFORCED === 'true'
    && Object.values(p).every(n => Number.isSafeInteger(n) && n > 0) ? p : null;
}

function reserve(matricula) {
  const p = policy();
  if (!p) return { status: 503 };
  const now = Date.now();
  if (now - windowStart >= p.window * 1000) {
    windowStart = now; total = 0; accounts.clear();
  }
  const key = createHash('sha256').update(matricula).digest('hex');
  const used = accounts.get(key) || 0;
  if (running >= p.concurrent || total >= p.global || used >= p.account) {
    return { status: 429, retryAfter: Math.max(1, Math.ceil((windowStart + p.window * 1000 - now) / 1000)) };
  }
  running++; total++; accounts.set(key, used + 1);
  let released = false;
  return { status: 200, release() { if (!released) { running--; released = true; } } };
}

module.exports = { reserve, policy };
