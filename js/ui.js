// =============================================================================
// SENG Demandas — Utilitários de interface (sem dependências)
// Segurança: todo conteúdo dinâmico entra via textContent/atributos, nunca HTML.
// =============================================================================

// Cria elemento: el('div', {class:'x', onclick:fn}, filho1, 'texto', ...)
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const frag = (...kids) => { const f = document.createDocumentFragment(); kids.flat(Infinity).forEach(k => k != null && f.append(k)); return f; };

// --- Formatadores -----------------------------------------------------------
export const fmtMoeda = (v) => (v == null || v === '' || isNaN(v)) ? '—'
  : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
export const fmtData = (ts) => ts ? new Date(ts).toLocaleDateString('pt-BR') : '—';
export const fmtDataHora = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
export const fmtNum = (v, dec = 2) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// --- Toast (feedback não bloqueante) -----------------------------------------
let toastTimer;
export function toast(msg, tipo = 'ok') {
  let t = document.getElementById('toast');
  if (!t) { t = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.append(t); }
  t.textContent = msg;
  t.className = `show ${tipo}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = ''; }, 3600);
}

// --- Modal de confirmação -----------------------------------------------------
export function confirmar(titulo, texto, { ok = 'Confirmar', perigo = false } = {}) {
  return new Promise((resolve) => {
    const esc = (e) => { if (e.key === 'Escape') close(false); };
    const close = (v) => { document.removeEventListener('keydown', esc); wrap.remove(); resolve(v); };
    const wrap = el('div', { class: 'modal-wrap', onclick: (e) => e.target === wrap && close(false) },
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
        el('h3', {}, titulo),
        el('p', {}, texto),
        el('div', { class: 'modal-acoes' },
          el('button', { class: 'btn ghost', onclick: () => close(false) }, 'Cancelar'),
          el('button', { class: `btn ${perigo ? 'perigo' : 'primario'}`, onclick: () => close(true) }, ok),
        )));
    document.addEventListener('keydown', esc);
    document.body.append(wrap);
    wrap.querySelector('button.ghost').focus();
  });
}

// --- Pré-visualização de anexo (imagem ou PDF) ---------------------------------
// Lightbox acessível: fecha no ✕, no ESC e no clique fora; oferece "abrir em
// nova aba" (download/zoom nativo). Imagem exibe direto; PDF via iframe (CSP
// libera frame-src apenas para o Firebase Storage).
export function previewAnexo(a) {
  const ehImg = (a.tipo || '').indexOf('image/') === 0;
  const esc = (e) => { if (e.key === 'Escape') close(); };
  const close = () => { document.removeEventListener('keydown', esc); wrap.remove(); };
  const corpo = ehImg
    ? el('img', { class: 'lightbox-img', src: a.url, alt: a.nome })
    : el('iframe', { class: 'lightbox-pdf', src: a.url, title: a.nome });
  const titulo = a.titulo || a.nome;
  const wrap = el('div', { class: 'modal-wrap', onclick: (e) => e.target === wrap && close() },
    el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
      el('div', { class: 'lightbox-topo' },
        el('span', { class: 'lightbox-nome', title: `${titulo} (${a.nome})` }, titulo),
        el('a', { class: 'btn ghost sm', href: a.url, target: '_blank', rel: 'noopener' }, 'Abrir em nova aba'),
        el('button', { class: 'btn ghost sm', onclick: close, 'aria-label': 'Fechar' }, '✕')),
      a.descricao ? el('p', { class: 'lightbox-desc' }, a.descricao) : null,
      corpo));
  document.addEventListener('keydown', esc);
  document.body.append(wrap);
}

// --- Campos de formulário ------------------------------------------------------
export function campo(labelTxt, inputEl, hint) {
  const wrap = el('label', { class: 'campo' }, el('span', { class: 'campo-label' }, labelTxt), inputEl);
  if (hint) wrap.append(el('span', { class: 'campo-hint' }, hint));
  return wrap;
}

export function select(opcoes, { value = '', placeholder = 'Selecione…', ...attrs } = {}) {
  const s = el('select', attrs);
  if (placeholder !== null) s.append(el('option', { value: '' }, placeholder));
  for (const o of opcoes) {
    const opt = el('option', { value: o.id ?? o.v ?? o }, o.nome ?? o.t ?? o);
    s.append(opt);
  }
  s.value = value ?? '';
  return s;
}

// --- Badge de status ------------------------------------------------------------
import { statusNome, statusCor } from './config.js';

// --- Indicador de ausência (v1.29.4) -----------------------------------------
// Selo com ampulheta para os cartões de profissional: tom de alerta quando há
// ausência VIGENTE (férias, licença etc.); versão discreta (dourada) quando a
// próxima ausência começa em até `diasAviso` dias — mesma janela usada nos
// seletores de alocação (notaAusencia). Detalhes (tipo e período) no tooltip e
// no aria-label. SVG montado via DOM (createElementNS) — sem innerHTML, na
// linha da regra de segurança deste módulo.
import { ausenciaAtual, proximaAusencia, tipoAusenciaNome } from './config.js';
export function badgeAusencia(p, diasAviso = 15) {
  const atual = ausenciaAtual(p);
  const prox = atual ? null : proximaAusencia(p);
  const emBreve = prox && (prox.inicio - Date.now() <= diasAviso * 86400000);
  if (!atual && !emBreve) return null;
  const a = atual || prox;
  const dt = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const titulo = atual
    ? `${tipoAusenciaNome(a.tipo)} — ausente até ${dt(a.fim)}`
    : `${tipoAusenciaNome(a.tipo)} prevista: ${dt(a.inicio)} a ${dt(a.fim)}`;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: '13', height: '13',
    fill: 'none', stroke: 'currentColor', 'stroke-width': '2.2', 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', 'M6 3h12M6 21h12M8 3v3.5a4 4 0 0 0 1.6 3.2L12 12l-2.4 2.3A4 4 0 0 0 8 17.5V21M16 3v3.5a4 4 0 0 1-1.6 3.2L12 12l2.4 2.3a4 4 0 0 1 1.6 3.2V21');
  svg.append(path);
  return el('span', { class: `badge-ausencia${atual ? '' : ' prevista'}`, title: titulo,
    role: 'img', 'aria-label': titulo }, svg);
}

export const badgeStatus = (id) => el('span', { class: `badge ${statusCor(id)}` }, statusNome(id));

// --- Barra de pontos (carga do profissional) -------------------------------------
export function barraPontos(usados, limite, emergencial = 0) {
  const pct = Math.min(100, (usados / limite) * 100);
  const cls = usados > limite ? 'cheia' : (usados >= limite ? 'limite' : '');
  return el('div', { class: 'pontos-barra', title: `${usados} de ${limite} pontos${emergencial ? ` (+${emergencial} emergencial)` : ''}` },
    el('div', { class: `pontos-fill ${cls}`, style: `width:${pct}%` }));
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// Abrevia nomes do meio p/ caber em uma linha: "Ana Maria de Souza Lima" -> "Ana M. de Souza Lima"
export function abreviarNome(nome) {
  if (!nome) return '';
  const conect = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  const t = String(nome).trim().split(' ').filter(Boolean);
  if (t.length <= 2) return t.join(' ');
  return t.map((p, i) => (i === 0 || i === t.length - 1) ? p
    : (conect.has(p.toLowerCase()) ? p.toLowerCase() : p[0].toUpperCase() + '.')).join(' ');
}
