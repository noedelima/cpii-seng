// =============================================================================
// SENG Demandas — Exportação da fila em Excel (.xlsx) — perfis internos
// Todas as colunas (inclui classificação, escores, alocação e observações).
// SheetJS carregado sob demanda (CDN jsdelivr, conforme CSP) apenas ao clicar.
// =============================================================================
import { campusNome, statusNome, TIPOS_DEMANDA, PROJETO_EXISTE, TIPOS_ATIVIDADE, PRAZOS, APP } from './config.js';
import { prioridade, pontosArt11, faixaValorLabel } from './calc.js';

const SRC = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
function carregarLib() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement('script');
    s.src = SRC;
    s.onload = () => resolve(window.XLSX);
    s.onerror = () => reject(new Error('Falha ao carregar a biblioteca de Excel.'));
    document.head.append(s);
  });
}

const nome = (lista, id) => (lista.find(x => (x.id ?? x.v) === id) || {}).nome ?? '—';
const simNao = (v) => v === true ? 'Sim' : v === false ? 'Não' : '—';
const tombadoTxt = { sim: 'Sim', nao: 'Não', ns: 'Não informado' };

// Monta a matriz (array de arrays) com todas as colunas — função pura (testável).
export function montarLinhas({ demandas, params, internas = {}, profissionais = [] }) {
  const nomeProf = (pid) => (profissionais.find(p => p.id === pid) || {}).nome || '';
  const cab = [
    'ID', 'Campus', 'Objeto', 'Localização', 'Tipo de demanda', 'Projeto existente',
    'Tipo de atividade (SENG)', 'Status', 'G', 'U', 'T', 'GUT', 'Score Valor', 'Score Prazo',
    'Prazo×Custo', 'Prioridade calculada', 'Ajuste (CODIR)', 'Prioridade final', 'Pontos (art. 11)',
    'Valor estimado (R$)', 'Valor considerado (R$)', 'Prazo', 'Bem tombado', 'Emergencial',
    'Processo SUAP', 'Aprovada CODIR', 'Etapa', 'Fiscal titular', 'Fiscal substituto',
    'Equipe de planejamento', 'Obs. Engenharia', 'Obs. Solicitante/CODIR', 'Registrada em', 'Atualizada em',
  ];
  const fmt = (ts) => ts ? new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const linhas = demandas.map(d => {
    const a = d.aval || {};
    const pr = prioridade(d, params);
    const pts = pontosArt11(a, params.valorRef);
    const it = internas[d.id] || {};
    return [
      d.id, campusNome(d.campus), d.objeto || '', d.local || '',
      nome(TIPOS_DEMANDA, d.tipoDemanda), nome(PROJETO_EXISTE, d.projetoExiste),
      nome(TIPOS_ATIVIDADE, a.tipoAtividade), statusNome(d.status),
      a.g ?? '', a.u ?? '', a.t ?? '', pr.gut ?? '',
      pr.sv ?? '', pr.sp ?? '',
      pr.pxc != null ? Number(pr.pxc.toFixed(4)) : '',
      pr.prioridade != null ? Number(pr.prioridade.toFixed(4)) : '',
      d.ajuste?.valor ?? '', pr.final != null ? Number(pr.final.toFixed(4)) : '',
      (pts == null || a.tipoAtividade === 'planejamento') ? '' : pts,
      d.valorEstimado ?? '', a.valorConsiderado ?? '',
      d.prazoEstimado ? nome(PRAZOS, d.prazoEstimado) : '',
      tombadoTxt[d.tombado] || '', simNao(!!d.emergencial),
      d.processoSuap || '', d.codirAprovado ? 'Sim' : 'Não',
      d.etapa ? (d.etapa === 'obra' ? 'Obra' : 'Projeto') : '',
      it.fiscalTitular ? nomeProf(it.fiscalTitular) : '',
      it.fiscalSubstituto ? nomeProf(it.fiscalSubstituto) : '',
      (it.equipePlanejamento || []).map(nomeProf).filter(Boolean).join(', '),
      it.obsEngenharia || '', d.obsSolicitante || '',
      fmt(d.criadoEm), fmt(d.atualizadoEm),
    ];
  });
  return [cab, ...linhas];
}

export async function exportarExcel({ demandas, params, internas = {}, profissionais = [] }) {
  const XLSX = await carregarLib();
  const aoa = montarLinhas({ demandas, params, internas, profissionais });
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // larguras aproximadas
  ws['!cols'] = aoa[0].map((h, i) => ({ wch: i === 2 ? 40 : (h.length > 16 ? 18 : 12) }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fila de demandas');
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
  XLSX.writeFile(wb, `fila-demandas-seng-${stamp}.xlsx`);
}
