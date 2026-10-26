// Endpoints de escrita da FASE DEMANDA (v2.0 — ADR-004: entrada única em
// /entradas/{id}). Rodam sob o token do usuário → as Security Rules aprovam/negam.
// Operação + log de auditoria em commit único (#11).
// v2.0: demandas NÃO são mais criadas diretamente — nascem da escalada de um
// chamado (POST /api/entradas/{id}/escalar).
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { docGetRaw, writePatch, enc, encFields, nomeDoUsuario, commitComLog } = require('../shared/firestore');

const DIA = 86400000;
const str = (doc, campo) => doc.fields[campo] && doc.fields[campo].stringValue;
const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
function exigirId(id) { if (!idValido(id)) throw new ErroPublico(400, 'Identificador inválido.'); }
const PROIBIDOS = ['trilha', 'statusChamado', 'refs', 'ano', 'seq', 'campus', 'autor', 'aberturaEm', 'chamadoOrigem'];

// PATCH /api/demandas/{id} — atualizar (status, GUT, CODIR, edição, observações…)
// body: { patch: {...}, evento?: "texto do histórico" }
app.http('atualizarDemanda', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'demandas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const patch = (body && body.patch) || {};
    if (PROIBIDOS.some(k => k in patch)) throw new ErroPublico(400, 'Campo não pode ser alterado por esta operação.');
    if (patch.status === 'devolvido') throw new ErroPublico(400, 'Use a devolução ao chamado.');
    const evento = (body && body.evento) || null;
    const now = Date.now();
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    let ev = null;
    if (evento) { const nome = await nomeDoUsuario(user); ev = enc({ ts: now, user: nome, acao: String(evento).slice(0, 300) }); }
    await commitComLog(user, [writePatch('entradas/' + id, fields, mask, ev)],
      'Demanda atualizada [via API]', id, evento || mask.join(', '));
    return json(200, { ok: true, id });
  }),
});

// PUT /api/demandas/{id} — descontinuado na v2.0 (a demanda nasce da escalada).
app.http('criarDemanda', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'demandas/{id}',
  handler: withAuth(async () => json(410, { error: 'Demandas nascem da escalada de um chamado (v2.0).' })),
});

// POST /api/demandas/{id}/arquivar — soft-delete (arquivo morto). Entradas com
// fase de chamado não vão ao arquivo morto: devolve-se ao chamado (ou cancela-se).
app.http('arquivar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/arquivar',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const doc = await docGetRaw('entradas/' + id, user.token);
    if (!doc || !doc.fields) return json(404, { error: 'Demanda não encontrada.' });
    if (str(doc, 'statusChamado')) return json(409, { error: 'Esta demanda veio de um chamado: devolva-a ao chamado em vez de excluir.' });
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
      [writePatch('entradas/' + id, fields, ['status', 'statusAnterior', 'excluidoEm', 'expurgarEm', 'atualizadoEm'], ev)],
      'Demanda arquivada (excluída) [via API]', id, '');
    return json(200, { ok: true, id, status: 'excluido' });
  }),
});

// POST /api/demandas/{id}/resgatar — restaura do arquivo morto
app.http('resgatar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/resgatar',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const doc = await docGetRaw('entradas/' + id, user.token);
    if (!doc || !doc.fields) return json(404, { error: 'Demanda não encontrada.' });
    if (str(doc, 'status') !== 'excluido') return json(409, { error: 'A demanda não está no arquivo morto.' });
    const now = Date.now();
    const nome = await nomeDoUsuario(user);
    const anterior = str(doc, 'statusAnterior') || 'recebido';
    const ev = enc({ ts: now, user: nome, acao: 'Demanda resgatada do arquivo morto' });
    const fields = { status: enc(anterior), atualizadoEm: enc(now) };
    await commitComLog(user,
      [writePatch('entradas/' + id, fields, ['status', 'atualizadoEm', 'statusAnterior', 'excluidoEm', 'expurgarEm'], ev)],
      'Demanda resgatada [via API]', id, '');
    return json(200, { ok: true, id, status: anterior });
  }),
});
