'use strict';
// Reviewed deployment helper. Defaults to read-only, prints aggregate counts only.
// Google IAM credentials are obtained in memory from the operator's gcloud session.
const {execFileSync}=require('node:child_process');
const {publicDemanda,publicConfig}=require('../api/src/shared/security');
const {createHash}=require('node:crypto');
const args=process.argv.slice(2);const option=k=>{const i=args.indexOf(k);return i<0?null:args[i+1];};
const TYPES={ano:'number',campus:'string',objeto:'string',status:'string',fase:'string',etapa:'string',tipoDemanda:'string',projetoExiste:'string',projetoOrigem:'string',tombado:'string',emergencial:'boolean',valorEstimado:'number',prazoEstimado:'string',criadoEm:'number',atualizadoEm:'number',concluidoEm:'number',codirAprovado:'boolean'};
const SPECIALTIES=['Arquitetura','Engenharia Civil','Engenharia Elétrica','Engenharia Mecânica','Segurança do Trabalho'];
function validate(d) {
 const invalid=Object.entries(TYPES).filter(([key,type])=>d[key]!=null && (typeof d[key]!==type || type==='number' && !Number.isFinite(d[key]))).map(([key])=>key);
 for(const key of ['campus','objeto','status'])if(typeof d[key]!=='string')invalid.push(key);
 if(!Array.isArray(d.especialidades) || d.especialidades.some(x=>!SPECIALTIES.includes(x)))invalid.push('especialidades');
 if(d.expurgarEm!=null && !(d.expurgarEm instanceof Date && Number.isFinite(d.expurgarEm.getTime())))invalid.push('expurgarEm');
 for(const key of ['g','u','t','valorConsiderado','pontosManual'])if(d.aval[key]!=null && (typeof d.aval[key]!=='number' || !Number.isFinite(d.aval[key])))invalid.push('aval.'+key);
 for(const key of ['prazoConsiderado','tipoAtividade'])if(d.aval[key]!=null && typeof d.aval[key]!=='string')invalid.push('aval.'+key);
 if(d.aval.tombadoConf!=null && typeof d.aval.tombadoConf!=='boolean')invalid.push('aval.tombadoConf');
 if(d.ajuste.valor!=null && (typeof d.ajuste.valor!=='number' || !Number.isFinite(d.ajuste.valor)))invalid.push('ajuste.valor');
 return [...new Set(invalid)];
}
function decode(v) {
 if('mapValue' in v)return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k,x])=>[k,decode(x)]));
 if('arrayValue' in v)return (v.arrayValue.values || []).map(decode);
 if('integerValue' in v)return Number(v.integerValue);
 if('timestampValue' in v)return new Date(v.timestampValue);
 return Object.values(v)[0];
}
function enc(v){
 if(v==null)return {nullValue:null};if(v instanceof Date)return {timestampValue:v.toISOString()};
 if(typeof v==='string')return {stringValue:v};if(typeof v==='boolean')return {booleanValue:v};
 if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
 if(Array.isArray(v))return {arrayValue:{values:v.map(enc)}};
 return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
}
function retirementMetadata(existing) { return {...existing,firebaseStorageDownloadTokens:null}; }
async function main() {
 const project=option('--project');const bucket=option('--bucket');const apply=args.includes('--apply');
 if(!project || !/^[a-z][a-z0-9-]+$/.test(project))throw new Error('Specify the reviewed target with --project.');
 if(!bucket || !/^[a-z0-9.-]+$/.test(bucket))throw new Error('Specify the exact reviewed --bucket.');
 let token;try{token=execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{throw new Error('An authenticated operator gcloud session is required.');}
 const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
 const resource=p=>`projects/${project}/databases/(default)/documents/${p}`;
 async function call(url,method='GET',body){
  const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok)throw new Error('Migration request failed with HTTP '+r.status+'; no upstream body was logged.');return r.status===204?{}:r.json();
 }
 async function list(col){let pageToken;const result=[];do{const query=new URLSearchParams({pageSize:'1000'});if(pageToken)query.set('pageToken',pageToken);const p=await call(base+'/'+col+'?'+query);result.push(...(p.documents || []));pageToken=p.nextPageToken;}while(pageToken);return result;}
 const demands=await list('demandas');const configs=await list('config');const publicDocs=await list('publicDemandas');
 const writes=[];const invalid=[];const ids=new Set();
 for(const raw of demands){const id=raw.name.split('/').pop();ids.add(id);const d=Object.fromEntries(Object.entries(raw.fields || {}).map(([k,v])=>[k,decode(v)]));const projection=publicDemanda(id,d);const errors=validate(projection);if(errors.length){invalid.push({fingerprint:createHash('sha256').update(id).digest('hex').slice(0,12),fields:errors});continue;}const projectedFields=Object.fromEntries(Object.entries(projection).map(([k,v])=>[k,enc(v)]));if(raw.fields?.expurgarEm?.timestampValue)projectedFields.expurgarEm=raw.fields.expurgarEm;writes.push({update:{name:resource('publicDemandas/'+id),fields:projectedFields}});}
 for(const raw of configs){const id=raw.name.split('/').pop();if(!['params','transparencia'].includes(id))continue;const data=Object.fromEntries(Object.entries(raw.fields || {}).map(([k,v])=>[k,decode(v)]));const projection=publicConfig(id,data);const errors=Object.entries(projection).filter(([,v])=>v!=null && (typeof v!=='number' || !Number.isFinite(v))).map(([k])=>k);if(errors.length){invalid.push({fingerprint:'config-'+id,fields:errors});continue;}writes.push({update:{name:resource('publicConfig/'+id),fields:Object.fromEntries(Object.entries(projection).map(([k,v])=>[k,enc(v)]))}});}
 let orphans=0;for(const raw of publicDocs)if(!ids.has(raw.name.split('/').pop())){writes.push({delete:raw.name});orphans++;}
 const objects=[];for(const prefix of ['chamados/','demandas/','perfis/']){let pageToken;do{const q=new URLSearchParams({prefix,maxResults:'1000'});if(pageToken)q.set('pageToken',pageToken);const p=await call('https://storage.googleapis.com/storage/v1/b/'+bucket+'/o?'+q);objects.push(...(p.items || []));pageToken=p.nextPageToken;}while(pageToken);}
 const legacy=objects.filter(o=>o.metadata?.firebaseStorageDownloadTokens);
 const summary={mode:apply?'apply':'dry-run',project,demands:demands.length,projectionWrites:writes.length,invalidProjections:invalid,orphanPublicProjections:orphans,objectsWithDownloadTokens:legacy.length,retireDownloadTokens:args.includes('--retire-download-tokens')};
 console.log(JSON.stringify(summary,null,2));if(invalid.length)throw new Error('Correct the identified source types before publishing; no writes performed.');
 if(!apply)return;
 // Apply only while writes are paused. Rule-enforcing clients keep both records
 // atomic; an IAM migration cannot establish a cross-client transaction boundary.
 for(let i=0;i<writes.length;i+=100)await call(base+':commit','POST',{writes:writes.slice(i,i+100)});
 if(args.includes('--retire-download-tokens'))for(const object of legacy){const metadata=retirementMetadata(object.metadata);
  await call('https://storage.googleapis.com/storage/v1/b/'+bucket+'/o/'+encodeURIComponent(object.name)+'?ifMetagenerationMatch='+encodeURIComponent(object.metageneration),'PATCH',{metadata});
  const verified=await call('https://storage.googleapis.com/storage/v1/b/'+bucket+'/o/'+encodeURIComponent(object.name));
  if(verified.metadata?.firebaseStorageDownloadTokens)throw new Error('Download-token retirement verification failed; keep writes paused.');
 }
 console.log(JSON.stringify({completed:true,projectionWrites:writes.length,retiredTokens:args.includes('--retire-download-tokens')?legacy.length:0}));
}
module.exports={validate,enc,decode,retirementMetadata};
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
