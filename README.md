# Portal da Engenharia — Colégio Pedro II

Sistema da **Seção de Engenharia (SENG/DECOF)** do Colégio Pedro II para o
atendimento de chamados e o gerenciamento das demandas de obras e serviços de
engenharia, em atendimento à **Portaria nº 7503/REITORIA/CPII, de 24/11/2025**.
*(Nome anterior: SENG Demandas.)*

O **chamado é a porta de entrada única**: o campus abre um chamado, a SENG faz a
**triagem** (com prazo/SLA por categoria, pausado em diligência) e define o
desfecho — **consultoria/laudo** (resolvido com orientação ou Nota Técnica),
**encaminhamento** a outro setor, ou conversão em **demanda de obra**, que segue
a avaliação **GUT**, a deliberação do **CODIR** (aprovação, dotação orçamentária,
fator de ajuste), a **fila pública** priorizada e as **fases do ciclo da
contratação** (workflow v2 — BPMN “Atendimento de Chamados v2”).

## Funcionalidades

- **Início público** (sem login): KPIs, gráficos (status, meses, campus,
  especialidade, chamados agregados), top 5 da fila — transparência sem nomes.
- **Módulo de Chamados** (intake + triagem): categorias com **SLA** (pausado em
  diligência, com recomposição do prazo), desfechos da triagem, conversão em
  demanda (inclusive **escalada** da consultoria já em atendimento/resolvida),
  minuta de **Nota Técnica** em PDF, anexos (imagem/PDF) e fio único de
  comentários campus ↔ SENG.
- **Avaliação GUT** com as escalas da SENG, faixas de valor/prazo e pontos de
  complexidade (arts. 11–13).
- **Deliberação do CODIR** (gateways do fluxograma v2): aprovar e posicionar na
  fila, aprovar **aguardando dotação** (suspensão estruturada que não encerra o
  ciclo), **não aprovar** (reanálise ou encerramento, com justificativa) e
  **fator de ajuste** com justificativa (marca `*` na fila).
- **Fases do atendimento** (workflow v2): Planejamento (checklist de artefatos —
  ETP, Matriz de Riscos, **Elaboração / Atualização de Orçamento**, TR/PB, lista
  AGU, Processo SUAP), Licitação (certame com loop deserto/fracassado),
  Execução e Recebimento — com **stepper** do ciclo no dossiê e etiqueta/filtro
  de fase na fila.
- **Ciclo projeto → obra**: concluído o projeto, a demanda retorna ao CODIR como
  obra para **repriorização** (nova deliberação).
- **Trava funcional**: demandas em atendimento/concluídas não podem ser
  excluídas nem ter a classificação alterada (interface **e** Security Rules).
- **Profissionais e alocação**: fiscais titulares/substitutos e equipes de
  planejamento, carga por profissional (limite do art. 12) e monitor do art. 13.
- **Perfis**: Campus, Engenharia, Chefe de Seção, CODIR e Administrador —
  com salvaguarda de sempre haver ao menos um administrador ativo.
- **Notificações** (sino), **log de auditoria** imutável (admin), **arquivo
  morto** recuperável (30 dias), relatórios **PDF efêmeros** e **Excel** interno.
- **Ajuda embutida**: manuais por perfil (Campus, Engenharia, CODIR) renderizados
  no app, com reproduções fiéis das telas e os fluxogramas do chamado e do ciclo
  da demanda.
- Identidade visual CP2, **temas claro/escuro**, responsivo e acessível.

## Arquitetura

SPA estática (ES Modules, **sem build**). **Produção no Azure Static Web Apps**
(CI/CD por GitHub Actions; o endereço antigo no GitHub Pages apenas redireciona —
ver `docs/AZURE-SWA-SETUP.md`). Backend em **Firebase Auth + Cloud Firestore +
Cloud Storage** com regras de segurança restritivas (`firebase/*.rules`) e
**camada de API** opcional em `/api/*` (Azure Functions validando o ID token —
`docs/API-CAMADA.md`). Sem configuração de Firebase, roda em **modo
demonstração** (dados fictícios em `localStorage`), com usuários de teste na
tela de login.

```
index.html            shell + CSP
css/app.css           design system (temas claro/escuro)
js/config.js          domínio: campi, status, fases, artefatos, escalas GUT, papéis
js/calc.js            GUT, faixas, prioridade, pontos art. 11, arts. 12–13
js/store.js           camada de dados (demo) + seleção de provedor
js/firebase-provider.js  provedor de produção (Auth + Firestore + Storage)
js/seed.js            dados fictícios do modo demonstração (inclui workflow v2)
js/views/*.js         início, chamados (hub/triagem/dossiê), demanda, ajuda, admin…
js/ajuda-figs.js      reproduções de tela e fluxogramas SVG dos manuais
js/pdf.js · js/xlsx.js  relatórios efêmeros (PDF timbrado, Excel interno)
api/                  camada de API (Azure Functions) — docs/API-CAMADA.md
firebase/             Security Rules + guia de ativação (SETUP.md)
docs/                 ADRs, manuais da Ajuda, BPMN do fluxo de chamados
```

## Produção

Siga **[firebase/SETUP.md](firebase/SETUP.md)** (~15 min): criar projeto
Firebase, ativar e-mail/senha, publicar as rules, criar perfis e colar a
config em `js/firebase-config.js`. A `apiKey` Web do Firebase não é segredo;
o controle de acesso é feito pelas Security Rules. Hospedagem e API:
`docs/AZURE-SWA-SETUP.md` e `docs/API-CAMADA.md`.

## Cálculo de priorização

`GUT = G×U×T` (escalas 1–5) · `ScoreValor` 1–5 por faixas múltiplas do valor
de referência do art. 75-I da Lei 14.133/2021 (parametrizável) ·
`ScorePrazo` 3/2/1 · `Prazo×Custo = (V/5 + P/3)/2` ·
**Prioridade = 0,75·(GUT/125) + 0,25·(Prazo×Custo) + ajuste CODIR**.
Pontos de complexidade conforme art. 11 (+1 para bem tombado), com
contabilização por profissional e alertas dos limites dos arts. 12 e 13.

---
Desenvolvido para a SENG/DECOF · Colégio Pedro II · 2026.
