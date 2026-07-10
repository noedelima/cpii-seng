// =============================================================================
// Credencial administrativa DEDICADA para custom claims (hardening do Storage —
// ADR-002). Usa uma service account EXCLUSIVA com o papel "Firebase
// Authentication Admin" (roles/firebaseauth.admin): pode gerir contas/claims,
// mas NÃO lê nem escreve Firestore/Storage — o princípio "a API não eleva
// privilégio sobre os dados" permanece.
// A chave JSON fica na App Setting FB_SA_JSON do SWA (nunca no repositório).
// Zero dependências: JWT assinado com `crypto` + `fetch` global (Node >= 18).
// =============================================================================
const crypto = require('crypto');
const { PROJECT_ID } = require('./auth');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

function saConfig() {
  const raw = process.env.FB_SA_JSON || '';
  if (!raw) return null;
  try {
    const sa = JSON.parse(raw);
    return (sa.client_email && sa.private_key) ? sa : null;
  } catch { return null; }
}
const claimsDisponiveis = () => !!saConfig();

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

let cache = { at: 0, token: null };
async function accessToken() {
  if (cache.token && Date.now() - cache.at < 50 * 60e3) return cache.token;
  const sa = saConfig();
  if (!sa) throw new Error('FB_SA_JSON ausente — claims não configuradas');
  const now = Math.floor(Date.now() / 1000);
  const semAssinatura = b64url({ alg: 'RS256', typ: 'JWT' }) + '.' +
    b64url({ iss: sa.client_email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 });
  const assinatura = crypto.createSign('RSA-SHA256')
    .update(semAssinatura).sign(sa.private_key).toString('base64url');
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: semAssinatura + '.' + assinatura,
    }),
  });
  if (!r.ok) throw new Error('oauth ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const data = await r.json();
  cache = { at: Date.now(), token: data.access_token };
  return cache.token;
}

// Define (substitui) as custom claims do usuário no Firebase Auth.
// Limite do Firebase: 1000 caracteres serializados.
async function setCustomClaims(uid, claims) {
  const s = JSON.stringify(claims || {});
  if (s.length > 1000) throw new Error('claims excedem 1000 caracteres');
  const t = await accessToken();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts:update`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId: uid, customAttributes: s }),
  });
  if (!r.ok) throw new Error('accounts:update ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return claims;
}

module.exports = { claimsDisponiveis, setCustomClaims };
