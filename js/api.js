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
  // Escritas (híbrido): espelham os métodos do provider; rodam sob as rules.
  criarDemanda: (id, data) => req('PUT', '/demandas/' + encodeURIComponent(id), { data }),
  atualizarDemanda: (id, patch, evento) => req('PATCH', '/demandas/' + encodeURIComponent(id), { patch, evento }),
  arquivar: (id) => req('POST', '/demandas/' + encodeURIComponent(id) + '/arquivar'),
  resgatar: (id) => req('POST', '/demandas/' + encodeURIComponent(id) + '/resgatar'),
  setInterna: (id, patch) => req('PATCH', '/internas/' + encodeURIComponent(id), { patch }),
  salvarProfissional: (p) => req('POST', '/profissionais', { p }),
  setParams: (p) => req('PATCH', '/config/params', { p }),
};

// Roteamento híbrido. Fase 2 concluída: a API é o caminho de escrita PADRÃO
// onde ela existe (Azure Static Web Apps / domínio próprio). No GitHub Pages e em
// localhost (sem Functions) as escritas seguem DIRETO no Firestore. Isso torna a
// promoção segura mesmo com os dois hosts no ar. Override manual por sessão:
// `?api=1` força ligar, `?api=0` força desligar (gravado no localStorage);
// `USE_API` (config) força ligar em qualquer origem.
export function apiLigada() {
  try {
    const p = new URLSearchParams(location.search);
    if (p.get('api') === '1') localStorage.setItem('seng-use-api', '1');
    if (p.get('api') === '0') localStorage.setItem('seng-use-api', '0');
    const ov = localStorage.getItem('seng-use-api');
    if (ov === '1') return true;
    if (ov === '0') return false;
    if (USE_API) return true;
    const h = (location.hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === 'github.io' || h.endsWith('.github.io')) return false;
    return true; // demais origens (SWA / domínio próprio) têm a API
  } catch { return USE_API; }
}

// Verifica se a camada de API está no ar (usada para o roteamento híbrido).
export async function apiDisponivel() {
  try { const h = await api.health(); return !!(h && h.ok); }
  catch { return false; }
}
