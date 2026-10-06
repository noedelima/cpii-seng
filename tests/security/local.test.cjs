'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {EventEmitter}=require('node:events');
const root=path.resolve(__dirname,'../..');
const quiet={error(){},warn(){},log(){}};
function load(rel,mocks={},globals={}) {
 const module={exports:{}};
 const context=vm.createContext({module,exports:module.exports,require(name){
  if(Object.hasOwn(mocks,name))return mocks[name];
  if(['tls','crypto'].includes(name))return require(name);
  throw new Error('Unmocked dependency: '+name);
 },Buffer,URL,Date,Set,Map,setTimeout,clearTimeout,process:{env:{}},console:quiet,
 fetch:async()=>{throw new Error('External network prohibited in unit tests');},...globals});
 vm.runInContext(fs.readFileSync(path.join(root,rel),'utf8'),context,{filename:rel});
 return module.exports;
}
const security=require('../../api/src/shared/security');
const request=body=>({json:async()=>body,params:{id:'synthetic'},headers:{get:()=>''}});
const policy={LDAP_GLOBAL_LIMIT_ENFORCED:'true',LDAP_MAX_CONCURRENT:'1',LDAP_ACCOUNT_ATTEMPTS:'2',LDAP_GLOBAL_ATTEMPTS:'3',LDAP_WINDOW_SECONDS:'60'};
function ldapHandler({enabled=true,eligible=true,active=true,bind=async()=>({ok:false}),reserve=()=>({status:200,release(){}}),fetchError=false}={}){
 let handler;const order=[];let releases=0;
 const http=load('api/src/shared/http.js',{'./auth':{}});
 load('api/src/functions/auth-matricula.js',{
  '@azure/functions':{app:{http(_n,r){handler=r.handler;}}},'../shared/http':http,
  '../shared/ldapLimits':{reserve:(...args)=>{const r=reserve(...args);return {...r,release(){releases++;r.release?.();}};}},
  '../shared/auth':{PROJECT_ID:'demo-security-local'},
  '../shared/adminAuth':{claimsDisponiveis:()=>true,accessToken:async()=> 'synthetic',customToken:()=> 'synthetic-custom-token',SCOPE_DATASTORE:'synthetic'},
  '../shared/ldap':{ldapDisponivel:()=>enabled,ldapBind:async(...args)=>{order.push('bind');return bind(...args);}},
 },{process:{env:{LDAP_URL:'ldaps://synthetic.invalid'}},fetch:async()=>{
   order.push('eligibility');if(fetchError)throw new Error('SYNTHETIC_INTERNAL_PASSWORD_MARKER');
   return {ok:true,json:async()=>eligible?[{document:{name:'projects/demo/usuarios/synthetic',fields:{ativo:{booleanValue:active},nome:{stringValue:'Synthetic'}}}}]:[]};
 }});
 return {handler,order,get releases(){return releases;}};
}
for(const scheme of ['ldap','http','https'])test('reject '+scheme+' before connecting or sending credentials',async()=>{
 let sockets=0;const ldap=load('api/src/shared/ldap.js',{tls:{connect(){sockets++;throw new Error('Unexpected socket');}}});
 await assert.rejects(ldap.ldapBind(scheme+'://127.0.0.1:12345','Synthetic','SYNTHETIC_PASSWORD'),/LDAPS/);assert.equal(sockets,0);
});
test('LDAPS validates certificate and waits for fragmented response',async()=>{
 let opts,sent;const socket=new EventEmitter();socket.destroy=()=>{};socket.write=data=>{sent=data;queueMicrotask(()=>{socket.emit('data',Buffer.from([0x30]));socket.emit('data',Buffer.from([0x0c,0x02,0x01,0x01,0x61,0x07,0x0a,0x01,0x00,0x04,0x00,0x04,0x00]));});};
 const ldap=load('api/src/shared/ldap.js',{tls:{connect(o,cb){opts=o;queueMicrotask(cb);return socket;}}});
 assert.equal((await ldap.ldapBind('ldaps://ad.invalid','Synthetic DN','SYNTHETIC_PASSWORD')).ok,true);
 assert.equal(opts.rejectUnauthorized,true);assert.equal(opts.servername,'ad.invalid');assert(sent.includes(Buffer.from('SYNTHETIC_PASSWORD')));
});
test('certificate failure sends no LDAP credential packet',async()=>{
 let writes=0;const socket=new EventEmitter();socket.destroy=()=>{};socket.write=()=>writes++;
 const ldap=load('api/src/shared/ldap.js',{tls:{connect(){queueMicrotask(()=>socket.emit('error',new Error('certificate rejected')));return socket;}}});
 await assert.rejects(ldap.ldapBind('ldaps://ad.invalid','Synthetic DN','SYNTHETIC_PASSWORD'),/certificate/);assert.equal(writes,0);
});
test('dormant LDAP has no lookup or bind',async()=>{const h=ldapHandler({enabled:false});assert.equal((await h.handler(request({}),quiet)).status,503);assert.deepEqual(h.order,[]);});
for(const opts of [{eligible:false},{active:false}])test('portal eligibility checked before LDAP '+JSON.stringify(opts),async()=>{
 const h=ldapHandler(opts);assert.equal((await h.handler(request({matricula:'000001',senha:'Synthetic'}),quiet)).status,401);assert.deepEqual(h.order,['eligibility']);assert.equal(h.releases,1);
});
test('unknown/disabled account and invalid password return same external response',async()=>{
 const responses=[];for(const opts of [{eligible:false},{active:false},{}])responses.push(await ldapHandler(opts).handler(request({matricula:'000001',senha:'Synthetic'}),quiet));
 assert.equal(new Set(responses.map(r=>JSON.stringify(r))).size,1);
});
test('LDAP exception has correlation ID without upstream detail',async()=>{
 const h=ldapHandler({fetchError:true});const r=await h.handler(request({matricula:'000001',senha:'Synthetic'}),quiet);
 assert.equal(r.status,500);assert(r.jsonBody.correlationId);assert(!JSON.stringify(r).includes('MARKER'));assert.equal(h.releases,1);
});
test('LDAP activation fails closed unless explicit policy and global enforcement exist',()=>{
 const a=load('api/src/shared/ldapLimits.js');assert.equal(a.reserve('000001').status,503);
 const b=load('api/src/shared/ldapLimits.js',{}, {process:{env:{...policy,LDAP_GLOBAL_LIMIT_ENFORCED:'false'}}});assert.equal(b.reserve('000001').status,503);
});
test('LDAP guards concurrency, per-account and aggregate attempts; releases are idempotent',()=>{
 const limits=load('api/src/shared/ldapLimits.js',{}, {process:{env:policy}});
 const first=limits.reserve('000001');assert.equal(first.status,200);assert.equal(limits.reserve('000002').status,429);first.release();first.release();
 const second=limits.reserve('000001');assert.equal(second.status,200);second.release();assert.equal(limits.reserve('000001').status,429);
 const third=limits.reserve('000002');assert.equal(third.status,200);third.release();assert.equal(limits.reserve('000003').status,429);
});
test('rate rejection touches neither eligibility service nor AD',async()=>{
 const h=ldapHandler({reserve:()=>({status:429,retryAfter:60})});const r=await h.handler(request({matricula:'000001',senha:'Synthetic'}),quiet);
 assert.equal(r.status,429);assert.equal(r.headers['Retry-After'],'60');assert.deepEqual(h.order,[]);
});
for(const status of [401,403,500])test('controlled '+status+' response and sanitized diagnostic',async()=>{
 const logs=[];const http=load('api/src/shared/http.js',{'./auth':{verifyIdToken:async()=>{if(status===401)throw new Error('TOKEN_SECRET_MARKER');return {uid:'synthetic'};}}});
 const r=await http.withAuth(async()=>{throw new Error(status===403?'firestore commit 403: UPSTREAM_SECRET_MARKER':'UPSTREAM_SECRET_MARKER');})(request({}),{error:(...args)=>logs.push(args)});
 assert.equal(r.status,status);assert(r.jsonBody.correlationId);assert(!JSON.stringify([r,logs]).includes('SECRET_MARKER'));assert(!Object.hasOwn(r.jsonBody,'detalhe'));
});
test('caller-controlled author, creation time and history replaced with authenticated values',()=>{
 const now=Date.now();const d=security.normalizeMutation('chamados',{}, {categoria:'eletrica',autor:{uid:'forged'},aberturaEm:1,historico:[{uid:'forged'}]}, {uid:'caller',nome:'Caller',email:'caller@invalid.test'},'',true,now);
 assert.deepEqual(d.autor,{uid:'caller',nome:'Caller',email:'caller@invalid.test'});assert.equal(d.aberturaEm,now);assert.equal(d.prazoLimite,now+5*86400000);assert.equal(d.historico[0].uid,'caller');
});
test('unknown chamado fields and update history overwrite rejected',()=>{
 assert.throws(()=>security.normalizeMutation('chamados',{}, {unknown:'injection'}, {},'',true),/unknown_chamado_field/);
 assert.throws(()=>security.normalizeMutation('demandas',{}, {historico:[]}, {},'',false),/append_only/);
});
test('public allowlists omit free descriptions, authors, attachments, notes and agenda',()=>{
 const d=security.publicDemanda('id',{objeto:'Public title',autor:{email:'private'},descricao:'private',obsInterna:['private'],anexos:[{url:'private'}],aval:{g:3,obs:'private'},ajuste:{valor:2,motivo:'private'}});
 const c=security.publicConfig('params',{valorRef:100,eventosAgenda:[{private:true}]});
 assert(!JSON.stringify([d,c]).includes('private'));assert.equal(d.aval.g,3);assert.equal(d.ajuste.valor,2);assert.equal(c.valorRef,100);
});
test('existing external notification URLs cannot control navigation',()=>{
 assert.equal(security.notificationLink({link:'https://attacker.invalid',tipo:'chamado-atualizado',demandaId:'safe'}),'#/chamado/safe');
 assert.equal(security.notificationLink({demandaId:'../unsafe'}),'#/conta');
});
test('shared browser/API security policy cannot drift',()=>{
 const api=fs.readFileSync(path.join(root,'api/src/shared/security.js'),'utf8').split('\nmodule.exports =')[0];
 const browser=fs.readFileSync(path.join(root,'js/security.js'),'utf8').split('\nexport {')[0];assert.equal(browser,api);
});
function atomicClient({deny=false}={}){
 let commit;let gets=0;const f=load('api/src/shared/firestore.js',{'./auth':{PROJECT_ID:'demo-security-local'},'./security':security},{fetch:async(url,opts)=>{
 if(url.endsWith(':commit')){commit=JSON.parse(opts.body);return {ok:!deny,status:deny?403:200,text:async()=> 'SYNTHETIC_PERMISSION_DENIED'};}
 gets++;return {ok:true,status:200,json:async()=>({fields:{nome:{stringValue:'Caller'},ativo:{booleanValue:true}}})};
 }});return {f,get commit(){return commit;},get gets(){return gets;}};
}
test('API source and audit use one commit with server timestamp',async()=>{
 const c=atomicClient();await c.f.mutate('chamados/new',{categoria:'eletrica',assunto:'Synthetic',campus:'TEST'}, {uid:'caller',email:'caller@invalid.test',token:'synthetic'},{create:true});
 assert.equal(c.commit.writes.length,2);const [source,audit]=c.commit.writes;
 assert.equal(source.currentDocument.exists,false);assert.equal(source.update.fields._audit.stringValue,audit.update.name.split('/').pop());assert.equal(audit.updateTransforms[0].setToServerValue,'REQUEST_TIME');
 assert.equal(c.f.unwrap(source.update.fields).autor.uid,'caller');
});
test('API fails if atomic source/audit commit fails; never reports success',async()=>{
 const c=atomicClient({deny:true});await assert.rejects(c.f.mutate('chamados/new',{categoria:'eletrica'}, {uid:'caller',token:'synthetic'},{create:true}),e=>e.code==='PERMISSION_DENIED');assert.equal(c.commit.writes.length,2);
});
test('API creates matching projection inside the same demand commit',async()=>{
 const c=atomicClient();await c.f.mutate('demandas/new',{objeto:'Public title',descricao:'Private'}, {uid:'caller',token:'synthetic'},{create:true});
 assert.equal(c.commit.writes.length,3);assert.equal(c.commit.writes[2].update.fields._audit.stringValue,c.commit.writes[0].update.fields._audit.stringValue);assert(!Object.hasOwn(c.commit.writes[2].update.fields,'descricao'));
});
test('vendored browser libraries match committed integrity manifest',()=>{
 const crypto=require('node:crypto');const manifest=JSON.parse(fs.readFileSync(path.join(root,'vendor/manifest.json')));
 assert.equal(manifest.length,5);for(const f of manifest)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f.path))).digest('hex'),f.sha256);
});
test('real LDAPS loopback rejects self-signed certificate before writing bind credentials',async()=>{
 const tls=require('node:tls');const os=require('node:os');const {execFileSync}=require('node:child_process');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'seng-tls-test-'));const key=path.join(dir,'key.pem');const cert=path.join(dir,'cert.pem');let applicationPackets=0;
 execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-keyout',key,'-out',cert],{stdio:'ignore'});
 const server=tls.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(cert)},socket=>socket.on('data',()=>applicationPackets++));server.on('tlsClientError',()=>{});
 await new Promise(resolve=>server.listen(0,'localhost',resolve));
 try{const ldap=load('api/src/shared/ldap.js');await assert.rejects(ldap.ldapBind('ldaps://localhost:'+server.address().port,'Synthetic DN','SYNTHETIC_PASSWORD'),e=>e.code==='DEPTH_ZERO_SELF_SIGNED_CERT');assert.equal(applicationPackets,0);}
 finally{await new Promise(resolve=>server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});
test('migration validates public types without coercing legacy private values',()=>{
 const {validate,enc,decode}=require('../../tools/security-migration.cjs');
 const d=security.publicDemanda('id',{objeto:'Synthetic',campus:'TEST',status:'fila',especialidades:[],valorEstimado:100});assert.deepEqual(validate(d),[]);
 assert(validate({...d,valorEstimado:'private text'}).includes('valorEstimado'));
 const timestamp=new Date('2026-10-06T12:00:00Z');assert.equal(decode(enc(timestamp)).toISOString(),timestamp.toISOString());
});
test('API retention timestamp remains a Firestore timestamp in source and public projection',async()=>{
 const f=load('api/src/shared/firestore.js',{'./auth':{PROJECT_ID:'demo-security-local'},'./security':security});
 const expiry=new Date('2026-11-06T12:00:00Z');const projected=security.publicDemanda('id',{expurgarEm:expiry.toISOString()});assert.equal(f.enc(projected.expurgarEm).timestampValue,expiry.toISOString());
});
test('migration explicitly removes GCS download-token key without losing other metadata',()=>{
 const {retirementMetadata}=require('../../tools/security-migration.cjs');const previous={ownerUid:'synthetic',firebaseStorageDownloadTokens:'SYNTHETIC_TEST_ONLY'};
 assert.deepEqual(retirementMetadata(previous),{ownerUid:'synthetic',firebaseStorageDownloadTokens:null});assert.equal(previous.firebaseStorageDownloadTokens,'SYNTHETIC_TEST_ONLY');
});
