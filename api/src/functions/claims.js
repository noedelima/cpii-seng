// =============================================================================
// Sincronização das CUSTOM CLAIMS (role/campi) — hardening do Storage (ADR-002).
// A fonte da verdade é /usuarios/{uid} no Firestore (gerido só pelo admin, sob
// as Security Rules). Estes endpoints copiam o perfil para claims no ID token,
// que as Storage rules leem SEM cross-service (request.auth.token.role/.campi).
//   POST /api/claims/self — o próprio usuário sincroniza as suas claims
//                           (lê o próprio doc; sem escalada possível).
//   POST /api/claims/sync — admin sincroniza as claims de { uid } (após criar,
//                           editar ou desativar usuário).
// Sem FB_SA_JSON configurada → 501 (recurso dormente; nada quebra).
// =============================================================================
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { docGet, logAudit } = require('../shared/firestore');
const { claimsDisponiveis, setCustomClaims } = require('../shared/adminAuth');

const ROLES = ['campus', 'engenharia', 'chefe', 'codir', 'admin'];

// Perfil (doc /usuarios) → claims mínimas. Inativo ou perfil inválido → {}
// (token sem claims = negado pelas Storage rules).
function claimsDoPerfil(p) {
  if (!p || p.ativo === false || !ROLES.includes(p.role)) return {};
  const claims = { role: p.role };
  if (p.role === 'campus') {
    const campi = (Array.isArray(p.campi) && p.campi.length) ? p.campi
      : (p.campus ? [p.campus] : []);
    claims.campi = campi.filter((c) => typeof c === 'string' && c.length <= 8).slice(0, 16);
  }
  return claims;
}

app.http('claimsSelf', {
  methods: ['POST'], authLevel: 'anonymous', route: 'claims/self',
  handler: withAuth(async ({ user }) => {
    if (!claimsDisponiveis()) return json(501, { error: 'claims não configuradas (FB_SA_JSON)' });
    const perfil = await docGet('usuarios/' + user.uid, user.token); // rules: lê o próprio doc
    const claims = claimsDoPerfil(perfil);
    await setCustomClaims(user.uid, claims);
    return json(200, { ok: true, claims });
  }),
});

app.http('claimsSync', {
  methods: ['POST'], authLevel: 'anonymous', route: 'claims/sync',
  handler: withAuth(async ({ request, user }) => {
    if (!claimsDisponiveis()) return json(501, { error: 'claims não configuradas (FB_SA_JSON)' });
    const body = await request.json().catch(() => ({}));
    const uid = body && body.uid;
    if (!uid || typeof uid !== 'string') return json(400, { error: 'uid obrigatório' });
    const chamador = await docGet('usuarios/' + user.uid, user.token);
    if (!chamador || chamador.role !== 'admin' || chamador.ativo === false)
      return json(403, { error: 'somente administradores' });
    const perfil = await docGet('usuarios/' + uid, user.token); // admin lê qualquer usuário (rules)
    if (!perfil) return json(404, { error: 'usuário sem perfil em /usuarios' });
    const claims = claimsDoPerfil(perfil);
    await setCustomClaims(uid, claims);
    await logAudit(user, chamador.nome, 'Claims sincronizadas [via API]', uid, JSON.stringify(claims));
    return json(200, { ok: true, uid, claims });
  }),
});
