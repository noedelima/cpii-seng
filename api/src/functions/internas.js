// PATCH /api/internas/{id} — dados internos (alocação de fiscais, equipe,
// observação técnica). Merge (só os campos enviados), sob as Security Rules.
// v1.31: log de auditoria no mesmo commit (#11).
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { writeMerge, encFields, commitComLog } = require('../shared/firestore');

app.http('setInterna', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'internas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id;
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(String(id || ''))) throw new ErroPublico(400, 'Identificador inválido.');
    const body = await request.json().catch(() => ({}));
    const patch = (body && body.patch) || {};
    const mask = Object.keys(patch);
    if (!mask.length) return json(400, { error: 'Nada a atualizar.' });
    await commitComLog(user, [writeMerge('internas/' + id, encFields(patch), mask)],
      'Alocação atualizada [via API]', id, mask.join(', '));
    return json(200, { ok: true, id });
  }),
});
