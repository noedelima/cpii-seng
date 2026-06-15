// =============================================================================
// Detalhe da demanda — consulta pública + tratamento (GUT, status, alocação)
// =============================================================================
import { el, frag, campo, select, toast, confirmar, badgeStatus, fmtMoeda, fmtNum, fmtDataHora, abreviarNome } from '../ui.js';
import { campusNome, statusNome, TIPOS_DEMANDA, PROJETO_EXISTE, PRAZOS, TIPOS_ATIVIDADE, ESCALA_G, ESCALA_U, ESCALA_T, precisaEtapaProjeto } from '../config.js';
import { prioridade, pontosArt11, faixaValorLabel, cargaProfissionais } from '../calc.js';
import { store } from '../store.js';
import { can, podeAvaliar, podeExcluir, podeComplementar, podeDeliberarCodir, transicoesPermitidas, travada } from '../auth.js';

const nomeDe = (lista, id, campoNome = 'nome') => (lista.find(x => (x.id ?? x.v) === id) || {})[campoNome] ?? (lista.find(x => x.id === id) || {}).t ?? '—';

export function viewDemanda(rerender, id) {
  const s = store();
  const user = s.user;
  const d = s.getDemanda(id);
  if (!d) return frag(el('section', { class: 'card' }, el('h1', {}, 'Demanda não encontrada'), el('a', { class: 'btn ghost', href: '#/' }, 'Voltar')));

  const params = s.getParams();
  const internas = user ? s.getInternas() : {};
  const interna = internas[d.id] || {};
  const profissionais = user ? s.listProfissionais() : [];
  const pr = prioridade(d, params);
  const pts = pontosArt11(d.aval, params.valorRef);
  const bloqueada = travada(d);

  // ---------- coluna 1: dados da solicitação --------------------------------
  const dados = el('section', { class: 'card' },
    el('div', { class: 'detalhe-topo' },
      el('div', {},
        user ? el('h1', { class: 'mono' }, d.id) : null, // referência interna (BD) — só autenticado
        el('h2', { class: 'detalhe-objeto' }, d.objeto || '—')),
      badgeStatus(d.status)),
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
      toast('Complemento registrado. Demanda devolvida para análise.');
    } },
      campo('Responder diligência', inComp, 'Ao enviar, a demanda retorna para “Em análise”.'),
      el('button', { class: 'btn primario' }, 'Enviar complemento')));
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
  if (user && can(user, 'avaliar')) {
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
  if (user && can(user, 'codir')) {
    const podeAgora = podeDeliberarCodir(user, d);
    const filhosCodir = [el('h2', {}, 'Deliberação do CODIR')];
    if (bloqueada) {
      filhosCodir.push(el('p', { class: 'nota' }, 'Demanda em atendimento/concluída — aprovação e ajuste travados.'));
    } else if (!podeAgora) {
      filhosCodir.push(el('p', { class: 'nota' }, 'Disponível após a análise GUT pela Engenharia (status “Aguardando aprovação do CODIR”).'));
    } else {
      const ck = el('input', { type: 'checkbox', ...(d.codirAprovado ? { checked: true } : {}) });
      ck.addEventListener('change', async () => {
        const patch = { codirAprovado: ck.checked };
        let evento = ck.checked ? 'Aprovada pelo CODIR' : 'Aprovação do CODIR desmarcada';
        if (ck.checked && d.status === 'codir') { patch.status = 'fila'; evento = 'Aprovada pelo CODIR — posicionada na fila'; }
        await s.atualizarDemanda(d.id, patch, evento);
        toast('Registro de aprovação atualizado.');
      });
      filhosCodir.push(el('label', { class: 'chip-check destaque-codir' }, ck, ' Aprovada pelo CODIR',
        d.status === 'codir' ? el('span', { class: 'sub' }, ' (ao marcar, entra na fila)') : null));
      if (d.status === 'codir') {
        filhosCodir.push(el('button', { class: 'btn ghost sm', onclick: async () => {
          await s.atualizarDemanda(d.id, { codirAprovado: true, status: 'fila' }, 'Aprovada pelo CODIR — posicionada na fila');
          toast('Demanda posicionada na fila.');
        } }, 'Posicionar na fila'));
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
  if (user && (can(user, 'statusBasico') || can(user, 'statusTotal'))) {
    const filhos = [el('h2', {}, 'Gestão')];

    // Transições de status
    const proximos = transicoesPermitidas(user, d);
    if (proximos.length) {
      filhos.push(el('h3', {}, 'Alterar status'));
      filhos.push(el('div', { class: 'chips' }, proximos.map(st => el('button', {
        class: 'btn ghost sm', onclick: async () => {
          if (st === 'atendimento' && !d.codirAprovado) {
            const okMesmo = await confirmar('Iniciar sem aprovação do CODIR?', 'Esta demanda ainda não está marcada como aprovada pelo CODIR. Iniciar o atendimento mesmo assim (ex.: emergência — art. 9º)?', { ok: 'Iniciar mesmo assim', perigo: true });
            if (!okMesmo) return;
          }
          if (['cancelado', 'suspenso', 'nao-enquadrado'].includes(st)) {
            const okConf = await confirmar(`Confirmar “${statusNome(st)}”?`, 'A alteração ficará registrada no histórico da demanda.', { ok: 'Confirmar', perigo: st === 'cancelado' });
            if (!okConf) return;
          }
          await s.atualizarDemanda(d.id, { status: st }, `Status alterado para “${statusNome(st)}”`);
          toast(`Status: ${statusNome(st)}.`);
        } }, statusNome(st)))));
    }

    // Alocação de profissionais (chefe)
    if (can(user, 'alocar')) {
      const carga = cargaProfissionais(s.listDemandas(), internas, profissionais, params);
      const opcoes = profissionais.filter(p => p.ativo !== false).map(p =>
        ({ id: p.id, nome: `${p.nome} — ${p.area} (${carga[p.id].regular}/${params.limitePontos} pts)` }));
      const selTit = select(opcoes, { value: interna.fiscalTitular ?? '', placeholder: '— sem titular —' });
      const selSub = select(opcoes, { value: interna.fiscalSubstituto ?? '', placeholder: '— sem substituto —' });
      const eqChecks = profissionais.filter(p => p.ativo !== false).map(p => {
        const c = el('input', { type: 'checkbox', value: p.id, ...((interna.equipePlanejamento || []).includes(p.id) ? { checked: true } : {}) });
        return el('label', { class: 'chip-check' }, c, ' ' + abreviarNome(p.nome));
      });
      filhos.push(el('h3', {}, 'Alocação ', el('span', { class: 'sub' }, '(visível somente autenticado)')));
      filhos.push(el('div', { class: 'form-grid' },
        campo('Fiscal técnico titular', selTit),
        campo('Fiscal técnico substituto', selSub),
        campo('Integrantes técnicos — equipe de planejamento (art. 13)', el('div', { class: 'chips chips-pessoas' }, eqChecks)),
        el('button', { class: 'btn primario', onclick: async () => {
          if (selTit.value && selTit.value === selSub.value) { toast('Titular e substituto devem ser diferentes.', 'erro'); return; }
          const equipe = eqChecks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
          // Aviso de limite do art. 12 (não bloqueia emergencial — art. 12 §2º)
          const novos = [selTit.value, selSub.value].filter(Boolean);
          const estouro = novos.find(pid => {
            const c = carga[pid]; if (!c) return false;
            const jaAlocado = interna.fiscalTitular === pid || interna.fiscalSubstituto === pid;
            const addPts = (d.status === 'atendimento' && !jaAlocado) ? (pontosArt11(d.aval, params.valorRef) ?? 0) : 0;
            return !d.aval?.especial && c.regular + addPts > params.limitePontos;
          });
          if (estouro) {
            const okEst = await confirmar('Limite de 6 pontos excedido', `${(profissionais.find(p => p.id === estouro) || {}).nome} ultrapassará o limite do art. 12 com esta alocação. Prosseguir mesmo assim?`, { ok: 'Alocar mesmo assim', perigo: true });
            if (!okEst) return;
          }
          await s.setInterna(d.id, {
            fiscalTitular: selTit.value || null,
            fiscalSubstituto: selSub.value || null,
            equipePlanejamento: equipe,
          });
          await s.atualizarDemanda(d.id, {}, 'Alocação de profissionais atualizada');
          toast('Alocação salva.');
        } }, 'Salvar alocação')));
    }

    // Conclusão da etapa de projeto (demandas que exigem projeto + obra)
    if (can(user, 'statusTotal') && d.status === 'atendimento' && precisaEtapaProjeto(d) && d.etapa !== 'obra') {
      filhos.push(el('h3', {}, 'Etapa de projeto'));
      filhos.push(el('p', { class: 'sub' }, 'Concluída a elaboração do projeto, a demanda retorna ao CODIR como obra (projeto existente), para repriorização.'));
      const acoesEtapa = [el('button', { class: 'btn ghost sm', onclick: async () => {
        const ok = await confirmar('Concluir etapa de projeto?', 'A demanda passará a “Aguardando aprovação do CODIR” como OBRA, com projeto existente. Reavalie o GUT e o valor da obra antes do envio.', { ok: 'Concluir e enviar ao CODIR' });
        if (!ok) return;
        await s.atualizarDemanda(d.id, { etapa: 'obra', tipoDemanda: 'obra', projetoExiste: 'completo', status: 'codir' },
          'Etapa de projeto concluída — retorna ao CODIR como obra (projeto existente)');
        toast('Etapa de projeto concluída. Demanda enviada ao CODIR como obra.');
      } }, 'Concluir projeto → obra ao CODIR')];
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
          const okDel = await confirmar('Excluir demanda?', `A demanda ${d.id} será removida definitivamente. Prefira “Cancelado” para preservar o histórico.`, { ok: 'Excluir', perigo: true });
          if (!okDel) return;
          try { await s.excluirDemanda(d.id); toast('Demanda excluída.'); location.hash = '#/'; }
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
    cartaoEquipe = el('section', { class: 'card' },
      el('h2', {}, 'Alocação'),
      linha('Fiscal técnico titular', interna.fiscalTitular ? nomeProf(interna.fiscalTitular) : '—'),
      linha('Fiscal técnico substituto', interna.fiscalSubstituto ? nomeProf(interna.fiscalSubstituto) : '—'),
      linha('Equipe de planejamento', (interna.equipePlanejamento || []).map(nomeProf).join(', ') || '—'));
  }

  // ---------- observações (Engenharia interna + Solicitante/CODIR) -------------------
  let cartaoObs = null;
  {
    const ehCampusDono = user && user.role === 'campus' && user.campus === d.campus;
    const editaEng = user && can(user, 'avaliar');            // engenharia, chefe, admin
    const editaSol = user && (ehCampusDono || can(user, 'codir')); // campus (dono), codir, admin
    const veEng = user && can(user, 'verInterno');
    const filhosObs = [el('h2', {}, 'Observações')];
    if (veEng) {
      if (editaEng) {
        const ta = el('textarea', { rows: 3, maxlength: 4000, placeholder: 'Anotações técnicas internas (Engenharia/Chefia)…' });
        ta.value = interna.obsEngenharia || '';
        filhosObs.push(
          campo('Observação da Engenharia (interna)', ta, 'Visível apenas a usuários internos (não aparece no painel público).'),
          el('button', { class: 'btn ghost sm', onclick: async () => {
            await s.setInterna(d.id, { obsEngenharia: ta.value.trim() });
            await s.atualizarDemanda(d.id, {}, 'Observação da Engenharia atualizada');
            toast('Observação da Engenharia salva.');
          } }, 'Salvar observação da Engenharia'));
      } else if (interna.obsEngenharia) {
        filhosObs.push(linha('Observação da Engenharia', interna.obsEngenharia));
      }
    }
    if (editaSol) {
      const ts = el('textarea', { rows: 3, maxlength: 4000, placeholder: 'Observações do solicitante ou do CODIR…' });
      ts.value = d.obsSolicitante || '';
      filhosObs.push(
        campo('Observação do solicitante / CODIR', ts, 'Registrada no histórico e no log de auditoria.'),
        el('button', { class: 'btn ghost sm', onclick: async () => {
          await s.atualizarDemanda(d.id, { obsSolicitante: ts.value.trim() }, 'Observação do solicitante/CODIR atualizada');
          toast('Observação salva.');
        } }, 'Salvar observação do solicitante/CODIR'));
    } else if (d.obsSolicitante) {
      filhosObs.push(linha('Observação do solicitante/CODIR', d.obsSolicitante));
    }
    if (filhosObs.length > 1) cartaoObs = el('section', { class: 'card' }, filhosObs);
  }

  // ---------- histórico --------------------------------------------------------------
  const hist = el('section', { class: 'card' },
    el('h2', {}, 'Histórico'),
    el('ol', { class: 'timeline' },
      [...(d.historico || [])].sort((a, b) => b.ts - a.ts).map(h =>
        el('li', {},
          el('span', { class: 'tl-quando' }, fmtDataHora(h.ts)),
          el('span', { class: 'tl-acao' }, h.acao),
          user ? el('span', { class: 'tl-quem' }, h.user) : null))));

  return frag(
    el('a', { class: 'voltar', href: '#/' }, '← Voltar ao painel'),
    el('div', { class: 'detalhe-grid' },
      el('div', { class: 'col' }, dados, hist),
      el('div', { class: 'col' }, cartaoPontuacao, cartaoCodir, cartaoAvaliacao, cartaoGestao, cartaoEquipe, cartaoObs)));
}

const linha = (rotulo, valor) => valor == null ? null : el('div', { class: 'linha-info' },
  el('span', { class: 'linha-rotulo' }, rotulo), el('span', { class: 'linha-valor' }, valor));

const score = (sigla, valor, titulo) => el('div', { class: `score ${valor == null ? 'vazio' : ''}`, title: titulo },
  el('span', { class: 'score-sigla' }, sigla), el('span', { class: 'score-valor' }, valor == null ? '—' : String(valor)));
