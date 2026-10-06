'use strict';
// Execute the actual Azure REST mutation code against emulator-enforced Rules.
// Only the endpoint transport and synthetic token verification are substituted.
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');const PROJECT='demo-security-cpii-seng';
assert.equal(process.env.FIRESTORE_EMULATOR_HOST,'127.0.0.1:18080');
const host='http://127.0.0.1:18080';const remote=`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const nativeFetch=fetch;let commits=0;
const transport=async(url,opts)=>{assert(String(url).startsWith(remote));if(String(url).endsWith(':commit'))commits++;return nativeFetch(host+String(url).slice('https://firestore.googleapis.com'.length),opts);};
function token(uid){const base=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const now=Math.floor(Date.now()/1000);return base({alg:'none',typ:'JWT'})+'.'+base({iss:`https://securetoken.google.com/${PROJECT}`,aud:PROJECT,sub:uid,user_id:uid,email:uid+'@invalid.test',iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'custom',identities:{}}})+'.';}
function load(rel,mocks,fetcher=transport){const module={exports:{}};const context=vm.createContext({module,exports:module.exports,require:n=>Object.hasOwn(mocks,n)?mocks[n]:n==='crypto'?require(n):(()=>{throw new Error('Unexpected module');})(),fetch:fetcher,Buffer,URL,Date,console});vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),context,{filename:rel});return module.exports;}
(async()=>{
 const security=require('../../api/src/shared/security');
 const data=load('api/src/shared/firestore.js',{'./auth':{PROJECT_ID:PROJECT},'./security':security});
 const user={uid:'chief-synthetic',email:'chief-synthetic@invalid.test',token:token('chief-synthetic')};
 const http=load('api/src/shared/http.js',{'./auth':{verifyIdToken:async()=>user}});const handlers={};
 load('api/src/functions/chamados.js',{'@azure/functions':{app:{http:(name,r)=>handlers[name]=r.handler}},'../shared/firestore':data,'../shared/http':http});
 const request=body=>({params:{id:'api-real-code'},headers:{get:()=>user.token},json:async()=>body});const log={error(){}};
 let response=await handlers.criarChamado(request({data:{campus:'TEST',categoria:'eletrica',assunto:'Synthetic API integration',descricao:'Synthetic',autor:{uid:'forged'},aberturaEm:1,historico:[{user:'forged'}]}}),log);assert.equal(response.status,200,JSON.stringify(response));assert.equal(commits,1);
 const created=await data.docGet('chamados/api-real-code',user.token);assert.equal(created.autor.uid,user.uid);assert(created.aberturaEm>1);assert.equal(created.historico[0].uid,user.uid);assert(created._audit);
 response=await handlers.atualizarChamado(request({patch:{status:'diligencia'},evento:'Diligência solicitada'}),log);assert.equal(response.status,200);const paused=await data.docGet('chamados/api-real-code',user.token);assert(paused.diligenciaDesde>0);assert.equal(paused.historico.length,2);
 user.uid='support-synthetic';user.email=user.uid+'@invalid.test';user.token=token(user.uid);
 response=await handlers.atualizarChamado(request({patch:{status:'resolvido'},evento:'Synthetic unauthorized resolution'}),log);assert.equal(response.status,403);assert(response.jsonBody.correlationId);assert(!Object.hasOwn(response.jsonBody,'detalhe'));
 assert.equal((await data.docGet('chamados/api-real-code',user.token)).status,'diligencia');
 user.uid='chief-synthetic';user.email=user.uid+'@invalid.test';user.token=token(user.uid);
 let reads=0,release;const gate=new Promise(r=>release=r);
 const gated=async(url,opts)=>{const r=await transport(url,opts);if(url===remote+'/chamados/api-real-code' && !opts.method){reads++;if(reads===2)release();await gate;}return r;};
 const concurrent=load('api/src/shared/firestore.js',{'./auth':{PROJECT_ID:PROJECT},'./security':security},gated);
 // Real preconditions are separately checked by conflicting writes built from the
 // same known updateTime, through the real mutation function transport.
 const tasks=await Promise.allSettled([
  concurrent.mutate('chamados/api-real-code',{descricao:'Concurrent A'},user),
  concurrent.mutate('chamados/api-real-code',{descricao:'Concurrent B'},user),
 ]);
 assert.equal(tasks.filter(x=>x.status==='fulfilled').length,1);assert.equal(tasks.filter(x=>x.status==='rejected').length,1);assert(tasks.every(x=>x.status==='fulfilled' || ['FAILED_PRECONDITION','ABORTED'].includes(x.reason.code)));
 console.log('PASS real Azure REST mutation code: create, author/time/history stamping, atomic audit, diligence, denial rollback and optimistic preconditions');
 fs.writeFileSync(path.join(__dirname,'api-rules-results.json'),JSON.stringify({checks:6,productionRequests:0,project:PROJECT})+'\n');
})().catch(e=>{console.error(e);process.exitCode=1;});
