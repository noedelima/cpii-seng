// PATCH /api/config/params — parâmetros do sistema (Chefe/Admin pelas rules).
// Merge dos campos enviados. body: { p: {...} }
// v1.31: log no mesmo commit (#11); a Agenda interna NÃO vive mais em params
// (vazava no documento público) — vai para config/agenda (#1).
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { writeMerge, encFields, commitComLog } = require('../shared/firestore');

app.http('setParams', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'config/params',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json().catch(() => ({}));
    const p = { ...((body && body.p) || {}) };
    delete p.eventosAgenda;
    const mask = Object.keys(p);
    if (!mask.length) return json(400, { error: 'Sem parâmetros.' });
    await commitComLog(user, [writeMerge('config/params', encFields(p), mask)],
      'Parâmetros alterados [via API]', 'config', JSON.stringify(p).slice(0, 300));
    return json(200, { ok: true });
  }),
});
