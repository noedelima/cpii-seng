// =============================================================================
// Detalhe da demanda — consulta pública + tratamento (GUT, status, alocação)
// =============================================================================
import { el, frag, campo, select, toast, confirmar, badgeStatus, fmtMoeda, fmtNum, fmtData, fmtDataHora, abreviarNome } from '../ui.js';
import { campusNome, statusNome, TIPOS_DEMANDA, PROJETO_EXISTE, PRAZOS, TIPOS_ATIVIDADE, ESPECIALIDADES, ESCALA_G, ESCALA_U, ESCALA_T, precisaEtapaProjeto, DIAS_ARQUIVO_MORTO, FASES_DEMANDA, faseNome, faseCurta, ARTEFATOS_PLANEJAMENTO, MOTIVOS_SUSPENSAO, motivoSuspensaoNome, PROJETO_ORIGEM, RESULTADOS_CERTAME } from '../config.js';
import { selecaoPessoas } from '../alocacao.js';
import { renderStepper } from '../stepper.js';
import { prioridade, pontosArt11, faixaValorLabel, cargaProfissionais, fiscaisDe } from '../calc.js';
import { store } from '../store.js';
import { can, podeAvaliar, podeExcluir, podeComplementar, podeDeliberarCodir, transicoesPermitidas, travada, ehReversaoStatus, podeEditarDados, ehCampusDe } from '../auth.js';
import { notificar } from '../notificacoes.js';
import { renderAnexosCard } from '../anexos.js';
import { renderLinhaTempo } from '../timeline.js';

const nomeDe = (lista, id, campoNome = 'nome') => (lista.find(x => (x.id ?? x.v) === id) || {})[campoNome] ?? (lista.find(x => x.id === id) || {}).t ?? '—';

export function viewDemanda(rerender, id) {
  const s = store();
  const user = s.user;
  const d = s.getDemanda(id);
  if (!d) return frag(el('section', { class: 'card' }, el('h1', {}, 'Demanda não encontrada'), el('a', { class: 'btn ghost', href: '#/' }, 'Voltar')));
  // Arquivo morto: demanda excluída só é visível a quem pode gerenciá-la (Chefe/Admin).
  if (d.status === 'excluido' && !(user && can(user, 'excluir')))
    return frag(el('section', { class: 'card' }, el('h1', {}, 'Demanda não encontrada'), el('a', { class: 'btn ghost', href: '#/' }, 'Voltar')));

  const params = s.getParams();
  const internas = user ? s.getInternas() : {};
  const interna = internas[d.id] || {};
  const profissionais = user ? s.listProfissionais() : [];
  const pr = prioridade(d, params);
  const pts = pontosArt11(d.aval, params.valorRef);
  const bloqueada = travada(d);
  const excluida = d.status === 'excluido';

  // ---------- stepper do ciclo completo (workflow v2) ------------------------
  const stepper = excluida ? null : stepperDemanda(d, user);

  // ---------- coluna 1: dados da solicitação --------------------------------
  const dados = el('section', { class: 'card' },
    el('div', { class: 'detalhe-topo' },
      el('div', {},
        user ? el('h1', { class: 'mono' }, d.id) : null, // referência interna (BD) — só autenticado
        el('h2', { class: 'detalhe-objeto' }, d.objeto || '—')),
      el('div', { class: 'detalhe-badges' },
        badgeStatus(d.status),
        (d.status === 'atendimento' && d.fase) ? el('span', { class: 'fase-badge' }, faseCurta(d.fase)) : null,
        (user && d.chamadoOrigem) ? el('a', { class: 'fase-badge', href: `#/chamado/${d.chamadoOrigem}`, title: 'Abrir o chamado de origem' }, `origem: ${d.chamadoOrigem}`) : null)),
    linha('Campus', campusNome(d.campus)),
    linha('Localização', d.local || '—'),
    linha('Tipo de demanda', nomeDe(TIPOS_DEMANDA, d.tipoDemanda)),
    linha('Projeto existente', nomeDe(PROJETO_EXISTE, d.projetoExiste)),
    linha('Atividade da SENG', d.aval?.tipoAtividade ? nomeDe(TIPOS_ATIVIDADE, d.aval.tipoAtividade) : '—'),
    linha('Especialidades', (d.especialidades || []).join(', ') || '—'),
    linha('Bem tombado (informado)', { sim: 'Sim', nao: 'Não', ns: 'Não informado' }[d.tombado] || '—'),
    linha('Valor estimado', fmtMoeda(d.valorEstimado)),
    linha('Prazo estimado', d.prazoEstimado ? nomeDe(PRAZOS, d.prazoEstimado) : '—'),
    linha('Processo SUAP', d.processoSuap || '—'),
    (d.status === 'atendimento' && d.fase) ? linha('Fase do atendimento', faseNome(d.fase)) : null,
    d.projetoOrigem ? linha('Origem do projeto', nomeDe(PROJETO_ORIGEM, d.projetoOrigem)) : null,
    linha('Emergencial (solicitado)', d.emergencial ? 'Sim — art. 11, §5º' : 'Não'),
    linha('Registrada em', fmtDataHora(d.criadoEm) + (d.solicitante?.nome && user ? ` por ${d.solicitante.nome}` : '')),
    el('div', { class: 'detalhe-desc' }, el('h3', {}, 'Descrição'), el('p', {}, d.descricao || '—')),
  );

  // Complemento em diligência (campus da demanda ou equipe)
  if (podeComplementar(user, d)) {
    const inComp = el('textarea', { rows: 3, maxlength: 2000, placeholder: 'Informações complementares solicitadas pela SENG…' });
    dados.append(el('form', { class: 'form-inline', onsubmit: async (e) => {
      e.preventDefault();
      if (!inComp.value.trim()) return;
      await s.atualizarDemanda(d.id, {
        descricao: d.descricao + '\n\n[Complemento ' + new Date().toLocaleDateString('pt-BR') + ']\n' + inComp.value.trim(),
        status: 'analise',
      }, 'Diligência respondida pelo campus — retornou para análise');
      await notificar(s, 'diligencia', d, interna);
      toast('Complemento registrado. Demanda devolvida para análise.');
    } },
      campo('Responder diligência', inComp, 'Ao enviar, a demanda retorna para “Em análise”.'),
      el('button', { class: 'btn primario' }, 'Enviar complemento')));
  }

  // ---------- editar dados da solicitação (Chefia/Admin, até a aprovação do CODIR) ----
  let cartaoEditarDados = null;
  if (podeEditarDados(user, d)) {
    const inLocal = el('input', { type: 'text', maxlength: 160, value: d.local || '' });
    const selTipo = select(TIPOS_DEMANDA.filter(t => !t.oculto || t.id === d.tipoDemanda), { value: d.tipoDemanda || '' });
    const selProj = select(PROJETO_EXISTE, { value: d.projetoExiste || '' });
    const selTomb = select([{ id: 'sim', nome: 'Sim' }, { id: 'nao', nome: 'Não' }, { id: 'ns', nome: 'Não sei informar' }], { value: d.tombado || '' });
    const inValor = el('input', { type: 'number', min: 0, step: 'any', value: d.valorEstimado ?? '' });
    const selPrazo = select(PRAZOS, { value: d.prazoEstimado || '', placeholder: 'Sem previsão definida' });
    const inSuap = el('input', { type: 'text', maxlength: 25, value: d.processoSuap || '' });
    const inObjeto = el('input', { type: 'text', maxlength: 120, value: d.objeto || '' });
    const inDesc = el('textarea', { rows: 4, maxlength: 4000 }); inDesc.value = d.descricao || '';
    const ckEmerg = el('input', { type: 'checkbox', ...(d.emergencial ? { checked: true } : {}) });
    const espChecks = ESPECIALIDADES.map(e2 => {
      const c = el('input', { type: 'checkbox', value: e2, ...((d.especialidades || []).includes(e2) ? { checked: true } : {}) });
      return el('label', { class: 'chip-check' }, c, ' ' + e2);
    });
    const form = el('div', { class: 'form-grid' },
      campo('Localização no campus', inLocal),
      el('div', { class: 'form-linha' }, campo('Tipo de demanda', selTipo), campo('Projeto já existe?', selProj)),
      el('div', { class: 'form-linha' }, campo('Imóvel tombado?', selTomb), campo('Previsão de prazo', selPrazo)),
      el('div', { class: 'form-linha' }, campo('Valor estimado (R$)', inValor), campo('Processo SUAP', inSuap)),
      campo('Objeto resumido', inObjeto),
      campo('Especialidades envolvidas', el('div', { class: 'chips' }, espChecks)),
      campo('Descrição completa', inDesc),
      el('label', { class: 'chip-check destaque-emergencial' }, ckEmerg, ' Serviço emergencial (art. 11, §5º)'),
      el('button', { class: 'btn primario', onclick: async () => {
        const objeto = inObjeto.value.trim();
        const descricao = inDesc.value.trim();
        const especialidades = espChecks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
        if (!objeto) { toast('Informe o objeto resumido.', 'erro'); return; }
        if (!descricao) { toast('Informe a descrição.', 'erro'); return; }
        if (!especialidades.length) { toast('Selecione ao menos uma especialidade.', 'erro'); return; }
        const tipoDemanda = selTipo.value || d.tipoDemanda;
        const projetoExiste = selProj.value || d.projetoExiste;
        // Campos editáveis (chave, rótulo, valor novo). Registramos no log apenas os que mudaram.
        const novos = [
          ['local', 'Localização', inLocal.value.trim()],
          ['tipoDemanda', 'Tipo de demanda', tipoDemanda],
          ['projetoExiste', 'Situação do projeto', projetoExiste],
          ['tombado', 'Bem tombado', selTomb.value || d.tombado],
          ['valorEstimado', 'Valor estimado', inValor.value ? Number(inValor.value) : null],
          ['prazoEstimado', 'Prazo estimado', selPrazo.value || null],
          ['processoSuap', 'Processo SUAP', inSuap.value.trim()],
          ['objeto', 'Objeto', objeto],
          ['descricao', 'Descrição', descricao],
          ['especialidades', 'Especialidades', especialidades],
          ['emergencial', 'Emergencial', ckEmerg.checked],
        ];
        const norm = (v) => Array.isArray(v) ? [...v].sort().join('|') : (v == null || v === '' ? '' : String(v));
        const alterados = novos.filter(([k, , nv]) => norm(d[k]) !== norm(nv));
        if (!alterados.length) { toast('Nenhuma alteração a salvar.'); return; }
        const patch = {};
        alterados.forEach(([k, , nv]) => { patch[k] = nv; });
        if (alterados.some(([k]) => k === 'tipoDemanda' || k === 'projetoExiste')) {
          patch.etapa = precisaEtapaProjeto({ tipoDemanda, projetoExiste }) ? (d.etapa || 'projeto') : null;
        }
        const rotulos = alterados.map(([, label]) => label).join(', ');
        await s.atualizarDemanda(d.id, patch, `Dados da solicitação editados — campos: ${rotulos}`);
        toast(`Dados atualizados (${alterados.length} campo${alterados.length > 1 ? 's' : ''}).`);
      } }, 'Salvar dados'));
    cartaoEditarDados = el('section', { class: 'card' },
      el('h2', {}, 'Editar dados da solicitação'),
      el('p', { class: 'sub' }, 'Edição liberada até a submissão ao CODIR — depois congela (reverter o status reabre). Cada alteração registra no histórico e no log de auditoria exatamente quais campos mudaram. O campus da demanda não é editável (compõe o identificador).'),
      el('details', { class: 'editar-dados' }, el('summary', {}, 'Abrir edição dos dados'), form));
  }

  // ---------- coluna 2: pontuação ---------------------------------------------
  const aval = d.aval || {};
  const semValorPts = ['fisc-obra', 'fisc-projeto'].includes(aval.tipoAtividade) && !(Number(aval.valorConsiderado) > 0) && (aval.pontosManual == null || aval.pontosManual === '');
  const cartaoPontuacao = el('section', { class: 'card' },
    el('h2', {}, 'Priorização'),
    el('div', { class: 'score-grid' },
      score('G', aval.g, 'Gravidade'), score('U', aval.u, 'Urgência'), score('T', aval.t, 'Tendência'),
      score('GUT', pr.gut, 'G × U × T'),
      score('V', pr.sv, pr.sv ? faixaValorLabel(pr.sv, params.valorRef) : 'Score de valor'),
      score('P', pr.sp, 'Score de prazo')),
    linha('Prazo × Custo', fmtNum(pr.pxc)),
    linha('Prioridade calculada', fmtNum(pr.prioridade)),
    d.ajuste?.valor ? linha('Ajuste (CODIR)', `${d.ajuste.valor > 0 ? '+' : ''}${fmtNum(d.ajuste.valor)} — ${d.ajuste.justificativa || ''}`) : null,
    el('div', { class: 'prioridade-final' },
      el('span', {}, 'Prioridade final'),
      el('strong', {}, fmtNum(pr.final))),
    linha('Pontos de complexidade (art. 11)', aval.tipoAtividade === 'planejamento' ? 'Equipe de planejamento (limite do art. 13)' : (pts == null ? (semValorPts ? '— · informe o valor para calcular (art. 11)' : '—') : `${pts} ponto(s)${aval.pontosManual != null && aval.pontosManual !== '' ? ' (definido manualmente)' : ''}`)),
    linha('Aprovação do CODIR', d.codirAprovado ? '✓ Aprovada' : 'Pendente'),
  );

  // ---------- avaliação técnica (engenharia/chefe) ------------------------------
  let cartaoAvaliacao = null;
  if (user && can(user, 'avaliar') && !excluida) {
    if (bloqueada) {
      cartaoAvaliacao = el('section', { class: 'card aviso-travada' },
        el('h2', {}, 'Avaliação técnica'),
        el('p', {}, `Demanda ${statusNome(d.status).toLowerCase()} — classificação e ajuste travados (não podem ser alterados; a demanda não pode ser excluída).`));
    } else {
      const selG = select(ESCALA_G.map(x => ({ id: x.v, nome: `${x.v} — ${x.t}` })), { value: aval.g ?? '' });
      const selU = select(ESCALA_U.map(x => ({ id: x.v, nome: `${x.v} — ${x.t}` })), { value: aval.u ?? '' });
      const selT = select(ESCALA_T.map(x => ({ id: x.v, nome: `${x.v} — ${x.t}` })), { value: aval.t ?? '' });
      const selAtv = select(TIPOS_ATIVIDADE, { value: aval.tipoAtividade ?? '' });
      const inValor = el('input', { type: 'number', min: 0, step: 'any', value: aval.valorConsiderado ?? d.valorEstimado ?? '' });
      const selPrazo = select(PRAZOS, { value: aval.prazoConsiderado ?? d.prazoEstimado ?? '' });
      const ckTombado = el('input', { type: 'checkbox', ...(aval.tombadoConf ? { checked: true } : {}) });
      const ckEspecial = el('input', { type: 'checkbox', ...(aval.especial ? { checked: true } : {}) });
      const inPontosManual = can(user, 'pontosManual')
        ? el('input', { type: 'number', min: 0, max: 9, step: 1, value: aval.pontosManual ?? '', placeholder: 'auto' }) : null;

      cartaoAvaliacao = el('section', { class: 'card' },
        el('h2', {}, 'Avaliação técnica ', el('span', { class: 'sub' }, '(GUT — critérios do art. 5º, II)')),
        el('div', { class: 'form-grid' },
          campo('Gravidade do dano (G)', selG),
          campo('Urgência da intervenção (U)', selU),
          campo('Tendência de evolução (T)', selT),
          el('div', { class: 'form-linha' },
            campo('Tipo de atividade da SENG', selAtv, `Define os pontos do art. 11 — confira a coerência com o tipo de demanda do campus (${nomeDe(TIPOS_DEMANDA, d.tipoDemanda)}).`),
            campo('Prazo considerado', selPrazo)),
          el('div', { class: 'form-linha' },
            campo('Valor considerado (R$)', inValor, 'Usado nas faixas e nos pontos do art. 11. Sem valor, a pontuação não é calculada automaticamente.'),
            inPontosManual ? campo('Pontos (manual)', inPontosManual, 'Sem valor informado, o art. 11 não calcula sozinho — informe o valor ou os pontos aqui.') : null),
          el('div', { class: 'chips' },
            el('label', { class: 'chip-check' }, ckTombado, ' Bem tombado confirmado (+1 ponto, §4º)'),
            el('label', { class: 'chip-check destaque-emergencial' }, ckEspecial, ' Serviço emergencial (art. 11, §5º)')),
          el('button', { class: 'btn primario', onclick: async () => {
            await s.atualizarDemanda(d.id, { aval: {
              ...aval,
              g: selG.value ? +selG.value : (aval.g ?? null), u: selU.value ? +selU.value : (aval.u ?? null), t: selT.value ? +selT.value : (aval.t ?? null),
              tipoAtividade: selAtv.value || aval.tipoAtividade || null,
              valorConsiderado: inValor.value ? +inValor.value : (aval.valorConsiderado ?? null),
              prazoConsiderado: selPrazo.value || aval.prazoConsiderado || null,
              tombadoConf: ckTombado.checked, especial: ckEspecial.checked,
              pontosManual: inPontosManual && inPontosManual.value !== '' ? +inPontosManual.value : null,
            } }, 'Avaliação técnica atualizada');
            toast('Avaliação salva.');
          } }, 'Salvar avaliação')));
    }
  }

  // ---------- deliberação do CODIR (perfil codir e administrador) ------------------
  let cartaoCodir = null;
  if (user && can(user, 'codir') && !excluida) {
    const podeAgora = podeDeliberarCodir(user, d);
    const filhosCodir = [el('h2', {}, 'Deliberação do CODIR')];
    if (bloqueada) {
      filhosCodir.push(el('p', { class: 'nota' }, 'Demanda em atendimento/concluída — aprovação e ajuste travados.'));
    } else if (!podeAgora) {
      filhosCodir.push(el('p', { class: 'nota' }, 'Disponível após a análise GUT pela Engenharia (status “Aguardando aprovação do CODIR”).'));
    } else {
      const ck = el('input', { type: 'checkbox', ...(d.codirAprovado ? { checked: true } : {}) });
      ck.addEventListener('change', async () => {
        // Desfazer a aprovação com a demanda já na fila a retira da fila
        // (volta a “Aguardando aprovação do CODIR”), com confirmação.
        if (!ck.checked && d.status === 'fila') {
          const okRet = await confirmar('Retirar da fila?', 'Desfazer a aprovação retira a demanda da fila e a devolve para “Aguardando aprovação do CODIR”. A ação fica registrada no histórico.', { ok: 'Retirar da fila', perigo: true });
          if (!okRet) { ck.checked = true; return; }
          await s.atualizarDemanda(d.id, { codirAprovado: false, status: 'codir' }, 'Aprovação do CODIR desfeita — retirada da fila');
          toast('Demanda devolvida para aprovação do CODIR.');
          return;
        }
        const patch = { codirAprovado: ck.checked };
        let evento = ck.checked ? 'Aprovada pelo CODIR' : 'Aprovação do CODIR desmarcada';
        if (ck.checked && d.status === 'codir') { patch.status = 'fila'; evento = 'Aprovada pelo CODIR — posicionada na fila'; }
        await s.atualizarDemanda(d.id, patch, evento);
        if (patch.status === 'fila') await notificar(s, 'fila', d, interna);
        toast('Registro de aprovação atualizado.');
      });
      filhosCodir.push(el('label', { class: 'chip-check destaque-codir' }, ck, ' Aprovada pelo CODIR',
        d.status === 'codir' ? el('span', { class: 'sub' }, ' (ao marcar, entra na fila)') : null));
      if (d.status === 'codir') {
        // Gateways do fluxograma v2 na raia do CODIR: “Aprovada?” e
        // “Há dotação orçamentária?” — desfechos registrados pelo próprio CODIR.
        filhosCodir.push(el('div', { class: 'chips' },
          el('button', { class: 'btn ghost sm', onclick: async () => {
            await s.atualizarDemanda(d.id, { codirAprovado: true, status: 'fila' }, 'Aprovada pelo CODIR — posicionada na fila');
            await notificar(s, 'fila', d, interna);
            toast('Demanda posicionada na fila.');
          } }, 'Aprovar — posicionar na fila'),
          el('button', { class: 'btn ghost sm', onclick: async () => {
            const obs = await pedirTexto('Aprovar — aguardar dotação',
              'A demanda é aprovada, mas fica suspensa com o motivo “Aguardando dotação orçamentária”. A suspensão não encerra o ciclo: havendo orçamento, a Chefia a retorna à fila.',
              'Observação (opcional)', 'Aprovar e aguardar dotação', { opcional: true });
            if (obs === null) return;
            await s.atualizarDemanda(d.id, { codirAprovado: true, status: 'suspenso', suspensao: { motivo: 'dotacao', obs, desde: Date.now() } },
              'Aprovada pelo CODIR — sem dotação orçamentária: suspensa até haver orçamento');
            toast('Aprovada — aguardando dotação orçamentária.');
          } }, 'Aprovar — aguardar dotação'),
          el('button', { class: 'btn ghost sm', onclick: async () => {
            const just = await pedirTexto('Não aprovar — devolver para reanálise',
              'A demanda volta para “Em análise” na SENG, com a justificativa registrada no histórico.',
              'Justificativa *', 'Devolver para reanálise');
            if (!just) return;
            await s.atualizarDemanda(d.id, { codirAprovado: false, status: 'analise' }, `Não aprovada pelo CODIR — devolvida para reanálise: ${just}`);
            toast('Demanda devolvida para reanálise.');
          } }, 'Não aprovar — reanálise'),
          el('button', { class: 'btn ghost sm', onclick: async () => {
            const just = await pedirTexto('Não aprovar — encerrar',
              'A demanda é encerrada como “Cancelado” (não aprovada pelo CODIR), com a justificativa registrada no histórico.',
              'Justificativa *', 'Não aprovar e encerrar');
            if (!just) return;
            await s.atualizarDemanda(d.id, { codirAprovado: false, status: 'cancelado' }, `Não aprovada pelo CODIR — encerrada: ${just}`);
            toast('Demanda encerrada como não aprovada.');
          } }, 'Não aprovar — encerrar')));
      }

      const inAjuste = el('input', { type: 'number', step: 0.01, min: -1, max: 1, value: d.ajuste?.valor ?? '', placeholder: '0,00' });
      const inJust = el('input', { type: 'text', maxlength: 300, value: d.ajuste?.justificativa ?? '', placeholder: 'Justificativa da deliberação' });
      filhosCodir.push(el('div', { class: 'form-grid' },
        el('div', { class: 'form-linha' },
          campo('Fator de ajuste', inAjuste, 'Somado à prioridade calculada (ex.: 0,02) — altera a ordem da fila.'),
          campo('Justificativa', inJust)),
        el('button', { class: 'btn ghost', onclick: async () => {
          const v = inAjuste.value === '' ? null : +inAjuste.value;
          if (v && !inJust.value.trim()) { toast('Informe a justificativa do ajuste.', 'erro'); return; }
          await s.atualizarDemanda(d.id, { ajuste: v ? { valor: v, justificativa: inJust.value.trim(), solicitadoPor: 'CODIR' } : null },
            v ? `Ajuste de prioridade ${v > 0 ? '+' : ''}${v} aplicado pelo CODIR` : 'Ajuste de prioridade removido pelo CODIR');
          toast('Ajuste salvo.');
        } }, 'Salvar ajuste')));
    }
    cartaoCodir = el('section', { class: 'card destaque-card-codir' }, filhosCodir);
  }

  // ---------- gestão (chefe/admin): status e alocação --------------------------------
  let cartaoGestao = null;
  if (user && (can(user, 'statusBasico') || can(user, 'statusTotal')) && !excluida) {
    const filhos = [el('h2', {}, 'Gestão')];

    // Transições de status
    const proximos = transicoesPermitidas(user, d);
    if (proximos.length) {
      filhos.push(el('h3', {}, 'Alterar status'));
      filhos.push(el('div', { class: 'chips' }, proximos.map(st => el('button', {
        class: 'btn ghost sm', onclick: async () => {
          if (ehReversaoStatus(d.status, st)) {
            const msg = d.status === 'concluido'
              ? 'A demanda volta para “Em atendimento” e os pontos do art. 12 voltam a contar. A ação fica registrada no histórico.'
              : `A demanda volta para “${statusNome(st)}”; os pontos do art. 12 deixam de ser contabilizados. A ação fica registrada no histórico.`;
            const okRev = await confirmar(`Reverter “${statusNome(d.status)}”?`, msg, { ok: 'Reverter', perigo: true });
            if (!okRev) return;
            await s.atualizarDemanda(d.id, { status: st }, `Reversão de status: “${statusNome(d.status)}” → “${statusNome(st)}”`);
            toast(`Status: ${statusNome(st)}.`);
            return;
          }
          if (st === 'atendimento' && !d.codirAprovado) {
            const okMesmo = await confirmar('Iniciar sem aprovação do CODIR?', 'Esta demanda ainda não está marcada como aprovada pelo CODIR. Iniciar o atendimento mesmo assim (ex.: emergência — art. 9º)?', { ok: 'Iniciar mesmo assim', perigo: true });
            if (!okMesmo) return;
          }
          // Suspensão estruturada (workflow v2): registra o motivo — a suspensão
          // nunca é fim de ciclo; o retorno reposiciona a demanda no fluxo.
          if (st === 'suspenso') {
            const susp = await pedirSuspensao();
            if (!susp) return;
            await s.atualizarDemanda(d.id, { status: 'suspenso', suspensao: { ...susp, desde: Date.now() } },
              `Demanda suspensa — ${motivoSuspensaoNome(susp.motivo)}${susp.obs ? ': ' + susp.obs : ''}`);
            toast('Demanda suspensa — motivo registrado.');
            return;
          }
          if (['cancelado', 'nao-enquadrado'].includes(st)) {
            const okConf = await confirmar(`Confirmar “${statusNome(st)}”?`, 'A alteração ficará registrada no histórico da demanda.', { ok: 'Confirmar', perigo: st === 'cancelado' });
            if (!okConf) return;
          }
          const patchSt = { status: st };
          let eventoSt = `Status alterado para “${statusNome(st)}”`;
          if (d.status === 'suspenso' && d.suspensao) {
            patchSt.suspensao = null;
            eventoSt = `Retorno de suspensão (${motivoSuspensaoNome(d.suspensao.motivo)}) — status “${statusNome(st)}”`;
          }
          await s.atualizarDemanda(d.id, patchSt, eventoSt);
          const tipoN = { diligencia: 'diligencia', codir: 'codir', fila: 'fila', concluido: 'concluido' }[st];
          if (tipoN) await notificar(s, tipoN, d, interna);
          toast(`Status: ${statusNome(st)}.`);
        } }, statusNome(st)))));
    }

    // Alocação de profissionais (chefe)
    if (can(user, 'alocar')) {
      const carga = cargaProfissionais(s.listDemandas(), internas, profissionais, params);
      const ativos = profissionais.filter(p => p.ativo !== false);
      const { titulares: titAtuais, substitutos: subAtuais } = fiscaisDe(interna);
      const rotuloFiscal = (p) => abreviarNome(p.nome) + ` — ${p.area} (${carga[p.id].regular}/${params.limitePontos})`;
      const selTit = selecaoPessoas({ itens: ativos, atuais: titAtuais, rotulo: rotuloFiscal, vazio: 'Nenhum fiscal titular incluído.' });
      const selSub = selecaoPessoas({ itens: ativos, atuais: subAtuais, rotulo: rotuloFiscal, vazio: 'Nenhum fiscal substituto incluído.' });
      const selEq  = selecaoPessoas({ itens: ativos, atuais: interna.equipePlanejamento || [], rotulo: (p) => abreviarNome(p.nome), vazio: 'Nenhum integrante incluído.' });
      filhos.push(el('h3', {}, 'Alocação ', el('span', { class: 'sub' }, '(visível somente autenticado)')));
      filhos.push(el('div', { class: 'form-grid' },
        campo('Fiscais técnicos titulares', selTit.node, 'Um ou mais. Cada fiscal pontua pelo art. 11.'),
        campo('Fiscais técnicos substitutos', selSub.node),
        campo('Integrantes técnicos — equipe de planejamento (art. 13)', selEq.node),
        el('button', { class: 'btn primario', onclick: async () => {
          const tit = selTit.get();
          const sub = selSub.get();
          const equipe = selEq.get();
          const ambos = tit.filter(pid => sub.includes(pid));
          if (ambos.length) { toast('Um profissional não pode ser titular e substituto na mesma demanda.', 'erro'); return; }
          // Aviso de limite do art. 12 (não bloqueia emergencial — art. 12 §2º)
          const jaAloc = new Set([...titAtuais, ...subAtuais]);
          const novos = [...tit, ...sub].filter(pid => !jaAloc.has(pid));
          const estouro = novos.find(pid => {
            const c = carga[pid]; if (!c) return false;
            const addPts = (d.status === 'atendimento') ? (pontosArt11(d.aval, params.valorRef) ?? 0) : 0;
            return !d.aval?.especial && c.regular + addPts > params.limitePontos;
          });
          if (estouro) {
            const okEst = await confirmar('Limite de 6 pontos excedido', `${(profissionais.find(p => p.id === estouro) || {}).nome} ultrapassará o limite do art. 12 com esta alocação. Prosseguir mesmo assim?`, { ok: 'Alocar mesmo assim', perigo: true });
            if (!okEst) return;
          }
          await s.setInterna(d.id, {
            fiscaisTitulares: tit,
            fiscaisSubstitutos: sub,
            equipePlanejamento: equipe,
            fiscalTitular: null,
            fiscalSubstituto: null,
          });
          await s.atualizarDemanda(d.id, {}, 'Alocação de profissionais atualizada');
          toast('Alocação salva.');
        } }, 'Salvar alocação')));
    }

    // Ciclo projeto → obra (workflow v2): concluído o projeto, a demanda volta
    // ao CODIR como obra para REPRIORIZAÇÃO — a deliberação anterior e o ciclo
    // de fases do projeto são zerados (o estado fica arquivado em cicloProjeto).
    const ehProjetoPuro = d.tipoDemanda === 'projeto';
    if (can(user, 'statusTotal') && d.status === 'atendimento' && (precisaEtapaProjeto(d) || ehProjetoPuro) && d.etapa !== 'obra') {
      filhos.push(el('h3', {}, 'Etapa de projeto'));
      filhos.push(el('p', { class: 'sub' }, ehProjetoPuro
        ? 'Se, com o projeto pronto, a obra deve ser contratada, reavalie a demanda como OBRA: ela retorna ao CODIR (projeto existente) para repriorização, com nova deliberação.'
        : 'Concluída a elaboração do projeto, a demanda retorna ao CODIR como obra (projeto existente), para repriorização — com nova deliberação do Conselho.'));
      const patchProjetoObra = {
        etapa: 'obra', tipoDemanda: 'obra', projetoExiste: 'completo', status: 'codir',
        codirAprovado: false, fase: null, artefatos: null, certame: null,
        cicloProjeto: { fase: d.fase || null, artefatos: d.artefatos || null, certame: d.certame || null, encerradoEm: Date.now() },
      };
      const acoesEtapa = [el('button', { class: 'btn ghost sm', onclick: async () => {
        const ok = await confirmar(ehProjetoPuro ? 'Reavaliar como obra?' : 'Concluir etapa de projeto?', 'A demanda passará a “Aguardando aprovação do CODIR” como OBRA, com projeto existente. A aprovação anterior e o ciclo de fases do projeto são zerados (nova deliberação). Reavalie o GUT e o valor da obra antes do envio.', { ok: 'Concluir e enviar ao CODIR' });
        if (!ok) return;
        await s.atualizarDemanda(d.id, patchProjetoObra,
          'Etapa de projeto concluída — retorna ao CODIR como obra (projeto existente) para repriorização');
        await notificar(s, 'codir', d, interna);
        toast('Etapa de projeto concluída. Demanda enviada ao CODIR como obra.');
      } }, ehProjetoPuro ? 'Reavaliar como obra (projeto pronto)' : 'Concluir projeto → obra ao CODIR')];
      if (d.projetoExiste === 'parcial') {
        acoesEtapa.push(el('button', { class: 'btn ghost sm', onclick: async () => {
          const ok = await confirmar('Manter contratação unificada?', 'A demanda seguirá em atendimento como projeto + obra em contratação única, sem retornar ao CODIR.', { ok: 'Manter unificada' });
          if (!ok) return;
          await s.atualizarDemanda(d.id, { etapa: 'obra' }, 'Etapa de projeto concluída — contratação unificada (projeto + obra)');
          toast('Mantida a contratação unificada (projeto + obra).');
        } }, 'Manter unificada (projeto + obra)'));
      }
      filhos.push(el('div', { class: 'chips' }, acoesEtapa));
    }

    // Exclusão (chefe; nunca em atendimento/concluído)
    if (podeExcluir(user, d)) {
      filhos.push(el('div', { class: 'zona-perigo' },
        el('button', { class: 'btn perigo', onclick: async () => {
          const okDel = await confirmar('Excluir demanda?', `A demanda ${d.id} vai para o arquivo morto e pode ser resgatada por ${DIAS_ARQUIVO_MORTO} dias; depois é removida definitivamente. Prefira “Cancelado” se quiser preservá-la na fila.`, { ok: 'Excluir (arquivo morto)', perigo: true });
          if (!okDel) return;
          try { await s.arquivarDemanda(d.id); toast('Demanda enviada ao arquivo morto.'); location.hash = '#/'; }
          catch (e2) { toast(e2.message, 'erro'); }
        } }, 'Excluir demanda')));
    } else if (user && can(user, 'excluir') && bloqueada) {
      filhos.push(el('p', { class: 'nota' }, 'Demanda em atendimento/concluída: exclusão e alteração de classificação bloqueadas.'));
    }
    cartaoGestao = el('section', { class: 'card' }, filhos);
  }

  // ---------- alocação visível (engenharia sem gestão) -----------------------------
  let cartaoEquipe = null;
  if (user && can(user, 'verInterno') && !can(user, 'alocar')) {
    const nomeProf = (pid) => (profissionais.find(p => p.id === pid) || {}).nome || '—';
    const { titulares: tEq, substitutos: sEq } = fiscaisDe(interna);
    cartaoEquipe = el('section', { class: 'card' },
      el('h2', {}, 'Alocação'),
      linha('Fiscais titulares', tEq.map(nomeProf).join(', ') || '—'),
      linha('Fiscais substitutos', sEq.map(nomeProf).join(', ') || '—'),
      linha('Equipe de planejamento', (interna.equipePlanejamento || []).map(nomeProf).join(', ') || '—'));
  }

  // ---------- fase atual do atendimento (workflow v2) -------------------------------
  const cartaoFase = (user && can(user, 'avaliar') && d.status === 'atendimento' && !excluida)
    ? cartaoFaseAtual(d, s, user, interna) : null;

  // ---------- anexos (componente unificado com os chamados) ---------------------------
  const ehCampusDono = ehCampusDe(user, d.campus);
  let cartaoAnexos = null;
  if (user && !excluida) {
    const podeAnexar = can(user, 'avaliar') || ehCampusDono; // Eng/Chefe/Admin + campus dono
    cartaoAnexos = renderAnexosCard({
      lista: () => ((s.getDemanda(d.id) || d).anexos || []),
      podeAnexar,
      upload: (f2, onP) => s.uploadAnexoDemanda(d.id, d.campus, f2, onP),
      uploadThumb: typeof s.uploadThumbDemanda === 'function' ? (blob, base) => s.uploadThumbDemanda(d.id, d.campus, blob, base) : null,
      removerStorage: (p) => s.removerAnexoChamado(p),
      salvar: (anexos2, evento) => s.atualizarDemanda(d.id, { anexos: anexos2 }, evento),
      aoMudar: () => notificar(s, 'comentario', d, interna),
    });
  }

  // ---------- linha do tempo (fio único de comentários + anexos + eventos) -----------
  const podeComentar = !!(user && !excluida && (can(user, 'avaliar') || can(user, 'codir') || ehCampusDono));
  // Dossiê autocontido: o histórico do chamado de origem entra na linha do tempo
  // (somente leitura, eventos prefixados) — nada se perde na conversão.
  let docTempo = d;
  if (user && d.chamadoOrigem && typeof s.getChamado === 'function') {
    const cOrig = s.getChamado(d.chamadoOrigem);
    if (cOrig) {
      const histCh = (cOrig.historico || []).map(h => ({ ...h, acao: `[chamado ${cOrig.id}] ${h.acao}` }));
      docTempo = { ...d, historico: [...(d.historico || []), ...histCh] };
    }
  }
  const linhaTempo = renderLinhaTempo({
    doc: docTempo, user, rerender,
    extras: { obsEngenharia: interna.obsEngenharia },
    anexos: (d.anexos || []),
    podeComentar,
    podeModerar: !!(user && can(user, 'excluir')),
    salvar: async (comentarios2, evento) => { await s.atualizarDemanda(d.id, { comentarios: comentarios2 }, evento); },
    aoComentar: () => notificar(s, 'comentario', d, interna),
  });
  // ---------- arquivo morto (demanda excluída): resgate ------------------------------
  let cartaoArquivo = null;
  if (excluida && user && can(user, 'excluir')) {
    const expurgo = (d.excluidoEm || Date.now()) + DIAS_ARQUIVO_MORTO * 86400000;
    cartaoArquivo = el('section', { class: 'card aviso-travada' },
      el('h2', {}, 'Arquivo morto'),
      el('p', {}, `Esta demanda foi excluída em ${fmtDataHora(d.excluidoEm)}. Será removida definitivamente em ${fmtDataHora(expurgo)} (após ${DIAS_ARQUIVO_MORTO} dias).`),
      el('button', { class: 'btn primario', onclick: async () => {
        const ok = await confirmar('Resgatar demanda?', `A demanda ${d.id} volta para “${statusNome(d.statusAnterior || 'recebido')}” e sai do arquivo morto.`, { ok: 'Resgatar' });
        if (!ok) return;
        try { await s.resgatarDemanda(d.id); toast('Demanda resgatada.'); }
        catch (e2) { toast(e2.message, 'erro'); }
      } }, 'Resgatar demanda'));
  }

  return frag(
    el('a', { class: 'voltar', href: '#/chamados' }, '← Voltar aos chamados'),
    stepper,
    el('div', { class: 'detalhe-grid' },
      el('div', { class: 'col' }, dados, cartaoEditarDados, linhaTempo),
      el('div', { class: 'col' }, cartaoArquivo, cartaoFase, cartaoPontuacao, cartaoCodir, cartaoAvaliacao, cartaoGestao, cartaoEquipe, cartaoAnexos)));
}

// ----------------------------------------------------------------------------
// Stepper do ciclo completo da demanda (workflow v2 — BPMN Atendimento v2):
// [Chamado] → Recebida → Análise (GUT) → CODIR → Fila → Planejamento →
// Licitação → Execução → Recebimento. “Concluído” = tudo feito.
// ----------------------------------------------------------------------------
function stepperDemanda(d, user) {
  const temChamado = !!(user && d.chamadoOrigem);
  const rotulos = [
    ...(temChamado ? ['Chamado'] : []),
    'Recebida', 'Análise (GUT)', 'CODIR', 'Fila',
    ...FASES_DEMANDA.map(f => f.curto),
  ];
  const off = temChamado ? 1 : 0;
  const idxFase = FASES_DEMANDA.findIndex(f => f.id === d.fase);
  let pos = null; // índice do passo ATUAL
  if (d.status === 'recebido') pos = off;
  else if (['analise', 'diligencia'].includes(d.status)) pos = off + 1;
  else if (d.status === 'codir') pos = off + 2;
  else if (d.status === 'fila') pos = off + 3;
  else if (d.status === 'atendimento') pos = off + 4 + Math.max(0, idxFase);
  else if (d.status === 'concluido') pos = rotulos.length; // tudo feito

  let passos;
  if (pos != null) {
    passos = rotulos.map((r, i) => ({ rotulo: r, estado: i < pos ? 'feito' : i === pos ? 'atual' : 'pendente' }));
  } else {
    // Suspensa/cancelada/não enquadrada: mostra o progresso conhecido, sem “atual”.
    const aval = d.aval || {};
    const feitos = new Set();
    if (temChamado) feitos.add(0);
    feitos.add(off);
    if (aval.g != null) feitos.add(off + 1);
    if (d.codirAprovado) { feitos.add(off + 2); feitos.add(off + 3); }
    if (idxFase >= 0) for (let i = 0; i < idxFase; i++) feitos.add(off + 4 + i);
    passos = rotulos.map((r, i) => ({ rotulo: r, estado: feitos.has(i) ? 'feito' : 'pendente' }));
  }

  let aviso = null;
  if (d.status === 'suspenso') {
    const sp = d.suspensao || {};
    aviso = `Suspensa — ${motivoSuspensaoNome(sp.motivo)}${sp.desde ? ` · desde ${fmtData(sp.desde)}` : ''}${sp.obs ? ` · ${sp.obs}` : ''}. A demanda retorna ao fluxo quando a pendência se resolve.`;
  } else if (['cancelado', 'nao-enquadrado'].includes(d.status)) {
    aviso = `Encerrada como “${statusNome(d.status)}”.`;
  }
  const nota = (d.status === 'atendimento' && idxFase < 0)
    ? 'Fase do atendimento ainda não classificada — defina no cartão “Fase atual”.'
    : (d.etapa === 'projeto' ? 'Ciclo de projeto: concluído o projeto, a demanda reentra no CODIR como obra.' : null);
  // Suspensão ganha destaque visual (motivo é informação de primeira ordem).
  return renderStepper(passos, { aviso, nota, avisoClasse: d.status === 'suspenso' ? 'aviso-suspensao' : '' });
}

// ----------------------------------------------------------------------------
// Modal de suspensão estruturada: motivo (enum) + observação opcional.
// ----------------------------------------------------------------------------
function pedirSuspensao() {
  return new Promise((resolve) => {
    const selMotivo = select(MOTIVOS_SUSPENSAO, { placeholder: 'Selecione o motivo…' });
    const inObs = el('input', { type: 'text', maxlength: 300, placeholder: 'Observação (opcional)' });
    const esc = (e) => { if (e.key === 'Escape') close(null); };
    const close = (v) => { document.removeEventListener('keydown', esc); wrap.remove(); resolve(v); };
    const wrap = el('div', { class: 'modal-wrap', onclick: (e) => e.target === wrap && close(null) },
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Suspender demanda' },
        el('h3', {}, 'Suspender demanda'),
        el('p', {}, 'A suspensão registra o motivo e preserva o ciclo — a demanda retorna ao fluxo quando a pendência se resolver.'),
        campo('Motivo *', selMotivo),
        campo('Observação', inObs),
        el('div', { class: 'modal-acoes' },
          el('button', { class: 'btn ghost', onclick: () => close(null) }, 'Cancelar'),
          el('button', { class: 'btn primario', onclick: () => {
            if (!selMotivo.value) { toast('Selecione o motivo da suspensão.', 'erro'); return; }
            close({ motivo: selMotivo.value, obs: inObs.value.trim() });
          } }, 'Suspender'))));
    document.addEventListener('keydown', esc);
    document.body.append(wrap);
    selMotivo.focus();
  });
}

// ----------------------------------------------------------------------------
// Modal de texto (justificativa/observação) — usado nos desfechos do CODIR.
// Resolve com a string digitada, '' quando opcional e vazio, ou null (cancelado).
// ----------------------------------------------------------------------------
function pedirTexto(titulo, texto, rotulo, rotuloOk, { opcional = false } = {}) {
  return new Promise((resolve) => {
    const inTxt = el('input', { type: 'text', maxlength: 300, placeholder: opcional ? 'Opcional' : 'Obrigatória' });
    const esc = (e) => { if (e.key === 'Escape') close(null); };
    const close = (v) => { document.removeEventListener('keydown', esc); wrap.remove(); resolve(v); };
    const wrap = el('div', { class: 'modal-wrap', onclick: (e) => e.target === wrap && close(null) },
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
        el('h3', {}, titulo),
        el('p', {}, texto),
        campo(rotulo, inTxt),
        el('div', { class: 'modal-acoes' },
          el('button', { class: 'btn ghost', onclick: () => close(null) }, 'Cancelar'),
          el('button', { class: 'btn primario', onclick: () => {
            const v = inTxt.value.trim();
            if (!v && !opcional) { toast('Informe a justificativa.', 'erro'); return; }
            close(v);
          } }, rotuloOk))));
    document.addEventListener('keydown', esc);
    document.body.append(wrap);
    inTxt.focus();
  });
}

// ----------------------------------------------------------------------------
// Cartão “Fase atual” — a ação do momento no atendimento (workflow v2):
// planejamento (checklist de artefatos) → licitação (resultado do certame) →
// execução → recebimento. Certame deserto/fracassado devolve ao planejamento.
// ----------------------------------------------------------------------------
function cartaoFaseAtual(d, s, user, interna) {
  const salvar = async (patch, evento) => {
    try { await s.atualizarDemanda(d.id, patch, evento); toast('Atualizado.'); }
    catch (err) { toast(err.message || 'Falha ao atualizar.', 'erro'); }
  };
  const filhos = [];

  // Origem do projeto (ciclo projeto → obra — art. 11: elaboração interna pontua)
  const blocoProjetoOrigem = () => {
    if (!['projeto', 'projeto-obra'].includes(d.tipoDemanda) && d.etapa !== 'projeto') return null;
    const selPO = select(PROJETO_ORIGEM, { value: d.projetoOrigem || '', placeholder: 'Definir…' });
    selPO.onchange = () => selPO.value && salvar({ projetoOrigem: selPO.value },
      `Origem do projeto definida: ${(PROJETO_ORIGEM.find(o => o.id === selPO.value) || {}).nome}`);
    return campo('Origem do projeto', selPO, 'Projeto elaborado internamente pontua pela alocação (art. 11).');
  };

  if (!d.fase) {
    filhos.push(el('h2', {}, 'Fase atual'));
    filhos.push(el('p', { class: 'sub' }, 'Atendimento ainda sem fase classificada. Defina a fase para acompanhar o ciclo da contratação (planejamento → licitação → execução → recebimento).'));
    filhos.push(el('div', { class: 'chips' }, FASES_DEMANDA.map(f =>
      el('button', { class: 'btn ghost sm', onclick: () => salvar({ fase: f.id }, `Fase do atendimento definida: ${f.nome}`) }, f.curto))));
    filhos.push(blocoProjetoOrigem());
    return el('section', { class: 'card acao-momento' }, filhos);
  }

  if (d.fase === 'planejamento') {
    const arte = d.artefatos || {};
    const feitos = ARTEFATOS_PLANEJAMENTO.filter(a => arte[a.id]?.feito).length;
    filhos.push(el('h2', {}, `Fase atual — ${faseNome('planejamento')}`,
      el('span', { class: 'fase-progresso' }, `${feitos} de ${ARTEFATOS_PLANEJAMENTO.length} itens`)));
    // Retorno de certame deserto/fracassado: sinaliza o loop de ajuste (v2).
    if (['deserto', 'fracassado'].includes((d.certame || {}).resultado)) {
      filhos.push(el('p', { class: 'aviso-certame' },
        `Retorno da licitação — certame ${d.certame.resultado}. Ajuste os artefatos e reencaminhe o processo (o item “Processo SUAP” foi reaberto).`));
    }
    filhos.push(el('p', { class: 'sub' }, 'Fase preparatória da Lei nº 14.133/2021 — artefatos sempre a partir dos modelos da AGU.'));
    filhos.push(el('ul', { class: 'chk-artefatos' }, ARTEFATOS_PLANEJAMENTO.map(a => {
      const info = arte[a.id] || {};
      const ck = el('input', { type: 'checkbox', ...(info.feito ? { checked: true } : {}), 'aria-label': a.nome });
      ck.onchange = () => salvar({ artefatos: { ...arte, [a.id]: ck.checked ? { feito: true, em: Date.now(), por: user.nome } : { feito: false } } },
        `Artefato “${a.nome}” ${ck.checked ? 'concluído' : 'reaberto'}`);
      return el('li', { class: `chk-item ${info.feito ? 'chk-feito' : ''}` }, ck,
        el('span', { class: 'chk-rotulo' }, a.nome),
        info.feito && info.em ? el('span', { class: 'chk-meta' }, fmtData(info.em)) : null);
    })));
    filhos.push(blocoProjetoOrigem());
    filhos.push(el('div', { class: 'form-acoes' }, el('button', { class: 'btn primario', onclick: async () => {
      const pend = ARTEFATOS_PLANEJAMENTO.length - ARTEFATOS_PLANEJAMENTO.filter(a => (d.artefatos || {})[a.id]?.feito).length;
      const ok = await confirmar('Concluir o planejamento?',
        pend ? `Ainda há ${pend} item(ns) do checklist em aberto. Avançar mesmo assim para a fase de licitação?`
             : 'Os artefatos estão completos. A demanda avança para a fase de licitação.',
        { ok: 'Avançar para licitação', perigo: !!pend });
      if (!ok) return;
      await salvar({ fase: 'licitacao', certame: { ...(d.certame || {}), enviadoEm: Date.now(), resultado: null } },
        'Planejamento concluído — fase de licitação');
    } }, 'Concluir fase → licitação')));
  }

  if (d.fase === 'licitacao') {
    const ct = d.certame || {};
    const nomeResultado = (id) => (RESULTADOS_CERTAME.find(r => r.id === id) || {}).nome || id;
    // Deserto/fracassado: retorna ao planejamento e REABRE o item "Processo
    // SUAP" do checklist (o processo precisa ser reencaminhado após o ajuste).
    const retornar = async (resultado) => {
      const ok = await confirmar(`Certame ${resultado}?`, `${nomeResultado(resultado)} — a demanda retorna ao planejamento para ajuste dos artefatos (o item “Processo SUAP” é reaberto), com registro no histórico.`, { ok: 'Registrar e retornar', perigo: true });
      if (!ok) return;
      await salvar({ fase: 'planejamento', certame: { ...ct, resultado }, artefatos: { ...(d.artefatos || {}), envioSuap: { feito: false } } },
        `Certame ${resultado} — retorna ao planejamento para ajuste dos artefatos`);
    };
    filhos.push(el('h2', {}, `Fase atual — ${faseNome('licitacao')}`));
    filhos.push(el('p', { class: 'sub' }, ct.enviadoEm ? `Processo encaminhado à licitação em ${fmtData(ct.enviadoEm)}. Registre o resultado do certame:` : 'Registre o resultado do certame:'));
    filhos.push(el('div', { class: 'chips' },
      el('button', { class: 'btn primario sm', onclick: async () => {
        const ok = await confirmar('Certame com êxito?', 'Contrato assinado — a demanda avança para a fase de execução.', { ok: 'Confirmar êxito' });
        if (!ok) return;
        await salvar({ fase: 'execucao', certame: { ...ct, resultado: 'exito', contratoEm: Date.now() } },
          'Certame com êxito — contrato assinado; iniciada a execução');
      } }, nomeResultado('exito')),
      el('button', { class: 'btn ghost sm', onclick: () => retornar('deserto') }, nomeResultado('deserto')),
      el('button', { class: 'btn ghost sm', onclick: () => retornar('fracassado') }, nomeResultado('fracassado'))));
  }

  if (d.fase === 'execucao') {
    const ct = d.certame || {};
    filhos.push(el('h2', {}, `Fase atual — ${faseNome('execucao')}`));
    filhos.push(el('p', { class: 'sub' }, `Contrato em execução${ct.contratoEm ? ` desde ${fmtData(ct.contratoEm)}` : ''}. Acompanhamento pelos fiscais alocados; registros na linha do tempo.`));
    filhos.push(el('div', { class: 'form-acoes' }, el('button', { class: 'btn primario', onclick: async () => {
      const ok = await confirmar('Concluir a execução?', 'A demanda avança para a fase de recebimento do objeto.', { ok: 'Avançar para recebimento' });
      if (!ok) return;
      await salvar({ fase: 'recebimento' }, 'Execução concluída — fase de recebimento');
    } }, 'Concluir fase → recebimento')));
  }

  if (d.fase === 'recebimento') {
    filhos.push(el('h2', {}, `Fase atual — ${faseNome('recebimento')}`));
    filhos.push(el('p', { class: 'sub' }, 'Recebimento provisório e definitivo do objeto (termos de recebimento). Após o recebimento definitivo, conclua a demanda.'));
    // Concluir é ação da Chefia/Administração (statusTotal) — as Security Rules
    // não permitem à Engenharia a transição atendimento → concluído.
    if (can(user, 'statusTotal')) {
      filhos.push(el('div', { class: 'form-acoes' }, el('button', { class: 'btn primario', onclick: async () => {
        const ok = await confirmar('Concluir a demanda?', 'Recebimento definitivo registrado — a demanda será marcada como Concluída.', { ok: 'Concluir demanda' });
        if (!ok) return;
        await salvar({ status: 'concluido' }, 'Recebimento definitivo — demanda concluída');
        await notificar(s, 'concluido', d, interna);
      } }, 'Receber e concluir a demanda')));
    } else {
      filhos.push(el('p', { class: 'nota' }, 'A conclusão da demanda (recebimento definitivo) é registrada pela Chefia.'));
    }
  }

  return el('section', { class: 'card acao-momento' }, filhos);
}

const linha = (rotulo, valor) => valor == null ? null : el('div', { class: 'linha-info' },
  el('span', { class: 'linha-rotulo' }, rotulo), el('span', { class: 'linha-valor' }, valor));

const score = (sigla, valor, titulo) => el('div', { class: `score ${valor == null ? 'vazio' : ''}`, title: titulo },
  el('span', { class: 'score-sigla' }, sigla), el('span', { class: 'score-valor' }, valor == null ? '—' : String(valor)));
