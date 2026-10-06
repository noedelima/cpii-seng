const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { mutate, docGetRaw } = require('../shared/firestore');
app.http('setInterna', {
  methods:['PATCH'], authLevel:'anonymous', route:'internas/{id}',
  handler:withAuth(async ({request,user}) => {
    const body=await request.json();
    if (!body.patch || !Object.keys(body.patch).length) return json(400,{error:'patch vazio'});
    const path='internas/'+request.params.id;
    await mutate(path,body.patch,user,{create:!(await docGetRaw(path,user.token))});
    return json(200,{ok:true,id:request.params.id});
  }),
});
