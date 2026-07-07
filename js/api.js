// =============================================================================
// Cliente da camada de API (Fase 2 — modelo HÍBRIDO).
// As leituras em tempo real continuam DIRETO no Firestore (onSnapshot); esta
// camada cobre escritas e operações sensíveis, com a autorização validada no
// servidor. Envia o ID token do Firebase no header `x-fb-token` (o SWA consome
// o `Authorization`, por isso não usamos Bearer aqui) — espelha o SANE.
// =============================================================================
import { store } from './store.js';

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
};

// Verifica se a camada de API está no ar (usada para o roteamento híbrido).
export async function apiDisponivel() {
  try { const h = await api.health(); return !!(h && h.ok); }
  catch { return false; }
}
