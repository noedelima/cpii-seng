// Endpoints de escrita de DEMANDAS pela API (modelo híbrido). Rodam sob o token
// do usuário → as Security Rules aprovam/negam. Espelham os métodos do provider.
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { docGetRaw, patchDoc, commitPatch, commitCreate, enc, encFields, nomeDoUsuario, logAudit } = require('../shared/firestore');

const DIA = 86400000;
const str = (doc, campo) => doc.fields[campo] && doc.fields[campo].stringValue;

// PATCH /api/demandas/{id} — atualizar (status, GUT, CODIR, edição, observações…)
// body: { patch: {...}, evento?: "texto do histórico" }
app.http('atualizarDemanda', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'demandas/{id}',
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
    await commitPatch('demandas/' + id, fields, mask, ev, user.token);
    await logAudit(user, null, 'Demanda atualizada [via API]', id, evento || mask.join(', '));
    return json(200, { ok: true, id });
  }),
});

// PUT /api/demandas/{id} — criar (o id é calculado no cliente, como no provider)
// body: { data: {...} }  (a demanda já com ano/seq/criadoEm/historico)
app.http('criarDemanda', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'demandas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id;
    const body = await request.json().catch(() => ({}));
    const data = (body && body.data) || {};
    await commitCreate('demandas/' + id, encFields(data), user.token);
    await logAudit(user, null, 'Demanda criada [via API]', id, data.objeto || '');
    return json(200, { ok: true, id });
  }),
});

// POST /api/demandas/{id}/arquivar — soft-delete (arquivo morto)
app.http('arquivar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/arquivar',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id;
    const doc = await docGetRaw('demandas/' + id, user.token);
    if (!doc || !doc.fields) return json(404, { error: 'demanda não encontrada' });
    const status = str(doc, 'status');
    if (status === 'atendimento' || status === 'concluido') return json(409, { error: 'Demandas em atendimento ou concluídas não podem ser excluídas.' });
    if (status === 'excluido') return json(409, { error: 'Demanda já está no arquivo morto.' });
    const now = Date.now();
    const nome = await nomeDoUsuario(user);
    const ev = enc({ ts: now, user: nome, acao: 'Demanda enviada ao arquivo morto (excluída)' });
    const hist = (doc.fields.historico && doc.fields.historico.arrayValue && doc.fields.historico.arrayValue.values) || [];
    const fields = {
      status: enc('excluido'), statusAnterior: enc(status), excluidoEm: enc(now),
      expurgarEm: { timestampValue: new Date(now + 30 * DIA).toISOString() }, atualizadoEm: enc(now),
      historico: { arrayValue: { values: hist.concat([ev]) } },
    };
    await patchDoc('demandas/' + id, fields, ['status', 'statusAnterior', 'excluidoEm', 'expurgarEm', 'atualizadoEm', 'historico'], user.token);
    await logAudit(user, nome, 'Demanda arquivada (excluída) [via API]', id, '');
    return json(200, { ok: true, id, status: 'excluido' });
  }),
});

// POST /api/demandas/{id}/resgatar — restaura do arquivo morto
app.http('resgatar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/resgatar',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id;
    const doc = await docGetRaw('demandas/' + id, user.token);
    if (!doc || !doc.fields) return json(404, { error: 'demanda não encontrada' });
    if (str(doc, 'status') !== 'excluido') return json(409, { error: 'A demanda não está no arquivo morto.' });
    const now = Date.now();
    const nome = await nomeDoUsuario(user);
    const anterior = str(doc, 'statusAnterior') || 'recebido';
    const ev = enc({ ts: now, user: nome, acao: 'Demanda resgatada do arquivo morto' });
    const hist = (doc.fields.historico && doc.fields.historico.arrayValue && doc.fields.historico.arrayValue.values) || [];
    const fields = { status: enc(anterior), atualizadoEm: enc(now), historico: { arrayValue: { values: hist.concat([ev]) } } };
    await patchDoc('demandas/' + id, fields, ['status', 'atualizadoEm', 'historico', 'statusAnterior', 'excluidoEm', 'expurgarEm'], user.token);
    await logAudit(user, nome, 'Demanda resgatada [via API]', id, '');
    return json(200, { ok: true, id, status: anterior });
  }),
});
