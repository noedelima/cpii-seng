// =============================================================================
// Cliente da camada de API (Fase 2 — modelo HÍBRIDO).
// As leituras em tempo real continuam DIRETO no Firestore (onSnapshot); esta
// camada cobre escritas e operações sensíveis, com a autorização validada no
// servidor. Envia o ID token do Firebase no header `x-fb-token` (o SWA consome
// o `Authorization`, por isso não usamos Bearer aqui) — espelha o SANE.
// =============================================================================
import { store } from './store.js';
import { USE_API } from './config.js';

async function idToken() {
  const s = store();
  const u = s && s.auth && s.auth.currentUser;   // presente só no FirebaseProvider
  return u ? await u.getIdToken() : null;
}

async function req(method, path, body) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const t = await idToken();
  if (t) headers['x-fb-token'] = t;
  const r = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* resposta sem corpo */ }
  if (!r.ok) throw new Error((data && (data.error || data.detalhe)) || ('HTTP ' + r.status));
  return data;
}

export const api = {
  health: () => req('GET', '/health'),
  me: () => req('GET', '/me'),
  arquivar: (id) => req('POST', '/demandas/' + encodeURIComponent(id) + '/arquivar'),
  resgatar: (id) => req('POST', '/demandas/' + encodeURIComponent(id) + '/resgatar'),
};

// Roteamento híbrido: liga a API por SESSÃO sem afetar a produção dos demais.
// `?api=1` na URL liga (grava no localStorage); `?api=0` desliga. Default: USE_API.
export function apiLigada() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('api') === '1') localStorage.setItem('seng-use-api', '1');
    if (p.get('api') === '0') localStorage.removeItem('seng-use-api');
    return USE_API || localStorage.getItem('seng-use-api') === '1';
  } catch { return USE_API; }
}

// Verifica se a camada de API está no ar (usada para o roteamento híbrido).
export async function apiDisponivel() {
  try { const h = await api.health(); return !!(h && h.ok); }
  catch { return false; }
}
