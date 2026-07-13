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

// Barras horizontais: dados = [{ rotulo, valor, cor? }]
export function barrasH(dados, { rotuloW = 92, larg = 320, alturaBarra = 13, gap = 7, aria = '' } = {}) {
  const max = Math.max(1, ...dados.map(d => d.valor));
  const h = dados.length * (alturaBarra + gap) + 4;
  const svg = sv('svg', { viewBox: `0 0 ${larg} ${h}`, width: '100%', role: 'img', 'aria-label': aria });
  dados.forEach((d, i) => {
    const y = i * (alturaBarra + gap);
    const w = Math.max(2, Math.round((d.valor / max) * (larg - rotuloW - 34)));
    svg.append(
      sv('text', { x: rotuloW - 6, y: y + alturaBarra - 3, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--texto-2)' }, d.rotulo),
      sv('rect', { x: rotuloW, y, width: w, height: alturaBarra, rx: 2, fill: d.cor || CORES[i % CORES.length] }),
      sv('text', { x: rotuloW + w + 5, y: y + alturaBarra - 3, 'font-size': 10, fill: 'var(--texto)' }, d.valor));
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
    const item = document.createElement('div');
    const sw = document.createElement('span');
    sw.className = 'graf-swatch'; sw.style.background = CORES[i % CORES.length];
    item.append(sw, ` ${d.rotulo} — ${d.valor}`);
    lista.append(item);
  });
  wrap.append(svg, lista);
  return wrap;
}
