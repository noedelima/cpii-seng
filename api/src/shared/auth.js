// =============================================================================
// Verificação do ID token do Firebase — LOCAL (RS256), sem service account e
// sem apiKey (evita a restrição de HTTP referrer da chave Web no lado servidor).
// Espelha o SANE (validar o JWT antes de tocar o banco); a autoridade de dados
// continua sendo as Security Rules, aplicadas pelo Firestore ao receber o token.
// Zero dependências: usa `crypto` nativo + `fetch` global (Node >= 18).
// =============================================================================
const crypto = require('crypto');

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'cpii-seng';
const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cache = { at: 0, certs: null };
async function getCerts() {
  if (cache.certs && Date.now() - cache.at < 3600e3) return cache.certs;
  const r = await fetch(CERTS_URL);
  if (!r.ok) throw new Error('falha ao obter certificados do Firebase');
  cache = { at: Date.now(), certs: await r.json() };
  return cache.certs;
}

const b64urlJson = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

// Retorna { uid, email, token } se o token for válido; lança em caso contrário.
async function verifyIdToken(token) {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3)
    throw new Error('token ausente ou mal formado');
  const [h, p, sig] = token.split('.');
  const header = b64urlJson(h);
  const payload = b64urlJson(p);
  if (header.alg !== 'RS256') throw new Error('algoritmo inválido');

  const certs = await getCerts();
  const pem = certs[header.kid];
  if (!pem) throw new Error('kid desconhecido');
  const ok = crypto.createVerify('RSA-SHA256').update(h + '.' + p).verify(pem, Buffer.from(sig, 'base64url'));
  if (!ok) throw new Error('assinatura inválida');

  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== PROJECT_ID) throw new Error('aud inválido');
  if (payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID) throw new Error('iss inválido');
  if (!payload.sub) throw new Error('sub vazio');
  if (typeof payload.exp !== 'number' || payload.exp <= now) throw new Error('token expirado');
  if (typeof payload.iat === 'number' && payload.iat > now + 300) throw new Error('iat no futuro');

  return { uid: payload.sub, email: payload.email || null, token };
}

module.exports = { verifyIdToken, PROJECT_ID };
