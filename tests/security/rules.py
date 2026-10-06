"""Regression tests for the corrected rules, with synthetic data only. No SDK installation or production credentials.

Execute only through the supplied Firebase config and demo project. This file
does not start/download emulators. Every request targets fixed loopback ports.
"""
import base64,copy,json,os,pathlib,time,urllib.request,urllib.error,urllib.parse,subprocess
PROJECT='demo-security-cpii-seng'
BUCKET=PROJECT+'.appspot.com'
OUT=pathlib.Path(__file__).resolve().parent
FS_HOST='127.0.0.1:18080'
ST_HOST='127.0.0.1:19199'
if os.environ.get('FIRESTORE_EMULATOR_HOST')!=FS_HOST or os.environ.get('FIREBASE_STORAGE_EMULATOR_HOST')!=ST_HOST:
    raise SystemExit('Refusing execution: exact emulator-only environment is required.')
BASE=f'http://{FS_HOST}/v1/projects/{PROJECT}/databases/(default)/documents'
ST_BASE=f'http://{ST_HOST}/v0/b/{BUCKET}/o'
RESULTS=[]
def token(uid,role=None,campi=None):
    b64=lambda v:base64.urlsafe_b64encode(json.dumps(v).encode()).decode().rstrip('=')
    now=int(time.time());p={'iss':f'https://securetoken.google.com/{PROJECT}','aud':PROJECT,'sub':uid,'user_id':uid,'iat':now,'exp':now+3600,'auth_time':now,'firebase':{'sign_in_provider':'custom','identities':{}}}
    p['email']=uid+'@invalid.test'
    if role:p['role']=role
    if campi is not None:p['campi']=campi
    return b64({'alg':'none','typ':'JWT'})+'.'+b64(p)+'.'
def req(url,method='GET',body=None,t=None,ctype='application/json',extra_headers=None):
    assert url.startswith('http://127.0.0.1:18080/') or url.startswith('http://127.0.0.1:19199/')
    headers={'Content-Type':ctype}
    if extra_headers:headers.update(extra_headers)
    if t:headers['Authorization']='Bearer '+t
    data=None if body is None else body if isinstance(body,bytes) else json.dumps(body).encode()
    r=urllib.request.Request(url,data=data,headers=headers,method=method)
    try:
        with urllib.request.urlopen(r,timeout=30) as response:return response.status,response.read()
    except urllib.error.HTTPError as e:return e.code,e.read()
def enc(v):
    if hasattr(v,'isoformat'):return {'timestampValue':v.isoformat()}
    if v is None:return {'nullValue':None}
    if isinstance(v,bool):return {'booleanValue':v}
    if isinstance(v,int):return {'integerValue':str(v)}
    if isinstance(v,float):return {'doubleValue':v}
    if isinstance(v,str):return {'stringValue':v}
    if isinstance(v,list):return {'arrayValue':{'values':[enc(x) for x in v]}}
    return {'mapValue':{'fields':{k:enc(x) for k,x in v.items()}}}
def fields(d):return {k:enc(v) for k,v in d.items()}
def write(p,d,t='owner',mask=None):
    query=''
    if mask:query='?'+urllib.parse.urlencode([('updateMask.fieldPaths',x) for x in mask])
    return req(BASE+'/'+p+query,'PATCH',{'fields':fields(d)},t)[0]
def get(p,t=None):return req(BASE+'/'+p,t=t)
def seed(p,d):assert write(p,d)==200,('seed failed',p)
def check(name,finding,fn):
    try:detail=fn();result={'name':name,'finding':finding,'pass':True,'detail':detail}
    except Exception as e:result={'name':name,'finding':finding,'pass':False,'error':str(e)}
    RESULTS.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
def expect(actual,expected):assert actual==expected,(actual,expected)
def patch_test(p,data,t,expected=200):
    code=write(p,data,t,list(data));expect(code,expected);return {'http_status':code}
def upload(p,t,content=b'%PDF-SYNTHETIC-ONLY',mime='application/pdf'):
    boundary='synthetic-boundary-codex-local'
    metadata=json.dumps({'name':p,'contentType':mime,'metadata':{'ownerUid': json.loads(base64.urlsafe_b64decode(t.split('.')[1]+'==='))['sub']}}).encode()
    body=b'--'+boundary.encode()+b'\r\nContent-Type: application/json; charset=utf-8\r\n\r\n'+metadata+b'\r\n--'+boundary.encode()+b'\r\nContent-Type: '+mime.encode()+b'\r\n\r\n'+content+b'\r\n--'+boundary.encode()+b'--\r\n'
    code,raw=req(ST_BASE+'?'+urllib.parse.urlencode({'name':p}),'POST',body,t,'multipart/related; boundary='+boundary,{'x-goog-upload-protocol':'multipart'})
    return code
def delete(p,t):return req(ST_BASE+'/'+urllib.parse.quote(p,safe=''),'DELETE',t=t)[0]
def st_get(p,t):return req(ST_BASE+'/'+urllib.parse.quote(p,safe=''),t=t)[0]
import uuid,datetime
NAME_PREFIX=f'projects/{PROJECT}/databases/(default)/documents/'
UID={r:r+'-synthetic' for r in ['campus','other','support','administrative','inactive','engineering','chief','codir','admin']}
TOKENS={r:token(uid, {'support':'estagiario','administrative':'administrativo','engineering':'engenharia','chief':'chefe','other':'campus','inactive':'campus'}.get(r,r),['OTHER'] if r=='other' else ['TEST']) for r,uid in UID.items()}
for r,uid in UID.items():
    seed('usuarios/'+uid,{'role':{'support':'estagiario','administrative':'administrativo','engineering':'engenharia','chief':'chefe','other':'campus','inactive':'campus'}.get(r,r),'campi':['OTHER'] if r=='other' else ['TEST'],'nome':r,'ativo':r!='inactive'})
UNPROFILED=token('unprofiled-synthetic','admin',['TEST'])
def dec(v):
    if 'mapValue' in v:return {k:dec(x) for k,x in v['mapValue'].get('fields',{}).items()}
    if 'arrayValue' in v:return [dec(x) for x in v['arrayValue'].get('values',[])]
    if 'integerValue' in v:return int(v['integerValue'])
    if 'timestampValue' in v:return datetime.datetime.fromisoformat(v['timestampValue'].replace('Z','+00:00'))
    return next(iter(v.values()))
def read(p,t='owner'):
    code,raw=get(p,t)
    if code==404:return None
    expect(code,200)
    return {k:dec(v) for k,v in json.loads(raw)['fields'].items()}
PUB=['ano','campus','objeto','especialidades','status','fase','etapa','tipoDemanda','projetoExiste','projetoOrigem','tombado','emergencial','valorEstimado','prazoEstimado','criadoEm','atualizadoEm','concluidoEm','codirAprovado','expurgarEm']
AVAL=['g','u','t','valorConsiderado','prazoConsiderado','tipoAtividade','tombadoConf','pontosManual']
PARAMS=['anoPlano','valorRef','pesoGUT','pesoPxC','limitePontos','refChamadosProf','refChamadosSetor','refPlanejProf','refPlanejSetor']
def projection(id,d):return {'id':id,'_audit':d.get('_audit'),**{k:d.get(k) for k in PUB},'aval':{k:(d.get('aval') or {}).get(k) for k in AVAL},'ajuste':{'valor':(d.get('ajuste') or {}).get('valor')}}
def ms():return int(time.time()*1000)
def hist(r,action='Synthetic event'):
    return {'ts':ms(),'uid':UID[r],'user':r,'acao':action}
def demand(status='recebido'):
    return {'objeto':'Synthetic','descricao':'Private description','campus':'TEST','status':status,'especialidades':[],'comentarios':[],'historico':[],'obsInterna':[],'obsExterna':[],'criadoEm':ms(),'atualizadoEm':ms()}
def call(status='aberto'):
    now=ms();return {'assunto':'Synthetic','descricao':'Synthetic','campus':'TEST','categoria':'eletrica','status':status,'prazoLimite':now+5*86400000,'aberturaEm':now,'atualizadoEm':now,'historico':[],'comentarios':[],'autor':{'uid':UID['campus'],'nome':'campus','email':UID['campus']+'@invalid.test'}}
def audited(path,patch,r='campus',create=False,delete=False,log_override=None,source_override=None,projection_override=None,omit_log=False,omit_projection=False):
    col,id=path.split('/');old={} if create else read(path) or {};d={**old,**patch};op='delete' if delete else 'create' if create else 'update';event=uuid.uuid4().hex
    changes=list(k for k in sorted(set(old)|set(d)) if k!='_audit' and (k not in old or k not in d or old[k]!=d[k]))
    if delete:changes=[k for k in old if k!='_audit']
    log={'uid':UID[r],'nome':r,'email':UID[r]+'@invalid.test','acao':op,'alvo':path,'detalhes':'','col':col,'doc':id,'op':op,'fields':changes}
    if log_override:log.update(log_override)
    writes=[]
    if delete:
        writes.append({'delete':NAME_PREFIX+path})
        writes.append({'update':{'name':NAME_PREFIX+'auditDeletes/'+col+'_'+id,'fields':fields({'col':col,'doc':id,'eventId':event})}})
    else:
        d['_audit']=event
        if source_override:d.update(source_override)
        writes.append({'update':{'name':NAME_PREFIX+path,'fields':fields(d)},'currentDocument':{'exists':not create}})
    if not omit_log:writes.append({'update':{'name':NAME_PREFIX+'logs/'+event,'fields':fields(log)},'updateTransforms':[{'fieldPath':'ts','setToServerValue':'REQUEST_TIME'}]})
    if not omit_projection and (col=='demandas' or col=='config' and id=='params'):
        p='publicDemandas/'+id if col=='demandas' else 'publicConfig/'+id
        if delete:writes.append({'delete':NAME_PREFIX+p})
        else:
            pub=projection(id,d) if col=='demandas' else {k:d.get(k) for k in PARAMS}
            if projection_override:pub.update(projection_override)
            writes.append({'update':{'name':NAME_PREFIX+p,'fields':fields(pub)}})
    code,raw=req(BASE+':commit','POST',{'writes':writes},TOKENS[r])
    return code,raw,event,d

def mutation_test(name,finding,path,patch,r='campus',expected=200,**opts):
    def run():
        code,raw,event,d=audited(path,patch,r,**opts)
        assert code==expected,(code,expected,raw.decode()[:900]);return {'status':code}
    check(name,finding,run)
seed('demandas/public-synthetic',demand())
seed('publicDemandas/public-synthetic',projection('public-synthetic',demand()))
seed('config/params',{'valorRef':100,'private':'secret'})
seed('publicConfig/params',{k:100 if k=='valorRef' else None for k in PARAMS})
seed('diretorio/atual',{'entradas':[]})
for p in ['demandas/public-synthetic','config/params','usuarios/'+UID['campus']]:
 check('anonymous private read denied: '+p,1,lambda p=p:expect(get(p)[0],403))
for p in ['publicDemandas/public-synthetic','publicConfig/params']:
 check('anonymous approved public projection: '+p,1,lambda p=p:expect(get(p)[0],200))
check('projection contains no descriptions, authors or timelines',1,lambda:expect(set(read('publicDemandas/public-synthetic')) & {'descricao','autor','historico','comentarios','anexos','eventosAgenda'},set()))
for r in ['campus','engineering','support']:
 check('profile may read own/private demand: '+r,1,lambda r=r:expect(get('demandas/public-synthetic',TOKENS[r])[0],200))
check('other campus private demand denied',1,lambda:expect(get('demandas/public-synthetic',TOKENS['other'])[0],403))
check('unprofiled directory access denied despite admin claim',2,lambda:expect(get('diretorio/atual',UNPROFILED)[0],403))
check('active campus routing directory remains accessible',2,lambda:expect(get('diretorio/atual',TOKENS['campus'])[0],200))
check('unprofiled arbitrary notification denied',2,lambda:expect(write('notificacoes/forged',{'de':'unprofiled-synthetic','para':UID['engineering'],'tipo':'anything','demandaId':'missing','link':'https://invalid.test','lida':False},UNPROFILED),403))
for r in ['support','administrative']:
 seed('tarefas/'+r,{'titulo':'Synthetic','situacao':'aberta','responsaveis':[]})
 mutation_test('support edit/task assignments allowed '+r,3,'tarefas/'+r,{'titulo':'Updated','responsaveis':[UID['campus']]},r)
 mutation_test('support cancel task denied '+r,3,'tarefas/'+r,{'situacao':'cancelada'},r,403)
 mutation_test('support delete task denied '+r,3,'tarefas/'+r,{},r,403,delete=True)
mutation_test('chief may cancel task',3,'tarefas/support',{'situacao':'cancelada'},'chief')
for col in ['demandas','chamados']:
 data=demand('atendimento') if col=='demandas' else call('resolvido')
 a={'id':'other','ts':ms(),'autorUid':UID['other'],'autor':'other','role':'campus','texto':'Other comment'}
 own={'id':'own','ts':ms(),'autorUid':UID['campus'],'autor':'campus','role':'campus','texto':'Own comment'}
 data.update(comentarios=[a,own],historico=[hist('engineering')]);path=col+'/timeline';seed(path,data)
 mutation_test(col+' cannot erase comment/history arrays',4,path,{'comentarios':[],'historico':[]},expected=403)
 mutation_test(col+' can append own comment in final state',4,path,{'comentarios':[a,own,{'id':'new','ts':ms(),'autorUid':UID['campus'],'autor':'campus','role':'campus','texto':'New comment'}]})
 current=read(path);edited={**own,'texto':'Edited','editadoEm':ms()}
 mutation_test(col+' edit own comment preserves others',4,path,{'comentarios':[a,edited,current['comentarios'][2]]})
 mutation_test(col+' forged author on edited comment denied',4,path,{'comentarios':[a,{**edited,'autorUid':UID['other']},current['comentarios'][2]]},expected=403)
 mutation_test(col+' cannot erase another author comment',4,path,{'comentarios':[edited,current['comentarios'][2]]},expected=403)
 mutation_test(col+' own deletion permitted',4,path,{'comentarios':[a,current['comentarios'][2]]})
 mutation_test(col+' chief moderation permitted',4,path,{'comentarios':[current['comentarios'][2]]},'chief')
 mutation_test(col+' history forgery denied',4,path,{'historico':[hist('other')]},expected=403)
for status in ['recebido','analise','diligencia']:
 path='demandas/internal-'+status;seed(path,demand(status))
 mutation_test('campus private workflow field injection '+status,5,path,{'fase':'execucao','artefatos':{'secret':True}},expected=403)
 mutation_test('campus legal request edit '+status,5,path,{'descricao':'Legitimate update','historico':[hist('campus')],'atualizadoEm':ms()})
seed('demandas/reply',demand('diligencia'))
mutation_test('campus demand diligencia response allowed',5,'demandas/reply',{'descricao':'Responded','status':'analise','historico':[hist('campus')],'atualizadoEm':ms()})
seed('chamados/rewind',call('resolvido'))
mutation_test('resolved chamado rewind and arbitrary SLA denied',6,'chamados/rewind',{'status':'aberto','prazoLimite':9999999999999,'diligenciaDesde':-1},expected=403)
seed('chamados/early',call())
mutation_test('same-state arbitrary SLA extension denied',6,'chamados/early',{'prazoLimite':9999999999999},expected=403)
mutation_test('campus early chamado edits SUAP allowed',6,'chamados/early',{'descricao':'Complement','processoSuap':'Synthetic SUAP','atualizadoEm':ms(),'historico':[hist('campus')]})
paused=call('diligencia');paused['diligenciaDesde']=ms()-30000;seed('chamados/paused',paused);now=ms()
mutation_test('paused SLA recomposition with real elapsed time allowed',6,'chamados/paused',{'status':'triagem','diligenciaDesde':None,'prazoLimite':paused['prazoLimite']+now-paused['diligenciaDesde'],'atualizadoEm':now,'historico':[hist('campus')]})
mutation_test('SENG may triage and enter diligence',6,'chamados/early',{'status':'diligencia','diligenciaDesde':ms(),'historico':read('chamados/early')['historico']+[hist('engineering')],'atualizadoEm':ms()},'engineering')
check('arbitrary orphan log rejected',11,lambda:expect(write('logs/forged',{'uid':UID['campus'],'nome':'campus','email':UID['campus']+'@invalid.test','acao':'create','alvo':'chamados/fake','detalhes':'','ts':-999,'col':'chamados','doc':'fake','op':'create','fields':[]},TOKENS['campus']),403))
mutation_test('forged actor on atomic receipt rejected',11,'chamados/early',{'descricao':'Changed'},expected=403,log_override={'nome':'other'})
mutation_test('false changed-field receipt rejected',11,'chamados/early',{'descricao':'Changed'},expected=403,log_override={'fields':['status']})
mutation_test('business write without audit fails atomically',11,'chamados/early',{'descricao':'Changed'},expected=403,omit_log=True)
check('failed batch did not mutate source',11,lambda:expect(read('chamados/early')['descricao'],'Complement'))
new=call();new['historico']=[hist('campus','Chamado aberto')]
mutation_test('strict legitimate chamado creation',12,'chamados/new',new,create=True)
for key,value in [('autor',{'uid':UID['other'],'nome':'other','email':'other@invalid.test'}),('aberturaEm',1),('extra','injected'),('atendentes',[UID['engineering']]),('historico',[hist('other')])]:
 forged={**new,key:value};mutation_test('chamado forged '+key+' rejected',12,'chamados/forged-'+key,forged,expected=403,create=True)
mutation_test('legitimate SENG-created demand and sanitized projection',1,'demandas/new',{**demand(),'historico':[hist('engineering')]},'engineering',create=True)
mutation_test('projection cannot leak unapproved fields',1,'demandas/new',{'descricao':'New private value'},'engineering',403,projection_override={'descricao':'leak'})
mutation_test('demand cannot commit without matching projection',1,'demandas/new',{'objeto':'Changed'},'engineering',403,omit_projection=True)
mutation_test('chief edits params and numeric public projection',1,'config/params',{'valorRef':200},'chief')
mutation_test('private config field cannot be inserted into projection',1,'config/params',{'valorRef':300},'chief',403,projection_override={'private':'leak'})
mutation_test('chief authenticated physical deletion audited',11,'chamados/new',{},'chief',delete=True)
mutation_test('engineering technical observation creation',11,'internas/new',{'obsEngenharia':'Synthetic note'},'engineering',create=True)
# Positive workflow regressions: scoring, CODIR gates, SENG phases, archive/rescue.
seed('demandas/score',{**demand('analise'),'aval':None,'codirAprovado':False})
mutation_test('engineering technical GUT evaluation allowed',5,'demandas/score',{'aval':{'g':3,'u':4,'t':5,'valorConsiderado':100000,'prazoConsiderado':'curto','tipoAtividade':'fisc-obra','tombadoConf':True},'status':'codir','historico':[hist('engineering')],'atualizadoEm':ms()},'engineering')
mutation_test('CODIR approves demand and sets adjustment',5,'demandas/score',{'status':'fila','codirAprovado':True,'ajuste':{'valor':0.1,'motivo':'Private rationale'},'historico':read('demandas/score')['historico']+[hist('codir')],'atualizadoEm':ms()},'codir')
mutation_test('chief starts approved demand',5,'demandas/score',{'status':'atendimento','fase':'planejamento','historico':read('demandas/score')['historico']+[hist('chief')],'atualizadoEm':ms()},'chief')
mutation_test('SENG maintains private artifacts in attendance',5,'demandas/score',{'fase':'licitacao','artefatos':{'etp':True},'historico':read('demandas/score')['historico']+[hist('engineering')],'atualizadoEm':ms()},'engineering')
mutation_test('support own demand comment remains allowed',4,'demandas/score',{'comentarios':[{'id':'support-note','ts':ms(),'autorUid':UID['support'],'autor':'support','role':'estagiario','texto':'Synthetic team comment'}]},'support')
mutation_test('campus cannot alter locked evaluation',5,'demandas/score',{'aval':{'g':1,'u':1,'t':1}},expected=403)
seed('demandas/intake-stage',{**demand(),'tipoDemanda':'obra','projetoExiste':'nao','etapa':'projeto'})
mutation_test('campus edit may update derived intake stage',5,'demandas/intake-stage',{'tipoDemanda':'consultoria','etapa':None,'historico':[hist('campus')],'atualizadoEm':ms()})
mutation_test('campus cannot set independent workflow stage',5,'demandas/intake-stage',{'etapa':'obra'},expected=403)
seed('demandas/archive',demand());expiry=datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(days=30)
mutation_test('chief archive mirrors timestamp retention into public projection',1,'demandas/archive',{'status':'excluido','statusAnterior':'recebido','excluidoEm':ms(),'expurgarEm':expiry,'historico':[hist('chief')],'atualizadoEm':ms()},'chief')
mutation_test('chief can delete archived demand and projection atomically',11,'demandas/archive',{},'chief',delete=True)
seed('profissionais/self',{'nome':'campus','email':UID['campus']+'@invalid.test','ausencias':[]})
profile=read('usuarios/'+UID['campus']);seed('usuarios/'+UID['campus'],{**profile,'email':UID['campus']+'@invalid.test'})
mutation_test('professional self-service absence allowed with audit',11,'profissionais/self',{'ausencias':[{'inicio':'2026-10-06','fim':'2026-10-07','tipo':'Synthetic'}]})
mutation_test('professional cannot change technical team identity',11,'profissionais/self',{'area':'Civil'},expected=403)
mutation_test('admin may create a user with atomic receipt',11,'usuarios/new-profile',{'nome':'Synthetic new user','role':'campus','ativo':True,'campi':['TEST']},'admin',create=True)
mutation_test('admin deactivation has atomic receipt',9,'usuarios/new-profile',{'ativo':False},'admin')
# Real notification event, valid recipients and local link; retries cannot forge copies.
code,raw,event,data=audited('chamados/early',{'descricao':'Changed again'},'campus');expect(code,200)
n={'para':UID['engineering'],'de':UID['campus'],'deNome':'campus','tipo':'chamado-atualizado','demandaId':'early','objeto':'Synthetic','texto':'Chamado atualizado — Synthetic','link':'#/chamado/early','criadoEm':ms(),'lida':False,'eventoId':event}
nid=event+'_'+UID['engineering']+'_chamado-atualizado'
check('legitimate campus notification fanout accepted',2,lambda:expect(write('notificacoes/'+nid,n,TOKENS['campus']),200))
for field,value in [('link','https://invalid.test/'),('texto','Attacker message'),('para',UID['other']),('eventoId','forged')]:
 forged={**n,field:value};fid=forged['eventoId']+'_'+forged['para']+'_'+forged['tipo']
 check('notification forged '+field+' denied',2,lambda forged=forged,fid=fid:expect(write('notificacoes/'+fid,forged,TOKENS['campus']),403))
check('notification recipient may mark read',2,lambda:expect(write('notificacoes/'+nid,{'lida':True},TOKENS['engineering'],['lida']),200))
# The existing UI calls 'diligencia' after the campus response (state = analise),
# and 'comentario' for a demand attachment. Both legitimate fanouts must survive.
for kind,patch,prefix in [('diligencia',{'descricao':'Campus reply notification'},'Diligência atualizada — '),('comentario',{'anexos':[{'path':'demandas/TEST/reply/synthetic.pdf'}]},'Novo comentário — ')]:
 code,raw,event,data=audited('demandas/reply',patch,'campus');expect(code,200)
 n={'para':UID['engineering'],'de':UID['campus'],'deNome':'campus','tipo':kind,'demandaId':'reply','objeto':'Synthetic','texto':prefix+'Synthetic','link':'#/demanda/reply','criadoEm':ms(),'lida':False,'eventoId':event}
 nid=event+'_'+UID['engineering']+'_'+kind
 check('legitimate demand fanout: '+kind,2,lambda n=n,nid=nid:expect(write('notificacoes/'+nid,n,TOKENS['campus']),200))
# Parent/state/current-profile checks in cross-service Storage rules.
for p in ['demandas/TEST/missing/file.pdf','chamados/TEST/missing/file.pdf']:
 check('orphan upload rejected '+p,8,lambda p=p:expect(upload(p,TOKENS['campus']),403))
seed('chamados/storage',call());seed('demandas/storage',demand('concluido'))
p='chamados/TEST/storage/file.pdf'
check('campus attaches to existing open chamado',8,lambda:expect(upload(p,TOKENS['campus']),200))
check('campus reads authenticated existing file',8,lambda:expect(st_get(p,TOKENS['campus']),200))
check('file overwrite denied',8,lambda:expect(upload(p,TOKENS['campus']),403))
check('mismatched path campus denied',8,lambda:expect(upload('chamados/OTHER/storage/wrong.pdf',TOKENS['other']),403))
check('other campus file read denied',8,lambda:expect(st_get(p,TOKENS['other']),403))
check('unprofiled claimed admin storage read denied',9,lambda:expect(st_get(p,UNPROFILED),403))
check('campus may attach to concluded demand',8,lambda:expect(upload('demandas/TEST/storage/concluded.pdf',TOKENS['campus']),200))
seed('chamados/closed-storage',call('resolvido'))
check('campus terminal chamado attachment rejected',8,lambda:expect(upload('chamados/TEST/closed-storage/file.pdf',TOKENS['campus']),403))
check('support may attach to SENG chamado',8,lambda:expect(upload('chamados/TEST/closed-storage/support.pdf',TOKENS['support']),200))
check('support cannot remove attachments',8,lambda:expect(delete('chamados/TEST/closed-storage/support.pdf',TOKENS['support']),403))
check('campus cannot remove another author file',8,lambda:expect(delete('chamados/TEST/closed-storage/support.pdf',TOKENS['campus']),403))
check('chief may remove another author file',8,lambda:expect(delete('chamados/TEST/closed-storage/support.pdf',TOKENS['chief']),204))
check('invalid MIME denied',8,lambda:expect(upload('chamados/TEST/storage/file.bin',TOKENS['campus'],mime='application/octet-stream'),403))
check('campus own file deletion allowed',8,lambda:expect(delete(p,TOKENS['campus']),204))
# A real already-issued JWT keeps its role/campus claims while live profile changes.
p='chamados/TEST/storage/revocation.pdf';expect(upload(p,TOKENS['campus']),200)
profile=read('usuarios/'+UID['campus']);seed('usuarios/'+UID['campus'],{**profile,'ativo':False})
check('deactivation immediately revokes storage read with stale JWT',9,lambda:expect(st_get(p,TOKENS['campus']),403))
check('deactivation immediately revokes upload with stale JWT',9,lambda:expect(upload('chamados/TEST/storage/after-disable.pdf',TOKENS['campus']),403))
check('deactivation immediately revokes Firestore writes',9,lambda:expect(audited('chamados/early',{'descricao':'Inactive'})[0],403))
seed('usuarios/'+UID['campus'],{**profile,'campi':['OTHER']})
check('campus reassignment immediately revokes storage with stale JWT',9,lambda:expect(st_get(p,TOKENS['campus']),403))
seed('usuarios/'+UID['campus'],profile)
report={'project':PROJECT,'syntheticOnly':True,'productionRequests':0,'tests':RESULTS,'passed':sum(x['pass'] for x in RESULTS),'failed':sum(not x['pass'] for x in RESULTS)}
(OUT/'rules-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'failed':report['failed']}))
if report['failed']:raise SystemExit(1)
