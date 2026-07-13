// =============================================================================
// Seleção de pessoas (alocação de profissionais) — componente compartilhado.
// Padrão de UX: lista de seleção (somente quem ainda não foi incluído) +
// botão “Incluir”; os incluídos aparecem como itens com remoção individual.
// Usado em: fiscais titulares/substitutos, equipe de planejamento (demandas)
// e responsáveis pelo atendimento (chamados).
// =============================================================================
import { el } from './ui.js';

// cfg: { itens: [{id, nome, ...}], atuais: [ids], rotulo?(p), vazio?, aoMudar?() }
// Retorna { node, get() } — get() devolve os ids incluídos, na ordem da lista.
export function selecaoPessoas({ itens = [], atuais = [], rotulo = (p) => p.nome, vazio = 'Ninguém incluído.', aoMudar = null } = {}) {
  const sel = new Set(atuais.filter(id => itens.some(p => p.id === id)));
  const combo = el('select', { class: 'sel-combo', 'aria-label': 'Selecionar profissional para incluir' });
  const btn = el('button', { type: 'button', class: 'btn ghost sm', onclick: () => {
    if (!combo.value) return;
    sel.add(combo.value);
    render();
    if (aoMudar) aoMudar();
  } }, 'Incluir');
  const lista = el('ul', { class: 'sel-lista' });

  function render() {
    const restantes = itens.filter(p => !sel.has(p.id));
    combo.textContent = '';
    combo.append(el('option', { value: '' }, restantes.length ? 'Selecionar…' : 'Todos incluídos'));
    restantes.forEach(p => combo.append(el('option', { value: p.id }, rotulo(p))));
    combo.value = '';
    combo.disabled = btn.disabled = !restantes.length;

    lista.textContent = '';
    const inclusos = itens.filter(p => sel.has(p.id));
    if (!inclusos.length) lista.append(el('li', { class: 'sel-vazio' }, vazio));
    inclusos.forEach(p => lista.append(el('li', { class: 'sel-item' },
      el('span', { class: 'sel-nome' }, rotulo(p)),
      el('button', { type: 'button', class: 'sel-rm', title: 'Remover', 'aria-label': `Remover ${p.nome}`, onclick: () => {
        sel.delete(p.id);
        render();
        if (aoMudar) aoMudar();
      } }, '✕'))));
  }
  render();

  const node = el('div', { class: 'sel-pessoas' },
    el('div', { class: 'sel-controles' }, combo, btn), lista);
  return { node, get: () => itens.filter(p => sel.has(p.id)).map(p => p.id) };
}
