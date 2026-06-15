// =============================================================================
// SENG Demandas — Configuração de domínio
// Colégio Pedro II — Portaria nº 7503/REITORIA/CPII, de 24/11/2025
// =============================================================================

export const APP = {
  nome: 'SENG Demandas',
  orgao: 'Colégio Pedro II',
  setor: 'Seção de Engenharia — SENG/DECOF',
  portaria: 'Portaria nº 7503/REITORIA/CPII, de 24/11/2025',
  versao: '1.5.5',
};

// --- Parâmetros ajustáveis pelo Administrador (defaults) ---------------------
// valorRef = inciso I do art. 75 da Lei nº 14.133/2021 (atualizado por decreto).
export const PARAMS_DEFAULT = {
  anoPlano: new Date().getFullYear() + 1,
  valorRef: 125451.15,
  pesoGUT: 0.75,
  pesoPxC: 0.25,
  limitePontos: 6, // art. 12
};

// --- Campi / unidades (siglas usadas no ID da demanda) -----------------------
export const CAMPI = [
  { id: 'REIT',   nome: 'Reitoria' },
  { id: 'CCE',    nome: 'Centro' },
  { id: 'CDC',    nome: 'Duque de Caxias' },
  { id: 'CENI',   nome: 'Engenho Novo I' },
  { id: 'CENII',  nome: 'Engenho Novo II' },
  { id: 'CHI',    nome: 'Humaitá I' },
  { id: 'CHII',   nome: 'Humaitá II' },
  { id: 'CNI',    nome: 'Niterói' },
  { id: 'CREI',   nome: 'Realengo I' },
  { id: 'CREII',  nome: 'Realengo II' },
  { id: 'CREIR',  nome: 'CREIR' },
  { id: 'CSCI',   nome: 'São Cristóvão I' },
  { id: 'CSCII',  nome: 'São Cristóvão II' },
  { id: 'CSCIII', nome: 'São Cristóvão III' },
  { id: 'CTI',    nome: 'Tijuca I' },
  { id: 'CTII',   nome: 'Tijuca II' },
];
export const campusNome = (id) => (CAMPI.find(c => c.id === id) || {}).nome || id;

// --- Status do ciclo de vida -------------------------------------------------
export const STATUS = [
  { id: 'recebido',    nome: 'Recebido',                        cor: 'st-recebido' },
  { id: 'analise',     nome: 'Em análise',                      cor: 'st-analise' },
  { id: 'diligencia',  nome: 'Em diligência',                   cor: 'st-diligencia' },
  { id: 'codir',       nome: 'Aguardando aprovação do CODIR',   cor: 'st-codir' },
  { id: 'fila',        nome: 'Na fila',                         cor: 'st-fila' },
  { id: 'atendimento', nome: 'Em atendimento',                  cor: 'st-atendimento' },
  { id: 'concluido',   nome: 'Concluído',                       cor: 'st-concluido' },
  { id: 'suspenso',    nome: 'Suspenso',                        cor: 'st-suspenso' },
  { id: 'cancelado',   nome: 'Cancelado',                       cor: 'st-cancelado' },
  { id: 'nao-enquadrado', nome: 'Não enquadrado (Art. 18)',     cor: 'st-nao-enquadrado' },
];
export const statusNome = (id) => (STATUS.find(s => s.id === id) || {}).nome || id;
export const statusCor  = (id) => (STATUS.find(s => s.id === id) || {}).cor || '';

// Transições permitidas (gerenciais; ver papéis em auth.js)
export const TRANSICOES = {
  'recebido':       ['analise', 'cancelado', 'nao-enquadrado'],
  'analise':        ['diligencia', 'codir', 'fila', 'suspenso', 'cancelado', 'nao-enquadrado'],
  'diligencia':     ['analise', 'cancelado'],
  'codir':          ['fila', 'analise', 'suspenso', 'cancelado'],
  'fila':           ['atendimento', 'codir', 'suspenso', 'cancelado'],
  'atendimento':    ['concluido', 'suspenso'],
  'suspenso':       ['analise', 'fila', 'atendimento', 'cancelado'],
  'concluido':      [],
  'cancelado':      [],
  'nao-enquadrado': [],
};

// Status que travam exclusão e alteração de classificação (exigência funcional)
export const STATUS_TRAVADOS = ['atendimento', 'concluido'];

// Reversões de status — disponíveis SOMENTE para Chefe/Admin (statusTotal), para
// desfazer um “Em atendimento” indevido ou reabrir uma conclusão acidental.
// Mudam APENAS o status: a trava de classificação do art. 12 continua valendo
// (avaliação, ajuste e aprovação do CODIR permanecem imutáveis enquanto travada).
export const TRANSICOES_REVERSAO = {
  'atendimento': ['fila', 'codir', 'analise'],
  'concluido':   ['atendimento'],
};

// Status encerrados — afundam para o fim da lista do Painel (limpam a visualização).
// A ordem do array é a ordem de exibição no rodapé: Concluído → Não enquadrado → Cancelado (por último).
export const STATUS_ENCERRADOS = ['concluido', 'nao-enquadrado', 'cancelado'];

// Status em que se pode editar os DADOS da solicitação. A edição vai até a
// SUBMISSÃO ao CODIR: ao entrar em “Aguardando aprovação do CODIR” (codir),
// congela para todos. Reverter o status para uma etapa anterior reabre a edição.
export const STATUS_EDITAVEL_DADOS = ['recebido', 'analise', 'diligencia'];

// --- Escalas GUT (idênticas às utilizadas no PowerBI da SENG) ----------------
export const ESCALA_G = [
  { v: 1, t: 'DANO MÍNIMO — impacta em melhorias pontuais' },
  { v: 2, t: 'DANO LEVE' },
  { v: 3, t: 'DANO REGULAR' },
  { v: 4, t: 'GRANDE DANO' },
  { v: 5, t: 'DANO GRAVÍSSIMO — determinações (TCU, CGU, MPU, PGR e CP2)' },
];
export const ESCALA_U = [
  { v: 1, t: 'NÃO HÁ PRESSA' },
  { v: 2, t: 'PODE AGUARDAR' },
  { v: 3, t: 'MAIS CEDO POSSÍVEL' },
  { v: 4, t: 'ALGUMA URGÊNCIA' },
  { v: 5, t: 'AÇÃO IMEDIATA' },
];
export const ESCALA_T = [
  { v: 1, t: 'DESAPARECE OU NÃO PIORA' },
  { v: 2, t: 'PIORA EM LONGO PRAZO' },
  { v: 3, t: 'PIORA EM MÉDIO PRAZO' },
  { v: 4, t: 'PIORA EM POUCO TEMPO' },
  { v: 5, t: 'PIORA RAPIDAMENTE' },
];

// --- Prazos estimados ---------------------------------------------------------
export const PRAZOS = [
  { id: '<6',   nome: 'Menos de 6 meses',  score: 3 },
  { id: '6-12', nome: 'De 6 a 12 meses',   score: 2 },
  { id: '>12',  nome: 'Mais de 12 meses',  score: 1 },
];

// --- Tipo de demanda (visão do campus) ---------------------------------------
export const TIPOS_DEMANDA = [
  { id: 'obra',          nome: 'Obra / reforma' },
  { id: 'projeto',       nome: 'Projeto (a elaborar ou contratar)' },
  { id: 'projeto-obra',  nome: 'Projeto e obra' },
  { id: 'laudo',         nome: 'Laudo / avaliação técnica' },
  { id: 'assessoria',    nome: 'Assessoria técnica' },
  { id: 'outro',         nome: 'Outro' },
];

// --- Situação de projeto existente -------------------------------------------
export const PROJETO_EXISTE = [
  { id: 'completo', nome: 'Sim, projeto completo' },
  { id: 'parcial',  nome: 'Sim, parcial (precisa complementar)' },
  { id: 'nao',      nome: 'Não — necessita contratar projeto' },
];

// --- Fluxo em etapas: Projeto + Obra ----------------------------------------
// Demandas que exigem projeto E obra (projeto inexistente ou parcial). A etapa
// de projeto, ao ser concluída, retorna ao CODIR como obra (projeto existente).
export const precisaEtapaProjeto = (d) =>
  ['obra', 'projeto-obra'].includes(d?.tipoDemanda) && ['nao', 'parcial'].includes(d?.projetoExiste);

// --- Tipo de atividade da SENG (avaliação técnica) ----------------------------
export const TIPOS_ATIVIDADE = [
  { id: 'fisc-obra',    nome: 'Fiscalização de Obra' },
  { id: 'fisc-projeto', nome: 'Fiscalização de Projeto' },
  { id: 'elab-projeto', nome: 'Elaboração de Projeto' },
  { id: 'planejamento', nome: 'Equipe de Planejamento' },
];

// --- Especialidades -----------------------------------------------------------
export const ESPECIALIDADES = [
  'Arquitetura', 'Engenharia Civil', 'Engenharia Elétrica',
  'Engenharia Mecânica', 'Segurança do Trabalho',
];

export const CARGOS = ['Engenheiro(a)', 'Arquiteto(a)'];
export const AREAS  = ['Arquitetura', 'Civil', 'Elétrica', 'Mecânica', 'Segurança do Trabalho'];

// --- Papéis de usuário ---------------------------------------------------------
export const ROLES = [
  { id: 'campus',     nome: 'Campus (solicitante)' },
  { id: 'engenharia', nome: 'Engenharia' },
  { id: 'chefe',      nome: 'Chefe de Seção' },
  { id: 'codir',      nome: 'CODIR (aprovação e ajuste)' },
  { id: 'admin',      nome: 'Administrador' },
];
export const roleNome = (id) => (ROLES.find(r => r.id === id) || {}).nome || id;
