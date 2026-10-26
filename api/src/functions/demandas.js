// Endpoints de escrita de DEMANDAS pela API (modelo híbrido). Rodam sob o token
// do usuário → as Security Rules aprovam/negam. v1.31: operação + log de
// auditoria em commit único (auditoria #11).
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { docGetRaw, writePatch, writeCreate, enc, encFields, nomeDoUsuario, commitComLog } = require('../shared/firestore');

const DIA = 86400000;
const str = (doc, campo) => doc.fields[campo] && doc.fields[campo].stringValue;
const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
function exigirId(id) { if (!idValido(id)) throw new ErroPublico(400, 'Identificador inválido.'); }

// PATCH /api/demandas/{id} — atualizar (status, GUT, CODIR, edição, observações…)
// body: { patch: {...}, evento?: "texto do histórico" }
app.http('atualizarDemanda', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'demandas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const patch = (body && body.patch) || {};
    const evento = (body && body.evento) || null;
    const now = Date.now();
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    let ev = null;
    if (evento) { const nome = await nomeDoUsuario(user); ev = enc({ ts: now, user: nome, acao: String(evento).slice(0, 300) }); }
    await commitComLog(user, [writePatch('demandas/' + id, fields, mask, ev)],
      'Demanda atualizada [via API]', id, evento || mask.join(', '));
    return json(200, { ok: true, id });
  }),
});

// PUT /api/demandas/{id} — criar (o id é calculado no cliente, como no provider)
app.http('criarDemanda', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'demandas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const data = (body && body.data) || {};
    await commitComLog(user, [writeCreate('demandas/' + id, encFields(data))],
      'Demanda criada [via API]', id, data.objeto || '');
    return json(200, { ok: true, id });
  }),
});

// POST /api/demandas/{id}/arquivar — soft-delete (arquivo morto)
app.http('arquivar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/arquivar',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const doc = await docGetRaw('demandas/' + id, user.token);
    if (!doc || !doc.fields) return json(404, { error: 'Demanda não encontrada.' });
    const status = str(doc, 'status');
    if (status === 'atendimento' || status === 'concluido') return json(409, { error: 'Demandas em atendimento ou concluídas não podem ser excluídas.' });
    if (status === 'excluido') return json(409, { error: 'Demanda já está no arquivo morto.' });
    const now = Date.now();
    const nome = await nomeDoUsuario(user);
    const ev = enc({ ts: now, user: nome, acao: 'Demanda enviada ao arquivo morto (excluída)' });
    const fields = {
      status: enc('excluido'), statusAnterior: enc(status), excluidoEm: enc(now),
      expurgarEm: { timestampValue: new Date(now + 30 * DIA).toISOString() }, atualizadoEm: enc(now),
    };
    await commitComLog(user,
      [writePatch('demandas/' + id, fields, ['status', 'statusAnterior', 'excluidoEm', 'expurgarEm', 'atualizadoEm'], ev)],
      'Demanda arquivada (excluída) [via API]', id, '');
    return json(200, { ok: true, id, status: 'excluido' });
  }),
});

// POST /api/demandas/{id}/resgatar — restaura do arquivo morto
app.http('resgatar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/resgatar',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const doc = await docGetRaw('demandas/' + id, user.token);
    if (!doc || !doc.fields) return json(404, { error: 'Demanda não encontrada.' });
    if (str(doc, 'status') !== 'excluido') return json(409, { error: 'A demanda não está no arquivo morto.' });
    const now = Date.now();
    const nome = await nomeDoUsuario(user);
    const anterior = str(doc, 'statusAnterior') || 'recebido';
    const ev = enc({ ts: now, user: nome, acao: 'Demanda resgatada do arquivo morto' });
    // campos no mask e ausentes de `fields` são apagados (statusAnterior/excluidoEm/expurgarEm)
    const fields = { status: enc(anterior), atualizadoEm: enc(now) };
    await commitComLog(user,
      [writePatch('demandas/' + id, fields, ['status', 'atualizadoEm', 'statusAnterior', 'excluidoEm', 'expurgarEm'], ev)],
      'Demanda resgatada [via API]', id, '');
    return json(200, { ok: true, id, status: anterior });
  }),
});
