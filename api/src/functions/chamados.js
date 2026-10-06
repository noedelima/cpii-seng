// Writes, publication and audit either all succeed or all fail under the caller's token.
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { mutate } = require('../shared/firestore');
app.http('atualizarChamado', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json();
    await mutate('chamados/' + request.params.id, body.patch, user, { event: body.evento || '' });
    return json(200, { ok: true, id: request.params.id });
  }),
});
app.http('criarChamado', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json();
    await mutate('chamados/' + request.params.id, body.data, user, { create: true });
    return json(200, { ok: true, id: request.params.id });
  }),
});
