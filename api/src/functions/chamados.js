// Endpoints de escrita de CHAMADOS pela API (mesmo padrão das demandas). Rodam
// sob o token do usuário → as Security Rules aprovam/negam.
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { commitPatch, commitCreate, enc, encFields, nomeDoUsuario, logAudit } = require('../shared/firestore');

// PATCH /api/chamados/{id} — atualizar (triagem, resolução, status, comentários…)
// body: { patch: {...}, evento?: "texto do histórico" }
app.http('atualizarChamado', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id;
    const body = await request.json().catch(() => ({}));
    const patch = (body && body.patch) || {};
    const evento = (body && body.evento) || null;
    const now = Date.now();
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    let ev = null;
    if (evento) { const nome = await nomeDoUsuario(user); ev = enc({ ts: now, user: nome, acao: evento }); }
    await commitPatch('chamados/' + id, fields, mask, ev, user.token);
    await logAudit(user, null, 'Chamado atualizado [via API]', id, evento || mask.join(', '));
    return json(200, { ok: true, id });
  }),
});

// PUT /api/chamados/{id} — abrir (id calculado no cliente). body: { data: {...} }
app.http('criarChamado', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id;
    const body = await request.json().catch(() => ({}));
    const data = (body && body.data) || {};
    await commitCreate('chamados/' + id, encFields(data), user.token);
    await logAudit(user, null, 'Chamado aberto [via API]', id, data.assunto || '');
    return json(200, { ok: true, id });
  }),
});
