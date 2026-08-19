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
// ---------------------------------------------------------------------------
// Transparência — agregados PÚBLICOS de chamados (só contagens; sem assuntos
// nem nomes). Publicados em config/transparencia pelo cliente interno.
// ---------------------------------------------------------------------------
export function calcularTransparencia(chamados, slaChamado, STATUS_ABERTO) {
  const chs = chamados || [];
  const anoAtual = new Date().getFullYear();
  const ativos = chs.filter(c => STATUS_ABERTO.includes(c.status));
  let prazo = 0, vencendo = 0, vencido = 0;
  for (const c of ativos) {
    const e = slaChamado(c).estado;
    if (e === 'vencido') vencido++; else if (e === 'vencendo') vencendo++; else prazo++;
  }
  const duracoes = chs.map(c => {
    const h = (c.historico || []).find(x => /desfecho|convertido|atendimento|resolvido/i.test(x.acao || ''));
    return h && c.aberturaEm ? h.ts - c.aberturaEm : null;
  }).filter(d => d != null && d >= 0);
  return {
    ativos: ativos.length,
    emTriagem: chs.filter(c => ['aberto', 'triagem', 'diligencia'].includes(c.status)).length,
    // v1.28 — detalhamento por etapa: aguardando triagem, com a SENG e com o
    // campus (diligência) — evita a leitura de que tudo "está parado na SENG".
    abertos: chs.filter(c => c.status === 'aberto').length,
    emTriagemSeng: chs.filter(c => c.status === 'triagem').length,
    emDiligencia: chs.filter(c => c.status === 'diligencia').length,
    emAtendimento: chs.filter(c => c.status === 'atendimento').length,
    resolvidosAno: chs.filter(c => c.status === 'resolvido' && new Date(c.atualizadoEm || 0).getFullYear() === anoAtual).length,
    slaPrazo: prazo, slaVencendo: vencendo, slaVencido: vencido,
    triagemMediaDias: duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length / 86400000) : null,
    atualizadoEm: Date.now(),
  };
}

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
    // v1.27.1: limite do art. 12 personalizável por profissional (refPontos —
    // jornada reduzida, estágio etc.); vazio = parâmetro global da Portaria.
    m.limite = refIndividual(m.prof, 'refPontos', params.limitePontos);
    m.disponivel = Math.max(0, m.limite - m.regular);
    m.excedido = m.regular > m.limite;
  }
  return mapa;
}

// Limite do art. 13: equipes de planejamento ≤ 2 × profissionais ativos da especialidade
export function limitePlanejamento(profissionais) {
  // Art. 13: 2× os profissionais DISPONÍVEIS da especialidade (capacidade real).
  // Perfis de apoio (v1.27) não contam para o limite técnico.
  const disp = disponiveis(profissionais).filter(p => !ehApoio(p));
  const porArea = {};
  for (const p of disp) porArea[p.area] = (porArea[p.area] || 0) + 1;
  const limites = {};
  for (const a of Object.keys(porArea)) limites[a] = porArea[a] * 2;
  return limites;
}

// --- Capacidade dinâmica (v1.21) ---------------------------------------------
// Disponíveis = ativos sem ausência vigente no instante consultado.
import { ausenciaAtual, ehApoio, STATUS } from './config.js';
export function disponiveis(profissionais, ts = Date.now()) {
  return profissionais.filter(p => p.ativo !== false && !ausenciaAtual(p, ts));
}
// Limites setoriais: override manual quando informado; senão, referência por
// profissional × disponíveis no momento (decisão D4 do plano Equipe).
export function capacidadeSetorial(profissionais, params) {
  // v1.27: perfis de apoio (Estágio/Apoio Administrativo) integram a equipe,
  // mas não entram na capacidade TÉCNICA (limites de chamados/planejamentos).
  const tecnicos = profissionais.filter(p => !ehApoio(p));
  const n = disponiveis(tecnicos).length;
  const auto = (manual, porProf) => (manual == null || manual === '' ? porProf * n : +manual);
  return {
    disponiveis: n,
    total: tecnicos.filter(p => p.ativo !== false).length,
    refChamadosSetor: auto(params.refChamadosSetor, params.refChamadosProf),
    refPlanejSetor: auto(params.refPlanejSetor, params.refPlanejProf),
    autoChamados: params.refChamadosSetor == null || params.refChamadosSetor === '',
    autoPlanej: params.refPlanejSetor == null || params.refPlanejSetor === '',
  };
}
// Limite individual: personalizado pela Chefia no cadastro (vazio = padrão).
export const refIndividual = (p, campo, padrao) => (p && p[campo] != null && p[campo] !== '' ? +p[campo] : padrao);

// --- Tempos por etapa (v1.28) ------------------------------------------------
// Reconstrução dos intervalos de status a partir do HISTÓRICO padronizado
// (eventos gerados pelo próprio Portal). Conta apenas intervalos FECHADOS —
// a etapa em curso não entra na distribuição.
const idPorNome = {};
for (const st of STATUS) idPorNome[st.nome] = st.id;

const EV_CHAMADO = [
  [/^Triagem iniciada/i, 'triagem'],
  [/^Triagem retomada/i, 'triagem'],
  [/^Complemento enviado pelo campus/i, 'triagem'],
  [/^Conversão desfeita/i, 'triagem'],
  [/^Diligência solicitada/i, 'diligencia'],
  [/^Chamado resolvido/i, 'resolvido'],
  [/^Desfecho: Encaminhar à fila de Obras/i, 'obra'],
  [/^Encaminhado a:/i, 'encaminhado'],
  [/^Desfecho: Improcedente/i, 'improcedente'],
  [/^Desfecho: Duplicado/i, 'duplicado'],
  [/^Desfecho:/i, 'atendimento'], // consultoria/laudo (demais desfechos casaram acima)
];
function statusEventoChamado(acao) {
  for (const [re, st] of EV_CHAMADO) if (re.test(acao)) return st;
  return null;
}
function statusEventoDemanda(acao) {
  const m = acao.match(/Status alterado para “(.+?)”/)
    || acao.match(/Reversão de status: .*→ “(.+?)”/)
    || acao.match(/— status “(.+?)”/);
  if (m) return idPorNome[m[1]] || null;
  if (/^Aprovada pelo CODIR/.test(acao)) return 'fila';
  if (/^Aprovação do CODIR desfeita/.test(acao)) return 'codir';
  if (/^Não aprovada pelo CODIR — devolvida/.test(acao)) return 'analise';
  if (/^Não aprovada pelo CODIR — encerrada/.test(acao)) return 'cancelado';
  if (/^Demanda suspensa/.test(acao)) return 'suspenso';
  if (/^Recebimento definitivo/.test(acao)) return 'concluido';
  if (/^Demanda enviada ao arquivo morto/.test(acao)) return 'excluido';
  return null;
}
function somaIntervalos(inicioTs, historico, statusInicial, extrator) {
  const somas = {};
  let t0 = inicioTs, atual = statusInicial;
  const evs = [...(historico || [])].filter(h => h && h.ts).sort((a, b) => a.ts - b.ts);
  for (const h of evs) {
    const novo = extrator(String(h.acao || ''));
    if (!novo || novo === atual) continue;
    if (t0) somas[atual] = (somas[atual] || 0) + Math.max(0, h.ts - t0);
    t0 = h.ts; atual = novo;
  }
  // v1.28.3: a etapa VIGENTE entra com o tempo já decorrido — sem isso, uma
  // diligência ainda não respondida ficaria invisível, mascarando tempo que
  // está com o campus, não com a SENG.
  if (t0) somas[atual] = (somas[atual] || 0) + Math.max(0, Date.now() - t0);
  return somas;
}
export function distribuicaoTempos(chamados = [], demandas = []) {
  const dia = 86400000;
  const acumula = (mapa, somas) => { for (const [st, ms] of Object.entries(somas)) (mapa[st] = mapa[st] || []).push(ms / dia); };
  const mCh = {};
  for (const c of chamados) if (c.aberturaEm) acumula(mCh, somaIntervalos(c.aberturaEm, c.historico, 'aberto', statusEventoChamado));
  const mDe = {};
  for (const d of demandas) if (d.criadoEm) acumula(mDe, somaIntervalos(d.criadoEm, d.historico, 'recebido', statusEventoDemanda));
  const monta = (mapa, ordem, rotulos) => ordem
    .map(st => ({ rotulo: rotulos[st], valores: (mapa[st] || []).filter(v => v >= 0) }))
    .filter(x => x.valores.length);
  return {
    chamados: monta(mCh, ['aberto', 'triagem', 'diligencia', 'atendimento'],
      { aberto: 'Aguardando triagem', triagem: 'Em triagem (SENG)', diligencia: 'Em diligência (campus)', atendimento: 'Em atendimento' }),
    demandas: monta(mDe, ['recebido', 'analise', 'diligencia', 'codir', 'fila', 'atendimento'],
      { recebido: 'Recebida', analise: 'Em análise', diligencia: 'Em diligência', codir: 'No CODIR', fila: 'Na fila', atendimento: 'Em atendimento' }),
  };
}
