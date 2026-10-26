// Endpoints de escrita de CHAMADOS pela API (mesmo padrão das demandas). Rodam
// sob o token do usuário → as Security Rules aprovam/negam.
// v1.31: log de auditoria no mesmo commit (#11) e AUTORIA carimbada pelo
// servidor a partir do token (#12) — o cliente não escolhe o autor. Quem abre
// em nome de outra pessoa registra isso em `solicitanteRepresentado`.
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { writePatch, writeCreate, enc, encFields, nomeDoUsuario, perfilDe, commitComLog } = require('../shared/firestore');

const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
function exigirId(id) { if (!idValido(id)) throw new ErroPublico(400, 'Identificador inválido.'); }

// PATCH /api/chamados/{id} — atualizar (triagem, resolução, status, comentários…)
app.http('atualizarChamado', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const patch = (body && body.patch) || {};
    if ('autor' in patch) throw new ErroPublico(400, 'A autoria do chamado não pode ser alterada.');
    const evento = (body && body.evento) || null;
    const now = Date.now();
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    let ev = null;
    if (evento) { const nome = await nomeDoUsuario(user); ev = enc({ ts: now, user: nome, acao: String(evento).slice(0, 300) }); }
    await commitComLog(user, [writePatch('chamados/' + id, fields, mask, ev)],
      'Chamado atualizado [via API]', id, evento || mask.join(', '));
    return json(200, { ok: true, id });
  }),
});

// PUT /api/chamados/{id} — abrir (id calculado no cliente). body: { data: {...} }
app.http('criarChamado', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const data = { ...((body && body.data) || {}) };
    const perfil = await perfilDe(user);
    // #12: autor técnico = usuário autenticado (as rules também conferem).
    data.autor = { nome: perfil.nome || '', email: user.email || '', uid: user.uid };
    if (data.solicitanteRepresentado != null) {
      const rep = String(data.solicitanteRepresentado).trim().slice(0, 120);
      if (rep) data.solicitanteRepresentado = rep; else delete data.solicitanteRepresentado;
    }
    const agora = Date.now();
    data.historico = [{ ts: agora, user: perfil.nome || user.email || 'Sistema', acao: 'Chamado aberto' }];
    await commitComLog(user, [writeCreate('chamados/' + id, encFields(data))],
      'Chamado aberto [via API]', id, data.assunto || '');
    return json(200, { ok: true, id });
  }),
});
