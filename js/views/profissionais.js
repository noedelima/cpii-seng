// =============================================================================
// Profissionais da SENG — cadastro, carga de pontos (art. 12) e art. 13
// =============================================================================
import { el, frag, campo, select, toast, fmtData } from '../ui.js';
import { CARGOS, AREAS, tipoAusenciaNome, ausenciaAtual, proximaAusencia } from '../config.js';
import { avatar } from '../avatar.js';
import { cargaProfissionais, limitePlanejamento, refIndividual } from '../calc.js';
import { store } from '../store.js';
import { can } from '../auth.js';
import { cardTarefas } from './tarefas.js';

export function viewProfissionais(rerender) {
  const s = store();
  const user = s.user;
  if (!user || !can(user, 'verInterno')) { location.hash = '#/login'; return frag(); }

  const params = s.getParams();
  const profissionais = s.listProfissionais();
  const carga = cargaProfissionais(s.listDemandas(), s.getInternas(), profissionais, params,
    typeof s.listChamados === 'function' ? s.listChamados() : []);
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
    // Chamados (consultoria/laudo) em atendimento — contagem à parte dos pontos.
    const detCh = (c.chamados || []).map(x => el('li', {},
      el('a', { href: `#/chamado/${x.id}` }, x.assunto || x.id), ' ',
      el('span', { class: 'sub' }, '(chamado em atendimento)')));
    return el('section', { class: `card prof-detalhe ${p.ativo === false ? 'inativo' : ''}` },
      el('div', { class: 'prof-cab' },
        el('div', { class: 'prof-ident' }, avatar(p.nome, p.fotoUrl, 44),
          el('div', {},
            el('h2', {}, p.nome, p.ativo === false ? el('span', { class: 'sub' }, ` — inativo${p.obs ? ` (${p.obs})` : ''}` ) : null),
            el('p', { class: 'sub' }, `${p.cargo} · ${p.area}${p.email ? ` · ${p.email}` : ''}`),
            (() => {
              const atual = ausenciaAtual(p); const prox = proximaAusencia(p);
              if (atual) return el('p', { class: 'sub ref-acima' }, `${tipoAusenciaNome(atual.tipo)} até ${fmtData(atual.fim)}`);
              if (prox) return el('p', { class: 'sub' }, `${tipoAusenciaNome(prox.tipo)} prevista: ${fmtData(prox.inicio)} a ${fmtData(prox.fim)}`);
              return null;
            })())),
        podeEditar ? el('button', { class: 'btn ghost sm', onclick: () => abrirForm(p) }, 'Editar') : null),
      el('div', { class: 'prof-resumo' },
        stat('Titular', c.titular), stat('Substituto', c.substituto),
        stat('Total (art. 12)', c.total, c.excedido), stat('Emergencial', c.emergencial),
        stat('Planejamento', c.planejamento, c.planejamento > refIndividual(p, 'refPlanej', params.refPlanejProf)), stat('Disponível', c.disponivel),
        stat('Chamados', (c.chamados || []).length, (c.chamados || []).length > refIndividual(p, 'refChamados', params.refChamadosProf))),
      el('div', { class: 'pontos-barra grande' },
        el('div', { class: `pontos-fill ${c.excedido ? 'cheia' : c.regular >= params.limitePontos ? 'limite' : ''}`, style: `width:${Math.min(100, (c.regular / params.limitePontos) * 100)}%` })),
      (det.length || detCh.length)
        ? el('ul', { class: 'prof-demandas' }, ...det, ...detCh)
        : el('p', { class: 'sub' }, 'Sem demandas nem chamados em atendimento.'));
  });

  // ---- formulário (novo/edição) ------------------------------------------------
  // O profissional é sempre um USUÁRIO já cadastrado (nome/e-mail derivados do
  // cadastro de usuários); aqui se atribuem cargo, área, observação e situação.
  let formWrap = el('div', {});
  function abrirForm(p = {}) {
    const usuarios = (s.listUsuarios() || []).filter(u => u.ativo !== false);
    const vinculados = new Set(profissionais.filter(x => x.id !== p.id).map(x => (x.email || '').toLowerCase()));
    const elegiveis = usuarios.filter(u =>
      !['campus', 'codir'].includes(u.role) && !vinculados.has((u.email || '').toLowerCase()));
    const atual = p.email ? usuarios.find(u => (u.email || '').toLowerCase() === p.email.toLowerCase()) : null;

    const opcoes = elegiveis.map(u => ({ id: u.uid, nome: `${u.nome} — ${u.email}` }));
    if (atual && !elegiveis.some(u => u.uid === atual.uid)) opcoes.unshift({ id: atual.uid, nome: `${atual.nome} — ${atual.email}` });
    if (!atual && p.id) opcoes.unshift({ id: '__manter', nome: `${p.nome} — ${p.email || 'sem e-mail'} (cadastro atual, sem usuário)` });

    if (!opcoes.length) {
      formWrap.replaceChildren(el('section', { class: 'card form-prof' },
        el('h2', {}, 'Novo profissional'),
        el('p', { class: 'nota' }, 'Todos os usuários elegíveis já estão cadastrados como profissionais — ou ainda não há usuários. Cadastre primeiro o usuário em Administração → Novo usuário (perfis Engenharia, Chefe ou Administrador) e volte aqui para atribuir cargo e especialidade.'),
        el('div', { class: 'form-acoes' }, el('button', { class: 'btn ghost', onclick: () => formWrap.replaceChildren() }, 'Fechar'))));
      formWrap.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const selUsuario = select(opcoes, { value: atual?.uid || (p.id && !atual ? '__manter' : ''), required: true });
    const selCargo = select(CARGOS, { value: p.cargo || '', required: true });
    const selArea = select(AREAS, { value: p.area || '', required: true });
    const ckAtivo = el('input', { type: 'checkbox', ...((p.ativo ?? true) ? { checked: true } : {}) });
    const inObs = el('input', { type: 'text', maxlength: 120, value: p.obs || '', placeholder: 'Ex.: em licença até 09/2026' });
    const inRefCh = el('input', { type: 'number', min: 0, max: 50, value: p.refChamados ?? '', placeholder: 'padrão' });
    const inRefPl = el('input', { type: 'number', min: 0, max: 20, value: p.refPlanej ?? '', placeholder: 'padrão' });
    formWrap.replaceChildren(el('section', { class: 'card form-prof' },
      el('h2', {}, p.id ? `Editar — ${p.nome}` : 'Novo profissional'),
      el('form', { class: 'form-grid', onsubmit: async (e) => {
        e.preventDefault();
        let nome = p.nome, email = p.email;
        if (selUsuario.value !== '__manter') {
          const u = usuarios.find(x => x.uid === selUsuario.value);
          if (!u) { toast('Selecione o usuário correspondente.', 'erro'); return; }
          nome = u.nome; email = u.email;
        }
        try {
          await s.salvarProfissional({ ...(p.id ? { id: p.id } : {}), nome, email, cargo: selCargo.value, area: selArea.value, ativo: ckAtivo.checked, obs: inObs.value.trim(),
            refChamados: inRefCh.value === '' ? null : +inRefCh.value, refPlanej: inRefPl.value === '' ? null : +inRefPl.value });
          toast('Profissional salvo.');
          formWrap.replaceChildren();
        } catch (err) { toast(err.message, 'erro'); }
      } },
        campo('Usuário *', selUsuario, 'Nome e e-mail vêm do cadastro de usuários (vínculo automático com o login). Não achou? Cadastre em Administração → Novo usuário.'),
        el('div', { class: 'form-linha' }, campo('Cargo *', selCargo), campo('Área / especialidade *', selArea)),
        campo('Observação', inObs),
        el('div', { class: 'form-linha' },
          campo('Limite individual — chamados', inRefCh, 'Vazio = padrão do sistema. Indicativo, sem bloqueio.'),
          campo('Limite individual — planejamentos', inRefPl, 'Vazio = padrão do sistema. Indicativo, sem bloqueio.')),
        el('label', { class: 'chip-check' }, ckAtivo, ' Ativo (disponível para alocação)'),
        el('div', { class: 'form-acoes' },
          el('button', { class: 'btn ghost', type: 'button', onclick: () => formWrap.replaceChildren() }, 'Fechar'),
          el('button', { class: 'btn primario' }, 'Salvar')))));
    formWrap.scrollIntoView({ behavior: 'smooth' });
  }

  // ---- Disponibilidade (6 meses × disciplina) + ausências futuras -------------
  const meses = [];
  const hoje = new Date();
  for (let i = 0; i < 6; i++) meses.push(new Date(hoje.getFullYear(), hoje.getMonth() + i, 1));
  const ativosDisp = profissionais.filter(p => p.ativo !== false);
  const areas = [...new Set(ativosDisp.map(p => p.area))].sort();
  const dispNoMes = (arr, m) => {
    const ini = m.getTime(), fim = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59).getTime();
    return arr.filter(p => !(p.ausencias || []).some(a => a.inicio <= fim && a.fim >= ini)).length;
  };
  const tblDisp = el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela' },
    el('thead', {}, el('tr', {}, el('th', {}, 'Disciplina'),
      meses.map(m => el('th', { class: 'num' }, m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') + '/' + String(m.getFullYear()).slice(2))))),
    el('tbody', {}, areas.map(a2 => {
      const doGrupo = ativosDisp.filter(p => p.area === a2);
      return el('tr', {}, el('td', {}, a2), meses.map(m => {
        const n = dispNoMes(doGrupo, m);
        return el('td', { class: `num${n <= 1 ? ' ref-acima' : ''}`, title: n <= 1 ? 'Disciplina com cobertura crítica no período' : '' }, `${n}/${doGrupo.length}`);
      }));
    }))));
  const futuras = ativosDisp.flatMap(p => (p.ausencias || [])
    .filter(a2 => a2.fim >= Date.now())
    .map(a2 => ({ p, a: a2 }))).sort((x, y) => x.a.inicio - y.a.inicio);
  const cardDisp = el('section', { class: 'card' },
    el('h2', {}, 'Disponibilidade ', el('span', { class: 'sub' }, '(profissionais disponíveis por mês — ausências registradas no Meu espaço)')),
    tblDisp,
    futuras.length ? el('div', { class: 'ausencias-lista' },
      el('h3', { class: 'sub-titulo' }, 'Ausências vigentes e previstas'),
      ...futuras.map(({ p, a: a2 }) => {
        // Passagem de serviço: itens ativos do profissional, com link direto
        // para realocação no dossiê (alocação/responsáveis).
        const c2 = carga[p.id] || {};
        const itens = [...(c2.demandas || []), ...((c2.chamados || []).map(x => ({ ...x, _ch: true })))];
        return el('p', { class: 'sub' },
          `${p.nome} — ${tipoAusenciaNome(a2.tipo)}: ${fmtData(a2.inicio)} a ${fmtData(a2.fim)}${a2.obs ? ` (${a2.obs})` : ''}`,
          itens.length ? el('span', {}, ' · passagem de serviço: ',
            itens.map((x, i) => el('span', {}, i ? ', ' : '',
              el('a', { href: x._ch ? `#/chamado/${x.id}` : `#/demanda/${x.id}`, title: 'Abrir para realocar' }, x.id)))) : null);
      }))
      : el('p', { class: 'sub' }, 'Nenhuma ausência registrada para os próximos meses.'));

  return frag(
    el('section', { class: 'hero' },
      el('div', {},
        el('h1', {}, 'Equipe da Seção de Engenharia'),
        el('p', { class: 'sub' }, `Limite de ${params.limitePontos} pontos simultâneos por profissional (art. 12). Equipes de planejamento limitadas a 2× os profissionais da especialidade (art. 13).`)),
      podeEditar ? el('button', { class: 'btn primario', onclick: () => abrirForm() }, '+ Novo profissional') : null),
    el('section', { class: 'card' },
      el('h2', {}, 'Equipes de planejamento por especialidade (art. 13)'),
      el('div', { class: 'art13-grid' }, Object.keys(limites).sort().map(area =>
        el('div', { class: `art13-item ${(usoPlanejamento[area] || 0) > limites[area] ? 'excedido' : ''}` },
          el('strong', {}, area),
          el('span', {}, `${usoPlanejamento[area] || 0} / ${limites[area]} participações`))))),
    cardDisp,
    cardTarefas(s, user, rerender),
    formWrap,
    el('div', { class: 'prof-lista' }, cards));
}

const stat = (rotulo, valor, alerta = false) => el('div', { class: `stat ${alerta ? 'alerta' : ''}` },
  el('span', { class: 'stat-num' }, String(valor)), el('span', { class: 'stat-label' }, rotulo));
