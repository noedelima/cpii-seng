// =============================================================================
// Ajuda — reproduções em DOM das telas (padrão SANE): moldura de janela +
// reprodução NÃO interativa (mesmas cores/temas do app) + marcadores numerados.
// Nada aqui é interativo; serve só de ilustração didática nos manuais.
// =============================================================================
import { el } from './ui.js';

// Moldura de janela (barra + tela) com marcadores posicionados em %.
export function ajudaFig({ titulo, legenda, marcadores = [], corpo }) {
  return el('figure', { class: 'ajuda-fig af' },
    el('div', { class: 'af-janela' },
      el('div', { class: 'af-barra' },
        el('span', { class: 'af-dot v' }), el('span', { class: 'af-dot a' }), el('span', { class: 'af-dot g' }),
        titulo ? el('span', { class: 'af-tit' }, titulo) : null),
      el('div', { class: 'af-tela' }, corpo,
        ...marcadores.map(m => el('span', { class: 'af-mk', style: `top:${m.top};left:${m.left}` }, String(m.n))))),
    legenda ? el('figcaption', { class: 'af-leg' }, legenda) : null);
}

// ---- primitivos de reprodução (usam variáveis de tema) ----------------------
const card = (...k) => el('div', { class: 'rp-card' }, k.flat(Infinity));
const ctit = (t) => el('div', { class: 'rp-ctit' }, t);
const grid = (...k) => el('div', { class: 'rp-grid' }, k.flat(Infinity));
const campo = (rot, val) => el('div', { class: 'rp-campo' }, el('div', { class: 'rp-label' }, rot), el('div', { class: 'rp-input' }, val));
const area = (rot, val) => el('div', { class: 'rp-campo' }, el('div', { class: 'rp-label' }, rot), el('div', { class: 'rp-input rp-area' }, val));
const btn = (t, tipo = 'primario') => el('span', { class: `rp-btn ${tipo}` }, t);
const acoes = (...k) => el('div', { class: 'rp-acoes' }, k.flat(Infinity));
const nota = (t) => el('div', { class: 'rp-nota' }, t);
const badge = (t, cor) => el('span', { class: `badge ${cor}` }, t);
const chips = (arr) => el('div', { class: 'rp-chips' }, arr.map(c => el('span', { class: 'rp-chip' + (c.on ? ' on' : '') }, c.t || c)));
const h = (t) => el('div', { class: 'rp-h' }, t);

// Barra de topo do app (para figuras de menu/painel).
function topbar(ativo = 'Painel', extra = []) {
  const links = ['Painel', 'Chamados', ...extra, 'Ajuda'];
  return el('div', { class: 'rp-topbar' },
    el('span', { class: 'rp-brand' }, 'SENG Demandas'),
    el('span', { class: 'rp-links' }, links.map(l => el('span', { class: 'rp-link' + (l === ativo ? ' on' : '') }, l))),
    el('span', { class: 'rp-user' }, '\u{1F514}  Seu nome ▾'));
}

// Tabela compacta de reprodução.
function tabela(head, linhas) {
  return el('table', { class: 'rp-tab' },
    el('thead', {}, el('tr', {}, head.map(c => el('th', {}, c)))),
    el('tbody', {}, linhas.map(r => el('tr', {}, r.map(c => el('td', {}, c))))));
}

// ---- SVG (fluxogramas) — construção via createElementNS, sem innerHTML ------
const SVGNS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  for (const k of kids.flat(Infinity)) if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
}

const F = {};
export function figura(id) {
  const f = F[id];
  return f ? f() : el('p', { class: 'nota' }, `(reprodução “${id}” indisponível)`);
}

// ============================================================================
// FLUXOGRAMA — ciclo do chamado (usado nos manuais Campus e Engenharia).
// Espelha docs/fluxo-chamados.bpmn (editável no Bizagi Modeler).
// ============================================================================
F['fluxo-chamado'] = () => {
  const caixa = (x, y, w, h, titulo, sub, destaque) => sv('g', {},
    sv('rect', { x, y, width: w, height: h, rx: 8, fill: 'var(--card)', stroke: destaque ? 'var(--acento)' : 'var(--borda-forte)', 'stroke-width': destaque ? 1.5 : 1 }),
    sv('text', { x: x + w / 2, y: y + (sub ? 21 : h / 2 + 4), 'text-anchor': 'middle', fill: 'var(--texto)', 'font-size': 13, 'font-weight': 600 }, titulo),
    sub ? sv('text', { x: x + w / 2, y: y + 38, 'text-anchor': 'middle', fill: 'var(--texto-2)', 'font-size': 11 }, sub) : null);
  const seta = (d) => sv('path', { d, fill: 'none', stroke: 'var(--texto-2)', 'stroke-width': 1.2, 'marker-end': 'url(#af-seta)' });
  const raia = (y, h, rotulo) => sv('g', {},
    sv('rect', { x: 8, y, width: 664, height: h, rx: 10, fill: 'none', stroke: 'var(--borda)', 'stroke-dasharray': '5 4' }),
    sv('text', { x: 20, y: y + 18, fill: 'var(--texto-2)', 'font-size': 11, 'font-weight': 600, 'letter-spacing': '.06em' }, rotulo));
  const svg = sv('svg', { viewBox: '0 0 680 640', width: '100%', role: 'img', 'aria-label': 'Fluxo do chamado, da abertura à conclusão' },
    sv('defs', {}, sv('marker', { id: 'af-seta', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' },
      sv('path', { d: 'M2 1L8 5L2 9', fill: 'none', stroke: 'var(--texto-2)', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))),
    raia(8, 116, 'CAMPUS'),
    raia(132, 500, 'SENG / DECOF'),
    caixa(60, 32, 180, 52, 'Abrir chamado', 'categoria, urgência, anexos'),
    caixa(430, 32, 190, 52, 'Responder diligência', 'complementa e devolve'),
    caixa(60, 164, 180, 52, 'Triagem do chamado', 'notifica envolvidos'),
    caixa(430, 164, 190, 52, 'Solicitar diligência', 'prazo (SLA) pausa'),
    caixa(60, 256, 180, 52, 'Decisão da triagem', 'desfecho com parecer'),
    caixa(28, 352, 120, 52, 'Obra', 'cria demanda', true),
    caixa(168, 352, 170, 52, 'Consultoria/laudo', 'aloca responsáveis'),
    caixa(358, 352, 124, 52, 'Encaminhado', 'outro setor'),
    caixa(502, 352, 150, 52, 'Não enquadrado', 'improcedente etc.'),
    caixa(28, 444, 150, 52, 'Fila de obras', 'GUT → CODIR → fila', true),
    caixa(168, 444, 170, 52, 'Em atendimento', 'conta na carga'),
    caixa(183, 536, 140, 52, 'Resolvido', 'orientação ou NT'),
    seta('M150 84 V160'),
    seta('M240 182 H426'),
    seta('M560 164 V88'),
    seta('M490 84 V140 H170 V160'),
    seta('M150 216 V252'),
    seta('M150 308 V330 H88 V348'),
    seta('M150 308 V330 H253 V348'),
    seta('M150 308 V330 H420 V348'),
    seta('M150 308 V330 H577 V348'),
    seta('M88 404 V420 H103 V440'),
    seta('M253 404 V440'),
    seta('M253 496 V532'));
  return ajudaFig({
    titulo: 'Ciclo do chamado — da abertura à conclusão',
    legenda: 'Abertura pelo campus → triagem (diligência opcional, com o SLA pausado) → desfecho: obra (vira demanda e segue GUT → CODIR → fila), consultoria/laudo (atendimento → resolvido), encaminhado ou não enquadrado.',
    corpo: el('div', { style: 'padding:6px' }, svg),
  });
};

// ============================================================================
// COMPARTILHADA
// ============================================================================
F['login'] = () => ajudaFig({
  titulo: 'Acesso ao sistema',
  legenda: '① Entrar — use o e-mail institucional. A consulta à fila e o PDF são públicos; o login habilita as ações.',
  marcadores: [{ n: 1, top: '84%', left: '50%' }],
  corpo: el('div', { class: 'rp-centro' }, card(
    h('SENG Demandas'),
    nota('Colégio Pedro II — Seção de Engenharia (SENG/DECOF)'),
    campo('E-mail institucional', 'nome@cp2.g12.br'),
    campo('Senha', '••••••••'),
    acoes(btn('Entrar')))),
});

// ============================================================================
// CAMPUS
// ============================================================================
F['campus-fila'] = () => ajudaFig({
  titulo: 'Painel — fila pública',
  legenda: '① Filtros e busca · ② Baixar PDF da fila · ③ Clique numa linha para ver os detalhes.',
  marcadores: [{ n: 1, top: '20%', left: '17%' }, { n: 2, top: '9%', left: '90%' }, { n: 3, top: '70%', left: '44%' }],
  corpo: el('div', {}, topbar('Painel'),
    el('div', { class: 'rp-hero' }, el('div', {}, h('Demandas de Obras e Serviços'), nota('Acompanhamento público — Portaria 7503/2025')), acoes(btn('Baixar PDF', 'ghost'))),
    el('div', { class: 'rp-filtros' }, chips(['Todos os campi', 'Todos os status', 'Especialidade'])),
    tabela(['Fila', 'Campus', 'Objeto', 'Status', 'Prior.'], [
      ['1º', 'Tijuca II', 'Cobertura do Anexo', badge('Na fila', 'st-fila'), '0,64'],
      ['—', 'Centro', 'Reforma do telhado', badge('Em atendimento', 'st-atendimento'), '0,61'],
      ['2º', 'Duque de Caxias', 'Lab. de informática', badge('Na fila', 'st-fila'), '0,55'],
    ])),
});

F['campus-abrir'] = () => ajudaFig({
  titulo: 'Chamados › Abrir chamado',
  legenda: '① Campus (seu) · ② Assunto/categoria (define disciplina e SLA) · ③ Título · ④ Descrição · ⑤ Abrir.',
  marcadores: [{ n: 1, top: '24%', left: '27%' }, { n: 2, top: '24%', left: '75%' }, { n: 3, top: '45%', left: '50%' }, { n: 4, top: '70%', left: '50%' }, { n: 5, top: '92%', left: '86%' }],
  corpo: el('div', {}, h('Abrir chamado'), nota('Solicitação à Engenharia — passa por triagem.'),
    card(
      grid(campo('Campus / unidade', 'São Cristóvão II'), campo('Assunto / categoria', 'Hidráulica / sanitária · SLA 5d')),
      campo('Título do chamado', 'Vazamento no banheiro do 2º pav.'),
      grid(campo('Localização', 'Bloco B, 2º pav.'), campo('Urgência', 'Alta')),
      area('Descrição', 'Vazamento constante sob a bancada, com infiltração no forro abaixo.'),
      acoes(btn('Cancelar', 'ghost'), btn('Abrir chamado')))),
});

F['campus-painel'] = () => ajudaFig({
  titulo: 'Chamados — painel',
  legenda: '① Faixa de SLA (no prazo / vencendo / vencido) · ② Filtros e busca · ③ Selo de status por linha.',
  marcadores: [{ n: 1, top: '30%', left: '20%' }, { n: 2, top: '46%', left: '18%' }, { n: 3, top: '68%', left: '68%' }],
  corpo: el('div', {}, topbar('Chamados'),
    el('div', { class: 'rp-hero' }, el('div', {}, h('Chamados'), nota('Solicitações da sua unidade')), acoes(btn('+ Abrir chamado'), btn('Baixar PDF', 'ghost'))),
    el('div', { class: 'rp-slaresumo' }, el('span', { class: 'sla-pill sla-ok' }, '3 no prazo'), el('span', { class: 'sla-pill sla-alerta' }, '1 vencendo'), el('span', { class: 'sla-pill sla-vencido' }, '1 vencido')),
    el('div', { class: 'rp-filtros' }, chips(['Ativos', 'Categoria', 'Buscar…'])),
    tabela(['Nº', 'Assunto', 'Status', 'Prazo'], [
      ['CH2026CSCII001', 'Vazamento no banheiro', badge('Em triagem', 'st-analise'), el('span', { class: 'ch-sla sla-ok' }, '3d')],
      ['CH2026CSCII002', 'Infiltração na cobertura', badge('Aberto', 'st-recebido'), el('span', { class: 'ch-sla sla-vencido' }, 'atrasado 2d')],
    ])),
});

F['campus-detalhe'] = () => ajudaFig({
  titulo: 'Detalhe do chamado',
  legenda: '① Status e prazo (SLA) · ② Anexos (fotos/PDF, até 10 MB) · ③ Comentários com a Engenharia.',
  marcadores: [{ n: 1, top: '12%', left: '62%' }, { n: 2, top: '55%', left: '24%' }, { n: 3, top: '85%', left: '30%' }],
  corpo: el('div', {},
    el('div', { class: 'rp-topo' }, el('span', { class: 'mono rp-id' }, 'CH2026CSCII001'), badge('Em triagem', 'st-analise'), el('span', { class: 'ch-sla sla-ok' }, 'SLA: 3d')),
    h('Vazamento no banheiro do 2º pav.'),
    card(ctit('Anexos'), el('div', { class: 'rp-anexos' }, el('span', { class: 'rp-thumb' }), el('span', { class: 'rp-thumb' }), el('span', { class: 'rp-file' }, 'PDF'), btn('+ Adicionar anexo', 'ghost'))),
    card(ctit('Comentários'), el('div', { class: 'rp-coment' }, el('b', {}, 'Engenharia'), ' Pode enviar uma foto do forro afetado?'))),
});

F['campus-diligencia'] = () => ajudaFig({
  titulo: 'Chamado em diligência',
  legenda: '① A Engenharia pediu um complemento — responda aqui; o prazo (SLA) fica pausado.',
  marcadores: [{ n: 1, top: '58%', left: '86%' }],
  corpo: el('div', {},
    el('div', { class: 'rp-topo' }, el('span', { class: 'mono rp-id' }, 'CH2026CSCII001'), badge('Em diligência', 'st-diligencia')),
    card(ctit('Diligência — resposta do campus'), nota('A Engenharia solicitou: informar a extensão da infiltração.'),
      area('Complemento', 'A infiltração atinge cerca de 2 m² do forro, com pontos de mofo.'),
      acoes(btn('Responder diligência')))),
});

F['campus-conta'] = () => ajudaFig({
  titulo: 'Minha conta',
  legenda: '① Seus dados de acesso · ② Troque a senha (mínimo 6 caracteres).',
  marcadores: [{ n: 1, top: '26%', left: '30%' }, { n: 2, top: '78%', left: '86%' }],
  corpo: el('div', {}, h('Minha conta'),
    card(ctit('Dados de acesso'), grid(campo('Nome', 'DIAD São Cristóvão II'), campo('Perfil', 'Campus'), campo('E-mail', 'campus.sc2@cp2.g12.br'), campo('Campus', 'CSCII'))),
    card(ctit('Trocar senha'), grid(campo('Senha atual', '••••••'), campo('Nova senha', '••••••••')), acoes(btn('Alterar senha')))),
});

// helpers extras
const check = (rot, on) => el('div', { class: 'rp-check' }, el('span', { class: 'rp-box' + (on ? ' on' : '') }), rot);
const scoreCell = (s, v) => el('div', { class: 'rp-cell' }, el('b', {}, v), el('span', {}, s));
const bar = (pct) => el('div', { class: 'rp-bar' }, el('i', { style: `width:${pct}%` }));
const cargaLinha = (nome, uso, pct) => el('div', { class: 'rp-carga' }, el('div', { class: 'rp-carga-top' }, el('span', {}, nome), el('span', {}, uso)), bar(pct));

// ============================================================================
// ENGENHARIA / CHEFIA / ADMIN
// ============================================================================
F['eng-painel'] = () => ajudaFig({
  titulo: 'Painel interno da SENG',
  legenda: '① Carga da equipe (acima da fila) · ② Filtro “Minhas atribuições” · ③ Coluna Fiscal técnico.',
  marcadores: [{ n: 1, top: '25%', left: '20%' }, { n: 2, top: '55%', left: '82%' }, { n: 3, top: '84%', left: '88%' }],
  corpo: el('div', {}, topbar('Painel', ['Profissionais', 'Administração']),
    card(ctit('Carga da equipe (limite 6 pts — art. 12)'), cargaLinha('Noé — Elétrica', '6/6', 100), cargaLinha('Raquel — Civil', '4/6', 66)),
    el('div', { class: 'rp-filtros' }, chips(['Todos os status', 'Especialidade', { t: 'Minhas atribuições', on: true }])),
    tabela(['Campus', 'Objeto', 'Status', 'GUT', 'Fiscal'], [
      ['Centro', 'Reforma do telhado', badge('Em atendimento', 'st-atendimento'), '64', 'Pâmella, Julie'],
      ['SC III', 'Fiscalização do telhado', badge('Em atendimento', 'st-atendimento'), '—', 'Rafael, Suellen'],
    ])),
});

F['eng-demanda'] = () => ajudaFig({
  titulo: 'Detalhe da demanda',
  legenda: 'Esquerda: dados e histórico. Direita: priorização, avaliação, gestão e alocação.',
  corpo: el('div', { class: 'rp-2col' },
    el('div', {}, card(ctit('Dados da solicitação'), campo('Objeto', 'Reforma do telhado'), campo('Campus', 'Centro')), card(ctit('Histórico'), nota('Registro · Análise · CODIR · Fila'))),
    el('div', {}, card(ctit('Priorização'), el('div', { class: 'rp-final' }, el('span', {}, 'Prioridade'), el('b', {}, '0,61'))), card(ctit('Gestão'), acoes(btn('Aguardando CODIR', 'ghost'), btn('Em diligência', 'ghost'))))),
});

F['eng-gut'] = () => ajudaFig({
  titulo: 'Avaliação técnica (GUT)',
  legenda: '① Gravidade · ② Urgência · ③ Tendência · ④ Tipo de atividade · ⑤ Prazo · ⑥ Valor considerado.',
  marcadores: [{ n: 1, top: '28%', left: '18%' }, { n: 2, top: '28%', left: '50%' }, { n: 3, top: '28%', left: '82%' }, { n: 4, top: '52%', left: '27%' }, { n: 5, top: '52%', left: '73%' }, { n: 6, top: '70%', left: '30%' }],
  corpo: card(ctit('Avaliação técnica (GUT)'),
    grid(campo('Gravidade (G)', '4'), campo('Urgência (U)', '4'), campo('Tendência (T)', '3')),
    grid(campo('Tipo de atividade', 'Fiscalização de Obra'), campo('Prazo considerado', '6–12 meses')),
    campo('Valor considerado (R$)', '250.000'),
    check('Bem tombado confirmado', false), check('Serviço emergencial (art. 11, §5º)', false),
    acoes(btn('Salvar avaliação'))),
});

F['eng-prioriz'] = () => ajudaFig({
  titulo: 'Priorização',
  legenda: 'G/U/T, GUT, escores de Valor (V) e Prazo (P), prioridade final e pontos (art. 11).',
  corpo: card(ctit('Priorização'),
    el('div', { class: 'rp-score' }, scoreCell('G', '4'), scoreCell('U', '4'), scoreCell('T', '3'), scoreCell('GUT', '48'), scoreCell('V', '4'), scoreCell('P', '2')),
    el('div', { class: 'rp-final' }, el('span', {}, 'Prioridade final'), el('b', {}, '0,55'))),
});

F['eng-gestao'] = () => ajudaFig({
  titulo: 'Gestão — status',
  legenda: 'A Engenharia aplica os status de triagem: Em análise, Em diligência e o envio ao CODIR.',
  corpo: card(ctit('Gestão'), acoes(btn('Em análise', 'ghost'), btn('Em diligência', 'ghost'), btn('Aguardando CODIR'))),
});

F['eng-travada'] = () => ajudaFig({
  titulo: 'Demanda em atendimento (travada)',
  legenda: 'Em atendimento/concluída: a avaliação e a exclusão ficam bloqueadas.',
  corpo: el('div', {}, el('div', { class: 'rp-topo' }, el('span', { class: 'mono rp-id' }, '2026HII02'), badge('Em atendimento', 'st-atendimento')),
    el('div', { class: 'ajuda-callout atencao', style: 'margin:0' }, el('p', {}, 'A avaliação técnica está travada e a demanda não pode ser excluída.'))),
});

F['eng-alocacao'] = () => ajudaFig({
  titulo: 'Alocação de fiscais',
  legenda: '① Titulares (um ou mais) · ② Substitutos · ③ Equipe de planejamento — cada um com a sua carga.',
  marcadores: [{ n: 1, top: '30%', left: '28%' }, { n: 2, top: '55%', left: '28%' }, { n: 3, top: '80%', left: '30%' }],
  corpo: card(ctit('Alocação'),
    el('div', {}, el('div', { class: 'rp-label' }, 'Fiscais titulares'), chips([{ t: 'Raquel · Civil (4/6)', on: true }, 'Vitor · Civil (6/6)'])),
    el('div', { style: 'margin-top:8px' }, el('div', { class: 'rp-label' }, 'Substitutos'), chips([{ t: 'Rafael · Civil', on: true }])),
    el('div', { style: 'margin-top:8px' }, el('div', { class: 'rp-label' }, 'Equipe de planejamento'), chips(['Allan', 'Suellen'])),
    acoes(btn('Salvar alocação'))),
});

F['eng-carga'] = () => ajudaFig({
  titulo: 'Carga da equipe',
  legenda: 'Pontos por profissional, com barra de uso do limite (art. 12).',
  corpo: card(ctit('Carga da equipe'), cargaLinha('Noé — Elétrica', '6/6', 100), cargaLinha('Raquel — Civil', '4/6', 66), cargaLinha('Pâmella — Arquitetura', '0/6', 6)),
});

F['eng-profissionais'] = () => ajudaFig({
  titulo: 'Profissionais',
  legenda: 'Cartões com a carga individual e o painel de equipes de planejamento (art. 13) por especialidade.',
  corpo: el('div', { class: 'rp-grid' },
    card(el('b', {}, 'Raquel Carvalho'), nota('Engenheira · Civil'), cargaLinha('Carga', '4/6', 66)),
    card(el('b', {}, 'Noé de Lima'), nota('Engenheiro · Elétrica'), cargaLinha('Carga', '6/6', 100))),
});

F['eng-prof-novo'] = () => ajudaFig({
  titulo: 'Novo profissional',
  legenda: '① Usuário (nome/e-mail derivados) · ② Cargo · ③ Área · ④ Observação.',
  marcadores: [{ n: 1, top: '26%', left: '50%' }, { n: 2, top: '50%', left: '27%' }, { n: 3, top: '50%', left: '73%' }, { n: 4, top: '74%', left: '30%' }],
  corpo: card(ctit('Novo profissional'),
    campo('Usuário', 'Raquel Carvalho — raquel@cp2.g12.br'),
    grid(campo('Cargo', 'Engenheiro(a)'), campo('Área', 'Civil')),
    area('Observação', '—'), acoes(btn('Salvar'))),
});

F['eng-parametros'] = () => ajudaFig({
  titulo: 'Parâmetros do sistema',
  legenda: 'Ano do plano, valor de referência, pesos (somam 1,00) e limite de pontos.',
  corpo: card(ctit('Parâmetros'),
    grid(campo('Ano do plano', '2026'), campo('Valor de referência', 'R$ 125.451,15'), campo('Peso GUT', '0,75'), campo('Peso Prazo×Custo', '0,25')),
    campo('Limite de pontos', '6'), acoes(btn('Salvar'))),
});

F['eng-usuarios'] = () => ajudaFig({
  titulo: 'Administração › Usuários',
  legenda: 'Lista de usuários e perfis — aba exclusiva do Administrador.',
  corpo: el('div', {}, el('div', { class: 'rp-filtros' }, chips([{ t: 'Usuários', on: true }, 'Parâmetros', 'Log de auditoria'])),
    card(tabela(['Nome', 'E-mail', 'Perfil'], [
      ['Administração', 'admin@cp2.g12.br', 'Administrador'],
      ['Chefia da SENG', 'chefia@cp2.g12.br', 'Chefe de Seção'],
    ]), acoes(btn('+ Novo usuário')))),
});

F['eng-usuario-novo'] = () => ajudaFig({
  titulo: 'Novo usuário',
  legenda: '① Nome · ② E-mail · ③ Perfil · ④ Campi (só perfil Campus) · ⑤ Senha inicial.',
  marcadores: [{ n: 1, top: '24%', left: '27%' }, { n: 2, top: '24%', left: '73%' }, { n: 3, top: '48%', left: '27%' }, { n: 4, top: '48%', left: '73%' }, { n: 5, top: '70%', left: '30%' }],
  corpo: card(ctit('Novo usuário'),
    grid(campo('Nome', 'Beatriz Antunes'), campo('E-mail', 'beatriz@cp2.g12.br')),
    grid(campo('Perfil', 'Engenharia'), campo('Campi', '—')),
    campo('Senha inicial', '••••••'), acoes(btn('Salvar'))),
});

F['eng-log'] = () => ajudaFig({
  titulo: 'Log de auditoria',
  legenda: 'Trilha imutável de todas as ações (o quê, quando, quem) — só o Administrador vê.',
  corpo: card(tabela(['Quando', 'Quem', 'Ação'], [
    ['08/07 14:22', 'Chefia', 'Alocação atualizada'],
    ['08/07 14:20', 'Noé', 'Avaliação salva'],
  ])),
});

F['ch-painel'] = () => ajudaFig({
  titulo: 'Chamados — triagem da SENG',
  legenda: '① Faixa de SLA (alerta) · ② Baixar PDF · ③ A SENG vê os chamados de todos os campi.',
  marcadores: [{ n: 1, top: '30%', left: '18%' }, { n: 2, top: '11%', left: '90%' }, { n: 3, top: '72%', left: '18%' }],
  corpo: el('div', {}, topbar('Chamados', ['Profissionais']),
    el('div', { class: 'rp-hero' }, el('div', {}, h('Chamados'), nota('Intake e triagem da Engenharia')), acoes(btn('+ Abrir chamado'), btn('Baixar PDF', 'ghost'))),
    el('div', { class: 'rp-slaresumo' }, el('span', { class: 'sla-pill sla-ok' }, '8 no prazo'), el('span', { class: 'sla-pill sla-alerta' }, '2 vencendo'), el('span', { class: 'sla-pill sla-vencido' }, '1 vencido')),
    tabela(['Nº', 'Assunto', 'Campus', 'Status', 'Prazo'], [
      ['CH2026CSCII001', 'Vazamento no banheiro', 'SC II', badge('Em triagem', 'st-analise'), el('span', { class: 'ch-sla sla-ok' }, '3d')],
      ['CH2026CTII001', 'Parecer de estrutura', 'Tijuca II', badge('Aberto', 'st-recebido'), el('span', { class: 'ch-sla sla-alerta' }, '1d')],
    ])),
});

F['ch-triagem'] = () => ajudaFig({
  titulo: 'Triagem do chamado',
  legenda: '① Iniciar triagem / diligência · ② Desfecho · ③ “Obra” abre a classificação da demanda.',
  marcadores: [{ n: 1, top: '17%', left: '28%' }, { n: 2, top: '44%', left: '30%' }, { n: 3, top: '76%', left: '50%' }],
  corpo: card(ctit('Triagem'),
    acoes(btn('Iniciar triagem', 'ghost'), btn('Solicitar diligência', 'ghost')),
    el('div', { style: 'margin-top:10px' }, campo('Decisão da triagem', 'Encaminhar à fila de Obras (vira Demanda)'),
      el('div', { class: 'obra-campos' }, grid(campo('Tipo de demanda', 'Obra / reforma'), campo('Projeto já existe?', 'Não — contratar')),
        el('div', { style: 'margin-top:6px' }, el('div', { class: 'rp-label' }, 'Especialidades'), chips([{ t: 'Engenharia Civil', on: true }, 'Elétrica'])))),
    acoes(btn('Aplicar desfecho'))),
});

// ============================================================================
// CODIR
// ============================================================================
F['codir-painel'] = () => ajudaFig({
  titulo: 'Painel do CODIR',
  legenda: 'Fila ordenada por prioridade, com GUT, prioridade e pontos (Pts).',
  corpo: el('div', {}, topbar('Painel'),
    tabela(['Fila', 'Campus', 'Objeto', 'GUT', 'Prior.', 'Pts'], [
      ['1º', 'Tijuca II', 'Cobertura do Anexo', '80', '0,64', '3'],
      ['2º', 'Duque de Caxias', 'Lab. de informática', '64', '0,61', '2'],
    ])),
});

F['codir-demanda'] = () => ajudaFig({
  titulo: 'Demanda — visão do CODIR',
  legenda: 'Dados e histórico à esquerda; priorização e deliberação à direita.',
  corpo: el('div', { class: 'rp-2col' },
    el('div', {}, card(ctit('Dados'), campo('Objeto', 'Cobertura do Anexo'), campo('Campus', 'Tijuca II'))),
    el('div', {}, card(ctit('Priorização'), el('div', { class: 'rp-final' }, el('span', {}, 'Prioridade'), el('b', {}, '0,64'))), card(ctit('Deliberação do CODIR'), check('Aprovada pelo CODIR', false)))),
});

F['codir-deliberacao'] = () => ajudaFig({
  titulo: 'Deliberação do CODIR',
  legenda: '① Aprovar (entra na fila) · ② Fator de ajuste · ③ Justificativa (obrigatória).',
  marcadores: [{ n: 1, top: '22%', left: '22%' }, { n: 2, top: '46%', left: '30%' }, { n: 3, top: '72%', left: '50%' }],
  corpo: card(ctit('Deliberação do CODIR'),
    check('Aprovada pelo CODIR', true),
    campo('Fator de ajuste', '+0,05'),
    area('Justificativa', 'Relevância institucional e risco de acessibilidade.'),
    acoes(btn('Salvar ajuste'))),
});

F['codir-prioriz-ajuste'] = () => ajudaFig({
  titulo: 'Priorização com ajuste',
  legenda: 'A linha “Ajuste (CODIR)” mostra o valor; a prioridade final é recalculada (marca *).',
  corpo: card(ctit('Priorização'),
    el('div', { class: 'rp-score' }, scoreCell('GUT', '80'), scoreCell('V', '4'), scoreCell('P', '3'), scoreCell('Calc', '0,59'), scoreCell('Ajuste', '+0,05'), scoreCell('Final', '0,64')),
    el('div', { class: 'rp-final' }, el('span', {}, 'Prioridade final'), el('b', {}, '0,64*'))),
});

F['codir-aprovada'] = () => ajudaFig({
  titulo: 'Demanda aprovada',
  legenda: 'Após aprovar e ajustar: entra na fila (com a marca *), histórico atualizado.',
  corpo: el('div', {}, el('div', { class: 'rp-topo' }, el('span', { class: 'mono rp-id' }, '2026CTII01'), badge('Na fila', 'st-fila')),
    el('div', { class: 'ajuda-callout dica', style: 'margin:0' }, el('p', {}, 'Aprovada pelo CODIR · Fator de ajuste +0,05 · agora 1ª na fila.'))),
});
