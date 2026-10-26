# ADR-004 — Entrada única com fases (chamado → demanda) — v2.0.0

**Status:** aprovado (Noé, 26/10/2026) · **Substitui:** o vínculo entre registros
separados (`chamados` + `demandas` ligados por `demandaId`/`chamadoOrigem`).

## Contexto

Ao ser escalado, o chamado gerava uma **demanda nova**. A conversão duplicava os dados
da solicitação, deixava para trás comentários e anexos e só era reversível arquivando a
demanda. A Seção precisa tratar chamado e demanda como **fases de uma mesma entrada**:
um só histórico, um só fio de comentários, anexos sem duplicação e conversão reversível
(devolução ao chamado por engano ou por entendimento do CODIR ou do Campus).

Levantamento em 26/10/2026: 70 demandas (5 originadas de chamado e 65 anteriores à
unificação), 27 chamados (5 escalados), 37 anexos (todos em chamados), 36 comentários e
805 eventos de histórico.

## Decisões (Noé, 26/10/2026)

1. **Registro único** na coleção `entradas/{id}`. A entrada nasce na fase **chamado**
   e, se escalada, passa à fase **demanda** no **mesmo documento**.
2. **Número único novo** para toda entrada, no formato `ANO + CAMPUS + sequencial de 3
   dígitos` (ex.: `2026CDC013`), atribuído na abertura e **nunca alterado** (vale para
   escalada, devolução e reescalada).
3. **Números antigos guardados como referência** (`refs.chamado`, `refs.demanda`):
   encontráveis na busca. Links e notificações antigas redirecionam pela coleção
   `aliases/{numeroAntigo}`, de modo que nada citado no SUAP ou em atas fica órfão.
4. **Devolução ao chamado:** feita pela Chefia/Admin até a fase de planejamento, ou pelo
   CODIR na deliberação, com motivo obrigatório. A fase de demanda fica preservada
   (`status: 'devolvido'`, avaliação, deliberação e histórico intactos). Na reescalada,
   o mesmo registro volta à análise, com nova deliberação.
5. **Virada em janela curta fora do expediente**, com o Portal congelado para escrita.
   As coleções antigas ficam intactas, somente leitura, como backup.

## Modelo de dados — `entradas/{id}`

| Grupo | Campos |
|---|---|
| Identidade | `ano`, `seq`, `campus` (imutável), `trilha` (`'chamado'` ou `'demanda'`: fase vigente), `refs { chamado, demanda }` |
| Fase chamado | `assunto`, `categoria`, `urgencia`, `autor`, `solicitanteRepresentado`, `aberturaEm`, `prazoLimite`, `diligenciaDesde`, **`statusChamado`** (aberto…obra), `desfecho`, `resolucao`, `atendentes` |
| Fase demanda | `objeto`, **`status`** (recebido…concluído, `devolvido`), `aval`, `ajuste`, `codirAprovado`, `fase`, `etapa`, `artefatos`, `certame`, `projetoOrigem`, `tipoDemanda`, `projetoExiste`, `tombado`, `valorEstimado`, `prazoEstimado`, `especialidades`, `emergencial`, `solicitante`, `criadoEm` (data da escalada), `concluidoEm`, `suspensao`, `devolucao`, `statusAnterior` |
| Comuns (únicos) | `descricao`, `local`, `processoSuap`, **`historico`**, **`comentarios`**, **`anexos`**, `obsInterna`/`obsExterna` (legado), `atualizadoEm` |

- **Escalar:** `trilha → 'demanda'`, `statusChamado → 'obra'` e `status → 'recebido'`,
  com a classificação da demanda.
- **Devolver:** `trilha → 'chamado'`, `statusChamado → 'triagem'` e `status → 'devolvido'`,
  com `devolucao { motivo, por, papel, em }`.
- **Internas** (`internas/{id}`) e **ficha pública** (`publicas/{id}`) passam a ser
  indexadas pelo número novo. A ficha ganha `refDemanda` (nº antigo citado no SUAP) e
  só existe na fase demanda, fora do arquivo morto e da devolução.
- **Anexos:** os arquivos **não são movidos**; cada item guarda `path`/`url`. Envios
  novos vão para `entradas/{campus}/{id}/…`. Os caminhos legados (`chamados/…`,
  `demandas/…`) ficam somente leitura (remoção pela SENG).

## Camada de aplicação

O provider lê **uma** coleção e oferece às telas duas vistas do mesmo registro:
`listChamados()` (entradas com fase chamado, em que `status` = `statusChamado` e
`demandaId` = o próprio id quando escalada) e `listDemandas()` (entradas com fase
demanda; inclui as devolvidas, que aparecem em Arquivados). Novos métodos:
`escalarChamado`, `devolverDemanda`, `resolverAlias`. As rotas `#/chamado/:id` e
`#/demanda/:id` abrem a vista da fase **vigente** e aceitam números antigos.

## Segurança (rules)

`entradas` com despacho por fase logo no início (ternário em `trilha`), para conter o
limite de 1000 expressões. Atualização de chamado não toca campos de demanda, e
vice-versa. Transições `escalada` (SENG) e `devolucao` (Chefia/Admin até o
planejamento; CODIR em `codir`/`fila`) têm ramos próprios. Mantidas todas as proteções
da v1.31 (listas íntegras, autoria, SLA, log, ficha pública por espelho fiel e
notificações validadas).

## Virada e rollback

1. Congelar escritas nas coleções antigas (deploy de rules).
2. Migração por script administrativo (simulação antes): entradas, `aliases`, internas,
   fichas públicas e log.
3. Publicar o site e a API novos, depois as rules novas.
4. Validar e reabrir.

**Rollback:** republicar a v1.31 (site + rules). As coleções antigas não são alteradas
pela migração.
