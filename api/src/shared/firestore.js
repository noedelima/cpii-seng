// =============================================================================
// Acesso ao Firestore via REST, COM o ID token do usuário (Authorization: Bearer).
// As Security Rules continuam mandando — a API não eleva privilégio (sem service
// account). Espelha o "token → PostgREST → RLS" do SANE.
// =============================================================================
const { PROJECT_ID } = require('./auth');
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// Converte o formato tipado do Firestore REST em valor JS simples.
function val(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return v.timestampValue;
  if ('mapValue' in v) return unwrap(v.mapValue.fields || {});
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(val);
  return null;
}
function unwrap(fields = {}) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) out[k] = val(v);
  return out;
}

// GET de um documento por caminho (ex.: "usuarios/abc"). Retorna objeto simples,
// ou null se não existir. Lança em erro de autorização/servidor.
async function docGet(path, token) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const d = await r.json();
  return unwrap(d.fields || {});
}

module.exports = { docGet, unwrap, val, BASE };
