// =============================================================================
// POST /api/usuarios/credencial — cria a credencial (e-mail/senha) de um novo
// usuário no Firebase Auth. SOMENTE administradores ativos.
//
// v1.31 (auditoria #2): o cadastro PÚBLICO de contas foi desativado no Firebase
// Auth (qualquer pessoa com a apiKey Web podia criar uma conta e, sem perfil,
// alcançar o diretório e as notificações). A criação passa a ser feita aqui,
// pela service account dedicada (papel Firebase Authentication Admin), que não
// é afetada pela restrição. O perfil em /usuarios continua sendo gravado pelo
// cliente do administrador, sob as Security Rules.
// body: { email, senha } → { uid }
// =============================================================================
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { PROJECT_ID } = require('../shared/auth');
const { perfilDe, commitComLog } = require('../shared/firestore');
const { claimsDisponiveis, accessToken } = require('../shared/adminAuth');

app.http('criarCredencial', {
  methods: ['POST'], authLevel: 'anonymous', route: 'usuarios/credencial',
  handler: withAuth(async ({ request, user }) => {
    if (!claimsDisponiveis()) return json(501, { error: 'Service account (FB_SA_JSON) não configurada.' });
    const chamador = await perfilDe(user);
    // v2.0.2: Administrador ou Chefe de Seção (o perfil gravado depois passa pelas rules).
    if (!['admin', 'chefe'].includes(chamador.role) || chamador.ativo === false)
      return json(403, { error: 'Somente administradores e a Chefia criam credenciais.' });

    const body = await request.json().catch(() => ({}));
    const email = String((body && body.email) || '').trim().toLowerCase();
    const senha = String((body && body.senha) || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120)
      throw new ErroPublico(400, 'E-mail inválido.');
    // Política de cadastro do Portal (04/09/2026): somente e-mail institucional.
    if (!email.endsWith('@cp2.g12.br'))
      throw new ErroPublico(400, 'Use o e-mail institucional pessoal (@cp2.g12.br).');
    if (senha.length < 6 || senha.length > 128)
      throw new ErroPublico(400, 'A senha inicial deve ter entre 6 e 128 caracteres.');

    const t = await accessToken();
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: senha }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const cod = (j && j.error && j.error.message) || '';
      if (cod.startsWith('EMAIL_EXISTS'))
        throw new ErroPublico(409, 'Este e-mail já possui credencial. Edite o usuário existente ou use a redefinição de senha.');
      if (cod.startsWith('WEAK_PASSWORD')) throw new ErroPublico(400, 'Senha inicial fraca demais.');
      throw new Error('accounts.create ' + r.status + ': ' + cod);
    }
    await commitComLog(user, [], 'Credencial criada [via API]', email, 'conta de acesso (e-mail/senha)');
    return json(200, { ok: true, uid: j.localId });
  }),
});
