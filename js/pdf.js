// =============================================================================
// SENG Demandas — Relatório PDF efêmero (gera e baixa; nada é armazenado)
// Papel timbrado do CP2, data/hora de geração, filtros aplicados.
// jsPDF + AutoTable carregados sob demanda (CDN) apenas ao clicar em "PDF".
// =============================================================================
import { TIMBRE_H, TIMBRE_RATIO } from './logos.js';
import { campusNome, statusNome, TIPOS_ATIVIDADE, APP } from './config.js';
import { pontosArt11, fiscaisDe } from './calc.js';

let libs = null;
async function carregarLibs() {
  if (libs) return libs;
  await Promise.all([
    importScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js'),
    null,
  ]);
  await importScript('https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js');
  libs = window.jspdf;
  return libs;
}
function importScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Falha ao carregar biblioteca PDF.'));
    document.head.append(s);
  });
}

const tipoAtvNome = (id) => (TIPOS_ATIVIDADE.find(t => t.id === id) || {}).nome || '—';

/**
 * Gera o relatório da fila de demandas.
 * @param {Object} opts
 *   demandas      — lista já filtrada e ordenada (com posição implícita)
 *   params        — parâmetros de cálculo
 *   filtros       — descrição textual dos filtros aplicados
 *   autenticado   — inclui colunas de alocação de profissionais
 *   internas/profissionais — para resolver nomes quando autenticado
 */
export async function gerarRelatorio({ demandas, params, filtros, autenticado, internas = {}, profissionais = [] }) {
  const { jsPDF } = await carregarLibs();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const agora = new Date();
  const carimbo = agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

  // --- Papel timbrado -----------------------------------------------------
  const timbreW = 64, timbreH = timbreW * TIMBRE_RATIO;
  const cabecalho = () => {
    doc.addImage(TIMBRE_H, 'PNG', M, 9, timbreW, timbreH);
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(90);
    doc.text(['Diretoria de Engenharia, Contratos e Fiscalização — DECOF', 'Seção de Engenharia — SENG'], W - M, 13, { align: 'right' });
    doc.setDrawColor(166, 146, 90).setLineWidth(0.5);
    doc.line(M, 11 + timbreH, W - M, 11 + timbreH);
  };
  const rodape = (pag, total) => {
    doc.setFontSize(7.5).setTextColor(120);
    doc.text(`${APP.portaria} · Relatório efêmero gerado em ${carimbo} — não armazenado pelo sistema.`, M, H - 8);
    doc.text(`Página ${pag} de ${total}`, W - M, H - 8, { align: 'right' });
  };

  cabecalho();
  let y = 16 + timbreH;
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(35, 40, 30);
  doc.text('Fila de Demandas de Obras e Serviços de Engenharia', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80);
  doc.text(`Gerado em ${carimbo} · ${demandas.length} demanda(s)`, M, y);
  y += 5;
  if (filtros) { doc.text(`Filtros: ${filtros}`, M, y, { maxWidth: W - 2 * M }); y += 5; }
  if (!autenticado) { doc.setTextColor(140); doc.text('Versão pública — não exibe a alocação de profissionais.', M, y); y += 5; }

  // --- Tabela ----------------------------------------------------------------
  const nomeProf = (pid) => (profissionais.find(p => p.id === pid) || {}).nome || '—';
  const head = ['#', 'Campus', 'Objeto', 'Tipo de atividade', 'Status', 'Pts'];
  if (autenticado) head.push('Fiscal técnico (tit./subst.)');

  const body = demandas.map((d, i) => {
    const pts = pontosArt11(d.aval, params.valorRef);
    const row = [
      String(i + 1), campusNome(d.campus), d.objeto || '—',
      tipoAtvNome(d.aval?.tipoAtividade), statusNome(d.status),
      pts == null ? '—' : String(pts),
    ];
    if (autenticado) {
      const it = internas[d.id] || {};
      const ff = fiscaisDe(it);
      const fiscais = [...ff.titulares.map(nomeProf), ...ff.substitutos.map(nomeProf)]
        .filter(Boolean).join(' / ');
      const eq = (it.equipePlanejamento || []).map(nomeProf).join(', ');
      row.push(fiscais || (eq ? `Equipe: ${eq}` : '—'));
    }
    return row;
  });

  doc.autoTable({
    head: [head], body,
    startY: y + 2, margin: { left: M, right: M, top: 14 + timbreH, bottom: 14 },
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 1.6, textColor: [45, 48, 40], lineColor: [210, 205, 190], lineWidth: 0.15 },
    headStyles: { fillColor: [62, 74, 46], textColor: 255, fontStyle: 'bold', fontSize: 7.8 },
    alternateRowStyles: { fillColor: [247, 246, 241] },
    columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 2: { cellWidth: autenticado ? 62 : 80 }, 5: { halign: 'center', cellWidth: 9 } },
    didDrawPage: () => cabecalho(),
  });

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); rodape(p, total); }

  const stamp = agora.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  doc.save(`fila-demandas-seng-${stamp}.pdf`);
}
