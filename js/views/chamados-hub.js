// =============================================================================
// Chamados — página unificada: recorte "Fila e atendimento" (a fila pública de
// demandas + chamados em atendimento) e recorte "Triagem de chamados"
// (cadastro/triagem, autenticado). O botão "+ Abrir chamado" vive aqui.
// =============================================================================
import { el, frag } from '../ui.js';
import { store } from '../store.js';
import { viewDashboard, aplicarFiltrosExternos } from './dashboard.js';
import { viewChamados } from './chamados.js';
import { viewArquivo } from './arquivo.js';

let recorte = 'fila'; // persiste durante a sessão de navegação

export function viewChamadosHub(rerender) {
  const s = store();
  const user = s.user;

  // Filtros por URL (#/chamados?status=fila&campus=CCE…): aplica uma vez e
  // normaliza o hash para não reaplicar a cada render.
  const q = (location.hash.split('?')[1] || '');
  if (q) {
    const p = new URLSearchParams(q);
    if (p.get('recorte') === 'triagem') recorte = 'triagem';
    else if (p.get('recorte') === 'arquivo') recorte = 'arquivo';
    else {
      recorte = 'fila';
      aplicarFiltrosExternos({
        status: p.get('status') || '', campus: p.get('campus') || '',
        tipo: p.get('tipo') || '', esp: p.get('esp') || '', busca: p.get('busca') || '',
        fase: p.get('fase') || '', ano: p.get('ano') || '',
      });
    }
    history.replaceState(null, '', location.pathname + location.search + '#/chamados');
  }
  if (!user && recorte === 'triagem') recorte = 'fila'; // arquivo de demandas é público

  const pill = (id, txt) => el('button', {
    class: `sla-pill hub-pill${recorte === id ? ' hub-on' : ''}`,
    'aria-pressed': recorte === id ? 'true' : 'false',
    onclick: () => { recorte = id; rerender(); },
  }, txt);

  // Para o campus, o recorte é a lista dos próprios chamados — sem o jargão
  // interno "triagem", que descreve o trabalho da SENG.
  const barra = el('div', { class: 'hub-barra' },
    pill('fila', 'Fila e atendimento'),
    user ? pill('triagem', user.role === 'campus' ? 'Chamados da unidade' : 'Triagem de chamados') : null,
    pill('arquivo', 'Arquivados'));

  const corpo = (recorte === 'triagem' && user) ? viewChamados(rerender, 'ativos')
    : recorte === 'arquivo' ? viewArquivo(rerender)
    : viewDashboard(rerender);
  return frag(barra, corpo);
}
