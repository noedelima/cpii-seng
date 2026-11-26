// =============================================================================
// SENG Demandas — Papéis e permissões (espelhadas nas Security Rules)
// =============================================================================
import { STATUS_TRAVADOS, TRANSICOES, TRANSICOES_REVERSAO, STATUS_EDITAVEL_DADOS } from './config.js';

// Capacidades por papel.
// CODIR: marca "Aprovado pelo CODIR" e define o fator de ajuste (após análise GUT).
// Administrador: executa todas as ações (tudo fica no log de auditoria).
const CAPS = {
  campus:     ['criar', 'complementar'],
  engenharia: ['criar', 'complementar', 'verInterno', 'avaliar', 'statusBasico'],
  // Perfis internos de APOIO da SENG (v1.27): veem o ambiente da equipe e
  // colaboram (tarefas, comentários, anexos) — sem triagem/avaliação/status.
  estagiario:     ['criar', 'complementar', 'verInterno'],
  administrativo: ['criar', 'complementar', 'verInterno'],
  chefe:      ['criar', 'complementar', 'verInterno', 'avaliar', 'statusBasico',
               'statusTotal', 'alocar', 'excluir', 'profissionais', 'pontosManual', 'params',
               'usuarios'],   // v2.0.2: gerencia usuários, exceto Administradores
  codir:      ['verInterno', 'codir', 'ajuste'],
  admin:      ['criar', 'complementar', 'verInterno', 'avaliar', 'statusBasico',
               'statusTotal', 'alocar', 'excluir', 'profissionais', 'pontosManual',
               'params', 'codir', 'ajuste', 'usuarios', 'log'],
};

export function can(user, cap) {
  if (!user) return false;
  return (CAPS[user.role] || []).includes(cap);
}

// Campi do cadastrador de campus (compat: campo único `campus` → lista `campi`).
export function campiDoUsuario(user) {
  if (!user) return [];
  if (Array.isArray(user.campi) && user.campi.length) return user.campi;
  return user.campus ? [user.campus] : [];
}
// Verdadeiro se o usuário é perfil Campus e o campus informado está entre os seus.
export function ehCampusDe(user, campusId) {
  return !!user && user.role === 'campus' && campiDoUsuario(user).includes(campusId);
}

// Status que o papel "engenharia" pode aplicar (tratamento básico da triagem)
const STATUS_ENG = ['analise', 'diligencia', 'codir'];

export function transicoesPermitidas(user, demanda) {
  if (!user || !demanda) return [];
  const proximos = TRANSICOES[demanda.status] || [];
  if (can(user, 'statusTotal')) {
    // Chefe/Admin também podem reverter um status travado (atendimento/concluído)
    // para corrigir lançamentos indevidos — ver TRANSICOES_REVERSAO.
    return [...proximos, ...(TRANSICOES_REVERSAO[demanda.status] || [])];
  }
  if (can(user, 'statusBasico')) return proximos.filter(s => STATUS_ENG.includes(s));
  return [];
}

// Indica se a transição de `de` para `para` é uma reversão (correção de status
// travado por Chefe/Admin) — usado para exigir confirmação explícita na interface.
export function ehReversaoStatus(de, para) {
  return (TRANSICOES_REVERSAO[de] || []).includes(para);
}

// Trava funcional: em atendimento/concluído não se altera classificação nem se exclui
export const travada = (demanda) => STATUS_TRAVADOS.includes(demanda?.status);

// Edição dos DADOS da solicitação — liberada até a SUBMISSÃO ao CODIR (status
// recebido/análise/diligência). Aberta a todos os perfis: Engenharia, Chefe,
// Administrador e CODIR editam qualquer demanda; o Campus edita apenas as da
// própria unidade. Ao entrar em “Aguardando aprovação do CODIR”, congela para todos.
export function podeEditarDados(user, demanda) {
  if (!user || !demanda) return false;
  if (!STATUS_EDITAVEL_DADOS.includes(demanda.status)) return false;
  if (user.role === 'campus') return ehCampusDe(user, demanda.campus);
  return ['engenharia', 'chefe', 'admin', 'codir'].includes(user.role);
}

export function podeAvaliar(user, demanda) {
  return can(user, 'avaliar') && !travada(demanda);
}
export function podeExcluir(user, demanda) {
  // v2.0: demanda vinda de chamado não vai ao arquivo morto — devolve-se ao chamado.
  return can(user, 'excluir') && !travada(demanda) && !demanda?.statusChamado;
}
// v2.0.1: demanda cadastrada direto (sem fase de chamado) → chamado em triagem,
// no mesmo registro. Chefia/Admin. Espelha conversaoOk() das rules.
export function podeConverterEmChamado(user, d) {
  if (!user || !d || d.trilha !== 'demanda' || d.statusChamado) return false;
  if (!['chefe', 'admin'].includes(user.role)) return false;
  return ['recebido', 'analise', 'diligencia', 'codir', 'fila', 'suspenso', 'nao-enquadrado', 'cancelado'].includes(d.status)
    || (d.status === 'atendimento' && (!d.fase || d.fase === 'planejamento'));
}
// v2.0 (ADR-004): devolução da demanda ao chamado (mesmo registro). Chefia/Admin
// até o planejamento; CODIR na deliberação. Espelha devolucaoOk() das rules.
export function podeDevolver(user, d) {
  if (!user || !d || d.trilha !== 'demanda' || !d.statusChamado) return false;
  if (['chefe', 'admin'].includes(user.role))
    return ['recebido', 'analise', 'diligencia', 'codir', 'fila', 'suspenso'].includes(d.status)
      || (d.status === 'atendimento' && (!d.fase || d.fase === 'planejamento'));
  if (user.role === 'codir') return ['codir', 'fila'].includes(d.status);
  return false;
}
export function podeComplementar(user, demanda) {
  if (!user || !demanda) return false;
  if (demanda.status !== 'diligencia') return false;
  if (user.role === 'campus') return ehCampusDe(user, demanda.campus);
  return can(user, 'complementar');
}
// CODIR atua a partir da análise concluída (status "Aguardando aprovação do CODIR" em diante)
export function podeDeliberarCodir(user, demanda) {
  if (!can(user, 'codir') || travada(demanda)) return false;
  return ['codir', 'fila', 'suspenso'].includes(demanda.status);
}
