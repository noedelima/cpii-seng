// =============================================================================
// Início — Portal da Engenharia: transparência pública (KPIs, gráficos e fila
// resumida) + carga da equipe para autenticados internos.
// Privacidade: nenhum nome de profissional nem assunto de chamado; os totais
// de chamados vêm do doc público config/transparencia (só contagens).
// =============================================================================
import { el, frag, fmtNum } from '../ui.js';
import { CAMPI, ESPECIALIDADES, FASES_DEMANDA, campusNome } from '../config.js';
import { ordenarFila, prioridade, cargaProfissionais } from '../calc.js';
import { store } from '../store.js';
import { can } from '../auth.js';
import { barrasH, linhasMensais, legenda, donut } from '../graficos.js';

export function viewInicio() {
  const s = store();
  const user = s.user;
  const params = s.getParams();
  const todas = s.listDemandas().filter(d => d.status !== 'excluido');
  const t = (typeof s.getTransparencia === 'function' ? s.getTransparencia() : null) || null;
  const anoAtual = new Date().getFullYear();

  // ---- KPIs -----------------------------------------------------------------
  const n = (st) => todas.filter(d => d.status === st).length;
  const dtConclusao = (d) => {
    const h = (d.historico || []).filter(x => /conclu/i.test(x.acao || '')).pop();
    return (h && h.ts) || d.atualizadoEm;
  };
  const concluidasAno = todas.filter(d => d.status === 'concluido' && new Date(dtConclusao(d)).getFullYear() === anoAtual).length;
  const totalSla = t ? (t.slaPrazo + t.slaVencendo + t.slaVencido) : 0;
  const pctPrazo = t && totalSla > 0 ? Math.round(100 * t.slaPrazo / totalSla) : null;

  const kpi = (rot, val, ok, href) => el(href ? 'a' : 'div', { class: 'kpi-card', ...(href ? { href, title: 'Ver na lista' } : {}) },
    el('div', { class: 'kpi-rotulo' }, rot),
    el('div', { class: `kpi-valor${ok ? ' ok' : ''}` }, val == null ? '—' : String(val)));
  const kpis = el('div', { class: 'kpi-grid' },
    kpi('Em atendimento', n('atendimento'), false, '#/chamados?status=atendimento'),
    kpi('Na fila', n('fila'), false, '#/chamados?status=fila'),
    kpi(`Concluídas em ${anoAtual}`, concluidasAno, false, `#/chamados?status=concluido&ano=${anoAtual}`),
    kpi('Chamados ativos', t ? t.ativos : null, false, user ? '#/chamados?recorte=triagem' : null),
    kpi('Triagem no prazo', pctPrazo == null ? null : pctPrazo + '%', pctPrazo != null && pctPrazo >= 80),
    kpi('Triagem média', t && t.triagemMediaDias != null ? t.triagemMediaDias + 'd' : null));

  // ---- hero -------------------------------------------------------------------
  const hero = el('section', { class: 'hero' },
    el('div', {},
      el('h1', {}, 'Obras e serviços de engenharia'),
      el('p', { class: 'sub' }, 'Acompanhamento das demandas do Colégio Pedro II.')),
    el('div', { class: 'hero-acoes' },
      el('a', { class: 'btn primario', href: user ? '#/chamado-novo' : '#/login' }, '+ Abrir chamado'),
      el('a', { class: 'btn ghost', href: '#/chamados' }, 'Ver chamados')));

  // ---- gráficos -----------------------------------------------------------------
  const card = (titulo, ...k) => el('section', { class: 'card graf-card' }, el('h2', {}, titulo), ...k);

  const meses = [];
  const agora = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    meses.push({ k: d.getFullYear() * 12 + d.getMonth(), mes: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') });
  }
  const chave = (ts) => { const d = new Date(ts); return d.getFullYear() * 12 + d.getMonth(); };
  const serie = (extrai) => meses.map(mm => ({ mes: mm.mes, valor: todas.filter(d => { const ts = extrai(d); return ts && chave(ts) === mm.k; }).length }));
  const sAbertas = { nome: 'abertas', cor: 'var(--acento)', pontos: serie(d => d.criadoEm) };
  const sConcl = { nome: 'concluídas', cor: 'var(--primario)', pontos: serie(d => d.status === 'concluido' ? dtConclusao(d) : null) };
  const gLinha = card('Aberturas × conclusões (12 meses)',
    linhasMensais([sAbertas, sConcl], { aria: 'Demandas abertas e concluídas por mês, últimos 12 meses' }),
    legenda([sAbertas, sConcl]));

  const irPara = (query) => () => { location.hash = '#/chamados?' + query; };
  const ROTULO_CURTO = { atendimento: 'Em atendimento', fila: 'Na fila', codir: 'No CODIR', analise: 'Em análise', recebido: 'Recebidas', diligencia: 'Em diligência', suspenso: 'Suspensas', concluido: 'Concluídas' };
  const stDados = Object.keys(ROTULO_CURTO)
    .map(st => ({ rotulo: ROTULO_CURTO[st], valor: n(st), onClick: irPara('status=' + st) })).filter(x => x.valor > 0);
  const gStatus = card('Demandas por status', barrasH(stDados, { rotuloW: 108, aria: 'Demandas por status' }));

  // Em atendimento, por fase do ciclo da contratação (workflow v2) + chamados
  const emAtd = todas.filter(d => d.status === 'atendimento');
  const atvDados = FASES_DEMANDA.map(f => ({
    rotulo: f.curto,
    valor: emAtd.filter(d => d.fase === f.id).length,
    onClick: irPara('status=atendimento&fase=' + f.id),
  })).filter(x => x.valor > 0);
  const semFase = emAtd.filter(d => !d.fase).length;
  if (semFase) atvDados.push({ rotulo: 'Sem fase definida', valor: semFase, onClick: irPara('status=atendimento&fase=sem-fase') });
  if (t && t.emAtendimento) atvDados.push({ rotulo: 'Chamados (consult./laudo)', valor: t.emAtendimento, onClick: irPara('tipo=chamado') });
  const gAtv = card('Em atendimento, por fase', atvDados.length
    ? barrasH(atvDados, { rotuloW: 128, aria: 'Itens em atendimento por fase do ciclo da contratação' })
    : el('p', { class: 'sub' }, 'Nada em atendimento no momento.'));

  const ativas = todas.filter(d => !['concluido', 'cancelado', 'nao-enquadrado'].includes(d.status));
  const porCampus = CAMPI.map(cp => ({ rotulo: cp.nome, valor: ativas.filter(d => d.campus === cp.id).length, onClick: irPara('campus=' + cp.id) }))
    .filter(x => x.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 6);
  const gCampus = card('Demandas ativas por campus', barrasH(porCampus, { rotuloW: 110, aria: 'Demandas ativas por campus, seis maiores' }));

  const porEsp = ESPECIALIDADES.map(e2 => ({ rotulo: String(e2).replace('Engenharia ', ''), valor: ativas.filter(d => (d.especialidades || []).includes(e2)).length, onClick: irPara('esp=' + encodeURIComponent(e2)) }))
    .filter(x => x.valor > 0);
  const gEsp = card('Demandas ativas por especialidade', porEsp.length
    ? donut(porEsp, { aria: 'Demandas ativas por especialidade' })
    : el('p', { class: 'sub' }, 'Sem demandas ativas.'));

  const gCh = card('Chamados por etapa',
    t ? barrasH([
      { rotulo: 'Em triagem', valor: t.emTriagem, onClick: user ? irPara('recorte=triagem') : null },
      { rotulo: 'Em atendimento', valor: t.emAtendimento, onClick: irPara('tipo=chamado') },
      { rotulo: `Resolvidos em ${anoAtual}`, valor: t.resolvidosAno, onClick: user ? irPara('recorte=triagem') : null },
    ], { rotuloW: 128, aria: 'Chamados por etapa' })
      : el('p', { class: 'sub' }, 'Os totais de chamados são publicados pela Engenharia e aparecerão aqui em breve.'),
    el('p', { class: 'nota' }, 'Contagens agregadas — sem assuntos nem nomes.'));

  // ---- próximas da fila (top 5) ---------------------------------------------------
  const fila5 = ordenarFila(todas.filter(d => d.status === 'fila'), params).slice(0, 5);
  const tblFila = el('section', { class: 'card' },
    el('div', { class: 'inicio-fila-cab' },
      el('h2', {}, 'Próximas da fila'),
      el('a', { class: 'btn ghost sm', href: '#/chamados' }, 'Ver a fila completa')),
    fila5.length
      ? el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Fila'), el('th', {}, 'Campus'), el('th', {}, 'Objeto'), el('th', { class: 'num' }, 'Prioridade'))),
          el('tbody', {}, fila5.map((d, i) => el('tr', { role: 'link', tabindex: 0, 'aria-label': `Abrir demanda: ${d.objeto || d.id}`,
            onclick: () => { location.hash = `#/demanda/${d.id}`; },
            onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/demanda/${d.id}`; } },
            el('td', { class: 'num' }, `${i + 1}º`),
            el('td', {}, campusNome(d.campus)),
            el('td', { class: 'objeto' }, el('strong', {}, d.objeto || d.id)),
            el('td', { class: 'num' }, fmtNum(prioridade(d, params).final ?? 0)))))))
      : el('p', { class: 'sub' }, 'Nenhuma demanda aguardando na fila.'));

  // ---- carga da equipe (autenticado interno) ---------------------------------------
  let painelProfs = null;
  if (user && can(user, 'verInterno')) {
    const profissionais = s.listProfissionais();
    if (profissionais.length) {
      const carga = cargaProfissionais(todas, s.getInternas(), profissionais, params,
        typeof s.listChamados === 'function' ? s.listChamados() : []);
      const cards = profissionais.filter(p => p.ativo !== false || carga[p.id].total > 0).map(p => {
        const c2 = carga[p.id];
        return el('a', { class: 'prof-card', href: '#/profissionais', title: 'Ver detalhes em Profissionais' },
          el('div', { class: 'prof-nome' }, p.nome, p.ativo === false ? el('span', { class: 'sub' }, ' (inativo)') : null),
          el('div', { class: 'sub' }, `${p.cargo} · ${p.area}`),
          el('div', { class: 'prof-pontos' },
            el('span', { class: c2.excedido ? 'excedido' : '' }, `${c2.regular} / ${params.limitePontos} pts`),
            c2.emergencial ? el('span', { class: 'tag-emergencial' }, `+${c2.emergencial} emerg.`) : null,
            c2.planejamento ? el('span', { class: `sub${c2.planejamento > params.refPlanejProf ? ' ref-acima' : ''}`, title: c2.planejamento > params.refPlanejProf ? `Acima do limite de referência (${params.refPlanejProf})` : '' }, ` · ${c2.planejamento} planej.`) : null,
            (c2.chamados || []).length ? el('span', { class: `sub${c2.chamados.length > params.refChamadosProf ? ' ref-acima' : ''}`, title: c2.chamados.length > params.refChamadosProf ? `Acima do limite de referência (${params.refChamadosProf})` : '' }, ` · ${c2.chamados.length} chamado${c2.chamados.length === 1 ? '' : 's'}`) : null),
          el('div', { class: 'pontos-barra' },
            el('div', { class: `pontos-fill ${c2.excedido ? 'cheia' : c2.regular >= params.limitePontos ? 'limite' : ''}`, style: `width:${Math.min(100, (c2.regular / params.limitePontos) * 100)}%` })));
      });
      // Referências setoriais (indicativas): total de chamados em atendimento e
      // de participações em planejamento, comparados aos limites de referência.
      const totCh = Object.values(carga).reduce((a, c2) => a + (c2.chamados || []).length, 0);
      const totPl = Object.values(carga).reduce((a, c2) => a + (c2.planejamento || 0), 0);
      const refSpan = (rot, val, ref) => el('span', { class: `sub${val > ref ? ' ref-acima' : ''}`, title: `Limite de referência: ${ref}` }, `${rot}: ${val}/${ref}`);
      painelProfs = el('section', { class: 'card' },
        el('div', { class: 'inicio-fila-cab' },
          el('h2', {}, 'Carga da equipe'),
          el('div', { class: 'carga-refs' },
            refSpan('Chamados em atendimento', totCh, params.refChamadosSetor),
            refSpan('Planejamentos em andamento', totPl, params.refPlanejSetor))),
        el('div', { class: 'prof-grid' }, cards));
    }
  }

  return frag(hero, kpis, painelProfs,
    el('div', { class: 'graf-grid' }, gLinha, gStatus, gCh, gAtv, gCampus, gEsp),
    tblFila);
}
