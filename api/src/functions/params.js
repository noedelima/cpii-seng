const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { mutate, docGetRaw } = require('../shared/firestore');
app.http('setParams', {
  methods:['PATCH'], authLevel:'anonymous', route:'config/params',
  handler:withAuth(async ({request,user}) => {
    const body=await request.json();
    if (!body.p || !Object.keys(body.p).length) return json(400,{error:'sem parâmetros'});
    await mutate('config/params',body.p,user,{create:!(await docGetRaw('config/params',user.token))});
    return json(200,{ok:true});
  }),
});
