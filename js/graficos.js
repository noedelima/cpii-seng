// =============================================================================
// Gráficos SVG do Portal da Engenharia — zero dependências, temas claro/escuro
// via variáveis CSS, acessíveis (role=img + aria-label). Usados no Início.
// =============================================================================
const NS = 'http://www.w3.org/2000/svg';
function sv(tag, attrs = {}, ...kids) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  for (const k of kids.flat(Infinity)) if (k != null) n.append(k.nodeType ? k : document.createTextNode(String(k)));
  return n;
}
const CORES = ['var(--primario)', 'var(--acento)', 'var(--ouro-claro)', 'var(--oliva)', 'var(--borda-forte)', 'var(--texto-2)'];

// Barras horizontais: dados = [{ rotulo, valor, cor?, onClick? }]
// Com onClick, a linha inteira é clicável (leva à lista filtrada).
export function barrasH(dados, { rotuloW = 92, larg = 320, alturaBarra = 13, gap = 7, aria = '' } = {}) {
  const max = Math.max(1, ...dados.map(d => d.valor));
  const h = dados.length * (alturaBarra + gap) + 4;
  const svg = sv('svg', { viewBox: `0 0 ${larg} ${h}`, width: '100%', role: 'img', 'aria-label': aria });
  dados.forEach((d, i) => {
    const y = i * (alturaBarra + gap);
    const w = Math.max(2, Math.round((d.valor / max) * (larg - rotuloW - 34)));
    const g = sv('g', d.onClick ? { class: 'graf-clique', role: 'link', tabindex: 0, 'aria-label': `${d.rotulo}: ${d.valor} — ver na lista` } : {},
      sv('rect', { x: 0, y: y - 2, width: larg, height: alturaBarra + 4, fill: 'transparent' }),
      sv('text', { x: rotuloW - 6, y: y + alturaBarra - 3, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--texto-2)' }, d.rotulo),
      sv('rect', { x: rotuloW, y, width: w, height: alturaBarra, rx: 2, fill: d.cor || CORES[i % CORES.length] }),
      sv('text', { x: rotuloW + w + 5, y: y + alturaBarra - 3, 'font-size': 10, fill: 'var(--texto)' }, d.valor));
    if (d.onClick) {
      g.addEventListener('click', d.onClick);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') d.onClick(); });
    }
    svg.append(g);
  });
  return svg;
}

// Boxplot VERTICAL em grupos (v1.28.1): grupos = [{ nome, cor?, itens: [{ rotulo,
// valores: [números] }] }] — todos no MESMO eixo (ex.: dias). Uma caixa por
// etapa, grupos lado a lado com separador; tooltip com o resumo completo.
export function boxplotV(grupos, { alt = 250, aria = '', unidade = 'd' } = {}) {
  const q = (arr, p) => { const a = [...arr].sort((x, y) => x - y); const i = (a.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return a[lo] + (a[hi] - a[lo]) * (i - lo); };
  const fmt = (v) => v >= 10 ? Math.round(v) : Math.round(v * 10) / 10;
  const quebra = (t) => { const p = t.split(' '); if (p.length === 1) return [t];
    let l1 = '', i = 0; const alvo = Math.ceil(t.length / 2);
    while (i < p.length - 1 && (l1 + ' ' + p[i]).trim().length <= alvo + 2) { l1 = (l1 + ' ' + p[i]).trim(); i++; }
    const l2 = p.slice(i).join(' ');
    return l2 ? [l1 || p[0], l2] : [l1]; };
  const todos = grupos.flatMap(g => g.itens);
  const maxV = Math.max(0.5, ...todos.flatMap(d => d.valores));
  const slot = 86, mEsq = 38, mDir = 12, sepW = 30;
  const larg = mEsq + todos.length * slot + (grupos.length - 1) * sepW + mDir;
  const yTop = 16, yBot = alt - 52;
  const y = (v) => yBot - (v / maxV) * (yBot - yTop);
  const svg = sv('svg', { viewBox: `0 0 ${larg} ${alt}`, width: '100%', role: 'img', 'aria-label': aria });
  // faixa de fundo sutil da área do gráfico
  svg.append(sv('rect', { x: mEsq, y: yTop - 8, width: larg - mEsq - mDir, height: yBot - yTop + 16, rx: 6, fill: 'var(--borda)', 'fill-opacity': 0.14 }));
  // linhas de referência (0 a máx em quartos)
  [0, 0.25, 0.5, 0.75, 1].forEach(f => {
    const v = maxV * f;
    svg.append(sv('line', { x1: mEsq + 4, y1: y(v), x2: larg - mDir - 4, y2: y(v), stroke: 'var(--borda)', 'stroke-width': 0.5, 'stroke-dasharray': '2 5' }));
    svg.append(sv('text', { x: mEsq - 5, y: y(v) + 2.5, 'text-anchor': 'end', 'font-size': 8, fill: 'var(--texto-2)' }, `${fmt(v)}${unidade}`));
  });
  let cxBase = mEsq;
  grupos.forEach((g, gi) => {
    const cor = g.cor || ['var(--ouro-claro)', 'var(--acento)'][gi % 2];
    const x0 = cxBase;
    g.itens.forEach((d, i) => {
      // Boxplot de Tukey: whiskers até o último valor dentro das cercas
      // (quartis ± 1,5×IQR); o que fica fora vira OUTLIER (ponto individual).
      const vals = [...d.valores].sort((a, b) => a - b);
      const q1 = q(vals, 0.25), med = q(vals, 0.5), q3 = q(vals, 0.75);
      const iqr = q3 - q1;
      const dentro = vals.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
      const wLo = dentro.length ? dentro[0] : q1;
      const wHi = dentro.length ? dentro[dentro.length - 1] : q3;
      const outliers = vals.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
      const topo = Math.max(wHi, ...outliers, med);
      const cx = cxBase + i * slot + slot / 2;
      const bw = 30;
      const gEl = sv('g', {},
        sv('line', { x1: cx, y1: y(wLo), x2: cx, y2: y(q1), stroke: 'var(--texto-2)', 'stroke-width': 1, 'stroke-linecap': 'round' }),
        sv('line', { x1: cx, y1: y(q3), x2: cx, y2: y(wHi), stroke: 'var(--texto-2)', 'stroke-width': 1, 'stroke-linecap': 'round' }),
        sv('line', { x1: cx - 4, y1: y(wLo), x2: cx + 4, y2: y(wLo), stroke: 'var(--texto-2)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
        sv('line', { x1: cx - 4, y1: y(wHi), x2: cx + 4, y2: y(wHi), stroke: 'var(--texto-2)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }),
        sv('rect', { x: cx - bw / 2, y: y(q3), width: bw, height: Math.max(2.5, y(q1) - y(q3)), rx: 3, fill: cor, 'fill-opacity': 0.92, stroke: 'var(--borda-forte)', 'stroke-width': 0.7 }),
        sv('line', { x1: cx - bw / 2 + 3, y1: y(med), x2: cx + bw / 2 - 3, y2: y(med), stroke: 'var(--primario)', 'stroke-width': 2.4, 'stroke-linecap': 'round' }),
        outliers.map((v, oi) => sv('circle', { cx: cx + ((oi % 3) - 1) * 4, cy: y(v), r: 2.4, fill: cor, 'fill-opacity': 0.9, stroke: 'var(--borda-forte)', 'stroke-width': 0.6 })),
        sv('text', { x: cx, y: y(topo) - 5, 'text-anchor': 'middle', 'font-size': 8.5, 'font-weight': 'bold', fill: 'var(--texto)' }, `${fmt(med)}${unidade}`));
      gEl.append(sv('title', {}, `${g.nome} — ${d.rotulo}: mediana ${fmt(med)}${unidade} · quartis ${fmt(q1)}–${fmt(q3)}${unidade} · whiskers ${fmt(wLo)}–${fmt(wHi)}${unidade}${outliers.length ? ` · ${outliers.length} outlier(s) até ${fmt(Math.max(...outliers))}${unidade}` : ''} · ${vals.length} registro(s)`));
      svg.append(gEl);
      // rótulo horizontal em até 2 linhas + contagem
      const linhas = quebra(d.rotulo);
      const tx = sv('text', { x: cx, y: yBot + 12, 'text-anchor': 'middle', 'font-size': 8.5, fill: 'var(--texto-2)' });
      linhas.forEach((l, li) => tx.append(sv('tspan', { x: cx, dy: li === 0 ? 0 : 9 }, l)));
      tx.append(sv('tspan', { x: cx, dy: 9, 'font-size': 8, fill: 'var(--texto-2)' }, `(${vals.length})`));
      svg.append(tx);
    });
    const wGrupo = g.itens.length * slot;
    // nome do grupo com traço na cor correspondente (legenda de cor)
    svg.append(sv('line', { x1: x0 + wGrupo / 2 - 26, y1: alt - 8.5, x2: x0 + wGrupo / 2 - 14, y2: alt - 8.5, stroke: cor, 'stroke-width': 4, 'stroke-linecap': 'round' }));
    svg.append(sv('text', { x: x0 + wGrupo / 2 + 4, y: alt - 5, 'text-anchor': 'middle', 'font-size': 9.5, 'font-weight': 'bold', fill: 'var(--texto)' }, g.nome));
    cxBase += wGrupo;
    if (gi < grupos.length - 1) {
      svg.append(sv('line', { x1: cxBase + sepW / 2, y1: yTop - 6, x2: cxBase + sepW / 2, y2: yBot + 8, stroke: 'var(--borda)', 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
      cxBase += sepW;
    }
  });
  return svg;
}

// Linhas mensais: series = [{ nome, cor, pontos: [{ mes: 'jan', valor }] }]
export function linhasMensais(series, { larg = 360, alt = 120, aria = '' } = {}) {
  const svg = sv('svg', { viewBox: `0 0 ${larg} ${alt}`, width: '100%', role: 'img', 'aria-label': aria });
  const n = Math.max(2, series[0]?.pontos.length || 2);
  const max = Math.max(1, ...series.flatMap(s => s.pontos.map(p => p.valor)));
  const x = (i) => 8 + i * ((larg - 16) / (n - 1));
  const y = (v) => 8 + (1 - v / max) * (alt - 34);
  for (const s of series) {
    const pts = s.pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
    svg.append(sv('polyline', { points: pts, fill: 'none', stroke: s.cor, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
  }
  const meses = series[0]?.pontos || [];
  [0, Math.floor((n - 1) / 2), n - 1].forEach(i => {
    if (meses[i]) svg.append(sv('text', { x: x(i), y: alt - 4, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle', 'font-size': 9, fill: 'var(--texto-2)' }, meses[i].mes));
  });
  return svg;
}

export function legenda(series) {
  const NSH = document.createElement('div');
  NSH.className = 'graf-legenda';
  for (const s of series) {
    const item = document.createElement('span');
    const sw = document.createElement('span');
    sw.className = 'graf-swatch'; sw.style.background = s.cor;
    item.append(sw, ' ' + s.nome);
    NSH.append(item);
  }
  return NSH;
}

// Donut: dados = [{ rotulo, valor }] — rótulos na lateral.
export function donut(dados, { raio = 44, espessura = 15, aria = '' } = {}) {
  const total = Math.max(1, dados.reduce((a, d) => a + d.valor, 0));
  const C = raio + 4;
  const svg = sv('svg', { viewBox: `0 0 ${C * 2} ${C * 2}`, width: '110', role: 'img', 'aria-label': aria });
  let ang = -Math.PI / 2;
  dados.forEach((d, i) => {
    const frac = d.valor / total;
    const a2 = ang + frac * Math.PI * 2;
    const large = frac > 0.5 ? 1 : 0;
    const p = (a) => [C + raio * Math.cos(a), C + raio * Math.sin(a)];
    const [x1, y1] = p(ang), [x2, y2] = p(a2);
    if (frac > 0.001) svg.append(sv('path', {
      d: `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${raio} ${raio} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
      fill: 'none', stroke: CORES[i % CORES.length], 'stroke-width': espessura,
    }));
    ang = a2;
  });
  svg.append(sv('text', { x: C, y: C + 4, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, fill: 'var(--texto)' }, String(total)));
  const wrap = document.createElement('div');
  wrap.className = 'graf-donut';
  const lista = document.createElement('div');
  lista.className = 'graf-donut-lista';
  dados.forEach((d, i) => {
    const item = document.createElement(d.onClick ? 'button' : 'div');
    if (d.onClick) { item.className = 'graf-item-clique'; item.type = 'button'; item.onclick = d.onClick; }
    const sw = document.createElement('span');
    sw.className = 'graf-swatch'; sw.style.background = CORES[i % CORES.length];
    item.append(sw, ` ${d.rotulo} — ${d.valor}`);
    lista.append(item);
  });
  wrap.append(svg, lista);
  return wrap;
}
