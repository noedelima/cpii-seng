// =============================================================================
// Dashboard público — resumo clicável, filtros, fila e exportação PDF efêmera
// =============================================================================
import { el, frag, fmtNum, fmtDataHora, badgeStatus, select, toast, debounce } from '../ui.js';
import { STATUS, CAMPI, TIPOS_ATIVIDADE, ESPECIALIDADES, campusNome, statusNome } from '../config.js';
import { prioridade, pontosArt11, ordenarFila, cargaProfissionais } from '../calc.js';
import { store } from '../store.js';
import { can } from '../auth.js';

// Estado dos filtros (persiste durante a sessão de navegação)
const filtros = { busca: '', campus: '', status: '', tipo: '', esp: '', minhas: false };

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
    (!txt || `${d.id} ${d.objeto} ${d.descricao} ${campusNome(d.campus)}`.toLowerCase().includes(txt))
  );
  if (filtros.minhas && user?.profissionalId) {
    lista = lista.filter(d => {
      const i = internas[d.id] || {};
      return i.fiscalTitular === user.profissionalId || i.fiscalSubstituto === user.profissionalId ||
             (i.equipePlanejamento || []).includes(user.profissionalId);
    });
  }
  const ordenadas = ordenarFila(lista, params);

  // posição na fila (apenas status "fila", calculada sobre o conjunto completo)
  const filaCompleta = ordenarFila(todas.filter(d => d.status === 'fila'), params);
  const posFila = {}; filaCompleta.forEach((d, i) => { posFila[d.id] = i + 1; });

  // ---- KPIs por status --------------------------------------------------------
  const contagem = {};
  for (const d of todas) contagem[d.status] = (contagem[d.status] || 0) + 1;
  const kpis = el('div', { class: 'kpis', role: 'group', 'aria-label': 'Resumo por status' },
    STATUS.map(st => el('button', {
      class: `kpi ${st.cor} ${filtros.status === st.id ? 'ativo' : ''}`,
      onclick: () => { filtros.status = filtros.status === st.id ? '' : st.id; rerender(); },
      'aria-pressed': String(filtros.status === st.id),
      title: `Filtrar por “${st.nome}”`,
    },
      el('span', { class: 'kpi-num' }, String(contagem[st.id] || 0)),
      el('span', { class: 'kpi-label' }, st.nome),
    )));

  // ---- mini-gráficos (barras por campus e por tipo) ----------------------------
  const porCampus = {};
  for (const d of lista) porCampus[d.campus] = (porCampus[d.campus] || 0) + 1;
  const grafCampus = miniBarras('Demandas por campus', porCampus, campusNome,
    (k) => { filtros.campus = filtros.campus === k ? '' : k; rerender(); }, filtros.campus);

  const porTipo = {};
  for (const d of lista) { const t = d.aval?.tipoAtividade || 'sem-avaliacao'; porTipo[t] = (porTipo[t] || 0) + 1; }
  const tipoNome = (id) => id === 'sem-avaliacao' ? 'Sem avaliação' : (TIPOS_ATIVIDADE.find(t => t.id === id) || {}).nome || id;
  const grafTipo = miniBarras('Por tipo de atividade', porTipo, tipoNome,
    (k) => { if (k !== 'sem-avaliacao') { filtros.tipo = filtros.tipo === k ? '' : k; rerender(); } }, filtros.tipo);

  // ---- barra de filtros ---------------------------------------------------------
  const inBusca = el('input', {
    type: 'search', placeholder: 'Buscar por ID, objeto, descrição…', value: filtros.busca,
    'aria-label': 'Buscar demandas',
    oninput: debounce((e) => { filtros.busca = e.target.value; rerender(); }, 220),
  });
  const selCampus = select(CAMPI, { value: filtros.campus, placeholder: 'Todos os campi', 'aria-label': 'Filtrar por campus' });
  selCampus.addEventListener('change', () => { filtros.campus = selCampus.value; rerender(); });
  const selStatus = select(STATUS, { value: filtros.status, placeholder: 'Todos os status', 'aria-label': 'Filtrar por status' });
  selStatus.addEventListener('change', () => { filtros.status = selStatus.value; rerender(); });
  const selEsp = select(ESPECIALIDADES, { value: filtros.esp, placeholder: 'Todas as especialidades', 'aria-label': 'Filtrar por especialidade' });
  selEsp.addEventListener('change', () => { filtros.esp = selEsp.value; rerender(); });

  const chips = el('div', { class: 'filtros' },
    inBusca, selCampus, selStatus, selEsp,
    user?.profissionalId ? el('label', { class: 'chip-check' },
      el('input', { type: 'checkbox', ...(filtros.minhas ? { checked: true } : {}), onchange: (e) => { filtros.minhas = e.target.checked; rerender(); } }),
      ' Minhas atribuições') : null,
    (filtros.busca || filtros.campus || filtros.status || filtros.tipo || filtros.esp || filtros.minhas)
      ? el('button', { class: 'btn ghost sm', onclick: () => { Object.assign(filtros, { busca: '', campus: '', status: '', tipo: '', esp: '', minhas: false }); rerender(); } }, 'Limpar filtros')
      : null,
  );

  // ---- tabela ----------------------------------------------------------------------
  const nomeProf = (pid) => (profissionais.find(p => p.id === pid) || {}).nome || '—';
  const linhas = ordenadas.map(d => {
    const pr = prioridade(d, params);
    const pts = pontosArt11(d.aval, params.valorRef);
    const i = internas[d.id] || {};
    return el('tr', { tabindex: 0, role: 'link', 'aria-label': `Abrir demanda ${d.id}`,
      onclick: () => { location.hash = `#/demanda/${d.id}`; },
      onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/demanda/${d.id}`; } },
      el('td', { class: 'num' }, d.status === 'fila' ? `${posFila[d.id]}º` : '—'),
      el('td', { class: 'mono' }, d.id),
      el('td', {}, campusNome(d.campus)),
      el('td', { class: 'objeto' }, el('strong', {}, d.objeto || '—'),
        d.emergencial || d.aval?.especial ? el('span', { class: 'tag-emergencial', title: 'Serviço emergencial (art. 11, §5º)' }, 'EMERGENCIAL') : null),
      el('td', {}, badgeStatus(d.status)),
      el('td', { class: 'num' }, pr.gut == null ? '—' : String(pr.gut)),
      el('td', { class: 'num', title: d.ajuste?.valor ? `Inclui ajuste de ${fmtNum(d.ajuste.valor)} (CODIR)` : '' },
        pr.final == null ? '—' : fmtNum(pr.final), d.ajuste?.valor ? el('span', { class: 'mark-ajuste' }, '*') : null),
      el('td', { class: 'num' }, pts == null || d.aval?.tipoAtividade === 'planejamento' ? '—' : String(pts)),
      user ? el('td', { class: 'prof-cell' },
        i.fiscalTitular ? el('span', {}, nomeProf(i.fiscalTitular)) : (i.equipePlanejamento?.length ? el('span', { class: 'sub' }, `Equipe: ${i.equipePlanejamento.map(nomeProf).join(', ')}`) : el('span', { class: 'sub' }, '—')),
        i.fiscalSubstituto ? el('span', { class: 'sub' }, `Subst.: ${nomeProf(i.fiscalSubstituto)}`) : null) : null,
      el('td', { class: 'sub' }, fmtDataHora(d.atualizadoEm)),
    );
  });

  const tabela = el('div', { class: 'tabela-wrap' },
    el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {},
        el('th', { title: 'Posição na fila (status “Na fila”)' }, 'Fila'),
        el('th', {}, 'ID'), el('th', {}, 'Campus'), el('th', {}, 'Objeto'), el('th', {}, 'Status'),
        el('th', { title: 'Gravidade × Urgência × Tendência' }, 'GUT'),
        el('th', { title: 'Prioridade final (0,75·GUT/125 + 0,25·Prazo×Custo + ajuste CODIR)' }, 'Prioridade'),
        el('th', { title: 'Pontos de complexidade — art. 11 da Portaria 7503/2025' }, 'Pts'),
        user ? el('th', {}, 'Fiscal técnico') : null,
        el('th', {}, 'Atualização'),
      )),
      el('tbody', {}, linhas.length ? linhas : el('tr', {}, el('td', { colspan: user ? 10 : 9, class: 'vazio' }, 'Nenhuma demanda corresponde aos filtros.'))),
    ));

  // ---- painel de carga dos profissionais (somente autenticado) ---------------------
  let painelProfs = null;
  if (user && can(user, 'verInterno') && profissionais.length) {
    const carga = cargaProfissionais(todas, internas, profissionais, params);
    const cards = profissionais.filter(p => p.ativo !== false || carga[p.id].total > 0).map(p => {
      const c = carga[p.id];
      return el('a', { class: 'prof-card', href: '#/profissionais', title: 'Ver detalhes em Profissionais' },
        el('div', { class: 'prof-nome' }, p.nome, p.ativo === false ? el('span', { class: 'sub' }, ' (inativo)') : null),
        el('div', { class: 'sub' }, `${p.cargo} · ${p.area}`),
        el('div', { class: 'prof-pontos' },
          el('span', { class: c.excedido ? 'excedido' : '' }, `${c.regular} / ${params.limitePontos} pts`),
          c.emergencial ? el('span', { class: 'tag-emergencial' }, `+${c.emergencial} emerg.`) : null,
          c.planejamento ? el('span', { class: 'sub' }, ` · ${c.planejamento} planej.`) : null),
        barra(c.regular, params.limitePontos));
    });
    painelProfs = el('section', { class: 'card' },
      el('h2', {}, 'Carga da equipe ', el('span', { class: 'sub' }, `(limite de ${params.limitePontos} pontos — art. 12)`)),
      el('div', { class: 'prof-grid' }, cards));
  }

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
      await gerarRelatorio({ demandas: ordenadas, params, filtros: desc, autenticado: !!user, internas, profissionais });
      toast('Relatório gerado. O arquivo não fica armazenado no sistema.');
    } catch (e) { console.error(e); toast('Não foi possível gerar o PDF: ' + e.message, 'erro'); }
    btnPdf.disabled = false; btnPdf.textContent = 'Baixar PDF da fila';
  } }, 'Baixar PDF da fila');

  return frag(
    el('section', { class: 'hero' },
      el('div', {},
        el('h1', {}, 'Demandas de Obras e Serviços de Engenharia'),
        el('p', { class: 'sub' }, 'Acompanhamento público da fila de demandas — Portaria nº 7503/2025. ',
          user ? null : 'A alocação de profissionais é exibida apenas para usuários autenticados.')),
      el('div', { class: 'hero-acoes' },
        user && can(user, 'criar') ? el('a', { class: 'btn primario', href: '#/nova' }, '+ Nova solicitação') : null,
        btnPdf)),
    kpis,
    el('div', { class: 'grid-2' }, grafCampus, grafTipo),
    el('section', { class: 'card' },
      el('h2', {}, 'Fila de demandas ', el('span', { class: 'sub' }, `${ordenadas.length} de ${todas.length}`)),
      chips, tabela,
      el('p', { class: 'nota' }, '* prioridade com fator de ajuste deliberado pelo CODIR. Clique em uma linha para ver os detalhes.')),
    painelProfs,
  );
}

// Gráfico de barras minimalista em CSS (clicável)
function miniBarras(titulo, mapa, nomeFn, onClick, ativo) {
  const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(1, ...entries.map(e => e[1]));
  return el('section', { class: 'card graf' },
    el('h2', {}, titulo),
    entries.length ? entries.map(([k, v]) => el('button', {
      class: `graf-linha ${ativo === k ? 'ativo' : ''}`, onclick: () => onClick(k),
      'aria-pressed': String(ativo === k),
    },
      el('span', { class: 'graf-label' }, nomeFn(k)),
      el('span', { class: 'graf-barra' }, el('span', { class: 'graf-fill', style: `width:${(v / max) * 100}%` })),
      el('span', { class: 'graf-num' }, String(v)),
    )) : el('p', { class: 'vazio' }, 'Sem dados para os filtros atuais.'));
}

function barra(usados, limite) {
  const pct = Math.min(100, (usados / limite) * 100);
  return el('div', { class: 'pontos-barra' },
    el('div', { class: `pontos-fill ${usados > limite ? 'cheia' : usados >= limite ? 'limite' : ''}`, style: `width:${pct}%` }));
}
