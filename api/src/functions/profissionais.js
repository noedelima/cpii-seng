// POST /api/profissionais — cria ou atualiza um profissional (Chefe/Admin pelas
// rules). body: { p: {...} }. Se p.id existir → merge; senão → cria (id automático).
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { patchDoc, createDoc, encFields, nomeDoUsuario, logAudit } = require('../shared/firestore');

app.http('salvarProfissional', {
  methods: ['POST'], authLevel: 'anonymous', route: 'profissionais',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json().catch(() => ({}));
    const p = (body && body.p) || {};
    const nome = await nomeDoUsuario(user);
    if (p.id) {
      const { id, ...rest } = p;
      await patchDoc('profissionais/' + id, encFields(rest), Object.keys(rest), user.token);
      await logAudit(user, nome, 'Profissional atualizado [via API]', p.nome || id, p.email || '');
      return json(200, { ok: true, id });
    }
    const res = await createDoc('profissionais', encFields(p), user.token);
    const id = (res.name || '').split('/').pop();
    await logAudit(user, nome, 'Profissional criado [via API]', p.nome || id, p.email || '');
    return json(200, { ok: true, id });
  }),
});
