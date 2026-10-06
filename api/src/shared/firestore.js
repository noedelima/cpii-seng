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
  if (v instanceof Date) return { timestampValue:v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
  if (typeof v === 'object') { const f = {}; for (const [k, x] of Object.entries(v)) f[k] = enc(x); return { mapValue: { fields: f } }; }
  return { nullValue: null };
}
const encFields = (obj = {}) => { const f = {}; for (const [k, v] of Object.entries(obj)) f[k] = enc(v); return f; };

// Discard upstream diagnostics; retain only known machine codes for HTTP mapping.
async function responseError(response) {
  let code='UNKNOWN';
  try { const body=await response.json();const candidate=body?.error?.status;
    if (['PERMISSION_DENIED','NOT_FOUND','ALREADY_EXISTS','ABORTED','FAILED_PRECONDITION','INVALID_ARGUMENT','UNAUTHENTICATED','UNAVAILABLE'].includes(candidate)) code=candidate;
  } catch { /* response may not be JSON */ }
  if (code==='UNKNOWN' && response.status===403) code='PERMISSION_DENIED';
  const error=new Error('firestore request failed');error.code=code;error.httpStatus=response.status;return error;
}

// ---- Leitura ----------------------------------------------------------------
async function docGet(path, token) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw await responseError(r);
  return unwrap((await r.json()).fields || {});
}
async function docGetRaw(path, token) {
  const r = await fetch(`${BASE}/${path}`, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 404) return null;
  if (!r.ok) throw await responseError(r);
  return r.json();
}

// All application writes go through mutate; rules require its atomic receipt.
module.exports = { BASE, val, unwrap, enc, encFields, docGet, docGetRaw };

// Atomic source + public projection + audit receipt. No administrative data
// credential is used: every write is still evaluated under the caller's Rules.
const { randomUUID } = require('crypto');
const { publicDemanda, publicConfig, normalizeMutation } = require('./security');
const stable = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const changedKeys = (old, next) => [...new Set([...Object.keys(old || {}), ...Object.keys(next || {})])]
  .filter(k => k !== '_audit' && stable(old?.[k]) !== stable(next?.[k]));
async function mutate(path, patch, user, { create = false, remove = [], event = '' } = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('invalid_patch');
  const [collection, id, extra] = path.split('/');
  if (extra || !['demandas','chamados','internas','profissionais','tarefas','usuarios','config'].includes(collection)
      || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('invalid_mutation_path');
  const actor = await docGet('usuarios/' + user.uid, user.token);
  if (!actor || actor.ativo === false) throw new Error('PERMISSION_DENIED');
  const oldRaw = create ? null : await docGetRaw(path, user.token);
  if (!create && !oldRaw) throw new Error('mutation_not_found');
  const old = oldRaw ? unwrap(oldRaw.fields) : {};
  const data = normalizeMutation(collection, old, patch, { ...user, nome: actor.nome }, event, create);
  remove.forEach(k => { delete data[k]; });
  const eventId = randomUUID();
  data._audit = eventId;
  const fields = Object.fromEntries(Object.entries(data).map(([k, value]) => [k,
    oldRaw && Object.hasOwn(old, k) && stable(value) === stable(old[k]) ? oldRaw.fields[k]
      : value instanceof Date ? { timestampValue: value.toISOString() } : enc(value)]));
  const source = { update: { name: BASE + '/' + path, fields },
    currentDocument: create ? { exists: false } : { updateTime: oldRaw.updateTime } };
  // Firestore resource names omit scheme/hostname and API version.
  const resourceName = p => `projects/${PROJECT_ID}/databases/(default)/documents/${p}`;
  source.update.name = resourceName(path);
  const op = create ? 'create' : 'update';
  const audit = { update: { name: resourceName('logs/' + eventId), fields: encFields({
    uid: user.uid, nome: actor.nome, email: user.email || '', acao: op,
    alvo: path, detalhes: '', col: collection, doc: id, op, fields: changedKeys(create ? {} : old, data),
  }) }, currentDocument: { exists: false },
    updateTransforms: [{ fieldPath: 'ts', setToServerValue: 'REQUEST_TIME' }] };
  const writes = [source, audit];
  if (collection === 'demandas') {
    const published=encFields(publicDemanda(id,data));
    if (fields.expurgarEm?.timestampValue) published.expurgarEm=fields.expurgarEm;
    writes.push({update:{name:resourceName('publicDemandas/'+id),fields:published}});
  }
  if (collection === 'config' && ['params','transparencia'].includes(id))
    writes.push({ update: { name: resourceName('publicConfig/' + id), fields: encFields(publicConfig(id, data)) } });
  const response = await fetch(COMMIT, { method: 'POST', headers: { Authorization: 'Bearer ' + user.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ writes }) });
  if (!response.ok) {
    const error=await responseError(response);
    // Rules can evaluate an audit's changed fields against a concurrently
    // updated document before rejecting its updateTime precondition. Keep the
    // write rejected, but distinguish a readable version conflict from an
    // actual loss of permission. A failed re-read preserves the denial.
    if (!create && error.code === 'PERMISSION_DENIED') {
      try {
        const current=await docGetRaw(path,user.token);
        if (!current || current.updateTime !== oldRaw.updateTime) error.code='FAILED_PRECONDITION';
      } catch { /* access may have been revoked; do not disclose new state */ }
    }
    throw error;
  }
  return { id, eventId };
}
module.exports.mutate = mutate;
