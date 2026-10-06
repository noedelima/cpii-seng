// Writes, publication and audit either all succeed or all fail under the caller's token.
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { mutate, docGetRaw, unwrap } = require('../shared/firestore');
app.http('atualizarDemanda', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'demandas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json();
    await mutate('demandas/' + request.params.id, body.patch, user, { event: body.evento || '' });
    return json(200, { ok: true, id: request.params.id });
  }),
});
app.http('criarDemanda', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'demandas/{id}',
  handler: withAuth(async ({ request, user }) => {
    const body = await request.json();
    await mutate('demandas/' + request.params.id, body.data, user, { create: true });
    return json(200, { ok: true, id: request.params.id });
  }),
});

app.http('arquivar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/arquivar',
  handler: withAuth(async ({ request, user }) => {
    const id=request.params.id;
    const raw=await docGetRaw('demandas/'+id,user.token);
    if (!raw) return json(404,{error:'demanda não encontrada'});
    const d=unwrap(raw.fields);
    if (['atendimento','concluido','excluido'].includes(d.status)) return json(409,{error:'Esta demanda não pode ser arquivada.'});
    const now=Date.now();
    await mutate('demandas/'+id,{status:'excluido',statusAnterior:d.status,excluidoEm:now,expurgarEm:new Date(now+30*86400000)},user,{event:'Demanda enviada ao arquivo morto'});
    return json(200,{ok:true,id,status:'excluido'});
  }),
});
app.http('resgatar', {
  methods: ['POST'], authLevel: 'anonymous', route: 'demandas/{id}/resgatar',
  handler: withAuth(async ({ request, user }) => {
    const id=request.params.id;
    const raw=await docGetRaw('demandas/'+id,user.token);
    if (!raw) return json(404,{error:'demanda não encontrada'});
    const d=unwrap(raw.fields);
    if (d.status!=='excluido') return json(409,{error:'A demanda não está no arquivo morto.'});
    await mutate('demandas/'+id,{status:d.statusAnterior || 'recebido'},user,{remove:['statusAnterior','excluidoEm','expurgarEm'],event:'Demanda resgatada do arquivo morto'});
    return json(200,{ok:true,id,status:d.statusAnterior || 'recebido'});
  }),
});
