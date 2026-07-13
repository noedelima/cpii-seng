// =============================================================================
// Dashboard público — resumo clicável, filtros, fila e exportação PDF efêmera
// =============================================================================
import { el, frag, fmtNum, fmtDataHora, badgeStatus, select, toast, debounce } from '../ui.js';
import { STATUS, CAMPI, TIPOS_ATIVIDADE, ESPECIALIDADES, STATUS_ORDEM, DIAS_ARQUIVO_MORTO, DIAS_NOTIFICACAO, campusNome, statusNome, statusChamadoNome, statusChamadoCor, slaChamado, categoriaChamado, FASES_DEMANDA, faseCurta } from '../config.js';
import { prioridade, pontosArt11, ordenarFila, cargaProfissionais, fiscaisDe } from '../calc.js';
import { store } from '../store.js';
import { can } from '../auth.js';

// Estado dos filtros (persiste durante a sessão de navegação)
const filtros = { busca: '', campus: '', status: '', tipo: '', esp: '', fase: '', minhas: false };

// Aplica filtros vindos de links externos (ex.: gráficos do Início — #/chamados?status=fila)
export function aplicarFiltrosExternos(obj = {}) {
  Object.assign(filtros, { busca: '', campus: '', status: '', tipo: '', esp: '', fase: '', minhas: false }, obj);
}
let purgaFeita = false; // limpeza do arquivo morto roda uma vez por sessão (Chefe/Admin)
let purgaNotifFeita = false; // limpeza do próprio inbox de notificações, 1x por sessão

export function viewDashboard(rerender) {
  const s = store();
  const user = s.user;
  const params = s.getParams();
  const todas = s.listDemandas();
  const internas = user ? s.getInternas() : {};
  const profissionais = user ? s.listProfissionais() : [];

  // ---- aplicação dos filtros ------------------------------------------------
  const txt = filtros.busca.trim().toLowerCase();
  let lista = todas.filter(d =>
    (!filtros.campus || d.campus === filtros.campus) &&
    (!filtros.status || d.status === filtros.status) &&
    (!filtros.tipo || d.aval?.tipoAtividade === filtros.tipo) &&
    (!filtros.esp || (d.especialidades || []).includes(filtros.esp)) &&
    (!filtros.fase || (filtros.fase === 'sem-fase' ? (d.status === 'atendimento' && !d.fase) : d.fase === filtros.fase)) &&
    (!txt || `${d.id} ${d.objeto} ${d.descricao} ${campusNome(d.campus)}`.toLowerCase().includes(txt))
  );
  // Profissional vinculado ao usuário pelo e-mail de login
  const meuProf = user ? s.profissionalDoUsuario(user) : null;
  if (filtros.minhas && meuProf) {
    lista = lista.filter(d => {
      const i = internas[d.id] || {};
      const { titulares: tt, substitutos: ss } = fiscaisDe(i);
      return tt.includes(meuProf.id) || ss.includes(meuProf.id) ||
             (i.equipePlanejamento || []).includes(meuProf.id);
    });
  }
  // Arquivo morto: a demanda excluída só aparece para quem pode gerenciá-la (Chefe/Admin).
  const gerencia = user && can(user, 'excluir');
  if (!gerencia) lista = lista.filter(d => d.status !== 'excluido');
  // Limpeza automática do arquivo morto (>30 dias) ao abrir, uma vez por sessão.
  if (gerencia && !purgaFeita) { purgaFeita = true; Promise.resolve(s.purgarExcluidos?.(DIAS_ARQUIVO_MORTO)).catch(() => {}); }
  // Limpeza do próprio inbox (avisos lidos antigos), uma vez por sessão, para qualquer usuário autenticado.
  if (user && !purgaNotifFeita) { purgaNotifFeita = true; Promise.resolve(s.purgarNotificacoes?.(DIAS_NOTIFICACAO)).catch(() => {}); }

  // Ordena por prioridade e reorganiza por STATUS na sequência operacional
  // (ativos primeiro; encerrados e o arquivo morto por último), preservando a
  // prioridade dentro de cada status.
  const ordStatus = (st) => { const i = STATUS_ORDEM.indexOf(st); return i < 0 ? 99 : i; };
  const ordenadas = ordenarFila(lista, params).sort((a, b) => ordStatus(a.status) - ordStatus(b.status));

  // posição na fila (apenas status "fila", calculada sobre o conjunto completo)
  const filaCompleta = ordenarFila(todas.filter(d => d.status === 'fila'), params);
  const posFila = {}; filaCompleta.forEach((d, i) => { posFila[d.id] = i + 1; });

  // ---- barra de filtros ---------------------------------------------------------
  const inBusca = el('input', {
    type: 'search', placeholder: 'Buscar por objeto, descrição, campus…', value: filtros.busca,
    'aria-label': 'Buscar demandas',
    oninput: debounce((e) => { filtros.busca = e.target.value; rerender(); }, 220),
  });
  const selCampus = select(CAMPI, { value: filtros.campus, placeholder: 'Todos os campi', 'aria-label': 'Filtrar por campus' });
  selCampus.addEventListener('change', () => { filtros.campus = selCampus.value; rerender(); });
  const selStatus = select(STATUS, { value: filtros.status, placeholder: 'Todos os status', 'aria-label': 'Filtrar por status' });
  selStatus.addEventListener('change', () => { filtros.status = selStatus.value; rerender(); });
  const selTipoF = select([...TIPOS_ATIVIDADE, { id: 'chamado', nome: 'Chamado (consultoria/laudo)' }], { value: filtros.tipo, placeholder: 'Todos os tipos de atividade', 'aria-label': 'Filtrar por tipo de atividade' });
  selTipoF.addEventListener('change', () => { filtros.tipo = selTipoF.value; rerender(); });
  const selEsp = select(ESPECIALIDADES, { value: filtros.esp, placeholder: 'Todas as especialidades', 'aria-label': 'Filtrar por especialidade' });
  selEsp.addEventListener('change', () => { filtros.esp = selEsp.value; rerender(); });
  const selFase = select([...FASES_DEMANDA.map(f => ({ id: f.id, nome: f.curto })), { id: 'sem-fase', nome: 'Sem fase definida' }],
    { value: filtros.fase, placeholder: 'Todas as fases', 'aria-label': 'Filtrar por fase do atendimento' });
  selFase.addEventListener('change', () => { filtros.fase = selFase.value; rerender(); });

  const chips = el('div', { class: 'filtros' },
    inBusca, selCampus, selStatus, selTipoF, selEsp, selFase,
    meuProf ? el('label', { class: 'chip-check' },
      el('input', { type: 'checkbox', ...(filtros.minhas ? { checked: true } : {}), onchange: (e) => { filtros.minhas = e.target.checked; rerender(); } }),
      ' Minhas atribuições') : null,
    el('button', { class: 'btn ghost sm', onclick: () => { Object.assign(filtros, { busca: '', campus: '', status: '', tipo: '', esp: '', fase: '', minhas: false }); rerender(); } }, 'Limpar filtros'),
  );

  // ---- tabela ----------------------------------------------------------------------
  const nomeProf = (pid) => (profissionais.find(p => p.id === pid) || {}).nome || '—';
  const linhas = ordenadas.map(d => {
    const pr = prioridade(d, params);
    const pts = pontosArt11(d.aval, params.valorRef);
    const i = internas[d.id] || {};
    const { titulares: fTit, substitutos: fSub } = fiscaisDe(i);
    return el('tr', { tabindex: 0, role: 'link', 'aria-label': `Abrir demanda: ${d.objeto || d.id}`,
      onclick: () => { location.hash = `#/demanda/${d.id}`; },
      onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/demanda/${d.id}`; } },
      el('td', { class: 'num' }, d.status === 'fila' ? `${posFila[d.id]}º` : '—'),
      el('td', {}, campusNome(d.campus)),
      el('td', { class: 'objeto' }, el('strong', {}, d.objeto || '—'),
        d.emergencial || d.aval?.especial ? el('span', { class: 'tag-emergencial', title: 'Serviço emergencial (art. 11, §5º)' }, 'EMERGENCIAL') : null),
      el('td', {}, badgeStatus(d.status),
        d.status === 'atendimento' && d.fase ? el('span', { class: 'fase-badge' }, faseCurta(d.fase)) : null),
      el('td', { class: 'num' }, pr.gut == null ? '—' : String(pr.gut)),
      el('td', { class: 'num', title: d.ajuste?.valor ? `Inclui ajuste de ${fmtNum(d.ajuste.valor)} (CODIR)` : '' },
        pr.final == null ? '—' : fmtNum(pr.final), d.ajuste?.valor ? el('span', { class: 'mark-ajuste' }, '*') : null),
      el('td', { class: 'num' }, pts == null || d.aval?.tipoAtividade === 'planejamento' ? '—' : String(pts)),
      user ? el('td', { class: 'prof-cell' },
        fTit.length ? el('span', {}, fTit.map(nomeProf).join(', ')) : (i.equipePlanejamento?.length ? el('span', { class: 'sub' }, `Equipe: ${i.equipePlanejamento.map(nomeProf).join(', ')}`) : el('span', { class: 'sub' }, '—')),
        fSub.length ? el('span', { class: 'sub' }, `Subst.: ${fSub.map(nomeProf).join(', ')}`) : null) : null,
      el('td', { class: 'sub' }, fmtDataHora(d.atualizadoEm)),
    );
  });

  // ---- chamados EM ATENDIMENTO na fila (unificação) — somente autenticados --------
  // Entram agrupados com as demandas “Em atendimento” (mesmo bloco de status),
  // ordenados pelo prazo (SLA) mais crítico primeiro. Cadastro/triagem ficam na
  // aba Chamados. Respeitam busca, campus, especialidade (disciplina), “minhas
  // atribuições” e os filtros de status/tipo (opção “Chamado” nos tipos).
  let linhasChamados = [];
  let chamadosFila = [];
  const mostraChamados = user && typeof s.listChamados === 'function'
    && (!filtros.status || filtros.status === 'atendimento')
    && (!filtros.tipo || filtros.tipo === 'chamado')
    && !filtros.fase; // chamados não têm fase de contratação
  if (mostraChamados) {
    const busca = (filtros.busca || '').toLowerCase();
    chamadosFila = s.listChamados()
      .filter(ch => ch.status === 'atendimento')
      .filter(ch => (!filtros.campus || ch.campus === filtros.campus)
        && (!busca || `${ch.assunto || ''} ${ch.descricao || ''} ${ch.id} ${campusNome(ch.campus)}`.toLowerCase().includes(busca))
        && (!filtros.esp || ((categoriaChamado(ch.categoria) || {}).disciplina && filtros.esp.includes((categoriaChamado(ch.categoria) || {}).disciplina)))
        && (!filtros.minhas || (meuProf && (ch.atendentes || []).includes(meuProf.id))))
      .sort((a, b) => (slaChamado(a).dias ?? 999) - (slaChamado(b).dias ?? 999));
    linhasChamados = chamadosFila.map(ch => {
      const sla = slaChamado(ch);
      return el('tr', { tabindex: 0, role: 'link', 'aria-label': `Abrir chamado: ${ch.assunto || ch.id}`,
        onclick: () => { location.hash = `#/chamado/${ch.id}`; },
        onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/chamado/${ch.id}`; } },
        el('td', { class: 'num' }, '—'),
        el('td', {}, campusNome(ch.campus)),
        el('td', { class: 'objeto' }, el('strong', {}, ch.assunto || ch.id),
          el('span', { class: 'tag-chamado', title: 'Chamado em tratamento pela SENG (sem pontuação GUT)' }, 'CHAMADO')),
        el('td', {}, el('span', { class: `badge ${statusChamadoCor(ch.status)}` }, statusChamadoNome(ch.status))),
        el('td', { class: 'num' }, '—'),
        el('td', { class: 'num sub', title: 'Prazo de triagem/atendimento (SLA)' },
          sla.estado === 'vencido' ? `SLA −${Math.abs(sla.dias)}d` : `SLA ${sla.dias}d`),
        el('td', { class: 'num' }, '—'),
        el('td', { class: 'prof-cell' }, (ch.atendentes || []).length
          ? el('span', {}, ch.atendentes.map(nomeProf).join(', '))
          : el('span', { class: 'sub' }, '—')),
        el('td', { class: 'sub' }, fmtDataHora(ch.atualizadoEm)));
    });
  }

  const tabela = el('div', { class: 'tabela-wrap' },
    el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {},
        el('th', { title: 'Posição na fila (status “Na fila”)' }, 'Fila'),
        el('th', {}, 'Campus'), el('th', {}, 'Objeto'), el('th', {}, 'Status'),
        el('th', { title: 'Gravidade × Urgência × Tendência' }, 'GUT'),
        el('th', { title: 'Prioridade final (0,75·GUT/125 + 0,25·Prazo×Custo + ajuste CODIR)' }, 'Prioridade'),
        el('th', { title: 'Pontos de complexidade — art. 11 da Portaria 7503/2025' }, 'Pts'),
        user ? el('th', {}, 'Fiscal técnico') : null,
        el('th', {}, 'Atualização'),
      )),
      el('tbody', {}, (linhas.length || linhasChamados.length)
        ? (() => {
            // agrupa por status: chamados entram logo após as demandas “Em atendimento”
            let corte = 0;
            ordenadas.forEach((d, i) => { if (d.status === 'atendimento') corte = i + 1; });
            return [...linhas.slice(0, corte), ...linhasChamados, ...linhas.slice(corte)];
          })()
        : el('tr', {}, el('td', { colspan: user ? 9 : 8, class: 'vazio' }, 'Nenhuma demanda corresponde aos filtros.'))),
    ));

  // A carga da equipe migrou para a página Início (Portal da Engenharia).

  // ---- botão PDF ---------------------------------------------------------------------
  const btnPdf = el('button', { class: 'btn primario', onclick: async () => {
    btnPdf.disabled = true; btnPdf.textContent = 'Gerando…';
    try {
      const { gerarRelatorio } = await import('../pdf.js');
      const desc = [
        filtros.status && `status: ${statusNome(filtros.status)}`,
        filtros.campus && `campus: ${campusNome(filtros.campus)}`,
        filtros.esp && `especialidade: ${filtros.esp}`,
        filtros.busca && `busca: “${filtros.busca}”`,
      ].filter(Boolean).join('; ');
      await gerarRelatorio({ demandas: ordenadas, chamados: chamadosFila, params, filtros: desc, autenticado: !!user, internas, profissionais });
      toast('Relatório gerado. O arquivo não fica armazenado no sistema.');
    } catch (e) { console.error(e); toast('Não foi possível gerar o PDF: ' + e.message, 'erro'); }
    btnPdf.disabled = false; btnPdf.textContent = 'Baixar PDF da fila';
  } }, 'Baixar PDF da fila');

  const btnXlsx = (user && can(user, 'avaliar')) ? el('button', { class: 'btn ghost', onclick: async () => {
    btnXlsx.disabled = true; btnXlsx.textContent = 'Gerando…';
    try {
      const { exportarExcel } = await import('../xlsx.js');
      await exportarExcel({ demandas: ordenadas, params, internas, profissionais });
      toast('Planilha gerada. O arquivo não fica armazenado no sistema.');
    } catch (e) { console.error(e); toast('Não foi possível gerar o Excel: ' + e.message, 'erro'); }
    btnXlsx.disabled = false; btnXlsx.textContent = 'Baixar Excel';
  } }, 'Baixar Excel') : null;

  return frag(
    el('section', { class: 'hero' },
      el('div', {},
        el('h1', {}, 'Demandas de Obras e Serviços de Engenharia'),
        el('p', { class: 'sub' }, 'Acompanhamento público da fila de demandas. ',
          user ? null : 'A alocação de profissionais é exibida apenas para usuários autenticados.')),
      el('div', { class: 'hero-acoes' },
        user && can(user, 'criar') ? el('a', { class: 'btn primario', href: '#/chamado-novo' }, '+ Abrir chamado') : null,
        btnPdf, btnXlsx)),
    el('section', { class: 'card' },
      el('h2', {}, 'Fila de demandas ', el('span', { class: 'sub' }, `${ordenadas.length} de ${todas.length}${linhasChamados.length ? ` · ${linhasChamados.length} chamado${linhasChamados.length === 1 ? '' : 's'}` : ''}`)),
      chips, tabela,
      el('p', { class: 'nota' }, '* prioridade com fator de ajuste deliberado pelo CODIR. Clique em uma linha para ver os detalhes.')),
  );
}

