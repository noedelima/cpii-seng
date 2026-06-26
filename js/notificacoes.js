// =============================================================================
// SENG Demandas — Notificações: regras de roteamento (destinatários) e disparo
// -----------------------------------------------------------------------------
// Modelo: "inbox" armazenado (uma notificação por destinatário). A geração é
// client-side (sistema estático + Firestore). O roteamento usa um DIRETÓRIO
// sem nomes (uid, papel, disciplina, id do profissional) — montado pelos
// provedores — para que qualquer ator (inclusive o Campus, que não enxerga a
// lista de profissionais) consiga endereçar as notificações corretamente.
//
// Eventos e destinatários (pedido da equipe de Engenharia):
//   • nova        → engenheiros/arquitetos das disciplinas marcadas na demanda.
//   • diligencia  → envolvidos (fiscalização/planejamento); sem equipe ainda,
//   • comentario  →   cai para os engenheiros das disciplinas da demanda.
//   • codir       → perfis CODIR (envio para aprovação).
//   • fila        → perfis Chefe de Seção (aprovação/ajuste → entra na fila).
//   • concluido   → todos os usuários ativos.
// O autor da ação nunca é notificado de si mesmo.
// =============================================================================

// especialidade da demanda ("Engenharia Civil") → área do profissional ("Civil")
export const espParaArea = (esp) => String(esp || '').replace(/^Engenharia\s+/i, '').trim();

// ids de profissionais envolvidos (titulares + substitutos + planejamento),
// com compatibilidade aos campos legados de fiscal único.
export function envolvidosPids(interna = {}) {
  const tit = interna.fiscaisTitulares || (interna.fiscalTitular ? [interna.fiscalTitular] : []);
  const sub = interna.fiscaisSubstitutos || (interna.fiscalSubstituto ? [interna.fiscalSubstituto] : []);
  const eq = interna.equipePlanejamento || [];
  return [...new Set([...tit, ...sub, ...eq].filter(Boolean))];
}

const ativo = (e) => e && e.ativo !== false;

// uids dos profissionais cuja disciplina está entre as especialidades marcadas
export function uidsPorDisciplina(diretorio = [], especialidades = []) {
  const areas = new Set((especialidades || []).map(espParaArea).filter(Boolean));
  if (!areas.size) return [];
  return diretorio.filter(e => ativo(e) && e.disc && areas.has(e.disc)).map(e => e.uid);
}

// uids dos profissionais alocados (envolvidos) na demanda
export function uidsEnvolvidos(diretorio = [], interna = {}) {
  const pids = new Set(envolvidosPids(interna));
  if (!pids.size) return [];
  return diretorio.filter(e => ativo(e) && e.pid && pids.has(e.pid)).map(e => e.uid);
}

// uids por papel (codir, chefe, …)
export function uidsPorRole(diretorio = [], roles) {
  const set = new Set([].concat(roles));
  return diretorio.filter(e => ativo(e) && set.has(e.role)).map(e => e.uid);
}

// Resolve a lista de destinatários (uids) por tipo de evento.
export function destinatarios(tipo, { diretorio = [], demanda = {}, interna = {} } = {}) {
  switch (tipo) {
    case 'nova':
      return uidsPorDisciplina(diretorio, demanda.especialidades);
    case 'diligencia':
    case 'comentario': {
      const env = uidsEnvolvidos(diretorio, interna);
      return env.length ? env : uidsPorDisciplina(diretorio, demanda.especialidades);
    }
    case 'codir':
      return uidsPorRole(diretorio, 'codir');
    case 'fila':
      return uidsPorRole(diretorio, 'chefe');
    case 'concluido':
      // Todos os perfis internos; o Campus só recebe conclusões do(s) seu(s) campus.
      return diretorio.filter(e => ativo(e) && (e.role !== 'campus' || (e.campi || []).includes(demanda.campus))).map(e => e.uid);
    default:
      return [];
  }
}

export const ROTULO_TIPO = {
  nova: 'Nova demanda',
  diligencia: 'Diligência',
  comentario: 'Comentário',
  codir: 'Envio ao CODIR',
  fila: 'Na fila',
  concluido: 'Concluída',
};

// Texto curto e informativo (≤ 300) por tipo de evento.
export function textoNotificacao(tipo, demanda = {}) {
  const obj = demanda.objeto || demanda.id || 'demanda';
  const t = {
    nova: `Nova demanda para análise — ${obj}`,
    diligencia: `Diligência atualizada — ${obj}`,
    comentario: `Novo comentário — ${obj}`,
    codir: `Enviada para aprovação do CODIR — ${obj}`,
    fila: `Aprovada pelo CODIR e posicionada na fila — ${obj}`,
    concluido: `Demanda concluída — ${obj}`,
  }[tipo] || obj;
  return t.length > 300 ? t.slice(0, 297) + '…' : t;
}

// Dispara o fan-out. Robusto: nunca lança (uma falha de notificação não pode
// quebrar a ação principal do usuário).
export async function notificar(s, tipo, demanda, interna) {
  try {
    if (!s || !demanda || typeof s.criarNotificacoes !== 'function') return;
    const diretorio = (typeof s.getDiretorio === 'function') ? (s.getDiretorio() || []) : [];
    const meu = s.user?.uid || null;
    const alvos = [...new Set(destinatarios(tipo, { diretorio, demanda, interna: interna || {} }))]
      .filter(uid => uid && uid !== meu);
    if (!alvos.length) return;
    const texto = textoNotificacao(tipo, demanda);
    await s.criarNotificacoes(alvos.map(uid => ({
      para: uid, tipo, demandaId: demanda.id, objeto: demanda.objeto || '', texto,
    })));
  } catch (e) { console.warn('notificar', e); }
}
