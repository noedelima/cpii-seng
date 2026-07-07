// PATCH /api/config/params — parâmetros do sistema (Chefe/Admin pelas rules).
// Merge dos campos enviados. body: { p: {...} }
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { patchDoc, encFields, nomeDoUsuario, logAudit } = require('../shared/firestore');

app.http('setParams', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'config/params',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json().catch(() => ({}));
    const p = (body && body.p) || {};
    const mask = Object.keys(p);
    if (!mask.length) return json(400, { error: 'sem parâmetros' });
    await patchDoc('config/params', encFields(p), mask, user.token);
    await logAudit(user, await nomeDoUsuario(user), 'Parâmetros alterados [via API]', 'config', JSON.stringify(p).slice(0, 300));
    return json(200, { ok: true });
  }),
});
