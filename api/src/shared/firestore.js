// =============================================================================
// Acesso ao Firestore via REST, COM o ID token do usuário (Authorization: Bearer).
// As Security Rules continuam mandando — a API não eleva privilégio (sem service
// account nos dados).
//
// v1.31 (auditoria #11): o registro de auditoria entra NA MESMA transação
// (commit atômico) da operação de negócio — não existe mais escrita sem log
// pela API, nem log de operação que falhou. Nome/e-mail do log vêm do perfil e
// do token (as rules conferem).
// =============================================================================
const crypto = require('crypto');
const { PROJECT_ID } = require('./auth');
const RAIZ = `projects/${PROJECT_ID}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${RAIZ}`;
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

// ---- Escrita atômica (sob o token; as rules aprovam/negam o conjunto) --------
async function commitWrites(writes, token) {
  const r = await fetch(COMMIT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (!r.ok) throw new Error('firestore commit ' + r.status + ': ' + (await r.text()).slice(0, 300));
  return r.json();
}
// Atualiza doc existente: só os campos do mask; `historyEvent` (opcional) faz o
// arrayUnion em `historico` (appendMissingElements) — igual ao SDK.
function writePatch(path, fields, maskPaths, historyEvent) {
  const write = { update: { name: `${RAIZ}/${path}`, fields }, currentDocument: { exists: true } };
  if (maskPaths && maskPaths.length) write.updateMask = { fieldPaths: maskPaths };
  if (historyEvent) write.updateTransforms = [{ fieldPath: 'historico', appendMissingElements: { values: [historyEvent] } }];
  return write;
}
// Merge (cria se não existir) — só os campos do mask.
function writeMerge(path, fields, maskPaths) {
  return { update: { name: `${RAIZ}/${path}`, fields }, updateMask: { fieldPaths: maskPaths } };
}
// Cria doc num id definido; falha se já existir.
function writeCreate(path, fields) {
  return { update: { name: `${RAIZ}/${path}`, fields }, currentDocument: { exists: false } };
}

// ---- Auditoria (#11) ----------------------------------------------------------
// Perfil do chamador (nome exato do cadastro — conferido pelas rules do log).
async function perfilDe(user) {
  try { return (await docGet('usuarios/' + user.uid, user.token)) || {}; } catch { return {}; }
}
async function nomeDoUsuario(user) {
  const p = await perfilDe(user);
  return p.nome || user.email || 'Sistema';
}
const idAleatorio = () => crypto.randomBytes(15).toString('base64url').slice(0, 20);
// Write do log, para entrar no MESMO commit da operação.
function writeLog(user, perfil, acao, alvo, detalhes) {
  return writeCreate('logs/' + idAleatorio(), encFields({
    ts: Date.now(), uid: user.uid, nome: (perfil && perfil.nome) || '', email: user.email || '',
    acao: String(acao || '').slice(0, 120), alvo: String(alvo || '').slice(0, 160),
    detalhes: String(detalhes || '').slice(0, 1000),
  }));
}
// Operação + log em transação única.
async function commitComLog(user, writes, acao, alvo, detalhes) {
  const perfil = await perfilDe(user);
  return commitWrites([...writes, writeLog(user, perfil, acao, alvo, detalhes)], user.token);
}

module.exports = {
  BASE, val, unwrap, enc, encFields,
  docGet, docGetRaw, commitWrites, writePatch, writeMerge, writeCreate,
  perfilDe, nomeDoUsuario, writeLog, commitComLog, idAleatorio,
};
