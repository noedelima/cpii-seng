// =============================================================================
// SENG Demandas — Relatório PDF efêmero (gera e baixa; nada é armazenado)
// Papel timbrado do CP2, data/hora de geração, filtros aplicados.
// jsPDF + AutoTable carregados sob demanda (CDN) apenas ao clicar em "PDF".
// =============================================================================
import { TIMBRE_H, TIMBRE_RATIO } from './logos.js';
import { campusNome, statusNome, TIPOS_ATIVIDADE, APP, statusChamadoNome, categoriaChamadoNome, slaChamado, faseCurta } from './config.js';
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
export async function gerarRelatorio({ demandas, chamados = [], params, filtros, autenticado, internas = {}, profissionais = [] }) {
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
    // Em atendimento, o status ganha a fase do ciclo da contratação (workflow v2).
    const statusTxt = d.status === 'atendimento' && d.fase
      ? `${statusNome(d.status)} — ${faseCurta(d.fase)}` : statusNome(d.status);
    const row = [
      String(i + 1), campusNome(d.campus), d.objeto || '—',
      tipoAtvNome(d.aval?.tipoAtividade), statusTxt,
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

  // Chamados em atendimento (fila unificada): entram no bloco “Em atendimento”,
  // logo após as demandas desse status — mesma ordem exibida no painel.
  if (chamados.length) {
    const rowsCh = chamados.map(ch => {
      const row = ['—', campusNome(ch.campus), `${ch.assunto || ch.id} [CHAMADO]`,
        'Chamado (consultoria/laudo)', statusChamadoNome(ch.status), '—'];
      if (autenticado) row.push((ch.atendentes || []).map(nomeProf).filter(Boolean).join(' / ') || '—');
      return row;
    });
    let corte = 0;
    demandas.forEach((d, i) => { if (d.status === 'atendimento') corte = i + 1; });
    body.splice(corte, 0, ...rowsCh);
  }

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

// =============================================================================
// Relatório PDF dos CHAMADOS (efêmero) — mesma identidade da fila.
// =============================================================================
export async function gerarRelatorioChamados({ chamados, filtros }) {
  const { jsPDF } = await carregarLibs();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 14;
  const agora = new Date();
  const carimbo = agora.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
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
  doc.text('Chamados — Intake e Triagem da Seção de Engenharia', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(80);
  doc.text(`Gerado em ${carimbo} · ${chamados.length} chamado(s)`, M, y);
  y += 5;
  if (filtros) { doc.text(`Filtros: ${filtros}`, M, y, { maxWidth: W - 2 * M }); y += 5; }

  const head = ['Nº', 'Campus', 'Categoria', 'Assunto', 'Status', 'Prazo (SLA)', 'Atualizado'];
  const body = chamados.map(c => {
    const sla = slaChamado(c);
    const prazo = sla.estado === 'vencido' ? `atrasado ${Math.abs(sla.dias)}d`
      : sla.estado === 'pausado' ? `pausado · ${sla.dias}d`
      : sla.estado === 'encerrado' ? '—' : `${sla.dias}d`;
    return [c.id, campusNome(c.campus), categoriaChamadoNome(c.categoria), c.assunto || '—',
      statusChamadoNome(c.status), prazo, new Date(c.atualizadoEm || c.aberturaEm).toLocaleDateString('pt-BR')];
  });
  doc.autoTable({
    head: [head], body, startY: y + 2, margin: { left: M, right: M, top: 14 + timbreH, bottom: 14 },
    styles: { font: 'helvetica', fontSize: 7.6, cellPadding: 1.6, textColor: [45, 48, 40], lineColor: [210, 205, 190], lineWidth: 0.15 },
    headStyles: { fillColor: [62, 74, 46], textColor: 255, fontStyle: 'bold', fontSize: 7.8 },
    alternateRowStyles: { fillColor: [247, 246, 241] },
    columnStyles: { 0: { cellWidth: 26 }, 3: { cellWidth: 50 }, 5: { halign: 'center', cellWidth: 20 }, 6: { cellWidth: 20 } },
    didDrawPage: () => cabecalho(),
  });
  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); rodape(p, total); }
  const stamp = agora.toISOString().slice(0, 16).replace(/[:T]/g, '-');
  doc.save(`chamados-seng-${stamp}.pdf`);
}

// =============================================================================
// MINUTA de Nota Técnica a partir de um chamado (desfecho consultoria/laudo).
// Estrutura DECOF-SENG (ver skill ia-engenharia). É rascunho: revisar/numerar
// antes de assinar. Efêmera — não armazenada.
// =============================================================================
export async function gerarNotaTecnicaChamado({ chamado, assinante = {} }) {
  const { jsPDF } = await carregarLibs();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 20;
  const agora = new Date();
  const ano = agora.getFullYear();
  const timbreW = 64, timbreH = timbreW * TIMBRE_RATIO;
  const cabecalho = () => {
    doc.addImage(TIMBRE_H, 'PNG', M, 9, timbreW, timbreH);
    doc.setDrawColor(166, 146, 90).setLineWidth(0.5);
    doc.line(M, 11 + timbreH, W - M, 11 + timbreH);
  };
  const rodape = (pag, total) => {
    doc.setFontSize(7.5).setTextColor(120);
    doc.text('Minuta gerada pelo Portal da Engenharia — revisar e numerar antes de assinar. Não armazenada pelo sistema.', M, H - 8);
    doc.text(`Página ${pag} de ${total}`, W - M, H - 8, { align: 'right' });
  };
  cabecalho();
  let y = 14 + timbreH + 8;
  const par = (txt, o = {}) => {
    const size = o.size || 10, style = o.style || 'normal', gap = o.gap == null ? 4 : o.gap;
    const color = o.color || [30, 30, 30], align = o.align || 'left';
    doc.setFont('helvetica', style).setFontSize(size).setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(String(txt), W - 2 * M);
    for (const ln of lines) {
      if (y > H - 24) { doc.addPage(); cabecalho(); y = 14 + timbreH + 8; }
      if (align === 'center') doc.text(ln, W / 2, y, { align: 'center' });
      else doc.text(ln, M, y);
      y += size * 0.42 + 1.7;
    }
    y += gap;
  };
  const secao = (t) => par(t, { size: 11, style: 'bold', gap: 2 });

  par('MINISTÉRIO DA EDUCAÇÃO — COLÉGIO PEDRO II', { size: 9, style: 'bold', align: 'center', gap: 1, color: [80, 80, 80] });
  par('Diretoria de Engenharia, Contratos e Fiscalização — Seção de Engenharia (DECOF/SENG)', { size: 9, align: 'center', gap: 7, color: [80, 80, 80] });
  doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(35, 40, 30);
  doc.text(`NOTA TÉCNICA Nº ______/${ano}/DECOF-SENG`, W / 2, y, { align: 'center' }); y += 9;

  const catNome = categoriaChamadoNome(chamado.categoria);
  par(`Assunto: ${chamado.assunto || '—'} (${catNome}).`, { style: 'bold', gap: 2 });
  par(`Referência: Chamado ${chamado.id} — Campus ${campusNome(chamado.campus)}${chamado.demandaId ? ' — Demanda ' + chamado.demandaId : ''}. Solicitante: ${chamado.autor?.nome || '—'}.`, { gap: 6 });

  secao('1. DA INTRODUÇÃO E DO HISTÓRICO');
  par(`Trata-se de chamado registrado nesta Seção de Engenharia em ${chamado.aberturaEm ? new Date(chamado.aberturaEm).toLocaleDateString('pt-BR') : '—'}, referente a ${chamado.assunto || '—'}, no âmbito do Campus ${campusNome(chamado.campus)}. Relato do solicitante: ${chamado.descricao || '—'}`);

  secao('2. DA ANÁLISE TÉCNICA');
  par(chamado.resolucao?.texto || '(Descrever a análise técnica realizada, os elementos vistoriados e a fundamentação normativa aplicável — ABNT/NR pertinentes.)');

  secao('3. DA CONCLUSÃO E DA RECOMENDAÇÃO');
  const trilha = chamado.desfecho === 'laudo' ? 'laudo/avaliação técnica' : 'consultoria/assessoria técnica';
  par(`Diante do exposto, esta Seção de Engenharia conclui pela trilha de ${trilha}, recomendando as providências indicadas na análise técnica acima${chamado.resolucao?.setor ? ', com encaminhamento a ' + chamado.resolucao.setor : ''}. Recomenda-se dar ciência ao solicitante e o subsequente arquivamento do chamado.`, { gap: 12 });

  par(`Rio de Janeiro, ${agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.`, { gap: 16 });
  doc.setDrawColor(60).setLineWidth(0.3); doc.line(W / 2 - 35, y, W / 2 + 35, y); y += 4;
  par(assinante.nome || 'Responsável Técnico', { align: 'center', style: 'bold', gap: 0 });
  par('Seção de Engenharia — DECOF/CPII', { align: 'center', gap: 0, size: 9, color: [90, 90, 90] });
  const cred = [assinante.siape ? 'SIAPE ' + assinante.siape : '', assinante.crea ? 'CREA-RJ ' + assinante.crea : ''].filter(Boolean).join(' · ');
  if (cred) par(cred, { align: 'center', size: 9, color: [90, 90, 90] });

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) { doc.setPage(p); rodape(p, total); }
  doc.save(`NT-minuta-${chamado.id}.pdf`);
}
