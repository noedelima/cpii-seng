// Public data is an explicit projection, never a clone of an application document.
const PUBLIC_DEMANDA_KEYS = ['ano','campus','objeto','especialidades','status','fase','etapa','tipoDemanda','projetoExiste','projetoOrigem','tombado','emergencial','valorEstimado','prazoEstimado','criadoEm','atualizadoEm','concluidoEm','codirAprovado','expurgarEm'];
const PUBLIC_AVAL_KEYS = ['g','u','t','valorConsiderado','prazoConsiderado','tipoAtividade','tombadoConf','pontosManual'];
const PUBLIC_PARAM_KEYS = ['anoPlano','valorRef','pesoGUT','pesoPxC','limitePontos','refChamadosProf','refChamadosSetor','refPlanejProf','refPlanejSetor'];
const PUBLIC_TRANSPARENCIA_KEYS = ['ativos','emTriagem','abertos','emTriagemSeng','emDiligencia','emAtendimento','resolvidosAno','slaPrazo','slaVencendo','slaVencido','triagemMediaDias','atualizadoEm'];
const CHAMADO_KEYS = ['id','processoSuap','ano','seq','campus','autor','categoria','assunto','descricao','local','urgencia','anexos','status','aberturaEm','prazoLimite','diligenciaDesde','atualizadoEm','desfecho','atendentes','resolucao','demandaId','obsInterna','obsExterna','comentarios','historico','_audit'];
const SLA_DAYS = { eletrica:5, hidraulica:5, cobertura:10, estrutura:15, acessibilidade:15, climatizacao:10, incendio:10, consultoria:15, outros:15 };
const pick = (data, keys) => Object.fromEntries(keys.map(k => [k, data?.[k] ?? null]));
function publicDemanda(id, data) {
  const projected={ id, _audit:data?._audit ?? null, ...pick(data,PUBLIC_DEMANDA_KEYS), aval:pick(data?.aval,PUBLIC_AVAL_KEYS), ajuste:{valor:data?.ajuste?.valor ?? null} };
  if (typeof projected.expurgarEm === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(projected.expurgarEm)) projected.expurgarEm=new Date(projected.expurgarEm);
  return projected;
}
function publicConfig(id, data) {
  return pick(data,id === 'params' ? PUBLIC_PARAM_KEYS : PUBLIC_TRANSPARENCIA_KEYS);
}
function historyEntry(user, action, now = Date.now()) {
  return { ts:now, uid:user.uid, user:user.nome, acao:String(action).slice(0,120) };
}
function cleanAttachments(anexos) {
  if (!Array.isArray(anexos)) return anexos;
  return anexos.map(a => {
    // Blob URLs are session-local presentation data. Legacy bearer URLs stay
    // private until their tokens are explicitly retired during migration.
    const { url, thumbUrl, ...metadata } = a;
    return metadata;
  });
}
function normalizeMutation(collection, old, patch, user, action, create, now=Date.now()) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('invalid_patch');
  if (Object.hasOwn(patch,'_audit')) throw new Error('reserved_field');
  let data={...old,...patch};
  if (collection === 'chamados') {
    if (Object.keys(patch).some(k => !CHAMADO_KEYS.includes(k))) throw new Error('unknown_chamado_field');
    if (create) {
      if (!Object.hasOwn(SLA_DAYS,data.categoria)) throw new Error('invalid_category');
      data={...data,autor:{uid:user.uid,nome:user.nome,email:user.email || ''},status:'aberto',aberturaEm:now,atualizadoEm:now,prazoLimite:now+SLA_DAYS[data.categoria]*86400000};
    } else if (patch.status && patch.status !== old.status) {
      if (patch.status === 'diligencia') data.diligenciaDesde=now;
      else if (old.status === 'diligencia') {
        data.diligenciaDesde=null;
        data.prazoLimite=old.prazoLimite+Math.max(0,now-old.diligenciaDesde);
      }
    }
  }
  if (['demandas','chamados'].includes(collection)) {
    if (!create && Object.hasOwn(patch,'historico')) throw new Error('history_is_append_only');
    data.atualizadoEm=now;
    if (collection === 'demandas' && data.status === 'concluido' && old?.status !== 'concluido') data.concluidoEm=now;
    if (create) {
      data.historico=[historyEntry(user,collection === 'chamados' ? 'Chamado aberto' : 'Demanda criada',now)];
      if (collection === 'demandas') data.criadoEm=now;
    } else if (action) data.historico=[...(old.historico || []),historyEntry(user,action,now)];
    if (Object.hasOwn(patch,'anexos')) data.anexos=cleanAttachments(data.anexos);
  }
  return data;
}
function notificationLink(n) {
  const kind=String(n.tipo || '').startsWith('chamado-') ? 'chamado' : 'demanda';
  const id=String(n.demandaId || '');
  return /^[A-Za-z0-9_-]{1,100}$/.test(id) ? '#/'+kind+'/'+id : '#/conta';
}

export { PUBLIC_DEMANDA_KEYS, PUBLIC_AVAL_KEYS, PUBLIC_PARAM_KEYS, PUBLIC_TRANSPARENCIA_KEYS, CHAMADO_KEYS, SLA_DAYS, publicDemanda, publicConfig, historyEntry, cleanAttachments, normalizeMutation, notificationLink };
