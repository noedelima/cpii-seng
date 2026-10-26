// POST /api/profissionais — cria ou atualiza um profissional (Chefe/Admin pelas
// rules). body: { p: {...} }. Se p.id existir → merge; senão → cria (id automático).
// v1.31: log no mesmo commit (#11).
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { writeMerge, writeCreate, encFields, commitComLog, idAleatorio } = require('../shared/firestore');

app.http('salvarProfissional', {
  methods: ['POST'], authLevel: 'anonymous', route: 'profissionais',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json().catch(() => ({}));
    const p = (body && body.p) || {};
    if (p.id) {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(p.id))) throw new ErroPublico(400, 'Identificador inválido.');
      const { id, ...rest } = p;
      await commitComLog(user, [writeMerge('profissionais/' + id, encFields(rest), Object.keys(rest))],
        'Profissional atualizado [via API]', p.nome || id, p.email || '');
      return json(200, { ok: true, id });
    }
    const id = idAleatorio();
    await commitComLog(user, [writeCreate('profissionais/' + id, encFields(p))],
      'Profissional criado [via API]', p.nome || id, p.email || '');
    return json(200, { ok: true, id });
  }),
});
