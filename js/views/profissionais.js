// =============================================================================
// Profissionais da SENG — cadastro, carga de pontos (art. 12) e art. 13
// =============================================================================
import { el, frag, campo, select, toast } from '../ui.js';
import { CARGOS, AREAS } from '../config.js';
import { cargaProfissionais, limitePlanejamento } from '../calc.js';
import { store } from '../store.js';
import { can } from '../auth.js';

export function viewProfissionais(rerender) {
  const s = store();
  const user = s.user;
  if (!user || !can(user, 'verInterno')) { location.hash = '#/login'; return frag(); }

  const params = s.getParams();
  const profissionais = s.listProfissionais();
  const carga = cargaProfissionais(s.listDemandas(), s.getInternas(), profissionais, params);
  const podeEditar = can(user, 'profissionais');

  // ---- art. 13: equipes de planejamento em uso por especialidade -------------
  const limites = limitePlanejamento(profissionais);
  const usoPlanejamento = {};
  for (const p of profissionais) {
    const c = carga[p.id];
    if (c && c.planejamento > 0) usoPlanejamento[p.area] = (usoPlanejamento[p.area] || 0) + c.planejamento;
  }

  const cards = profissionais.map(p => {
    const c = carga[p.id];
    const det = c.demandas.map(x => el('li', {},
      el('a', { href: `#/demanda/${x.id}` }, x.objeto || x.id), ' ',
      el('span', { class: 'sub' }, `(${{ titular: 'titular', substituto: 'substituto', planejamento: 'planejamento' }[x.papel]}${x.papel === 'planejamento' ? '' : `, ${x.pontos} pt${x.pontos === 1 ? '' : 's'}`}${x.emergencial ? ', emergencial' : ''})`)));
    return el('section', { class: `card prof-detalhe ${p.ativo === false ? 'inativo' : ''}` },
      el('div', { class: 'prof-cab' },
        el('div', {},
          el('h2', {}, p.nome, p.ativo === false ? el('span', { class: 'sub' }, ` — inativo${p.obs ? ` (${p.obs})` : ''}` ) : null),
          el('p', { class: 'sub' }, `${p.cargo} · ${p.area}${p.email ? ` · ${p.email}` : ''}`)),
        podeEditar ? el('button', { class: 'btn ghost sm', onclick: () => abrirForm(p) }, 'Editar') : null),
      el('div', { class: 'prof-resumo' },
        stat('Titular', c.titular), stat('Substituto', c.substituto),
        stat('Total (art. 12)', c.total, c.excedido), stat('Emergencial', c.emergencial),
        stat('Planejamento', c.planejamento), stat('Disponível', c.disponivel)),
      el('div', { class: 'pontos-barra grande' },
        el('div', { class: `pontos-fill ${c.excedido ? 'cheia' : c.regular >= params.limitePontos ? 'limite' : ''}`, style: `width:${Math.min(100, (c.regular / params.limitePontos) * 100)}%` })),
      det.length ? el('ul', { class: 'prof-demandas' }, det) : el('p', { class: 'sub' }, 'Sem demandas em atendimento.'));
  });

  // ---- formulário (novo/edição) ------------------------------------------------
  let formWrap = el('div', {});
  function abrirForm(p = {}) {
    const inNome = el('input', { type: 'text', required: true, maxlength: 80, value: p.nome || '' });
    const inEmail = el('input', { type: 'email', required: true, maxlength: 120, value: p.email || '', placeholder: 'nome@cp2.g12.br' });
    const selCargo = select(CARGOS, { value: p.cargo || '', required: true });
    const selArea = select(AREAS, { value: p.area || '', required: true });
    const ckAtivo = el('input', { type: 'checkbox', ...((p.ativo ?? true) ? { checked: true } : {}) });
    const inObs = el('input', { type: 'text', maxlength: 120, value: p.obs || '', placeholder: 'Ex.: em licença até 09/2026' });
    formWrap.replaceChildren(el('section', { class: 'card form-prof' },
      el('h2', {}, p.id ? `Editar — ${p.nome}` : 'Novo profissional'),
      el('form', { class: 'form-grid', onsubmit: async (e) => {
        e.preventDefault();
        try {
          await s.salvarProfissional({ ...(p.id ? { id: p.id } : {}), nome: inNome.value.trim(), email: inEmail.value.trim(), cargo: selCargo.value, area: selArea.value, ativo: ckAtivo.checked, obs: inObs.value.trim() });
          toast('Profissional salvo.');
          formWrap.replaceChildren();
        } catch (err) { toast(err.message, 'erro'); }
      } },
        el('div', { class: 'form-linha' }, campo('Nome *', inNome), campo('E-mail *', inEmail, 'Mesmo e-mail do login: vincula o usuário a este profissional.')),
        el('div', { class: 'form-linha' }, campo('Cargo *', selCargo), campo('Área / especialidade *', selArea)),
        campo('Observação', inObs),
        el('label', { class: 'chip-check' }, ckAtivo, ' Ativo (disponível para alocação)'),
        el('div', { class: 'form-acoes' },
          el('button', { class: 'btn ghost', type: 'button', onclick: () => formWrap.replaceChildren() }, 'Fechar'),
          el('button', { class: 'btn primario' }, 'Salvar')))));
    formWrap.scrollIntoView({ behavior: 'smooth' });
  }

  return frag(
    el('section', { class: 'hero' },
      el('div', {},
        el('h1', {}, 'Profissionais da Seção de Engenharia'),
        el('p', { class: 'sub' }, `Limite de ${params.limitePontos} pontos simultâneos por profissional (art. 12). Equipes de planejamento limitadas a 2× os profissionais da especialidade (art. 13).`)),
      podeEditar ? el('button', { class: 'btn primario', onclick: () => abrirForm() }, '+ Novo profissional') : null),
    el('section', { class: 'card' },
      el('h2', {}, 'Equipes de planejamento por especialidade (art. 13)'),
      el('div', { class: 'art13-grid' }, Object.keys(limites).sort().map(area =>
        el('div', { class: `art13-item ${(usoPlanejamento[area] || 0) > limites[area] ? 'excedido' : ''}` },
          el('strong', {}, area),
          el('span', {}, `${usoPlanejamento[area] || 0} / ${limites[area]} participações`))))),
    formWrap,
    el('div', { class: 'prof-lista' }, cards));
}

const stat = (rotulo, valor, alerta = false) => el('div', { class: `stat ${alerta ? 'alerta' : ''}` },
  el('span', { class: 'stat-num' }, String(valor)), el('span', { class: 'stat-label' }, rotulo));
