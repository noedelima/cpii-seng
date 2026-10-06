const { app } = require('@azure/functions');
const { randomUUID } = require('crypto');
const { json, withAuth } = require('../shared/http');
const { mutate } = require('../shared/firestore');
app.http('salvarProfissional', {
  methods:['POST'], authLevel:'anonymous', route:'profissionais',
  handler:withAuth(async ({request,user}) => {
    const body=await request.json();
    if (!body.p || typeof body.p!=='object') return json(400,{error:'profissional obrigatório'});
    const {id,...data}=body.p;
    const target=id || randomUUID();
    await mutate('profissionais/'+target,data,user,{create:!id});
    return json(200,{ok:true,id:target});
  }),
});
