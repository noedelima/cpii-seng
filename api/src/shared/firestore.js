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

// --- Escrita (sob o token do usuário; as Security Rules aprovam ou negam) ----
// Codifica valor JS no formato tipado do Firestore.
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') { const f = {}; for (const [k, x] of Object.entries(v)) f[k] = enc(x); return { mapValue: { fields: f } }; }
  return { nullValue: null };
}

// GET cru (mantém o formato tipado — usado para reescrever arrays como historico).
async function docGetRaw(path, token) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore GET ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

// PATCH com updateMask: define os campos de `fields`; campos no mask e AUSENTES
// de `fields` são APAGADOS (equivalente ao deleteField).
async function patchDoc(path, fields, maskPaths, token) {
  const qs = maskPaths.map((p) => 'updateMask.fieldPaths=' + encodeURIComponent(p)).join('&');
  const r = await fetch(`${BASE}/${path}?${qs}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error('firestore PATCH ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

// POST (cria doc com id automático) — usado para o log de auditoria.
async function createDoc(collection, fields, token) {
  const r = await fetch(`${BASE}/${collection}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error('firestore POST ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}

module.exports = { docGet, docGetRaw, patchDoc, createDoc, enc, unwrap, val, BASE };
