// =============================================================================
// SENG Demandas — Motor de cálculo (Portaria 7503/2025 + modelo GUT da SENG)
// Funções puras: recebem a demanda e os parâmetros, devolvem os escores.
// =============================================================================
import { PRAZOS } from './config.js';

// Faixas de valor: múltiplos do valor de referência (art. 75, I, Lei 14.133/21).
// ≤1× → 5 | ≤5× → 4 | ≤20× → 3 | ≤30× → 2 | acima → 1  (modelo PowerBI da SENG)
export function scoreValor(valor, valorRef) {
  if (valor == null || isNaN(valor) || valor <= 0) return null;
  if (valor <= valorRef)      return 5;
  if (valor <= valorRef * 5)  return 4;
  if (valor <= valorRef * 20) return 3;
  if (valor <= valorRef * 30) return 2;
  return 1;
}

export function faixaValorLabel(score, valorRef) {
  const f = (m) => (valorRef * m).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return { 5: `Até ${f(1)}`, 4: `${f(1)} a ${f(5)}`, 3: `${f(5)} a ${f(20)}`, 2: `${f(20)} a ${f(30)}`, 1: `Acima de ${f(30)}` }[score] || '—';
}

export function scorePrazo(prazoId) {
  const p = PRAZOS.find(x => x.id === prazoId);
  return p ? p.score : null;
}

// GUT = G × U × T (1–125)
export const gut = (g, u, t) => (g && u && t) ? g * u * t : null;

// Prazo × Custo = (V/5 + P/3) / 2  → [0,2667 ; 1]
export function prazoCusto(sv, sp) {
  if (sv == null || sp == null) return null;
  return (sv / 5 + sp / 3) / 2;
}

// Prioridade = pesoGUT·(GUT/125) + pesoPxC·(PxC); Final = Prioridade + Ajuste
export function prioridade(demanda, params) {
  const a = demanda.aval || {};
  const G = gut(a.g, a.u, a.t);
  const sv = scoreValor(a.valorConsiderado ?? demanda.valorEstimado, params.valorRef);
  const sp = scorePrazo(a.prazoConsiderado ?? demanda.prazoEstimado);
  const pxc = prazoCusto(sv, sp);
  if (G == null) return { gut: null, sv, sp, pxc, prioridade: null, final: null };
  const pr = params.pesoGUT * (G / 125) + (pxc != null ? params.pesoPxC * pxc : 0);
  const ajuste = Number(demanda.ajuste?.valor || 0);
  return { gut: G, sv, sp, pxc, prioridade: pr, final: pr + ajuste };
}

// ---------------------------------------------------------------------------
// Pontos de complexidade — art. 11 da Portaria 7503/2025
//   Nível I (1 pt): fiscalização de obra/serviço com valor < valorRef
//   Nível II (2 pts): fisc. obra entre valorRef e 5×; fisc. projeto até 5×
//   Nível III (3 pts): fisc. obra > 5×; fisc. projeto > 5×; elaboração de projeto
//   +1 ponto se bem tombado (§4º)
//   Equipe de planejamento: sem pontos do art. 11 (limite próprio — art. 13);
//   admite valor manual definido pela chefia.
// ---------------------------------------------------------------------------
export function pontosArt11(aval, valorRef) {
  if (!aval || !aval.tipoAtividade) return null;
  if (aval.pontosManual != null && aval.pontosManual !== '') return Number(aval.pontosManual);
  const v = Number(aval.valorConsiderado);
  const temValor = !isNaN(v) && v > 0;
  let base = null;
  switch (aval.tipoAtividade) {
    case 'fisc-obra':
      if (!temValor) return null; // sem valor estimado: não calcula (sinalizado na avaliação)
      base = v < valorRef ? 1 : (v <= valorRef * 5 ? 2 : 3);
      break;
    case 'fisc-projeto':
      if (!temValor) return null; // sem valor estimado: não calcula
      base = v <= valorRef * 5 ? 2 : 3;
      break;
    case 'elab-projeto':
      base = 3;
      break;
    case 'planejamento':
      return 0; // contabilizado pelo limite do art. 13
    default:
      return null;
  }
  if (aval.tombadoConf) base += 1; // §4º — patrimônio histórico
  return base;
}

// Ordena a fila: prioridade final desc → GUT desc → mais antiga primeiro
export function ordenarFila(demandas, params) {
  return [...demandas].sort((d1, d2) => {
    const p1 = prioridade(d1, params), p2 = prioridade(d2, params);
    if ((p2.final ?? -1) !== (p1.final ?? -1)) return (p2.final ?? -1) - (p1.final ?? -1);
    if ((p2.gut ?? -1) !== (p1.gut ?? -1)) return (p2.gut ?? -1) - (p1.gut ?? -1);
    return (d1.criadoEm || 0) - (d2.criadoEm || 0);
  });
}

// ---------------------------------------------------------------------------
// Carga de pontos por profissional (arts. 12 e 13)
// Conta apenas demandas EM ATENDIMENTO. Emergenciais (art. 11 §5º) pontuam,
// mas podem exceder o limite (art. 12 §2º) — sinalizadas à parte.
// ---------------------------------------------------------------------------
// Fiscais alocados (compat: campos únicos antigos -> listas). Retorna arrays de IDs.
export function fiscaisDe(interna) {
  const tit = interna?.fiscaisTitulares ?? (interna?.fiscalTitular ? [interna.fiscalTitular] : []);
  const sub = interna?.fiscaisSubstitutos ?? (interna?.fiscalSubstituto ? [interna.fiscalSubstituto] : []);
  return { titulares: (tit || []).filter(Boolean), substitutos: (sub || []).filter(Boolean) };
}

export function cargaProfissionais(demandas, internas, profissionais, params, chamados = []) {
  const mapa = {};
  for (const p of profissionais) {
    mapa[p.id] = { prof: p, titular: 0, substituto: 0, planejamento: 0,
                   emergencial: 0, demandas: [], chamados: [] };
  }
  // Chamados (consultoria/laudo) em atendimento: contagem à parte, sem somar
  // nos pontos do art. 12 — a Portaria não pontua consultorias/laudos.
  for (const ch of chamados || []) {
    if (ch.status !== 'atendimento') continue;
    for (const pid of (ch.atendentes || [])) {
      if (pid && mapa[pid]) mapa[pid].chamados.push({ id: ch.id, assunto: ch.assunto || ch.id });
    }
  }
  for (const d of demandas) {
    if (d.status !== 'atendimento') continue;
    const i = internas[d.id] || {};
    const pts = pontosArt11(d.aval, params.valorRef) ?? 0;
    const eEmerg = !!d.aval?.especial;
    const add = (pid, papel, val) => {
      if (!pid || !mapa[pid]) return;
      mapa[pid][papel] += val;
      if (eEmerg && papel !== 'planejamento') mapa[pid].emergencial += val;
      mapa[pid].demandas.push({ id: d.id, objeto: d.objeto, papel, pontos: val, emergencial: eEmerg });
    };
    if (d.aval?.tipoAtividade === 'planejamento') {
      (i.equipePlanejamento || []).forEach(pid => add(pid, 'planejamento', 1));
    } else {
      const { titulares, substitutos } = fiscaisDe(i);
      titulares.forEach(pid => add(pid, 'titular', pts));
      substitutos.forEach(pid => add(pid, 'substituto', pts));
      (i.equipePlanejamento || []).forEach(pid => add(pid, 'planejamento', 1));
    }
  }
  for (const k of Object.keys(mapa)) {
    const m = mapa[k];
    m.total = m.titular + m.substituto; // art. 12: titular + substituição
    m.regular = m.total - m.emergencial;
    m.disponivel = Math.max(0, params.limitePontos - m.regular);
    m.excedido = m.regular > params.limitePontos;
  }
  return mapa;
}

// Limite do art. 13: equipes de planejamento ≤ 2 × profissionais ativos da especialidade
export function limitePlanejamento(profissionais) {
  const ativos = profissionais.filter(p => p.ativo);
  const porArea = {};
  for (const p of ativos) porArea[p.area] = (porArea[p.area] || 0) + 1;
  const limites = {};
  for (const a of Object.keys(porArea)) limites[a] = porArea[a] * 2;
  return limites;
}
