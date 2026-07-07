// GET /api/health — diagnóstico, sem autenticação. Prova que a camada de API
// (Azure Functions no SWA) está no ar.
const { app } = require('@azure/functions');
const { json } = require('../shared/http');

app.http('health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'health',
  handler: async () => json(200, { ok: true, service: 'cpii-seng-api', ts: Date.now() }),
});
