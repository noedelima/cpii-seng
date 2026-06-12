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
    const close = (v) => { wrap.remove(); resolve(v); };
    const wrap = el('div', { class: 'modal-wrap', onclick: (e) => e.target === wrap && close(false) },
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
        el('h3', {}, titulo),
        el('p', {}, texto),
        el('div', { class: 'modal-acoes' },
          el('button', { class: 'btn ghost', onclick: () => close(false) }, 'Cancelar'),
          el('button', { class: `btn ${perigo ? 'perigo' : 'primario'}`, onclick: () => close(true) }, ok),
        )));
    document.body.append(wrap);
    wrap.querySelector('button.ghost').focus();
  });
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
export const badgeStatus = (id) => el('span', { class: `badge ${statusCor(id)}` }, statusNome(id));

// --- Barra de pontos (carga do profissional) -------------------------------------
export function barraPontos(usados, limite, emergencial = 0) {
  const pct = Math.min(100, (usados / limite) * 100);
  const cls = usados > limite ? 'cheia' : (usados >= limite ? 'limite' : '');
  return el('div', { class: 'pontos-barra', title: `${usados} de ${limite} pontos${emergencial ? ` (+${emergencial} emergencial)` : ''}` },
    el('div', { class: `pontos-fill ${cls}`, style: `width:${pct}%` }));
}

export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
