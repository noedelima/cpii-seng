// =============================================================================
// Autenticação por MATRÍCULA/SENHA DE REDE (AD/LDAP) — ADR-003 — DORMENTE.
// Fluxo (quando ativado pela DTI):
//   1. POST /api/auth/matricula { matricula, senha }
//   2. Bind LDAP com a credencial de rede (mesma do SUAP) — shared/ldap.js.
//   3. Localiza o usuário no Firestore pela matrícula (índice principal, v1.25)
//      — consulta administrativa (service account, escopo datastore).
//   4. Emite um CUSTOM TOKEN do Firebase → o cliente troca por sessão com
//      signInWithCustomToken; a partir daí NADA muda (rules, claims, app).
//
// ATIVAÇÃO (checklist — ver docs/ADR-003-autenticacao-matricula.md):
//   • App Settings no SWA: LDAP_URL (ldaps://…), LDAP_BIND_TEMPLATE
//     (ex.: "{matricula}@cp2.g12.br" ou "uid={matricula},ou=pessoas,dc=…").
//   • Service account FB_SA_JSON com papéis adicionais: Service Account Token
//     Creator (custom token) e Cloud Datastore Viewer (consulta por matrícula).
//   • Todos os usuários com `matricula` preenchida no cadastro (Administração).
// Sem LDAP_URL → 503 e nada muda no login atual (e-mail/senha do Firebase).
// =============================================================================
const { app } = require('@azure/functions');
const { json } = require('../shared/http');
const { PROJECT_ID } = require('../shared/auth');
const { claimsDisponiveis, accessToken, customToken, SCOPE_DATASTORE } = require('../shared/adminAuth');
const { ldapBind, ldapDisponivel } = require('../shared/ldap');

// Consulta administrativa: /usuarios com matricula == X (REST runQuery).
async function usuarioPorMatricula(matricula) {
  const t = await accessToken(SCOPE_DATASTORE);
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'usuarios' }],
      where: { fieldFilter: { field: { fieldPath: 'matricula' }, op: 'EQUAL', value: { stringValue: matricula } } },
      limit: 2,
    } }),
  });
  if (!r.ok) throw new Error('runQuery ' + r.status + ': ' + (await r.text()).slice(0, 200));
  const docs = (await r.json()).filter((x) => x.document);
  if (docs.length !== 1) return null; // ausente ou duplicada → nega
  const d = docs[0].document;
  return {
    uid: d.name.split('/').pop(),
    ativo: !(d.fields.ativo && d.fields.ativo.booleanValue === false),
    nome: d.fields.nome ? d.fields.nome.stringValue : '',
  };
}

app.http('authMatricula', {
  methods: ['POST'], authLevel: 'anonymous', route: 'auth/matricula',
  handler: async (request, context) => {
    if (!ldapDisponivel())
      return json(503, { error: 'Autenticação por matrícula ainda não habilitada — aguarda a integração com o domínio institucional (DTI).' });
    if (!claimsDisponiveis())
      return json(503, { error: 'Service account (FB_SA_JSON) não configurada.' });
    try {
      const body = await request.json().catch(() => ({}));
      const matricula = String(body.matricula || '').trim();
      const senha = String(body.senha || '');
      if (!/^\d{4,12}$/.test(matricula) || !senha)
        return json(400, { error: 'Informe matrícula (somente números) e a senha de rede.' });

      // 1) Credencial de rede (AD/LDAP) — mesma do SUAP.
      const dn = (process.env.LDAP_BIND_TEMPLATE || '{matricula}@cp2.g12.br').replaceAll('{matricula}', matricula);
      const bind = await ldapBind(process.env.LDAP_URL, dn, senha);
      if (!bind.ok) return json(401, { error: 'Matrícula ou senha de rede inválida.' });

      // 2) Cadastro no Portal (a autorização continua sendo do Portal/rules).
      const u = await usuarioPorMatricula(matricula);
      if (!u) return json(403, { error: 'Matrícula sem cadastro no Portal — solicite acesso à Administração.' });
      if (!u.ativo) return json(403, { error: 'Usuário desativado.' });

      // 3) Sessão Firebase (custom token) — rules e claims seguem valendo.
      return json(200, { token: customToken(u.uid), uid: u.uid, nome: u.nome });
    } catch (e) {
      context.error && context.error('auth/matricula', e);
      return json(500, { error: 'erro interno', detalhe: String(e.message || e) });
    }
  },
});
