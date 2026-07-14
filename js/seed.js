// =============================================================================
// SENG Demandas — Dados de demonstração (FICTÍCIOS)
// Nomes de profissionais e usuários são inventados; os objetos das demandas
// são exemplos plausíveis. Em produção (Firebase) nada disto é utilizado.
// =============================================================================
import { PARAMS_DEFAULT } from './config.js';

const dia = 24 * 60 * 60 * 1000;
const agora = Date.now();
const ev = (diasAtras, user, acao) => ({ ts: agora - diasAtras * dia, user, acao });

export function seedDemo() {
  const ano = PARAMS_DEFAULT.anoPlano;

  // E-mail do profissional = e-mail de login do usuário correspondente
  const profissionais = [
    { id: 'p1', nome: 'Beatriz Antunes',  email: 'engenharia@cp2.demo',       cargo: 'Engenheiro(a)', area: 'Civil',                 ativo: true },
    { id: 'p2', nome: 'Caio Mendonça',    email: 'caio.mendonca@cp2.demo',    cargo: 'Engenheiro(a)', area: 'Elétrica',              ativo: true },
    { id: 'p3', nome: 'Diana Furtado',    email: 'diana.furtado@cp2.demo',    cargo: 'Arquiteto(a)',  area: 'Arquitetura',           ativo: true },
    { id: 'p4', nome: 'Eduardo Sales',    email: 'eduardo.sales@cp2.demo',    cargo: 'Engenheiro(a)', area: 'Mecânica',              ativo: true },
    { id: 'p5', nome: 'Flávia Drummond',  email: 'flavia.drummond@cp2.demo',  cargo: 'Engenheiro(a)', area: 'Civil',                 ativo: true },
    { id: 'p6', nome: 'Gustavo Linhares', email: 'gustavo.linhares@cp2.demo', cargo: 'Engenheiro(a)', area: 'Civil',                 ativo: true },
    { id: 'p7', nome: 'Helena Vasques',   email: 'helena.vasques@cp2.demo',   cargo: 'Arquiteto(a)',  area: 'Arquitetura',           ativo: true },
    { id: 'p8', nome: 'Otávio Brandão',   email: 'otavio.brandao@cp2.demo',   cargo: 'Engenheiro(a)', area: 'Segurança do Trabalho', ativo: false, obs: 'Em licença' },
  ];

  const usuarios = [
    { uid: 'u-admin',  email: 'admin@cp2.demo',      senha: 'cp2demo', nome: 'Administração do Sistema', role: 'admin', ativo: true },
    { uid: 'u-chefe',  email: 'chefia@cp2.demo',     senha: 'cp2demo', nome: 'Chefia da SENG',           role: 'chefe', ativo: true },
    { uid: 'u-codir',  email: 'codir@cp2.demo',      senha: 'cp2demo', nome: 'Representante do CODIR',   role: 'codir', ativo: true },
    { uid: 'u-eng',    email: 'engenharia@cp2.demo', senha: 'cp2demo', nome: 'Beatriz Antunes',          role: 'engenharia', ativo: true },
    { uid: 'u-csc2',   email: 'campus.sc2@cp2.demo', senha: 'cp2demo', nome: 'DIAD São Cristóvão II',    role: 'campus', campus: 'CSCII', ativo: true },
    { uid: 'u-ct2',    email: 'campus.t2@cp2.demo',  senha: 'cp2demo', nome: 'Prefeitura Tijuca II',     role: 'campus', campus: 'CTII', ativo: true },
  ];

  // ---- Demandas de exemplo -------------------------------------------------
  let n = 0;
  const D = (campus, seq, dados) => ({
    id: `${ano}${campus}${String(seq).padStart(2, '0')}`,
    ano, campus, seq,
    criadoEm: agora - (40 - n) * dia,
    atualizadoEm: agora - (15 - (n++ % 14)) * dia,
    solicitante: { nome: 'Direção do campus', email: `demo@cp2.demo` },
    especialidades: [], historico: [ev(40 - n, 'Direção do campus', 'Solicitação registrada')],
    ...dados,
  });

  const demandas = [
    D('CTII', 1, {
      objeto: 'Projeto da cobertura do prédio Anexo',
      descricao: 'Contratação de projeto executivo para recuperação da cobertura do prédio Anexo, com infiltrações recorrentes em salas de aula.',
      local: 'Prédio Anexo', tipoDemanda: 'projeto', projetoExiste: 'nao',
      especialidades: ['Engenharia Civil'], tombado: 'nao', emergencial: false,
      valorEstimado: 100000, prazoEstimado: '<6', processoSuap: '23040.001234/2025-11',
      status: 'atendimento', codirAprovado: true,
      aval: { g: 5, u: 4, t: 4, tipoAtividade: 'fisc-projeto', tombadoConf: false, especial: false,
              valorConsiderado: 100000, prazoConsiderado: '<6' },
      ajuste: null,
      // Workflow v2: fase de planejamento em curso, com o checklist de artefatos.
      fase: 'planejamento', projetoOrigem: 'contratado',
      artefatos: {
        indicacao:      { feito: true, em: agora - 10 * dia, por: 'Chefia da SENG' },
        portaria:       { feito: true, em: agora - 8 * dia,  por: 'Chefia da SENG' },
        etp:            { feito: true, em: agora - 5 * dia,  por: 'Flávia Drummond' },
        matrizRiscos:   { feito: true, em: agora - 4 * dia,  por: 'Flávia Drummond' },
        pesquisaPrecos: { feito: true, em: agora - 2 * dia,  por: 'Flávia Drummond' },
      },
      historico: [ev(38, 'Direção do campus', 'Solicitação registrada'), ev(30, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(20, 'Chefia da SENG', 'Aprovada pelo CODIR'), ev(12, 'Chefia da SENG', 'Iniciado o atendimento'), ev(2, 'Flávia Drummond', 'Artefato “Elaboração / Atualização de Orçamento” concluído')],
    }),
    D('CHII', 1, {
      objeto: 'Projeto de reforma das coberturas',
      descricao: 'Projeto de reforma das coberturas dos blocos didáticos, com substituição de telhas e impermeabilização.',
      local: 'Blocos didáticos', tipoDemanda: 'projeto', projetoExiste: 'nao',
      especialidades: ['Engenharia Civil', 'Arquitetura'], tombado: 'sim', emergencial: false,
      valorEstimado: 170000, prazoEstimado: '<6', processoSuap: '',
      status: 'atendimento', codirAprovado: true,
      aval: { g: 5, u: 4, t: 4, tipoAtividade: 'fisc-projeto', tombadoConf: true, especial: false,
              valorConsiderado: 170000, prazoConsiderado: '<6' },
      historico: [ev(36, 'Direção do campus', 'Solicitação registrada'), ev(28, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(20, 'Chefia da SENG', 'Aprovada pelo CODIR'), ev(10, 'Chefia da SENG', 'Iniciado o atendimento')],
    }),
    D('CCE', 1, {
      objeto: 'Obra de modernização da subestação elétrica',
      descricao: 'Contratação de empresa especializada para modernização da subestação e adequação das instalações de média tensão.',
      local: 'Prédio histórico — subsolo', tipoDemanda: 'obra', projetoExiste: 'completo',
      especialidades: ['Engenharia Elétrica'], tombado: 'sim', emergencial: false,
      valorEstimado: 1300000, prazoEstimado: '6-12', processoSuap: '23040.005678/2025-22',
      status: 'atendimento', codirAprovado: true,
      aval: { g: 4, u: 4, t: 3, tipoAtividade: 'fisc-obra', tombadoConf: true, especial: false,
              valorConsiderado: 1300000, prazoConsiderado: '6-12' },
      // Workflow v2: contrato assinado (certame com êxito) — fase de execução.
      fase: 'execucao',
      certame: { enviadoEm: agora - 6 * dia, resultado: 'exito', contratoEm: agora - 3 * dia },
      historico: [ev(34, 'Direção do campus', 'Solicitação registrada'), ev(26, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(20, 'Chefia da SENG', 'Aprovada pelo CODIR'), ev(8, 'Chefia da SENG', 'Iniciado o atendimento'), ev(3, 'Chefia da SENG', 'Certame com êxito — contrato assinado; iniciada a execução')],
    }),
    D('CTII', 2, {
      objeto: 'Obra da cobertura do prédio Anexo',
      descricao: 'Execução da obra de recuperação da cobertura do prédio Anexo após conclusão do projeto.',
      local: 'Prédio Anexo', tipoDemanda: 'obra', projetoExiste: 'parcial',
      especialidades: ['Engenharia Civil'], tombado: 'nao', emergencial: false,
      valorEstimado: 1000000, prazoEstimado: '6-12',
      status: 'fila', codirAprovado: true,
      aval: { g: 5, u: 4, t: 4, tipoAtividade: 'fisc-obra', tombadoConf: false, especial: false,
              valorConsiderado: 1000000, prazoConsiderado: '6-12' },
      historico: [ev(32, 'Direção do campus', 'Solicitação registrada'), ev(24, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(18, 'Chefia da SENG', 'Aprovada pelo CODIR — posicionada na fila')],
    }),
    D('CHII', 2, {
      objeto: 'Obra de reforma das coberturas',
      descricao: 'Execução da reforma das coberturas dos blocos didáticos.',
      local: 'Blocos didáticos', tipoDemanda: 'obra', projetoExiste: 'parcial',
      especialidades: ['Engenharia Civil'], tombado: 'sim', emergencial: false,
      valorEstimado: 1500000, prazoEstimado: '6-12',
      status: 'fila', codirAprovado: true,
      aval: { g: 5, u: 4, t: 4, tipoAtividade: 'fisc-obra', tombadoConf: true, especial: false,
              valorConsiderado: 1500000, prazoConsiderado: '6-12' },
      historico: [ev(31, 'Direção do campus', 'Solicitação registrada'), ev(23, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(18, 'Chefia da SENG', 'Aprovada pelo CODIR — posicionada na fila')],
    }),
    D('CDC', 1, {
      objeto: 'Construção do laboratório de informática',
      descricao: 'Obra de construção do laboratório de informática em área anexa ao bloco principal.',
      local: 'Bloco principal', tipoDemanda: 'obra', projetoExiste: 'completo',
      especialidades: ['Engenharia Civil', 'Engenharia Elétrica'], tombado: 'nao', emergencial: false,
      valorEstimado: 170000, prazoEstimado: '<6',
      status: 'fila', codirAprovado: true,
      aval: { g: 4, u: 4, t: 4, tipoAtividade: 'fisc-obra', tombadoConf: false, especial: false,
              valorConsiderado: 170000, prazoConsiderado: '<6' },
      historico: [ev(30, 'Direção do campus', 'Solicitação registrada'), ev(22, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(18, 'Chefia da SENG', 'Aprovada pelo CODIR — posicionada na fila')],
    }),
    D('CDC', 2, {
      objeto: 'Laudo e projeto de reforço da estrutura metálica',
      descricao: 'Avaliação estrutural e projeto de reforço da cobertura metálica da quadra.',
      local: 'Quadra coberta', tipoDemanda: 'laudo', projetoExiste: 'nao',
      especialidades: ['Engenharia Civil'], tombado: 'nao', emergencial: false,
      valorEstimado: 100000, prazoEstimado: '<6',
      status: 'fila', codirAprovado: true,
      aval: { g: 4, u: 3, t: 4, tipoAtividade: 'fisc-projeto', tombadoConf: false, especial: false,
              valorConsiderado: 100000, prazoConsiderado: '<6' },
      ajuste: { valor: 0.02, justificativa: 'Deliberação do CODIR de 14/05: antecipação por risco à segurança de uso.', solicitadoPor: 'CODIR' },
      historico: [ev(29, 'Direção do campus', 'Solicitação registrada'), ev(21, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(17, 'Chefia da SENG', 'Ajuste aplicado por deliberação do CODIR'), ev(17, 'Chefia da SENG', 'Aprovada pelo CODIR — posicionada na fila')],
    }),
    D('CENII', 1, {
      objeto: 'Projeto de SCIP e complementares do complexo Engenho Novo',
      descricao: 'Contratação de projetos de segurança contra incêndio e pânico e projetos complementares para os campi EN I e EN II.',
      local: 'Complexo Engenho Novo', tipoDemanda: 'projeto', projetoExiste: 'nao',
      especialidades: ['Engenharia Civil', 'Engenharia Elétrica', 'Engenharia Mecânica'], tombado: 'nao', emergencial: false,
      valorEstimado: 450000, prazoEstimado: '6-12', processoSuap: '23783.000350/2024-97',
      status: 'codir',
      aval: { g: 4, u: 3, t: 3, tipoAtividade: 'fisc-projeto', tombadoConf: false, especial: false,
              valorConsiderado: 450000, prazoConsiderado: '6-12' },
      historico: [ev(20, 'Direção do campus', 'Solicitação registrada'), ev(9, 'Beatriz Antunes', 'Avaliação GUT concluída — encaminhada ao CODIR')],
    }),
    D('CSCIII', 1, {
      objeto: 'Reforma da fachada interna',
      descricao: 'Projeto e obra para recuperação da fachada interna com desplacamento de revestimento, face para o CSC I.',
      local: 'Fachada interna — face CSC I', tipoDemanda: 'projeto-obra', projetoExiste: 'nao',
      especialidades: ['Engenharia Civil', 'Arquitetura'], tombado: 'ns', emergencial: false,
      valorEstimado: 800000, prazoEstimado: '6-12', processoSuap: '23777.000072/2023-76',
      status: 'codir',
      aval: { g: 4, u: 4, t: 4, tipoAtividade: 'elab-projeto', tombadoConf: false, especial: false,
              valorConsiderado: 800000, prazoConsiderado: '6-12' },
      historico: [ev(18, 'Direção do campus', 'Solicitação registrada'), ev(7, 'Beatriz Antunes', 'Avaliação GUT concluída — encaminhada ao CODIR')],
    }),
    D('CSCII', 1, {
      objeto: 'Reforma de pisos e banheiros',
      descricao: 'Obra de reforma dos pisos dos corredores e banheiros dos pavimentos 1 e 2.',
      local: 'Pavimentos 1 e 2', tipoDemanda: 'obra', projetoExiste: 'parcial',
      especialidades: ['Engenharia Civil'], tombado: 'nao', emergencial: false,
      valorEstimado: 900000, prazoEstimado: '6-12',
      status: 'analise',
      aval: { g: 2, u: 2, t: 2, tipoAtividade: 'fisc-obra', tombadoConf: false, especial: false,
              valorConsiderado: 900000, prazoConsiderado: '6-12' },
      historico: [ev(12, 'DIAD São Cristóvão II', 'Solicitação registrada'), ev(5, 'Beatriz Antunes', 'Em análise pela SENG')],
    }),
    D('CNI', 1, {
      objeto: 'Acessibilidade — rampas e plataforma elevatória',
      descricao: 'Projeto de acessibilidade contemplando rampas, corrimãos e plataforma elevatória no bloco didático.',
      local: 'Bloco didático', tipoDemanda: 'projeto', projetoExiste: 'nao',
      especialidades: ['Arquitetura', 'Engenharia Mecânica'], tombado: 'nao', emergencial: false,
      valorEstimado: null, prazoEstimado: null,
      status: 'diligencia',
      aval: { g: null, u: null, t: null, tipoAtividade: null },
      historico: [ev(10, 'Direção do campus', 'Solicitação registrada'), ev(4, 'Beatriz Antunes', 'Diligência: detalhar locais de intervenção e estimativa de área')],
    }),
    D('CSCII', 2, {
      objeto: 'Cobertura da área de convivência',
      descricao: 'Instalação de cobertura metálica na área de convivência entre os blocos A e B.',
      local: 'Pátio entre blocos A e B', tipoDemanda: 'obra', projetoExiste: 'nao',
      especialidades: ['Engenharia Civil'], tombado: 'nao', emergencial: false,
      valorEstimado: 300000, prazoEstimado: '<6',
      status: 'recebido',
      historico: [ev(2, 'DIAD São Cristóvão II', 'Solicitação registrada')],
    }),
    D('CREII', 1, {
      objeto: 'Pintura geral do campus',
      descricao: 'Pintura geral dos blocos do campus, incluindo esquadrias.',
      local: 'Todos os blocos', tipoDemanda: 'obra', projetoExiste: 'nao',
      especialidades: ['Engenharia Civil'], tombado: 'nao', emergencial: false,
      valorEstimado: 350000, prazoEstimado: '<6',
      status: 'nao-enquadrado',
      historico: [ev(15, 'Direção do campus', 'Solicitação registrada'), ev(9, 'Chefia da SENG', 'Não enquadrado: serviço de manutenção (art. 18, I, da Portaria 7503/2025)')],
    }),
    D('CENI', 1, {
      objeto: 'Reforma do telhado da quadra (TED)',
      descricao: 'Projeto da reforma do telhado da quadra poliesportiva vinculada a TED.',
      local: 'Quadra poliesportiva', tipoDemanda: 'projeto', projetoExiste: 'parcial',
      especialidades: ['Engenharia Civil'], tombado: 'nao', emergencial: false,
      valorEstimado: 250000, prazoEstimado: '<6',
      status: 'concluido', codirAprovado: true,
      aval: { g: 4, u: 3, t: 3, tipoAtividade: 'fisc-projeto', tombadoConf: false, especial: false,
              valorConsiderado: 250000, prazoConsiderado: '<6' },
      historico: [ev(40, 'Direção do campus', 'Solicitação registrada'), ev(33, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(25, 'Chefia da SENG', 'Aprovada pelo CODIR'), ev(14, 'Chefia da SENG', 'Iniciado o atendimento'), ev(1, 'Chefia da SENG', 'Atendimento concluído')],
    }),
    D('CREI', 1, {
      objeto: 'Adequação elétrica do bloco C',
      descricao: 'Revisão de carga e adequação do quadro geral do bloco C.',
      local: 'Bloco C', tipoDemanda: 'assessoria', projetoExiste: 'nao',
      especialidades: ['Engenharia Elétrica'], tombado: 'nao', emergencial: false,
      valorEstimado: 90000, prazoEstimado: '<6',
      status: 'suspenso',
      aval: { g: 3, u: 3, t: 3, tipoAtividade: 'elab-projeto', tombadoConf: false, especial: false,
              valorConsiderado: 90000, prazoConsiderado: '<6' },
      // Workflow v2: suspensão estruturada (motivo + desde) — não encerra o ciclo.
      suspensao: { motivo: 'outro', obs: 'Obra de terceiros no local — retomada após a conclusão', desde: agora - 6 * dia },
      historico: [ev(26, 'Direção do campus', 'Solicitação registrada'), ev(19, 'Chefia da SENG', 'Avaliação GUT concluída'), ev(6, 'Chefia da SENG', 'Demanda suspensa — Outro motivo: obra de terceiros no local')],
    }),
    D('REIT', 1, {
      objeto: 'Planejamento da contratação de levantamento cadastral BIM',
      descricao: 'Equipe de planejamento para contratação de levantamento cadastral BIM dos campi históricos.',
      local: 'Campi históricos', tipoDemanda: 'outro', projetoExiste: 'nao',
      especialidades: ['Arquitetura'], tombado: 'sim', emergencial: false,
      valorEstimado: 500000, prazoEstimado: '6-12',
      status: 'atendimento', codirAprovado: true,
      aval: { g: 2, u: 2, t: 2, tipoAtividade: 'planejamento', tombadoConf: true, especial: false,
              valorConsiderado: 500000, prazoConsiderado: '6-12' },
      fase: 'planejamento',
      artefatos: {
        indicacao: { feito: true, em: agora - 9 * dia, por: 'Chefia da SENG' },
        portaria:  { feito: true, em: agora - 7 * dia, por: 'Chefia da SENG' },
      },
      historico: [ev(28, 'DECOF', 'Solicitação registrada'), ev(16, 'Chefia da SENG', 'Aprovada pelo CODIR'), ev(9, 'Chefia da SENG', 'Equipe de planejamento constituída')],
    }),
  ];

  const internas = {
    [`${ano}CTII01`]: { fiscalTitular: 'p5', fiscalSubstituto: 'p6' },
    [`${ano}CHII01`]: { fiscalTitular: 'p3', fiscalSubstituto: 'p7' },
    [`${ano}CCE01`]:  { fiscalTitular: 'p2', fiscalSubstituto: 'p4', notasInternas: 'Aguardando cronograma da contratada.' },
    [`${ano}CENI01`]: { fiscalTitular: 'p6', fiscalSubstituto: 'p5' },
    [`${ano}REIT01`]: { equipePlanejamento: ['p3', 'p7'] },
  };

  // ---- Chamados de exemplo (intake da SENG) --------------------------------
  const anoCh = new Date().getFullYear();
  const chamados = [
    { id: `CH${anoCh}CSCII001`, ano: anoCh, seq: 1, campus: 'CSCII', categoria: 'hidraulica',
      assunto: 'Vazamento constante no banheiro do 1º pavimento', descricao: 'Vazamento sob a pia do banheiro masculino, com infiltração no piso.',
      local: 'Bloco A, 1º pavimento — banheiro masculino', urgencia: 'alta', status: 'triagem',
      aberturaEm: agora - 2 * dia, atualizadoEm: agora - 1 * dia, prazoLimite: agora + 3 * dia,
      autor: { nome: 'DIAD São Cristóvão II', email: 'campus.sc2@cp2.demo' },
      historico: [ev(2, 'DIAD São Cristóvão II', 'Chamado aberto'), ev(1, 'Beatriz Antunes', 'Em triagem')] },
    { id: `CH${anoCh}CTII001`, ano: anoCh, seq: 1, campus: 'CTII', categoria: 'consultoria',
      assunto: 'Orientação sobre acessibilidade na entrada', descricao: 'Solicitamos orientação técnica sobre exigências de acessibilidade para a reforma da entrada principal.',
      local: 'Entrada principal', urgencia: 'baixa', status: 'aberto',
      aberturaEm: agora - 1 * dia, atualizadoEm: agora - 1 * dia, prazoLimite: agora + 14 * dia,
      autor: { nome: 'Prefeitura Tijuca II', email: 'campus.t2@cp2.demo' },
      historico: [ev(1, 'Prefeitura Tijuca II', 'Chamado aberto')] },
    // Workflow v2: diligência com o SLA PAUSADO (diligenciaDesde congela o prazo).
    { id: `CH${anoCh}CSCII002`, ano: anoCh, seq: 2, campus: 'CSCII', categoria: 'estrutura',
      assunto: 'Fissuras na empena do bloco B', descricao: 'Fissuras inclinadas na empena do bloco B, próximas à junta de dilatação.',
      local: 'Bloco B — empena norte', urgencia: 'media', status: 'diligencia',
      aberturaEm: agora - 5 * dia, atualizadoEm: agora - 2 * dia, prazoLimite: agora + 10 * dia, diligenciaDesde: agora - 2 * dia,
      autor: { nome: 'DIAD São Cristóvão II', email: 'campus.sc2@cp2.demo' },
      historico: [ev(5, 'DIAD São Cristóvão II', 'Chamado aberto'), ev(3, 'Beatriz Antunes', 'Em triagem'), ev(2, 'Beatriz Antunes', 'Diligência solicitada ao campus')] },
    // Workflow v2: consultoria/laudo em atendimento, com responsáveis alocados.
    { id: `CH${anoCh}CTII002`, ano: anoCh, seq: 2, campus: 'CTII', categoria: 'consultoria',
      assunto: 'Parecer sobre sobrecarga no piso da biblioteca', descricao: 'Avaliação da capacidade de carga do piso da biblioteca para novas estantes deslizantes.',
      local: 'Biblioteca — 2º pavimento', urgencia: 'media', status: 'atendimento', desfecho: 'laudo', atendentes: ['p1'],
      aberturaEm: agora - 6 * dia, atualizadoEm: agora - 3 * dia, prazoLimite: agora + 9 * dia,
      autor: { nome: 'Prefeitura Tijuca II', email: 'campus.t2@cp2.demo' },
      historico: [ev(6, 'Prefeitura Tijuca II', 'Chamado aberto'), ev(4, 'Beatriz Antunes', 'Em triagem'), ev(3, 'Beatriz Antunes', 'Desfecho: Laudo / avaliação técnica')] },
    { id: `CH${anoCh}CREII001`, ano: anoCh, seq: 1, campus: 'CREII', categoria: 'eletrica',
      assunto: 'Disjuntor desarmando no laboratório', descricao: 'O disjuntor do laboratório de informática desarma ao ligar os equipamentos.',
      local: 'Bloco C — laboratório', urgencia: 'media', status: 'encaminhado',
      aberturaEm: agora - 8 * dia, atualizadoEm: agora - 5 * dia, prazoLimite: agora - 3 * dia,
      autor: { nome: 'Direção do campus', email: 'demo@cp2.demo' },
      resolucao: { tipo: 'encaminhado', encaminhadoA: 'Prefeitura do campus / Manutenção', texto: 'Manutenção corretiva de baixa complexidade; orientada a substituição do disjuntor pela equipe de manutenção.', encerradoEm: agora - 5 * dia, por: 'Beatriz Antunes' },
      historico: [ev(8, 'Direção do campus', 'Chamado aberto'), ev(5, 'Beatriz Antunes', 'Encaminhado à manutenção com orientação')] },
  ];

  return {
    _v: 3,
    params: { ...PARAMS_DEFAULT },
    usuarios, profissionais, demandas, internas, chamados,
    logs: [{ ts: agora, uid: 'sistema', nome: 'Sistema', email: '', acao: 'Dados de demonstração gerados', alvo: 'sistema', detalhes: '' }],
  };
}
