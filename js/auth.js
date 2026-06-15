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
  chefe:      ['criar', 'complementar', 'verInterno', 'avaliar', 'statusBasico',
               'statusTotal', 'alocar', 'excluir', 'profissionais', 'pontosManual', 'params'],
  codir:      ['verInterno', 'codir', 'ajuste'],
  admin:      ['criar', 'complementar', 'verInterno', 'avaliar', 'statusBasico',
               'statusTotal', 'alocar', 'excluir', 'profissionais', 'pontosManual',
               'params', 'codir', 'ajuste', 'usuarios', 'log'],
};

export function can(user, cap) {
  if (!user) return false;
  return (CAPS[user.role] || []).includes(cap);
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

// Edição dos DADOS da solicitação pela Chefia/Admin — liberada até a aprovação
// do CODIR (status pré-fila). Reverter o status reabre a edição.
export function podeEditarDados(user, demanda) {
  return can(user, 'statusTotal') && STATUS_EDITAVEL_DADOS.includes(demanda?.status);
}

export function podeAvaliar(user, demanda) {
  return can(user, 'avaliar') && !travada(demanda);
}
export function podeExcluir(user, demanda) {
  return can(user, 'excluir') && !travada(demanda);
}
export function podeComplementar(user, demanda) {
  if (!user || !demanda) return false;
  if (demanda.status !== 'diligencia') return false;
  if (user.role === 'campus') return user.campus === demanda.campus;
  return can(user, 'complementar');
}
// CODIR atua a partir da análise concluída (status "Aguardando aprovação do CODIR" em diante)
export function podeDeliberarCodir(user, demanda) {
  if (!can(user, 'codir') || travada(demanda)) return false;
  return ['codir', 'fila', 'suspenso'].includes(demanda.status);
}
