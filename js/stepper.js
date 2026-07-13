// =============================================================================
// Stepper horizontal do ciclo de vida — compartilhado por chamados e demandas.
// Materializa o fluxo do BPMN “Atendimento de Chamados v2” no topo do dossiê.
// =============================================================================
import { el } from './ui.js';

// passos: [{ rotulo, estado: 'feito' | 'atual' | 'pendente' }]
// opts: { nota?: string|Node, aviso?: string|Node } — linha auxiliar sob o stepper.
export function renderStepper(passos, { nota = null, aviso = null } = {}) {
  const kids = [];
  passos.forEach((p, i) => {
    if (i) kids.push(el('span', { class: `stp-linha ${passos[i - 1].estado === 'feito' ? 'stp-linha-feita' : ''}`, 'aria-hidden': 'true' }));
    kids.push(el('span', { class: `stp-passo stp-${p.estado}` },
      el('span', { class: 'stp-bola', 'aria-hidden': 'true' }, p.estado === 'feito' ? '✓' : String(i + 1)),
      el('span', { class: 'stp-rotulo' }, p.rotulo)));
  });
  const atual = passos.find(p => p.estado === 'atual');
  return el('section', { class: 'card stepper-card' },
    el('div', { class: 'stepper', role: 'img', 'aria-label': `Etapas do ciclo${atual ? ` — etapa atual: ${atual.rotulo}` : ''}` }, kids),
    aviso ? el('p', { class: 'stp-aviso' }, aviso) : null,
    nota ? el('p', { class: 'stp-nota' }, nota) : null);
}
