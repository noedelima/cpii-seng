// =============================================================================
// Notificações — área pessoal (inbox). Lista como o log, mas cada linha é um
// link para a demanda. Marca como lida ao abrir; botão "marcar todas".
// =============================================================================
import { el, frag, fmtDataHora, toast } from '../ui.js';
import { store } from '../store.js';
import { ROTULO_TIPO } from '../notificacoes.js';
import { DIAS_NOTIFICACAO } from '../config.js';

export function cardNotificacoes() {
  const s = store();
  const user = s.user;
  if (!user) return null;

  const lista = s.listNotificacoes();
  const naoLidas = lista.filter(n => !n.lida).length;

  const topo = el('div', { class: 'detalhe-topo' },
    el('p', { class: 'sub' }, lista.length
      ? (naoLidas ? `${naoLidas} não lida(s) de ${lista.length}` : `${lista.length} notificação(ões) — tudo lido`)
      : 'Você está em dia.'),
    naoLidas
      ? el('button', { class: 'btn ghost sm', onclick: async () => { await s.marcarTodasLidas(); toast('Notificações marcadas como lidas.'); } }, 'Marcar todas como lidas')
      : null);

  let corpo;
  if (!lista.length) {
    corpo = el('p', { class: 'vazio' }, 'Sem notificações por enquanto. Você será avisado aqui sobre novas demandas, diligências, comentários e decisões relevantes ao seu perfil.');
  } else {
    corpo = el('ul', { class: 'notif-lista' }, lista.map(n =>
      el('li', {},
        el('a', {
          class: `notif-item ${n.lida ? '' : 'nao-lida'}`,
          href: n.link || `#/demanda/${n.demandaId}`,
          onclick: () => { if (!n.lida) s.marcarNotificacaoLida(n.id); },
        },
          el('span', { class: `notif-tag tipo-${n.tipo}` }, ROTULO_TIPO[n.tipo] || n.tipo),
          el('span', { class: 'notif-corpo' },
            el('span', { class: 'notif-texto' }, n.texto || n.objeto || n.demandaId),
            el('span', { class: 'notif-meta' }, `${n.demandaId} · ${fmtDataHora(n.criadoEm)}`)),
          n.lida ? null : el('span', { class: 'notif-ponto', 'aria-label': 'não lida', title: 'Não lida' })))));
  }

  // Cartão para o Meu espaço (v1.23 — a antiga página virou área pessoal).
  return el('section', { class: 'card' },
    el('h2', {}, 'Notificações ', naoLidas ? el('span', { class: 'sub ref-acima' }, `(${naoLidas} não lidas)`) : null),
    topo, corpo,
    lista.length ? el('p', { class: 'nota' }, `Os avisos já lidos são removidos automaticamente após ${DIAS_NOTIFICACAO} dias.`) : null);
}
