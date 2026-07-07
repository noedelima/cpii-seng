// =============================================================================
// Acesso ao Firestore via REST, COM o ID token do usuário (Authorization: Bearer).
// As Security Rules continuam mandando — a API não eleva privilégio (sem service
// account). Espelha o "token → PostgREST → RLS" do SANE.
// =============================================================================
const { PROJECT_ID } = require('./auth');
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const COMMIT = `${BASE}:commit`;

// ---- Decodificação (formato tipado do Firestore → valor JS) -----------------
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

// ---- Codificação (valor JS → formato tipado) --------------------------------
function enc(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') { const f = {}; for (const [k, x] of Object.entries(v)) f[k] = enc(x); return { mapValue: { fields: f } }; }
  return { nullValue: null };
}
const encFields = (obj = {}) => { const f = {}; for (const [k, v] of Object.entries(obj)) f[k] = enc(v); return f; };

// ---- Leitura ----------------------------------------------------------------
async function docGet(path, token) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore GET ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return unwrap((await r.json()).fields || {});
}
async function docGetRaw(path, token) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('firestore GET ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}

// ---- Escrita (sob o token; as rules aprovam/negam) --------------------------
// PATCH com updateMask: define os campos de `fields`; campos no mask e ausentes
// de `fields` são apagados (deleteField). Cria o doc se não existir (merge/upsert).
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
async function createDoc(collection, fields, token) {
  const r = await fetch(`${BASE}/${collection}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!r.ok) throw new Error('firestore POST ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
async function commitWrite(write, token) {
  const r = await fetch(COMMIT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [write] }),
  });
  if (!r.ok) throw new Error('firestore commit ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}
// Atualiza doc existente: só os campos do mask; `historyEvent` (opcional) faz o
// arrayUnion em `historico` (appendMissingElements) — igual ao SDK.
async function commitPatch(path, fields, maskPaths, historyEvent, token) {
  const name = `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const write = { update: { name, fields }, currentDocument: { exists: true } };
  if (maskPaths && maskPaths.length) write.updateMask = { fieldPaths: maskPaths };
  if (historyEvent) write.updateTransforms = [{ fieldPath: 'historico', appendMissingElements: { values: [historyEvent] } }];
  return commitWrite(write, token);
}
// Cria doc num id definido; falha se já existir.
async function commitCreate(path, fields, token) {
  const name = `projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  return commitWrite({ update: { name, fields }, currentDocument: { exists: false } }, token);
}

// ---- Auxiliares (nome do usuário + auditoria append-only) -------------------
async function nomeDoUsuario(user) {
  try { const p = await docGet('usuarios/' + user.uid, user.token); return (p && p.nome) || user.email || 'Sistema'; }
  catch { return user.email || 'Sistema'; }
}
async function logAudit(user, nome, acao, alvo, detalhes) {
  try {
    await createDoc('logs', encFields({
      ts: Date.now(), uid: user.uid, nome: nome || user.email || 'Sistema', email: user.email || '',
      acao: String(acao || '').slice(0, 120), alvo: String(alvo || '').slice(0, 160), detalhes: String(detalhes || '').slice(0, 1000),
    }), user.token);
  } catch { /* auditoria best-effort */ }
}

module.exports = {
  BASE, val, unwrap, enc, encFields,
  docGet, docGetRaw, patchDoc, createDoc, commitPatch, commitCreate,
  nomeDoUsuario, logAudit,
};
