// =============================================================================
// SENG Demandas — Configuração de domínio
// Colégio Pedro II — Portaria nº 7503/REITORIA/CPII, de 24/11/2025
// =============================================================================

export const APP = {
  nome: 'Portal da Engenharia',
  orgao: 'Colégio Pedro II',
  setor: 'Seção de Engenharia — SENG/DECOF',
  portaria: 'Portaria nº 7503/REITORIA/CPII, de 24/11/2025',
  versao: '1.23.0',
};

// --- Parâmetros ajustáveis pelo Administrador (defaults) ---------------------
// valorRef = inciso I do art. 75 da Lei nº 14.133/2021 (atualizado por decreto).
export const PARAMS_DEFAULT = {
  anoPlano: new Date().getFullYear() + 1,
  valorRef: 125451.15,
  pesoGUT: 0.75,
  pesoPxC: 0.25,
  limitePontos: 6, // art. 12
  // Limites de REFERÊNCIA (indicativos — não bloqueiam): sinalizam quando a
  // quantidade supera o valor de referência, por profissional e no setor.
  refChamadosProf: 3,    // chamados em atendimento por profissional
  refChamadosSetor: null, // setor: null = AUTOMÁTICO (ref × disponíveis); número = override manual
  refPlanejProf: 2,      // participações em equipes de planejamento por profissional
  refPlanejSetor: null,  // setor: null = AUTOMÁTICO (ref × disponíveis); número = override manual
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
  { id: 'excluido',    nome: 'Excluído',                         cor: 'st-excluido' },
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

// --- Workflow v2: fases do atendimento (BPMN “Atendimento de Chamados v2”) ----
// Sub-status de “Em atendimento” para demandas que seguem o ciclo da contratação.
// `fase: null` = demanda anterior à classificação (exibida como hoje).
export const FASES_DEMANDA = [
  { id: 'planejamento', nome: 'Planejamento da contratação', curto: 'Planejamento' },
  { id: 'licitacao',    nome: 'Licitação',                   curto: 'Licitação' },
  { id: 'execucao',     nome: 'Execução',                    curto: 'Execução' },
  { id: 'recebimento',  nome: 'Recebimento',                 curto: 'Recebimento' },
];
export const faseNome  = (id) => (FASES_DEMANDA.find(f => f.id === id) || {}).nome || id || '—';
export const faseCurta = (id) => (FASES_DEMANDA.find(f => f.id === id) || {}).curto || id || '—';

// Checklist de artefatos da fase de planejamento — fluxo da fase preparatória
// (Lei nº 14.133/2021: ETP → riscos ∥ orçamento → TR/PB → lista de verificação).
// O id `pesquisaPrecos` é chave dos checklists já gravados — não renomear.
export const ARTEFATOS_PLANEJAMENTO = [
  { id: 'indicacao',        nome: 'Integrantes técnicos indicados' },
  { id: 'portaria',         nome: 'Portaria da equipe publicada' },
  { id: 'etp',              nome: 'Estudo Técnico Preliminar (ETP)' },
  { id: 'matrizRiscos',     nome: 'Mapa / Matriz de Riscos' },
  { id: 'pesquisaPrecos',   nome: 'Elaboração / Atualização de Orçamento' },
  { id: 'trpb',             nome: 'Termo de Referência / Projeto Básico' },
  { id: 'listaVerificacao', nome: 'Lista de Verificação (AGU)' },
  { id: 'envioSuap',        nome: 'Processo SUAP instruído e encaminhado' },
];

// Suspensão estruturada — a suspensão nunca é fim de ciclo: registra o motivo
// e a demanda retorna manualmente (Chefia) quando a pendência se resolve.
export const MOTIVOS_SUSPENSAO = [
  { id: 'dotacao', nome: 'Aguardando dotação orçamentária' },
  { id: 'tecnico', nome: 'Pendência técnica' },
  { id: 'outro',   nome: 'Outro motivo' },
];
export const motivoSuspensaoNome = (id) => (MOTIVOS_SUSPENSAO.find(m => m.id === id) || {}).nome || id || '—';

// Resultado do certame (fase licitação). Deserto/fracassado devolve a demanda
// à fase de planejamento (ajuste dos artefatos), com registro no histórico.
export const RESULTADOS_CERTAME = [
  { id: 'exito',      nome: 'Êxito — contrato assinado' },
  { id: 'deserto',    nome: 'Deserto — sem licitantes' },
  { id: 'fracassado', nome: 'Fracassado — propostas desclassificadas' },
];

// Origem do projeto no ciclo projeto → obra (art. 11: elaboração interna pontua).
export const PROJETO_ORIGEM = [
  { id: 'interno',    nome: 'Interno (SENG)' },
  { id: 'contratado', nome: 'Contratado' },
];

// Reversões de status — disponíveis SOMENTE para Chefe/Admin (statusTotal), para
// desfazer um “Em atendimento” indevido ou reabrir uma conclusão acidental.
// Mudam APENAS o status: a trava de classificação do art. 12 continua valendo
// (avaliação, ajuste e aprovação do CODIR permanecem imutáveis enquanto travada).
export const TRANSICOES_REVERSAO = {
  'atendimento': ['fila', 'codir', 'analise'],
  'concluido':   ['atendimento'],
};

// Ordem de exibição no Painel — sequência operacional (workflow). Ativos primeiro;
// encerrados e o arquivo morto (Excluído) por último. A prioridade ordena dentro de cada status.
export const STATUS_ORDEM = [
  'atendimento', 'recebido', 'analise', 'diligencia', 'codir', 'fila',
  'suspenso', 'concluido', 'nao-enquadrado', 'cancelado', 'excluido',
];

// Arquivo morto: dias até a exclusão definitiva de uma demanda excluída.
export const DIAS_ARQUIVO_MORTO = 30;

// Notificações: dias para a limpeza automática dos avisos JÁ LIDOS (não lidos são
// preservados). Cada cliente limpa apenas o próprio inbox, 1x por sessão.
export const DIAS_NOTIFICACAO = 30;

// Camada de API (Fase 2 — modelo híbrido). Quando true, operações de escrita e
// sensíveis passam pela API (/api/*, Azure Functions, autorização no servidor);
// as leituras em tempo real seguem direto no Firestore (onSnapshot). Default off:
// liga-se por recurso à medida que cada fatia é migrada (estrangulamento).
export const USE_API = false;

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
  { id: 'laudo',         nome: 'Laudo / avaliação técnica', oculto: true },
  { id: 'assessoria',    nome: 'Assessoria técnica', oculto: true },
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

// --- Ausências (Meu espaço — controle informativo; o registro oficial é o SouGov) --
export const TIPOS_AUSENCIA = [
  { id: 'ferias',      nome: 'Férias' },
  { id: 'licenca',     nome: 'Licença' },
  { id: 'afastamento', nome: 'Afastamento' },
  { id: 'cessao',      nome: 'Cessão / missão' },
  { id: 'capacitacao', nome: 'Capacitação' },
  { id: 'outro',       nome: 'Outro' },
];
export const tipoAusenciaNome = (id) => (TIPOS_AUSENCIA.find(t => t.id === id) || {}).nome || id || '—';
// Ausência vigente (ou null) e a próxima prevista de um profissional.
export const ausenciaAtual = (p, ts = Date.now()) => (p?.ausencias || []).find(a => a.inicio <= ts && ts <= a.fim) || null;
export const proximaAusencia = (p, ts = Date.now()) => (p?.ausencias || []).filter(a => a.inicio > ts).sort((a, b) => a.inicio - b.inicio)[0] || null;
// Nota curta para os seletores de alocação: ausência vigente ou iniciando em breve.
export function notaAusencia(p, diasAviso = 15) {
  const dt = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const a = ausenciaAtual(p);
  if (a) return ` · ${tipoAusenciaNome(a.tipo).toLowerCase()} até ${dt(a.fim)}`;
  const prox = proximaAusencia(p);
  if (prox && prox.inicio - Date.now() <= diasAviso * 86400000) return ` · ${tipoAusenciaNome(prox.tipo).toLowerCase()} a partir de ${dt(prox.inicio)}`;
  return '';
}

// --- Papéis de usuário ---------------------------------------------------------
export const ROLES = [
  { id: 'campus',     nome: 'Campus (solicitante)' },
  { id: 'engenharia', nome: 'Engenharia' },
  { id: 'chefe',      nome: 'Chefe de Seção' },
  { id: 'codir',      nome: 'CODIR (aprovação e ajuste)' },
  { id: 'admin',      nome: 'Administrador' },
];
export const roleNome = (id) => (ROLES.find(r => r.id === id) || {}).nome || id;

// =============================================================================
// Módulo de Chamados (intake + triagem da SENG) — ver docs/ADR-002-chamados.md
// =============================================================================
export const STATUS_CHAMADO = [
  { id: 'aberto',       nome: 'Aberto',                       cor: 'st-recebido' },
  { id: 'triagem',      nome: 'Em triagem',                   cor: 'st-analise' },
  { id: 'diligencia',   nome: 'Em diligência',                cor: 'st-diligencia' },
  { id: 'atendimento',  nome: 'Em atendimento',               cor: 'st-atendimento' },
  { id: 'obra',         nome: 'Encaminhado à fila de Obras',  cor: 'st-fila' },
  { id: 'encaminhado',  nome: 'Encaminhado a outro setor',    cor: 'st-nao-enquadrado' },
  { id: 'resolvido',    nome: 'Resolvido',                    cor: 'st-concluido' },
  { id: 'improcedente', nome: 'Improcedente',                 cor: 'st-cancelado' },
  { id: 'duplicado',    nome: 'Duplicado',                    cor: 'st-suspenso' },
  { id: 'cancelado',    nome: 'Cancelado',                    cor: 'st-cancelado' },
];
export const statusChamadoNome = (id) => (STATUS_CHAMADO.find(s => s.id === id) || {}).nome || id;
export const statusChamadoCor  = (id) => (STATUS_CHAMADO.find(s => s.id === id) || {}).cor || '';

// Ordem operacional no painel (ativos primeiro; encerrados por último).
export const STATUS_CHAMADO_ORDEM = [
  'triagem', 'aberto', 'diligencia', 'atendimento', 'obra',
  'resolvido', 'encaminhado', 'improcedente', 'duplicado', 'cancelado',
];
export const STATUS_CHAMADO_ABERTO = ['aberto', 'triagem', 'diligencia', 'atendimento']; // SLA corre

// Estado do SLA (prazo de triagem) de um chamado. `dias` = dias corridos restantes
// (negativo = em atraso). Só corre nos status abertos; encerrados não têm prazo.
// Em diligência o SLA PAUSA (nota do fluxograma v2): o restante congela no valor
// do momento em que a diligência abriu e o prazo é recomposto na retomada.
export function slaChamado(c) {
  if (!c || !STATUS_CHAMADO_ABERTO.includes(c.status)) return { estado: 'encerrado', dias: null };
  const ref = c.status === 'diligencia' ? (c.diligenciaDesde || c.atualizadoEm || Date.now()) : Date.now();
  const restante = Math.ceil(((c.prazoLimite || 0) - ref) / 86400000);
  if (c.status === 'diligencia') return { estado: 'pausado', dias: restante };
  if (restante < 0) return { estado: 'vencido', dias: restante };
  if (restante <= 2) return { estado: 'vencendo', dias: restante };
  return { estado: 'no-prazo', dias: restante };
}

// Contabilidade da pausa do SLA nas transições de status do chamado:
// entra em diligência → marca `diligenciaDesde`; sai → estende `prazoLimite`
// pelo tempo pausado e limpa a marca. Devolve os campos a mesclar no patch.
export function patchSlaDiligencia(c, novoStatus) {
  if (!c || !novoStatus || novoStatus === c.status) return {};
  if (novoStatus === 'diligencia') return { diligenciaDesde: Date.now() };
  if (c.status === 'diligencia') {
    const extra = { diligenciaDesde: null };
    if (c.diligenciaDesde && c.prazoLimite)
      extra.prazoLimite = c.prazoLimite + Math.max(0, Date.now() - c.diligenciaDesde);
    return extra;
  }
  return {};
}

// Categorias/assuntos — cada uma mapeia a disciplina (= área do profissional, p/
// rotear notificações) e um SLA em dias corridos.
export const CATEGORIAS_CHAMADO = [
  { id: 'eletrica',       nome: 'Instalações elétricas',         disciplina: 'Elétrica',              slaDias: 5 },
  { id: 'hidraulica',     nome: 'Hidráulica / sanitária',        disciplina: 'Civil',                 slaDias: 5 },
  { id: 'cobertura',      nome: 'Cobertura / infiltração',       disciplina: 'Civil',                 slaDias: 10 },
  { id: 'estrutura',      nome: 'Estrutura / patologia',         disciplina: 'Civil',                 slaDias: 15 },
  { id: 'acessibilidade', nome: 'Acessibilidade',                disciplina: 'Arquitetura',           slaDias: 15 },
  { id: 'climatizacao',   nome: 'Climatização',                  disciplina: 'Mecânica',              slaDias: 10 },
  { id: 'incendio',       nome: 'Segurança / incêndio',          disciplina: 'Segurança do Trabalho', slaDias: 10 },
  { id: 'consultoria',    nome: 'Consultoria / parecer técnico', disciplina: null,                    slaDias: 15 },
  { id: 'outros',         nome: 'Outros',                        disciplina: null,                    slaDias: 15 },
];
export const categoriaChamado = (id) => CATEGORIAS_CHAMADO.find(c => c.id === id) || null;
export const categoriaChamadoNome = (id) => (categoriaChamado(id) || {}).nome || id;

// Urgência percebida pelo campus (não é o GUT — só sinalização inicial).
export const URGENCIA_CHAMADO = [
  { id: 'baixa',       nome: 'Baixa' },
  { id: 'media',       nome: 'Média' },
  { id: 'alta',        nome: 'Alta' },
  { id: 'emergencial', nome: 'Emergencial — risco iminente' },
];

// Desfechos da triagem (o que a SENG decide fazer com o chamado).
export const DESFECHO_CHAMADO = [
  { id: 'obra',         nome: 'Encaminhar à fila de Obras (vira Demanda)', status: 'obra' },
  { id: 'consultoria',  nome: 'Consultoria / assessoria técnica',          status: 'atendimento' },
  { id: 'laudo',        nome: 'Laudo / avaliação técnica',                 status: 'atendimento' },
  { id: 'encaminhado',  nome: 'Encaminhar a outro setor',                  status: 'encaminhado' },
  { id: 'improcedente', nome: 'Improcedente',                              status: 'improcedente' },
  { id: 'duplicado',    nome: 'Duplicado',                                 status: 'duplicado' },
];

// Setores de encaminhamento (desfecho “encaminhado”).
export const SETORES_ENCAMINHAMENTO = [
  'Prefeitura do campus / Manutenção', 'DTI (Tecnologia da Informação)',
  'Administração / Material', 'Comunicação', 'Outro',
];
