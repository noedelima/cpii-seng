// PATCH /api/internas/{id} — dados internos (alocação de fiscais, equipe,
// observação técnica). Merge (só os campos enviados), sob as Security Rules.
// body: { patch: {...} }
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { patchDoc, encFields, nomeDoUsuario, logAudit } = require('../shared/firestore');

app.http('setInterna', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'internas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id;
    const body = await request.json().catch(() => ({}));
    const patch = (body && body.patch) || {};
    const mask = Object.keys(patch);
    if (!mask.length) return json(400, { error: 'patch vazio' });
    await patchDoc('internas/' + id, encFields(patch), mask, user.token);
    await logAudit(user, await nomeDoUsuario(user), 'Alocação atualizada [via API]', id, mask.join(', '));
    return json(200, { ok: true, id });
  }),
});
