// POST /api/demandas/{id}/arquivar  e  /resgatar
// Primeira fatia de ESCRITA pela API (modelo híbrido). Roda sob o token do
// usuário → as Security Rules aprovam/negam (só Chefe/Admin arquivam). Espelha
// store.arquivarDemanda/resgatarDemanda (soft-delete recuperável, arquivo morto).
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { docGet, docGetRaw, patchDoc, createDoc, enc } = require('../shared/firestore');

const DIA = 86400000;
const arr = (doc, campo) => (doc.fields[campo] && doc.fields[campo].arrayValue && doc.fields[campo].arrayValue.values) || [];
const str = (doc, campo) => doc.fields[campo] && doc.fields[campo].stringValue;

async function nomeDoUsuario(user) {
  try { const p = await docGet('usuarios/' + user.uid, user.token); return (p && p.nome) || user.email || 'Sistema'; }
  catch { return user.email || 'Sistema'; }
}
async function logBestEffort(user, nome, acao, alvo) {
  try {
    await createDoc('logs', {
      ts: enc(Date.now()), uid: enc(user.uid), nome: enc(nome), email: enc(user.email || ''),
      acao: enc(acao), alvo: enc(alvo), detalhes: enc(''),
    }, user.token);
  } catch { /* auditoria best-effort */ }
}

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
    const fields = {
      status: enc('excluido'),
      statusAnterior: enc(status),
      excluidoEm: enc(now),
      expurgarEm: { timestampValue: new Date(now + 30 * DIA).toISOString() },
      atualizadoEm: enc(now),
      historico: { arrayValue: { values: arr(doc, 'historico').concat([ev]) } },
    };
    await patchDoc('demandas/' + id, fields, ['status', 'statusAnterior', 'excluidoEm', 'expurgarEm', 'atualizadoEm', 'historico'], user.token);
    await logBestEffort(user, nome, 'Demanda arquivada (excluída) [via API]', id);
    return json(200, { ok: true, id, status: 'excluido' });
  }),
});

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
    const fields = {
      status: enc(anterior),
      atualizadoEm: enc(now),
      historico: { arrayValue: { values: arr(doc, 'historico').concat([ev]) } },
    };
    // statusAnterior/excluidoEm/expurgarEm entram no mask mas fora de `fields` → apagados.
    await patchDoc('demandas/' + id, fields, ['status', 'atualizadoEm', 'historico', 'statusAnterior', 'excluidoEm', 'expurgarEm'], user.token);
    await logBestEffort(user, nome, 'Demanda resgatada [via API]', id);
    return json(200, { ok: true, id, status: anterior });
  }),
});
