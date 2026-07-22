// =============================================================================
// Arquivados — histórico universal dos encerrados: DEMANDAS (concluídas,
// canceladas e não enquadradas) e CHAMADOS (recorte próprio em chamados.js).
// Demandas arquivadas são públicas (como a fila); chamados exigem login.
// =============================================================================
import { el, frag, fmtNum, fmtDataHora, badgeStatus, select, debounce } from '../ui.js';
import { STATUS, CAMPI, campusNome } from '../config.js';
import { prioridade } from '../calc.js';
import { store } from '../store.js';
import { viewChamados } from './chamados.js';

export const TERMINAIS_DEMANDA = ['concluido', 'cancelado', 'nao-enquadrado'];

let tipoArq = 'demandas'; // persiste durante a sessão
const fd = { status: '', campus: '', texto: '' };

export function viewArquivo(rerender) {
  const s = store();
  const user = s.user;
  if (!user) tipoArq = 'demandas'; // chamados arquivados exigem login

  const pill = (id, txt) => el('button', {
    class: `sla-pill hub-pill${tipoArq === id ? ' hub-on' : ''}`,
    'aria-pressed': tipoArq === id ? 'true' : 'false',
    onclick: () => { tipoArq = id; rerender(); },
  }, txt);
  const sub = el('div', { class: 'hub-barra' },
    pill('demandas', 'Demandas'),
    user ? pill('chamados', 'Chamados') : null);

  const corpo = (tipoArq === 'chamados' && user)
    ? viewChamados(rerender, 'arquivo')
    : demandasArquivadas(s, user, rerender);
  return frag(sub, corpo);
}

function demandasArquivadas(s, user, rerender) {
  const params = s.getParams();
  const todas = s.listDemandas().filter(d => TERMINAIS_DEMANDA.includes(d.status));
  const filtradas = todas.filter(d =>
    (!fd.status || d.status === fd.status) &&
    (!fd.campus || d.campus === fd.campus) &&
    (!fd.texto || `${d.id} ${d.objeto || ''} ${d.descricao || ''} ${campusNome(d.campus)}`
      .toLowerCase().includes(fd.texto.toLowerCase()))
  ).sort((a, b) => (b.atualizadoEm || 0) - (a.atualizadoEm || 0)); // mais recente primeiro

  const selSt = select(STATUS.filter(st => TERMINAIS_DEMANDA.includes(st.id)),
    { value: fd.status, placeholder: 'Todos os desfechos' });
  selSt.onchange = () => { fd.status = selSt.value; rerender(); };
  const selCampus = select(CAMPI, { value: fd.campus, placeholder: 'Todos os campi' });
  selCampus.onchange = () => { fd.campus = selCampus.value; rerender(); };
  const inBusca = el('input', { type: 'search', placeholder: 'Buscar por objeto, descrição…', value: fd.texto });
  inBusca.oninput = debounce(() => { fd.texto = inBusca.value.trim(); rerender(); }, 250);

  const filtros = el('div', { class: 'chamados-filtros' },
    el('label', { class: 'campo compacto' }, el('span', { class: 'campo-label' }, 'Desfecho'), selSt),
    el('label', { class: 'campo compacto' }, el('span', { class: 'campo-label' }, 'Campus'), selCampus),
    el('label', { class: 'campo compacto cresce' }, el('span', { class: 'campo-label' }, 'Busca'), inBusca));

  let corpo;
  if (!filtradas.length) {
    corpo = el('p', { class: 'vazio' }, 'Nenhuma demanda arquivada corresponde aos filtros — as encerradas (concluídas, canceladas e não enquadradas) aparecem aqui.');
  } else {
    const linhas = filtradas.map(d => {
      const pr = prioridade(d, params);
      return el('tr', { tabindex: 0, role: 'link', 'aria-label': `Abrir demanda: ${d.objeto || d.id}`,
        onclick: () => { location.hash = `#/demanda/${d.id}`; },
        onkeydown: (e) => { if (e.key === 'Enter') location.hash = `#/demanda/${d.id}`; } },
        el('td', {}, campusNome(d.campus)),
        el('td', { class: 'objeto' }, el('strong', {}, d.objeto || '—')),
        el('td', {}, badgeStatus(d.status)),
        el('td', { class: 'num' }, pr.final == null ? '—' : fmtNum(pr.final)),
        el('td', { class: 'sub' }, fmtDataHora(d.atualizadoEm)));
    });
    corpo = el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' },
      el('thead', {}, el('tr', {},
        el('th', {}, 'Campus'), el('th', {}, 'Objeto'), el('th', {}, 'Desfecho'),
        el('th', { class: 'num' }, 'Prioridade'), el('th', {}, 'Encerrada em'))),
      el('tbody', {}, linhas)));
  }

  return frag(
    el('section', { class: 'hero' }, el('div', {},
      el('h1', {}, 'Arquivo de demandas'),
      el('p', { class: 'sub' }, 'Histórico das demandas encerradas — concluídas, canceladas e não enquadradas (Art. 18).'))),
    el('section', { class: 'card' }, filtros,
      el('p', { class: 'sub cont' }, `${filtradas.length} de ${todas.length} demanda(s) arquivada(s)`),
      corpo));
}
