'use strict';
const fs=require('node:fs');const path=require('node:path');const http=require('node:http');const assert=require('node:assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..');const checks=[];
const pass=name=>{checks.push(name);console.log('PASS',name);};
const emulated=process.env.SECURITY_EMULATORS==='1';
const PROJECT='demo-security-cpii-seng';
const server=http.createServer((req,res)=>{
 let p;try{p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}
 if(p==='/' || p==='/index.html')p='/index.html';
 if(p.split('/').some(s=>s.startsWith('.'))){res.writeHead(404);res.end();return;}
 const filename=path.resolve(root,'.'+p);
 if(!filename.startsWith(root+path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()){res.writeHead(404);res.end();return;}
 let body=p==='/js/firebase-config.js' ? Buffer.from('export const FIREBASE_CONFIG=null;') : fs.readFileSync(filename);
 if(p==='/index.html' && emulated)body=Buffer.from(body.toString().replace("connect-src 'self'","connect-src 'self' http://127.0.0.1:18080 http://127.0.0.1:19199 http://127.0.0.1:19099"));
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
 res.writeHead(200,{'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'});res.end(body);
});
const enc=v=>v==null?{nullValue:null}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{integerValue:String(v)}:typeof v==='string'?{stringValue:v}:Array.isArray(v)?{arrayValue:{values:v.map(enc)}}:{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,enc(x)]))}};
async function seed(doc,data){assert(emulated);const r=await fetch(`http://127.0.0.1:18080/v1/projects/${PROJECT}/databases/(default)/documents/${doc}`,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify({fields:Object.fromEntries(Object.entries(data).map(([k,x])=>[k,enc(x)]))})});assert.equal(r.status,200);}
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : chromium.executablePath()),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext();const page=await context.newPage();const errors=[];const external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(origin) && !r.url().startsWith('data:') && !r.url().startsWith('blob:'))external.push(r.url());});
 try{
  await page.goto(origin);await page.locator('.faixa-demo').waitFor();await page.getByRole('heading',{name:'Obras e serviços de engenharia',exact:true}).waitFor();pass('Public dashboard with synthetic demo data');
  await page.goto(origin+'/#/login');await page.locator('input[type=email]').fill('campus.sc2@cp2.demo');await page.locator('input[type=password]').fill('cp2demo');await page.getByRole('button',{name:'Entrar',exact:true}).click();await page.getByRole('button',{name:'Sair',exact:true}).waitFor();pass('Campus login');
  await page.goto(origin+'/#/chamado-novo');const category=page.locator('form select').nth(1);const value=await category.locator('option').evaluateAll(a=>a.find(x=>x.value)?.value);await category.selectOption(value);
  await page.locator('input[maxlength="140"]').fill('Synthetic browser regression');await page.locator('input[maxlength="160"]').fill('Test location');await page.locator('textarea').fill('Synthetic test only.');await page.getByRole('button',{name:'Abrir chamado',exact:true}).click();await page.waitForURL(/#\/chamado\//);pass('Create and display chamado');
  await page.reload();await page.locator('#app').getByText('Synthetic browser regression',{exact:true}).first().waitFor();pass('Session and chamado persistence');
  // Exercise real vendored PDF and XLSX bytes, including the pdf.js module/worker.
  const downloads=[];page.on('download',d=>downloads.push(d));
  await page.evaluate(async()=>{
   const {store}=await import('/js/store.js');const s=store();
   const {gerarRelatorio}=await import('/js/pdf.js');await gerarRelatorio({demandas:s.listDemandas(),params:s.getParams(),filtros:'Synthetic',autenticado:false});
   const {exportarExcel}=await import('/js/xlsx.js');await exportarExcel({demandas:s.listDemandas(),params:s.getParams()});
  });
  await page.waitForFunction(()=>Boolean(window.jspdf && window.XLSX));await new Promise(r=>setTimeout(r,200));assert.equal(downloads.length,2);
  for(const d of downloads){const f=await d.path();const bytes=fs.readFileSync(f);assert(bytes.length>1000);assert(bytes.subarray(0,4).toString()==='%PDF' || bytes.subarray(0,2).toString()==='PK');}
  pass('Vendored PDF and XLSX generation produce valid downloads');
  const thumb=await page.evaluate(async()=>{const doc=new window.jspdf.jsPDF();doc.text('Synthetic thumbnail',20,20);const {thumbDePdf}=await import('/js/pdf-thumb.js');const blob=await thumbDePdf(new File([doc.output('arraybuffer')],'synthetic.pdf',{type:'application/pdf'}));return blob && {size:blob.size,type:blob.type};});
  assert(thumb && thumb.size>100 && thumb.type==='image/jpeg');pass('Vendored PDF first-page thumbnail and worker');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);pass('Demo/browser workflows produce no JS errors or external requests');
  if(emulated){
   const r=await fetch(`http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=synthetic`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'browser-campus@invalid.test',password:'Synthetic-only-123!',returnSecureToken:true})});assert.equal(r.status,200);const account=await r.json();
   const profile={nome:'Browser Campus',role:'campus',campi:['TEST'],ativo:true,email:'browser-campus@invalid.test'};await seed('usuarios/'+account.localId,profile);
   await page.addInitScript(()=>{window.__SENG_EMULATORS__={auth:19099,firestore:18080,storage:19199};});
   await page.reload();
   // Only the official pinned Firebase SDK may leave loopback in this test.
   await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='www.gstatic.com' && u.pathname.startsWith('/firebasejs/10.12.2/')) { const file=path.join(root,'.test-cache/firebase-sdk',path.basename(u.pathname));if(fs.existsSync(file))return route.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(file)}); } if(['127.0.0.1','localhost'].includes(u.hostname) || ['data:','blob:'].includes(u.protocol))return route.continue();return route.abort();});
   await page.evaluate(async project=>{const {FirebaseProvider}=await import('/js/firebase-provider.js');window.testProvider=new FirebaseProvider({projectId:project,apiKey:'synthetic',authDomain:project+'.firebaseapp.com',storageBucket:project+'.appspot.com'});await window.testProvider.ready;},PROJECT);
   await page.evaluate(async()=>{await window.testProvider.login('browser-campus@invalid.test','Synthetic-only-123!');});
   await page.waitForFunction(()=>window.testProvider.user?.role==='campus');pass('Real FirebaseProvider login against Auth/Firestore emulators');
   const created=await page.evaluate(async()=>window.testProvider.criarChamado({campus:'TEST',categoria:'eletrica',assunto:'Browser SDK test',descricao:'Synthetic',autor:{uid:'forged'},historico:[{ts:1,user:'forged',acao:'forged'}]}));
   await page.waitForFunction(id=>window.testProvider.getChamado(id)?.autor?.uid===window.testProvider.user.uid,created);pass('Real SDK transaction binds author/history and writes atomic audit');
   const file=await page.evaluate(async id=>{const p=window.testProvider;const a=await p.uploadAnexoChamado(id,'TEST',new File(['%PDF synthetic'],'synthetic.pdf',{type:'application/pdf'}));await p.atualizarChamado(id,{anexos:[a]},'Anexo adicionado');return a;},created);
   await page.waitForFunction(id=>window.testProvider.getChamado(id)?.anexos?.[0]?.url?.startsWith('blob:'),created);assert(!Object.hasOwn(file,'url'));pass('Authenticated Storage blob read and durable path-only attachment metadata');
   const apiResponse=await fetch(`http://127.0.0.1:18080/v1/projects/${PROJECT}/databases/(default)/documents/chamados/${created}`,{headers:{Authorization:'Bearer owner'}});const stored=await apiResponse.json();assert(!JSON.stringify(stored.fields.anexos).includes('blob:'));assert(!JSON.stringify(stored.fields.anexos).includes('token='));
   await seed('usuarios/'+account.localId,{...profile,ativo:false});await page.waitForFunction(()=>!window.testProvider.user && !window.testProvider.auth.currentUser && window.testProvider.listChamados().length===0);pass('Live deactivation signs out and clears private data/blob cache');
  }
  fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify({checks,passed:checks.length,emulated,productionRequests:0},null,2)+'\n');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
