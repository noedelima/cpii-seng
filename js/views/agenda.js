// =============================================================================
// Agenda da Seção (v1.24) — calendário interno da SENG (Eng/Chefe/Admin; sem
// CODIR nem solicitantes). Agrega tudo que tem distribuição temporal:
// ausências da equipe, prazos de tarefas, SLAs de chamados ativos e eventos
// manuais (feriados/recessos/marcos, editáveis pela Chefia em config/params).
// =============================================================================
import { el, frag, campo, select, toast, confirmar, fmtData } from '../ui.js';
import { TIPOS_EVENTO_AGENDA, tipoEventoAgendaNome, tipoAusenciaNome, campusNome } from '../config.js';
import { store } from '../store.js';
import { can } from '../auth.js';
import { avatar } from '../avatar.js';

let mesRef = null; // primeiro dia do mês exibido (persiste na sessão)

const MESMO_DIA = (ts, d) => { const x = new Date(ts); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };
const NO_DIA = (ini, fim, d) => { const i0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); const i1 = i0 + 86399999; return ini <= i1 && (fim ?? ini) >= i0; };

export function viewAgenda(rerender) {
  const s = store();
  const user = s.user;
  if (!user || !['engenharia', 'chefe', 'admin'].includes(user.role)) { location.hash = '#/'; return frag(); }

  if (!mesRef) { const h = new Date(); mesRef = new Date(h.getFullYear(), h.getMonth(), 1); }
  const params = s.getParams();
  const profs = (s.listProfissionais() || []).filter(p => p.ativo !== false);

  // ---- agregação dos itens temporais ---------------------------------------
  const itens = [];
  profs.forEach(p => (p.ausencias || []).forEach(a => itens.push({
    tipo: 'ausencia', ini: a.inicio, fim: a.fim, cls: 'ag-ausencia',
    rotulo: `${p.nome} — ${tipoAusenciaNome(a.tipo)}`, href: '#/equipe', p })));
  (s.listTarefas ? s.listTarefas() : []).forEach(t => {
    if (t.prazo && !['concluida', 'cancelada'].includes(t.situacao))
      itens.push({ tipo: 'tarefa', ini: t.prazo, fim: t.prazo, cls: 'ag-tarefa',
        rotulo: `Tarefa: ${t.titulo}`, href: '#/equipe' });
  });
  (s.listChamados ? s.listChamados() : []).forEach(c => {
    if (c.prazoLimite && ['aberto', 'triagem', 'diligencia', 'atendimento'].includes(c.status))
      itens.push({ tipo: 'chamado', ini: c.prazoLimite, fim: c.prazoLimite, cls: 'ag-chamado',
        rotulo: `SLA ${c.id} — ${c.assunto || ''} (${campusNome(c.campus)})`, href: `#/chamado/${c.id}` });
  });
  (params.eventosAgenda || []).forEach(ev => itens.push({
    tipo: 'evento', ini: ev.inicio, fim: ev.fim || ev.inicio, cls: `ag-${ev.tipo}`,
    rotulo: `${tipoEventoAgendaNome(ev.tipo)}: ${ev.titulo}`, ev }));

  // ---- grade do mês ----------------------------------------------------------
  const ano = mesRef.getFullYear(), mes = mesRef.getMonth();
  const primeiro = new Date(ano, mes, 1), ultimo = new Date(ano, mes + 1, 0);
  const hoje = new Date();
  const celulas = [];
  for (let i = 0; i < primeiro.getDay(); i++) celulas.push(el('div', { class: 'ag-cel vazia' }));
  for (let dia = 1; dia <= ultimo.getDate(); dia++) {
    const d = new Date(ano, mes, dia);
    const doDia = itens.filter(x => NO_DIA(x.ini, x.fim, d));
    const ehHoje = MESMO_DIA(hoje.getTime(), d);
    celulas.push(el('div', { class: `ag-cel${ehHoje ? ' ag-hoje' : ''}${[0, 6].includes(d.getDay()) ? ' ag-fds' : ''}` },
      el('span', { class: 'ag-dia' }, String(dia)),
      doDia.slice(0, 3).map(x => el(x.href ? 'a' : 'span', { class: `ag-chip ${x.cls}`, ...(x.href ? { href: x.href } : {}), title: x.rotulo },
        x.rotulo.length > 18 ? x.rotulo.slice(0, 17) + '…' : x.rotulo)),
      doDia.length > 3 ? el('span', { class: 'sub' }, `+${doDia.length - 3}`) : null));
  }
  const nav = (delta) => () => { mesRef = new Date(ano, mes + delta, 1); rerender(); };
  const grade = el('section', { class: 'card' },
    el('div', { class: 'ag-topo' },
      el('button', { class: 'btn ghost sm', onclick: nav(-1), 'aria-label': 'Mês anterior' }, '←'),
      el('h2', {}, mesRef.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })),
      el('button', { class: 'btn ghost sm', onclick: nav(1), 'aria-label': 'Próximo mês' }, '→')),
    el('div', { class: 'ag-grade' },
      ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map(d => el('div', { class: 'ag-cab' }, d)), celulas),
    el('p', { class: 'nota' }, 'Legenda: ausências da equipe · prazos de tarefas · SLAs de chamados · feriados/recessos/marcos da seção.'));

  // ---- lista do mês ----------------------------------------------------------
  const iniMes = primeiro.getTime(), fimMes = new Date(ano, mes + 1, 0, 23, 59, 59).getTime();
  const doMes = itens.filter(x => x.ini <= fimMes && (x.fim ?? x.ini) >= iniMes).sort((a, b) => a.ini - b.ini);
  const lista = el('section', { class: 'card' },
    el('h2', {}, 'No mês ', el('span', { class: 'sub' }, `(${doMes.length})`)),
    doMes.length ? el('div', { class: 'ativ-lista' }, doMes.map(x =>
      el(x.href ? 'a' : 'div', { class: 'ativ-item', ...(x.href ? { href: x.href } : {}) },
        x.p ? avatar(x.p.nome, x.p.fotoUrl, 22) : el('span', { class: `ag-ponto ${x.cls}` }),
        el('span', { class: 'ativ-titulo' }, x.rotulo),
        el('span', { class: 'ativ-meta' }, x.fim && x.fim !== x.ini ? `${fmtData(x.ini)} a ${fmtData(x.fim)}` : fmtData(x.ini)),
        (x.ev && can(user, 'params')) ? el('button', { class: 'sel-rm', title: 'Remover evento', onclick: async (e) => {
          e.preventDefault();
          const ok = await confirmar('Remover evento?', `“${x.ev.titulo}” sai do calendário da seção.`, { ok: 'Remover', perigo: true });
          if (!ok) return;
          await s.setParams({ eventosAgenda: (params.eventosAgenda || []).filter(v => v.id !== x.ev.id) });
          toast('Evento removido.');
        } }, '✕') : null)))
      : el('p', { class: 'sub' }, 'Nada com data neste mês.'));

  // ---- novo evento (Chefia/Admin) -------------------------------------------
  let editor = null;
  if (can(user, 'params')) {
    const inTitulo = el('input', { type: 'text', maxlength: 100, placeholder: 'Ex.: Recesso escolar, visita técnica…' });
    const selTipo = select(TIPOS_EVENTO_AGENDA, { placeholder: 'Tipo…' });
    const inIni = el('input', { type: 'date' });
    const inFim = el('input', { type: 'date' });
    editor = el('section', { class: 'card' },
      el('h2', {}, 'Novo evento da seção ', el('span', { class: 'sub' }, '(feriado, recesso ou marco)')),
      el('div', { class: 'form-grid' },
        el('div', { class: 'form-linha' }, campo('Título *', inTitulo), campo('Tipo *', selTipo)),
        el('div', { class: 'form-linha' }, campo('Início *', inIni), campo('Fim (opcional)', inFim)),
        el('button', { class: 'btn', onclick: async () => {
          if (!inTitulo.value.trim() || !selTipo.value || !inIni.value) { toast('Preencha título, tipo e início.', 'erro'); return; }
          const ini = new Date(inIni.value + 'T00:00:00').getTime();
          const fim = inFim.value ? new Date(inFim.value + 'T23:59:59').getTime() : null;
          if (fim && fim < ini) { toast('O fim deve ser depois do início.', 'erro'); return; }
          const novo = { id: 'e' + Date.now().toString(36), titulo: inTitulo.value.trim(), tipo: selTipo.value, inicio: ini, ...(fim ? { fim } : {}) };
          await s.setParams({ eventosAgenda: [...(params.eventosAgenda || []), novo] });
          inTitulo.value = ''; selTipo.value = ''; inIni.value = ''; inFim.value = '';
          toast('Evento adicionado à agenda.');
        } }, 'Adicionar')));
  }

  return frag(
    el('section', { class: 'hero' }, el('div', {},
      el('h1', {}, 'Agenda da Seção'),
      el('p', { class: 'sub' }, 'Calendário interno da SENG — ausências, prazos de tarefas, SLAs de chamados e eventos da seção.'))),
    grade,
    el('div', { class: 'detalhe-grid' }, lista, editor));
}
