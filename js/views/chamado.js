// =============================================================================
// Dossiê do chamado — autocontido: stepper do ciclo, linha do tempo central e
// cartão contextual "Ação do momento" (somente os próximos passos válidos).
// SENG triam (desfecho); campus dono complementa, comenta e responde
// diligências. Desfecho/conversão "obra" transforma o chamado em Demanda.
// =============================================================================
import { el, frag, campo, select, toast, confirmar, fmtDataHora, fmtData } from '../ui.js';
import { renderAnexosCard } from '../anexos.js';
import { renderLinhaTempo } from '../timeline.js';
import {
  statusChamadoNome, statusChamadoCor, categoriaChamado, categoriaChamadoNome, campusNome,
  URGENCIA_CHAMADO, DESFECHO_CHAMADO, SETORES_ENCAMINHAMENTO, STATUS_CHAMADO_ABERTO, slaChamado, patchSlaDiligencia,
  TIPOS_DEMANDA, PROJETO_EXISTE, PRAZOS, ESPECIALIDADES, precisaEtapaProjeto,
} from '../config.js';
import { store } from '../store.js';
import { can, ehCampusDe } from '../auth.js';
import { selecaoPessoas } from '../alocacao.js';
import { renderStepper } from '../stepper.js';
import { notificar, notificarChamado } from '../notificacoes.js';
import { thumbDePdf } from '../pdf-thumb.js';

const urgenciaNome = (id) => (URGENCIA_CHAMADO.find(u => u.id === id) || {}).nome || id || '—';
const espDaDisciplina = (d) => !d ? [] : (['Civil', 'Elétrica', 'Mecânica'].includes(d) ? ['Engenharia ' + d] : [d]);

export function viewChamado(rerender, id) {
  const s = store();
  const user = s.user;
  if (!user) { location.hash = '#/login'; return frag(); }

  const c = s.getChamado(id);
  if (!c) {
    return frag(el('section', { class: 'card' },
      el('h1', {}, 'Chamado não encontrado'),
      el('p', { class: 'sub' }, 'Ele pode ter sido removido ou você não tem acesso a esta unidade.'),
      el('a', { class: 'btn ghost', href: '#/chamados' }, '← Voltar aos chamados')));
  }

  const ehSeng = ['engenharia', 'chefe', 'admin'].includes(user.role);
  const ehDono = ehCampusDe(user, c.campus);
  const terminal = !STATUS_CHAMADO_ABERTO.includes(c.status);
  const sla = slaChamado(c);

  // Wrapper de ação: aplica patch/evento, dispara notificação opcional, dá feedback.
  // Transições de status passam pela contabilidade da pausa do SLA (diligência).
  const acao = async (patch, evento, notif) => {
    try {
      if (patch.status) patch = { ...patchSlaDiligencia(c, patch.status), ...patch };
      await s.atualizarChamado(c.id, patch, evento);
      if (notif) await notificarChamado(s, notif, { ...c, ...patch });
      toast('Chamado atualizado.');
    } catch (err) { toast(err.message || 'Falha ao atualizar.', 'erro'); }
  };

  // ---------------------------------------------------------------- cabeçalho
  const slaChip = terminal ? null : el('span', {
    class: `ch-sla ${sla.estado === 'vencido' ? 'sla-vencido' : sla.estado === 'vencendo' ? 'sla-alerta' : sla.estado === 'pausado' ? 'sla-pausado' : 'sla-ok'}`,
    title: sla.estado === 'pausado' ? 'O prazo de triagem fica pausado enquanto o chamado está em diligência.' : null,
  }, sla.estado === 'vencido' ? `SLA atrasado ${Math.abs(sla.dias)}d`
    : sla.estado === 'pausado' ? `SLA pausado · ${sla.dias}d restantes`
    : `SLA: ${sla.dias}d`);

  const topo = el('section', { class: 'hero' },
    el('div', {},
      el('div', { class: 'ch-topo-linha' },
        el('span', { class: 'ch-id mono' }, c.id),
        el('span', { class: `badge ${statusChamadoCor(c.status)}` }, statusChamadoNome(c.status)),
        slaChip),
      el('h1', {}, c.assunto || '(sem assunto)'),
      el('p', { class: 'sub' }, `${categoriaChamadoNome(c.categoria)} · ${campusNome(c.campus)}`)),
    el('a', { class: 'btn ghost sm', href: '#/chamados' }, '← Chamados'));

  // ------------------------------------------------------------------ dados
  const linhaMeta = (rot, val) => el('div', { class: 'meta-item' },
    el('span', { class: 'meta-rot' }, rot), el('span', { class: 'meta-val' }, val || '—'));

  const dados = el('section', { class: 'card' },
    el('h2', {}, 'Dados do chamado'),
    el('div', { class: 'meta-grid' },
      linhaMeta('Campus', campusNome(c.campus)),
      linhaMeta('Categoria', categoriaChamadoNome(c.categoria)),
      linhaMeta('Urgência', urgenciaNome(c.urgencia)),
      linhaMeta('Localização', c.local),
      linhaMeta('Aberto em', fmtDataHora(c.aberturaEm)),
      linhaMeta('Prazo (SLA)', c.prazoLimite ? fmtData(c.prazoLimite) : '—'),
      linhaMeta('Solicitante', c.autor?.nome)),
    el('h3', { class: 'sub-titulo' }, 'Descrição'),
    el('p', { class: 'ch-descricao' }, c.descricao || '—'));

  // Chamado já convertido em demanda
  const cartaoDemanda = c.demandaId ? el('section', { class: 'card destaque' },
    el('h2', {}, 'Encaminhado à fila de Obras'),
    el('p', {}, 'Este chamado foi convertido na demanda ',
      el('a', { class: 'link', href: `#/demanda/${c.demandaId}` }, c.demandaId), '.'),
    (c.resolucao?.texto ? el('p', { class: 'ch-descricao' }, c.resolucao.texto) : null)) : null;

  // Resolução/parecer + minuta de Nota Técnica (consultoria/laudo)
  const temConsultoria = ['consultoria', 'laudo'].includes(c.desfecho);
  const desfechoNome = (id) => (DESFECHO_CHAMADO.find(d => d.id === id) || {}).nome || id;
  const btnNT = el('button', { class: 'btn', onclick: async (ev) => {
    const b = ev.currentTarget; b.disabled = true; const t = b.textContent; b.textContent = 'Gerando…';
    try {
      const { gerarNotaTecnicaChamado } = await import('../pdf.js');
      await gerarNotaTecnicaChamado({ chamado: c, assinante: { nome: user.nome } });
      toast('Minuta de Nota Técnica gerada. Revise e numere antes de assinar.');
    } catch (e) { toast('Falha ao gerar a NT: ' + (e.message || e), 'erro'); }
    b.disabled = false; b.textContent = t;
  } }, 'Gerar Nota Técnica (minuta)');
  const cartaoResolucao = ((c.resolucao || temConsultoria) && !c.demandaId) ? el('section', { class: 'card' },
    el('h2', {}, 'Desfecho'),
    c.desfecho ? el('p', {}, el('strong', {}, 'Trilha: '), desfechoNome(c.desfecho)) : null,
    c.resolucao?.setor ? el('p', {}, el('strong', {}, 'Encaminhado a: '), c.resolucao.setor) : null,
    c.resolucao?.texto ? el('p', { class: 'ch-descricao' }, c.resolucao.texto) : null,
    (ehSeng && temConsultoria) ? el('div', { class: 'form-acoes' }, btnNT,
      el('span', { class: 'sub' }, 'Rascunho — revise e numere antes de assinar.')) : null) : null;

  // ---------------------------------------------------------------- anexos
  const podeAnexar = ehSeng || (ehDono && ['aberto', 'triagem', 'diligencia'].includes(c.status));
  const anexos = renderAnexosCard({
    lista: () => ((s.getChamado(c.id) || c).anexos || []),
    podeAnexar,
    upload: (f, onP) => s.uploadAnexoChamado(c.id, c.campus, f, onP),
    uploadThumb: typeof s.uploadThumbChamado === 'function' ? (blob, base) => s.uploadThumbChamado(c.id, c.campus, blob, base) : null,
    removerStorage: (p) => s.removerAnexoChamado(p),
    salvar: (anexos2, evento) => s.atualizarChamado(c.id, { anexos: anexos2 }, evento),
    aoMudar: () => notificarChamado(s, 'chamado-anexo', c),
    avisoSemPermissao: ehDono ? 'Anexos podem ser incluídos enquanto o chamado está em aberto/triagem/diligência.' : null,
  });

  // ------------------------------------------ linha do tempo (comentários unificados)
  const linhaTempo = renderLinhaTempo({
    doc: c, user, rerender,
    anexos: (c.anexos || []),
    podeComentar: (ehSeng || ehDono) && !terminal,
    podeModerar: ['chefe', 'admin'].includes(user.role),
    salvar: async (comentarios2, evento) => { await s.atualizarChamado(c.id, { comentarios: comentarios2 }, evento); },
    aoComentar: () => notificarChamado(s, 'chamado-comentario', c),
  });

  // ------------------------------------ ação do momento (SENG — contextual)
  const acaoMomento = ehSeng ? renderAcaoMomento(c, s, user, terminal, acao, rerender) : null;

  // ----------------------------------------------- responder diligência (campus)
  const respostaCampus = (ehDono && c.status === 'diligencia') ? renderRespostaCampus(c, s, user, acao) : null;

  // ------------------------------------------------------ pessoas (SENG)
  let cartaoPessoas = null;
  if (ehSeng) {
    const profs = s.listProfissionais() || [];
    const nomes = (c.atendentes || []).map(pid => (profs.find(p => p.id === pid) || {}).nome || '—');
    cartaoPessoas = el('section', { class: 'card' },
      el('h2', {}, 'Pessoas'),
      el('div', { class: 'meta-grid' },
        linhaMeta('Solicitante', `${c.autor?.nome || '—'} (${campusNome(c.campus)})`),
        linhaMeta('Responsáveis pelo atendimento', nomes.length ? nomes.join(', ') : '—')));
  }

  // ---------------------------------------------------- stepper do ciclo
  const stepper = stepperChamado(c);

  return frag(topo, stepper,
    el('div', { class: 'detalhe-grid' },
      el('div', { class: 'col' }, dados, linhaTempo),
      el('div', { class: 'col' }, respostaCampus, acaoMomento, cartaoDemanda, cartaoResolucao, cartaoPessoas, anexos)));
}

// ----------------------------------------------------------------------------
// Stepper do chamado: Aberto → Triagem → Atendimento → Resolvido.
// Ramo alternativo (obra) e encerramentos aparecem como aviso/nota.
// ----------------------------------------------------------------------------
function stepperChamado(c) {
  const rotulos = ['Aberto', 'Triagem', 'Atendimento', 'Resolvido'];
  let pos = null;
  if (c.status === 'aberto') pos = 0;
  else if (['triagem', 'diligencia'].includes(c.status)) pos = 1;
  else if (c.status === 'atendimento') pos = 2;
  else if (c.status === 'resolvido') pos = rotulos.length; // tudo feito

  let passos, aviso = null, nota = null;
  if (pos != null) {
    passos = rotulos.map((r, i) => ({ rotulo: r, estado: i < pos ? 'feito' : i === pos ? 'atual' : 'pendente' }));
    if (c.status === 'diligencia') nota = 'Em diligência — aguardando complemento do campus para retomar a triagem.';
    else nota = 'Ramo alternativo: triagem “Obra” converte o chamado em demanda vinculada (fila de Obras).';
  } else {
    const feitos = new Set([0, 1]); // aberto + triagem concluídos nos desfechos
    passos = rotulos.map((r, i) => ({ rotulo: r, estado: feitos.has(i) ? 'feito' : 'pendente' }));
    aviso = c.status === 'obra'
      ? 'Convertido em demanda de obra — o ciclo segue no dossiê da demanda vinculada.'
      : `Encerrado como “${statusChamadoNome(c.status)}”.`;
  }
  return renderStepper(passos, { aviso, nota });
}

// ----------------------------------------------------------------------------
// Campos de classificação da demanda (conversão em obra) — reutilizados na
// triagem e na escalada consultoria → contratação (atendimento/resolvido).
// ----------------------------------------------------------------------------
function camposObra(c) {
  const disc = (categoriaChamado(c.categoria) || {}).disciplina;
  const espPre = espDaDisciplina(disc);
  const selTipo = select(TIPOS_DEMANDA.filter(t => !t.oculto), { value: 'obra', placeholder: null });
  const selProjeto = select(PROJETO_EXISTE, { value: 'nao', placeholder: null });
  const selTombado = select([{ id: 'sim', nome: 'Sim' }, { id: 'nao', nome: 'Não' }, { id: 'ns', nome: 'Não sei' }], { value: 'ns', placeholder: null });
  const selPrazo = select(PRAZOS, { placeholder: 'Sem previsão definida' });
  const inValor = el('input', { type: 'number', min: 0, step: 'any', placeholder: 'Ex.: 250000 (opcional)' });
  const inSuap = el('input', { type: 'text', maxlength: 25, placeholder: 'Ex.: 23040.001234/2026-11 (se houver)' });
  const espChecks = ESPECIALIDADES.map(e2 => el('label', { class: 'chip-check' },
    el('input', { type: 'checkbox', value: e2, ...(espPre.includes(e2) ? { checked: true } : {}) }), ' ' + e2));
  const node = el('div', { class: 'obra-campos' },
    el('div', { class: 'form-linha' }, campo('Tipo de demanda *', selTipo), campo('Projeto já existe? *', selProjeto)),
    el('div', { class: 'form-linha' }, campo('Imóvel tombado?', selTombado), campo('Previsão de prazo', selPrazo)),
    el('div', { class: 'form-linha' }, campo('Valor estimado (R$)', inValor), campo('Processo SUAP', inSuap)),
    campo('Especialidades envolvidas *', el('div', { class: 'chips' }, espChecks)));
  const ler = () => ({
    tipoDemanda: selTipo.value, projetoExiste: selProjeto.value, tombado: selTombado.value,
    prazoEstimado: selPrazo.value || null, valorEstimado: inValor.value || null, processoSuap: inSuap.value.trim(),
    especialidades: espChecks.map(l => l.querySelector('input')).filter(x => x.checked).map(x => x.value),
  });
  return { node, ler };
}

// ----------------------------------------------------------------------------
// Ação do momento (SENG): mostra somente os próximos passos válidos do fluxo.
// ----------------------------------------------------------------------------
function renderAcaoMomento(c, s, user, terminal, acao, rerender) {
  const secao = el('section', { class: 'card acao-momento' }, el('h2', {}, 'Ação do momento'));
  const profs = (s.listProfissionais() || []).filter(p => p.ativo !== false);
  const rotProf = (p) => `${p.nome} (${p.area})`;

  // Encerrados (obra/encaminhado/improcedente/duplicado/cancelado): sem ações.
  // “Resolvido” ainda permite a escalada para contratação (converter em demanda).
  if (terminal && c.status !== 'resolvido') {
    secao.append(el('p', { class: 'sub' }, `Chamado encerrado (${statusChamadoNome(c.status)}). `,
      c.status === 'obra' ? 'O andamento segue na demanda vinculada.' : 'Reabertura, se necessária, pela Chefia.'));
    return secao;
  }

  // ---------------- aberto: iniciar a triagem -------------------------------
  if (c.status === 'aberto') {
    secao.append(
      el('p', { class: 'sub' }, 'Chamado recém-aberto. Inicie a triagem para classificar e decidir a destinação.'),
      el('div', { class: 'form-acoes' },
        el('button', { class: 'btn primario', onclick: () => acao({ status: 'triagem' }, 'Triagem iniciada', 'chamado-atualizado') }, 'Iniciar triagem')));
    return secao;
  }

  // ---------------- diligência: aguardando o campus --------------------------
  if (c.status === 'diligencia') {
    secao.append(
      el('p', { class: 'sub' }, 'Diligência em curso — aguardando complemento do campus. Ao responder, o chamado retorna à triagem automaticamente.'),
      el('div', { class: 'form-acoes' },
        el('button', { class: 'btn ghost sm', onclick: () => acao({ status: 'triagem' }, 'Triagem retomada pela SENG', 'chamado-atualizado') }, 'Retomar triagem agora')));
    return secao;
  }

  // ---------------- triagem: desfecho + diligência ----------------------------
  if (c.status === 'triagem') {
    const selDesf = select(DESFECHO_CHAMADO, { placeholder: 'Selecione o desfecho…' });
    const selSetor = select(SETORES_ENCAMINHAMENTO.map(x => ({ id: x, nome: x })), { placeholder: 'Setor de destino…' });
    const wrapSetor = campo('Setor de destino', selSetor);
    wrapSetor.style.display = 'none';
    const inParecer = el('textarea', { rows: 3, maxlength: 4000, placeholder: 'Parecer / orientação (registrado no chamado e enviado ao campus quando resolver).' });
    const obra = camposObra(c);
    obra.node.style.display = 'none';

    const selAtend = selecaoPessoas({ itens: profs, rotulo: rotProf, vazio: 'Nenhum responsável incluído.' });
    const wrapAtend = campo('Responsáveis pelo atendimento *',
      profs.length ? selAtend.node : el('span', { class: 'sub' }, 'Nenhum profissional ativo cadastrado — cadastre em Profissionais.'),
      'Contabilizados na carga do profissional e notificados das alterações do chamado.');
    wrapAtend.style.display = 'none';

    selDesf.onchange = () => {
      wrapSetor.style.display = selDesf.value === 'encaminhado' ? '' : 'none';
      obra.node.style.display = selDesf.value === 'obra' ? '' : 'none';
      wrapAtend.style.display = (selDesf.value === 'consultoria' || selDesf.value === 'laudo') ? '' : 'none';
    };

    const btnDesf = el('button', { class: 'btn primario', onclick: () => aplicarDesfecho(c, s, user,
      { desfecho: selDesf.value, setor: selSetor.value, parecer: inParecer.value.trim(), obra: obra.ler(), atendentes: selAtend.get() }, acao) }, 'Aplicar desfecho');

    const inDilig = el('textarea', { rows: 2, maxlength: 1500, placeholder: 'O que falta esclarecer? (será enviado ao campus)' });
    const btnDilig = el('button', { class: 'btn', onclick: async () => {
      const txt = inDilig.value.trim();
      if (!txt) { toast('Escreva o que precisa ser complementado.', 'erro'); return; }
      const obs = [...(c.comentarios || []), comentario(user, txt, 'Diligência')];
      await acao({ status: 'diligencia', comentarios: obs }, 'Diligência solicitada ao campus', 'chamado-diligencia');
      inDilig.value = '';
    } }, 'Solicitar diligência');

    secao.append(
      el('div', { class: 'triagem-bloco' },
        el('h3', { class: 'sub-titulo' }, 'Desfecho da triagem'),
        campo('Decisão da triagem', selDesf,
          'Obra → cria a demanda (classifique abaixo). Consultoria/Laudo → atendimento pela SENG. Encaminhado → outro setor.'),
        wrapSetor,
        obra.node,
        wrapAtend,
        campo('Parecer / orientação', inParecer),
        el('div', { class: 'form-acoes' }, btnDesf)),
      el('details', { class: 'triagem-bloco' },
        el('summary', { class: 'sub-titulo' }, 'Precisa de mais informações? Solicitar diligência'),
        campo('Mensagem ao campus', inDilig), el('div', { class: 'form-acoes' }, btnDilig)));
    return secao;
  }

  // ---------------- atendimento: concluir / realocar / escalar ----------------
  if (c.status === 'atendimento') {
    const inResol = el('textarea', { rows: 3, maxlength: 4000, placeholder: 'Resumo da orientação ou nº da NT emitida.' });
    const blocoResolver = el('div', { class: 'triagem-bloco' },
      el('h3', { class: 'sub-titulo' }, 'Concluir o atendimento'),
      campo('Orientação / referência da Nota Técnica', inResol),
      el('div', { class: 'form-acoes' }, el('button', { class: 'btn primario', onclick: async () => {
        const txt = inResol.value.trim();
        if (!txt) { toast('Descreva a orientação/desfecho.', 'erro'); return; }
        await acao({ status: 'resolvido', resolucao: { texto: txt } }, 'Chamado resolvido (consultoria/laudo)', 'chamado-resolvido');
      } }, 'Marcar como resolvido')));

    const selRealoc = selecaoPessoas({ itens: profs, atuais: c.atendentes || [], rotulo: rotProf, vazio: 'Nenhum responsável incluído.' });
    const blocoRealoc = el('details', { class: 'triagem-bloco' },
      el('summary', { class: 'sub-titulo' }, 'Responsáveis pelo atendimento'),
      selRealoc.node,
      el('div', { class: 'form-acoes' }, el('button', { class: 'btn', onclick: async () => {
        const pids = selRealoc.get();
        if (!pids.length) { toast('Mantenha ao menos um responsável.', 'erro'); return; }
        await acao({ atendentes: pids }, 'Responsáveis pelo atendimento atualizados', 'chamado-atendimento');
      } }, 'Salvar responsáveis')));

    secao.append(
      el('p', { class: 'sub' }, 'Consultoria/laudo em atendimento. Conclua com a orientação, ajuste os responsáveis ou — se o caso exigir contratação — converta em demanda de obra.'),
      blocoResolver,
      blocoRealoc,
      blocoConversao(c, s, user));
    return secao;
  }

  // ---------------- resolvido: escalada p/ contratação ainda possível ----------
  secao.append(
    el('p', { class: 'sub' }, 'Chamado resolvido. Se a orientação técnica concluir pela necessidade de contratação, converta em demanda de obra — o histórico segue no dossiê da demanda.'),
    blocoConversao(c, s, user));
  return secao;
}

// Bloco recolhível "Converter em demanda de obra" (gate “Exige contratação?”).
function blocoConversao(c, s, user) {
  const obra = camposObra(c);
  return el('details', { class: 'triagem-bloco' },
    el('summary', { class: 'sub-titulo' }, 'Converter em demanda de obra'),
    el('p', { class: 'sub' }, 'O chamado passa a “Encaminhado à fila de Obras” e nasce uma demanda vinculada, que entra no fluxo de priorização (GUT/CODIR).'),
    obra.node,
    el('div', { class: 'form-acoes' }, el('button', { class: 'btn primario', onclick: () =>
      converterEmDemanda(c, s, user, { obra: obra.ler(), parecer: c.resolucao?.texto || '' }) }, 'Converter em demanda')));
}

// ----------------------------------------------------------------------------
// Conversão chamado → demanda (triagem “obra” ou escalada em atendimento/
// resolvido). A demanda nasce classificada e vinculada (chamadoOrigem).
// ----------------------------------------------------------------------------
async function converterEmDemanda(c, s, user, { obra = {}, parecer = '' }) {
  const esp = (obra.especialidades && obra.especialidades.length)
    ? obra.especialidades : espDaDisciplina((categoriaChamado(c.categoria) || {}).disciplina);
  if (!esp.length) { toast('Selecione ao menos uma especialidade.', 'erro'); return; }
  const ok = await confirmar('Converter em demanda de obra',
    `O chamado ${c.id} passará a "Encaminhado à fila de Obras" e será criada uma nova demanda vinculada, com a classificação informada, que entra no fluxo de priorização (GUT/CODIR). Confirmar?`,
    { ok: 'Converter em demanda' });
  if (!ok) return;
  try {
    const tipoDemanda = obra.tipoDemanda || 'obra';
    const projetoExiste = obra.projetoExiste || 'nao';
    const did = await s.criarDemanda({
      campus: c.campus, local: c.local || '', tipoDemanda, projetoExiste,
      etapa: precisaEtapaProjeto({ tipoDemanda, projetoExiste }) ? 'projeto' : null,
      tombado: obra.tombado || 'ns', prazoEstimado: obra.prazoEstimado || null,
      valorEstimado: obra.valorEstimado ? Number(obra.valorEstimado) : null,
      processoSuap: obra.processoSuap || '',
      objeto: (c.assunto || 'Demanda de obra').slice(0, 120),
      descricao: `${c.descricao || ''}${parecer ? '\n\nParecer da triagem: ' + parecer : ''}\n\n[Originado do chamado ${c.id}]`,
      emergencial: c.urgencia === 'emergencial', especialidades: esp, status: 'recebido',
      chamadoOrigem: c.id,
      solicitante: { nome: c.autor?.nome || user.nome, email: c.autor?.email || '' },
      historico: [{ ts: Date.now(), user: user.nome, acao: `Solicitação registrada (originada do chamado ${c.id})` }],
    });
    await s.atualizarChamado(c.id, { status: 'obra', desfecho: 'obra', demandaId: did, resolucao: parecer ? { texto: parecer } : null },
      `Convertido na demanda ${did} (fila de Obras)`);
    await notificar(s, 'nova', { id: did, objeto: c.assunto, especialidades: esp });
    await notificarChamado(s, 'chamado-desfecho', c);
    toast(`Demanda ${did} criada a partir do chamado.`);
    location.hash = `#/demanda/${did}`;
  } catch (err) { toast(err.message || 'Falha ao converter.', 'erro'); }
}

async function aplicarDesfecho(c, s, user, { desfecho, setor, parecer, obra = {}, atendentes = [] }, acao) {
  if (!desfecho) { toast('Selecione um desfecho.', 'erro'); return; }
  const def = DESFECHO_CHAMADO.find(d => d.id === desfecho);

  if (desfecho === 'obra') {
    await converterEmDemanda(c, s, user, { obra, parecer });
    return;
  }

  if (desfecho === 'consultoria' || desfecho === 'laudo') {
    if (!atendentes.length) { toast('Selecione ao menos um responsável pelo atendimento.', 'erro'); return; }
    await acao({ status: def.status, desfecho, atendentes, resolucao: parecer ? { texto: parecer } : null },
      `Desfecho: ${def.nome}`, 'chamado-desfecho');
    await notificarChamado(s, 'chamado-atendimento', { ...c, atendentes });
    return;
  }

  if (desfecho === 'encaminhado') {
    if (!setor) { toast('Selecione o setor de destino.', 'erro'); return; }
    await acao({ status: 'encaminhado', desfecho, resolucao: { setor, texto: parecer } },
      `Encaminhado a: ${setor}`, 'chamado-desfecho');
    return;
  }

  // improcedente / duplicado
  await acao({ status: def.status, desfecho, resolucao: parecer ? { texto: parecer } : null },
    `Desfecho: ${def.nome}`, 'chamado-desfecho');
}

// ----------------------------------------------------------------------------
// Campus responde a diligência: complementa e devolve para triagem.
// ----------------------------------------------------------------------------
function renderRespostaCampus(c, s, user, acao) {
  const inTxt = el('textarea', { rows: 3, maxlength: 3000, placeholder: 'Informação complementar solicitada pela Engenharia.' });
  const btn = el('button', { class: 'btn primario', onclick: async () => {
    const txt = inTxt.value.trim();
    if (!txt) { toast('Escreva o complemento.', 'erro'); return; }
    const obs = [...(c.comentarios || []), comentario(user, txt, 'Complemento')];
    await acao({ status: 'triagem', comentarios: obs }, 'Complemento enviado pelo campus', 'chamado-atualizado');
    inTxt.value = '';
  } }, 'Responder diligência');
  return el('section', { class: 'card destaque' },
    el('h2', {}, 'Diligência — resposta do campus'),
    el('p', { class: 'sub' }, 'A Engenharia solicitou um complemento. Responda abaixo para retomar a triagem.'),
    campo('Complemento', inTxt), el('div', { class: 'form-acoes' }, btn));
}

// Objeto de comentário padronizado (fio único da linha do tempo).
function comentario(user, texto, tag) {
  return { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ts: Date.now(), autor: user.nome, autorUid: user.uid, role: user.role, texto, ...(tag ? { tag } : {}) };
}
