// =============================================================================
// SENG Demandas — Papéis e permissões (espelhadas nas Security Rules)
// =============================================================================
import { STATUS_TRAVADOS, TRANSICOES } from './config.js';

// Capacidades por papel
const CAPS = {
  campus:     ['criar', 'complementar'],
  engenharia: ['criar', 'complementar', 'verInterno', 'avaliar', 'statusBasico'],
  chefe:      ['criar', 'complementar', 'verInterno', 'avaliar', 'statusBasico',
               'statusTotal', 'alocar', 'ajuste', 'codir', 'excluir', 'profissionais',
               'pontosManual', 'params'],
  admin:      ['verInterno', 'usuarios', 'params', 'profissionais'],
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
  if (can(user, 'statusTotal')) return proximos;
  if (can(user, 'statusBasico')) return proximos.filter(s => STATUS_ENG.includes(s));
  return [];
}

// Trava funcional: em atendimento/concluído não se altera classificação nem se exclui
export const travada = (demanda) => STATUS_TRAVADOS.includes(demanda?.status);

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
