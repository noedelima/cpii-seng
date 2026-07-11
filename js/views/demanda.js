// =============================================================================
// Detalhe da demanda — consulta pública + tratamento (GUT, status, alocação)
// =============================================================================
import { el, frag, campo, select, toast, confirmar, badgeStatus, fmtMoeda, fmtNum, fmtDataHora, abreviarNome } from '../ui.js';
import { campusNome, statusNome, TIPOS_DEMANDA, PROJETO_EXISTE, PRAZOS, TIPOS_ATIVIDADE, ESPECIALIDADES, ESCALA_G, ESCALA_U, ESCALA_T, precisaEtapaProjeto, DIAS_ARQUIVO_MORTO } from '../config.js';
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
        filhosCodir.push(el('button', { class: 'btn ghost sm', onclick: async () => {
          await s.atualizarDemanda(d.id, { codirAprovado: true, status: 'fila' }, 'Aprovada pelo CODIR — posicionada na fila');
          await notificar(s, 'fila', d, interna);
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
          if (['cancelado', 'suspenso', 'nao-enquadrado'].includes(st)) {
            const okConf = await confirmar(`Confirmar “${statusNome(st)}”?`, 'A alteração ficará registrada no histórico da demanda.', { ok: 'Confirmar', perigo: st === 'cancelado' });
            if (!okConf) return;
          }
          await s.atualizarDemanda(d.id, { status: st }, `Status alterado para “${statusNome(st)}”`);
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
      const mkFiscalChecks = (atuais) => ativos.map(p => {
        const c = el('input', { type: 'checkbox', value: p.id, ...(atuais.includes(p.id) ? { checked: true } : {}) });
        return el('label', { class: 'chip-check' }, c, ' ' + rotuloFiscal(p));
      });
      const titChecks = mkFiscalChecks(titAtuais);
      const subChecks = mkFiscalChecks(subAtuais);
      const eqChecks = ativos.map(p => {
        const c = el('input', { type: 'checkbox', value: p.id, ...((interna.equipePlanejamento || []).includes(p.id) ? { checked: true } : {}) });
        return el('label', { class: 'chip-check' }, c, ' ' + abreviarNome(p.nome));
      });
      filhos.push(el('h3', {}, 'Alocação ', el('span', { class: 'sub' }, '(visível somente autenticado)')));
      filhos.push(el('div', { class: 'form-grid' },
        campo('Fiscais técnicos titulares', el('div', { class: 'chips chips-pessoas' }, titChecks), 'Um ou mais. Cada fiscal pontua pelo art. 11.'),
        campo('Fiscais técnicos substitutos', el('div', { class: 'chips chips-pessoas' }, subChecks)),
        campo('Integrantes técnicos — equipe de planejamento (art. 13)', el('div', { class: 'chips chips-pessoas' }, eqChecks)),
        el('button', { class: 'btn primario', onclick: async () => {
          const tit = titChecks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
          const sub = subChecks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
          const equipe = eqChecks.map(l => l.querySelector('input')).filter(c => c.checked).map(c => c.value);
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

    // Conclusão da etapa de projeto (demandas que exigem projeto + obra)
    if (can(user, 'statusTotal') && d.status === 'atendimento' && precisaEtapaProjeto(d) && d.etapa !== 'obra') {
      filhos.push(el('h3', {}, 'Etapa de projeto'));
      filhos.push(el('p', { class: 'sub' }, 'Concluída a elaboração do projeto, a demanda retorna ao CODIR como obra (projeto existente), para repriorização.'));
      const acoesEtapa = [el('button', { class: 'btn ghost sm', onclick: async () => {
        const ok = await confirmar('Concluir etapa de projeto?', 'A demanda passará a “Aguardando aprovação do CODIR” como OBRA, com projeto existente. Reavalie o GUT e o valor da obra antes do envio.', { ok: 'Concluir e enviar ao CODIR' });
        if (!ok) return;
        await s.atualizarDemanda(d.id, { etapa: 'obra', tipoDemanda: 'obra', projetoExiste: 'completo', status: 'codir' },
          'Etapa de projeto concluída — retorna ao CODIR como obra (projeto existente)');
        await notificar(s, 'codir', d, interna);
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
  const linhaTempo = renderLinhaTempo({
    doc: d, user, rerender,
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
    el('a', { class: 'voltar', href: '#/' }, '← Voltar ao painel'),
    el('div', { class: 'detalhe-grid' },
      el('div', { class: 'col' }, dados, cartaoEditarDados, linhaTempo),
      el('div', { class: 'col' }, cartaoArquivo, cartaoPontuacao, cartaoCodir, cartaoAvaliacao, cartaoGestao, cartaoEquipe, cartaoAnexos)));
}

const linha = (rotulo, valor) => valor == null ? null : el('div', { class: 'linha-info' },
  el('span', { class: 'linha-rotulo' }, rotulo), el('span', { class: 'linha-valor' }, valor));

const score = (sigla, valor, titulo) => el('div', { class: `score ${valor == null ? 'vazio' : ''}`, title: titulo },
  el('span', { class: 'score-sigla' }, sigla), el('span', { class: 'score-valor' }, valor == null ? '—' : String(valor)));
