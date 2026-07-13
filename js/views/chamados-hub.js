// =============================================================================
// Chamados — página unificada: recorte "Fila e atendimento" (a fila pública de
// demandas + chamados em atendimento) e recorte "Triagem de chamados"
// (cadastro/triagem, autenticado). O botão "+ Abrir chamado" vive aqui.
// =============================================================================
import { el, frag } from '../ui.js';
import { store } from '../store.js';
import { viewDashboard } from './dashboard.js';
import { viewChamados } from './chamados.js';

let recorte = 'fila'; // persiste durante a sessão de navegação

export function viewChamadosHub(rerender) {
  const s = store();
  const user = s.user;
  if (!user && recorte === 'triagem') recorte = 'fila';

  const pill = (id, txt) => el('button', {
    class: `sla-pill hub-pill${recorte === id ? ' hub-on' : ''}`,
    'aria-pressed': recorte === id ? 'true' : 'false',
    onclick: () => { recorte = id; rerender(); },
  }, txt);

  const barra = el('div', { class: 'hub-barra' },
    pill('fila', 'Fila e atendimento'),
    user ? pill('triagem', 'Triagem de chamados') : null);

  const corpo = (recorte === 'triagem' && user) ? viewChamados(rerender) : viewDashboard(rerender);
  return frag(barra, corpo);
}
