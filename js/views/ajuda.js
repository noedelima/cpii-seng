// =============================================================================
// Ajuda — manuais (Campus, Engenharia, CODIR) renderizados a partir de Markdown.
// Conteúdo confiável e embutido no repositório (docs/ajuda/*.md). Renderização
// monta nós do DOM (sem innerHTML) — coerente com a política de segurança.
// =============================================================================
import { el, frag } from '../ui.js';

const MANUAIS = [
  { id: 'campus', rotulo: 'Campus', arq: 'docs/ajuda/Manual-Campus.md' },
  { id: 'engenharia', rotulo: 'Engenharia', arq: 'docs/ajuda/Manual-Engenharia.md' },
  { id: 'codir', rotulo: 'CODIR', arq: 'docs/ajuda/Manual-CODIR.md' },
];
let abaAtual = 'campus';
const cache = {};

// ---- Markdown → nós do DOM (subconjunto usado nos manuais) -----------------
function inline(txt) {
  // imagem inline não ocorre aqui (tratada por bloco); trata **negrito**, *itálico*, `código`, [texto](url)
  const out = [];
  let i = 0;
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/;
  while (i < txt.length) {
    const m = re.exec(txt.slice(i));
    if (!m) { out.push(txt.slice(i)); break; }
    if (m.index > 0) out.push(txt.slice(i, i + m.index));
    if (m[2] != null) out.push(el('strong', {}, m[2]));
    else if (m[3] != null) out.push(el('em', {}, m[3]));
    else if (m[4] != null) out.push(el('code', {}, m[4]));
    else if (m[5] != null) out.push(el('a', { href: m[6], target: '_blank', rel: 'noopener' }, m[5]));
    i += m.index + m[1].length;
  }
  return out;
}

export function mdToNodes(md) {
  const linhas = md.replace(/\r/g, '').split('\n');
  const nodes = [];
  let i = 0;
  const ehTabelaSep = (s) => /^\s*\|?[\s:|-]+\|?\s*$/.test(s) && s.includes('-');
  const celulas = (s) => s.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
  while (i < linhas.length) {
    let ln = linhas[i];
    if (!ln.trim()) { i++; continue; }
    // título
    let mh = /^(#{1,6})\s+(.*)$/.exec(ln);
    if (mh) { const n = Math.min(5, mh[1].length + 1); nodes.push(el('h' + n, {}, inline(mh[2]))); i++; continue; }
    // hr
    if (/^---+$/.test(ln.trim())) { nodes.push(el('hr', {})); i++; continue; }
    // imagem (linha própria) + legenda itálica seguinte
    let mi = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(ln.trim());
    if (mi) {
      const fig = el('figure', { class: 'ajuda-fig' }, el('img', { class: 'ajuda-img', src: mi[2], alt: mi[1], loading: 'lazy' }));
      if (linhas[i + 1] && /^\*[^*].*\*\s*$/.test(linhas[i + 1].trim())) {
        fig.append(el('figcaption', {}, inline(linhas[i + 1].trim().replace(/^\*|\*$/g, ''))));
        i++;
      }
      nodes.push(fig); i++; continue;
    }
    // citação
    if (/^>\s?/.test(ln)) {
      const buf = [];
      while (i < linhas.length && /^>\s?/.test(linhas[i])) { buf.push(linhas[i].replace(/^>\s?/, '')); i++; }
      nodes.push(el('blockquote', {}, ...buf.map((b, k) => el('p', {}, inline(b)))));
      continue;
    }
    // tabela
    if (ln.includes('|') && linhas[i + 1] && ehTabelaSep(linhas[i + 1])) {
      const head = celulas(ln);
      i += 2;
      const corpo = [];
      while (i < linhas.length && linhas[i].includes('|') && linhas[i].trim()) { corpo.push(celulas(linhas[i])); i++; }
      nodes.push(el('div', { class: 'tabela-wrap' }, el('table', { class: 'tabela ajuda-tabela' },
        el('thead', {}, el('tr', {}, head.map(h => el('th', {}, inline(h))))),
        el('tbody', {}, corpo.map(r => el('tr', {}, r.map(c => el('td', {}, inline(c)))))))));
      continue;
    }
    // listas
    if (/^\s*[-*]\s+/.test(ln)) {
      const itens = [];
      while (i < linhas.length && /^\s*[-*]\s+/.test(linhas[i])) { itens.push(linhas[i].replace(/^\s*[-*]\s+/, '')); i++; }
      nodes.push(el('ul', {}, itens.map(t => el('li', {}, inline(t))))); continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const itens = [];
      while (i < linhas.length && /^\s*\d+\.\s+/.test(linhas[i])) { itens.push(linhas[i].replace(/^\s*\d+\.\s+/, '')); i++; }
      nodes.push(el('ol', {}, itens.map(t => el('li', {}, inline(t))))); continue;
    }
    // legenda solta (itálico) → parágrafo em itálico
    if (/^\*[^*].*\*\s*$/.test(ln.trim())) { nodes.push(el('p', { class: 'ajuda-cap' }, el('em', {}, ln.trim().replace(/^\*|\*$/g, '')))); i++; continue; }
    // parágrafo
    const buf = [ln];
    i++;
    while (i < linhas.length && linhas[i].trim() && !/^(#{1,6}\s|>|\s*[-*]\s|\s*\d+\.\s|!\[|---+$)/.test(linhas[i]) && !(linhas[i].includes('|') && linhas[i + 1] && ehTabelaSep(linhas[i + 1]))) {
      buf.push(linhas[i]); i++;
    }
    nodes.push(el('p', {}, inline(buf.join(' '))));
  }
  return nodes;
}

export function viewAjuda(rerender) {
  const barra = el('nav', { class: 'abas', 'aria-label': 'Manuais' },
    MANUAIS.map(m => el('button', {
      class: `aba ${m.id === abaAtual ? 'ativo' : ''}`, type: 'button',
      onclick: () => { abaAtual = m.id; rerender(); },
    }, m.rotulo)));

  const doc = el('article', { class: 'ajuda-doc card' }, el('p', { class: 'sub' }, 'Carregando o manual…'));
  const man = MANUAIS.find(m => m.id === abaAtual);

  const render = (md) => doc.replaceChildren(...mdToNodes(md));
  if (cache[man.id]) render(cache[man.id]);
  else {
    fetch(man.arq).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
      .then(md => { cache[man.id] = md; if (man.id === abaAtual) render(md); })
      .catch(err => doc.replaceChildren(el('p', { class: 'nota' }, 'Não foi possível carregar o manual (' + err.message + ').')));
  }

  return frag(
    el('section', { class: 'hero' }, el('div', {},
      el('h1', {}, 'Ajuda'),
      el('p', { class: 'sub' }, 'Manuais de uso do sistema, por perfil. Conteúdo também disponível para impressão/distribuição.'))),
    barra,
    doc,
  );
}
