# Manual Operacional da Engenharia — Sistema de Gestão de Demandas SENG

**Colégio Pedro II · Seção de Engenharia — SENG/DECOF**
**Portaria nº 7503/REITORIA/CPII, de 24/11/2025**

Guia operacional completo para a equipe da Seção de Engenharia (perfis **Engenharia**, **Chefe de Seção** e **Administrador**): triagem, avaliação técnica (GUT), tramitação, alocação de fiscais, profissionais, parâmetros e administração. Escrito também para servir de base às **seções de ajuda do portal** — cada seção é autocontida.

> [!nota] **Sobre as imagens.** As telas são **reproduções fiéis** do sistema (mesmas cores e componentes), com dados de exemplo e **marcadores numerados** apenas didáticos. Acompanham o **tema claro/escuro** da página.

---

## Sumário

1. Visão geral
2. Perfis e permissões
3. Ciclo de vida da demanda (status e transições)
4. Como a prioridade é calculada
5. Fluxo 1 — Acessar e triar (painel interno)
6. Fluxo 2 — Abrir e ler uma demanda
7. Fluxo 3 — Avaliação técnica (GUT)
8. Fluxo 4 — Tramitar status, diligência e encaminhamento ao CODIR
9. Fluxo 5 — Trava de “Em atendimento”
10. Fluxo 6 — Alocação de fiscais (Chefia)
11. Fluxo 7 — Carga da equipe (art. 12)
12. Fluxo 8 — Profissionais (cadastro e art. 13)
13. Fluxo 9 — Parâmetros do sistema (Chefia)
14. Fluxo 10 — Administração: usuários e log (Administrador)
15. Fluxo 11 — Módulo de Chamados (intake, triagem e desfechos)
16. Apêndice A — Escalas GUT completas
17. Apêndice B — Status e transições por perfil
18. Apêndice C — Boas práticas
19. Apêndice D — Solução de problemas (FAQ)
20. Apêndice E — Glossário

---

## 1. Visão geral

O sistema reúne, em uma única ferramenta web, todo o ciclo das demandas de obras e serviços de engenharia — do cadastro pelo campus à conclusão pela SENG — com o **cálculo de priorização** da Seção, conforme a Portaria 7503/2025.

Princípios de projeto:

- **Cadastro contínuo** e **fila pública** (transparência).
- **Cálculo padronizado** de prioridade (GUT + valor + prazo).
- **Controle de carga** por profissional (limite do art. 12) e de equipes (art. 13).
- **Segurança por design**: dados públicos e internos separados; permissões validadas no servidor.
- **Rastreabilidade total**: histórico por demanda + log de auditoria.

> [!importante] **Porta de entrada: o Chamado.** O campus **abre um chamado**; a SENG **tria** e define o desfecho, inclusive **converter em Demanda** de obra (com a classificação preenchida na triagem). O passo a passo do módulo está no **Fluxo 11**.

---

## 2. Perfis e permissões

As capacidades de cada perfil espelham a Portaria e são validadas **também nas regras de segurança do banco** (não apenas na interface).

| Perfil | Pode |
|--------|------|
| **Campus** | **Abrir chamados** do seu campus (com anexos); acompanhar; complementar em diligência. |
| **Engenharia** | **Triar chamados** (definir desfecho e converter em obra); abrir e acompanhar demandas de **qualquer campus**; ver dados internos, **avaliar (GUT)** e aplicar status de triagem (Em análise, Em diligência, Aguardando CODIR). |
| **Chefe de Seção** | Tudo da Engenharia + **status total**, **alocação de fiscais**, exclusão, **profissionais** e **parâmetros**. |
| **CODIR** | Ver dados internos + **aprovar** e definir **fator de ajuste** (após a análise GUT). |
| **Administrador** | Executa **todas** as ações + gestão de **usuários** e **log de auditoria** (tudo registrado). |

> **Separação de funções (v1.1).** A **aprovação** e o **ajuste** passaram a ser atribuições exclusivas do **CODIR**. A Chefia concentra a gestão técnica e a alocação.

---

## 3. Ciclo de vida da demanda (status e transições)

Caminho principal:

**Recebido → Em análise → Aguardando aprovação do CODIR → Na fila → Em atendimento → Concluído**

Estados laterais: **Em diligência**, **Suspenso**, **Cancelado**, **Não enquadrado (Art. 18)**.

Regras de transição (resumo):

- **Engenharia** move entre: Em análise, Em diligência e Aguardando aprovação do CODIR.
- **Chefia** tem o status total: pode levar à fila, iniciar atendimento, concluir, suspender e cancelar.
- **Trava funcional**: demandas **Em atendimento** ou **Concluídas** **não** podem ter a classificação alterada nem ser excluídas (vale na interface e nas regras de segurança).
- **Reversão (Chefe/Admin)**: para corrigir um lançamento indevido, a **Chefia/Administração** pode **reverter** uma demanda **Em atendimento** de volta para **Na fila**, **Aguardando aprovação do CODIR** ou **Em análise**, e **reabrir** uma demanda **Concluída** para **Em atendimento**. A ação pede **confirmação** e fica registrada no histórico; a reversão muda **apenas o status** (avaliação, ajuste e aprovação do CODIR são preservados). Engenharia, CODIR e Campus **não** dispõem dessas reversões.
- **Conclusão** libera os pontos de complexidade dos profissionais (art. 12, §1º).

A tabela completa de transições por perfil está no **Apêndice B**.

> **Projeto + Obra em etapas.** Demandas de **obra** cujo projeto **não existe ou é parcial** tramitam como **uma única demanda**, em duas etapas. Concluída a etapa de **projeto** (no cartão **Gestão**, botão *“Concluir etapa de projeto”*): se o projeto era **inexistente**, a demanda **retorna ao CODIR como obra** (com projeto existente) para repriorização; se era **parcial**, há a opção de **contratação unificada** (projeto + obra) ou separada. Reavalie o GUT e o valor da obra antes de reenviar ao CODIR.

---

## 4. Como a prioridade é calculada

O cálculo segue o modelo de priorização da Seção (art. 5º, II):

1. **GUT** = G × U × T (escalas 1–5; resultado de 1 a 125).
2. **Score de Valor (1–5)** por faixas do **valor de referência** (art. 75-I da Lei 14.133/2021, parametrizável):
   - ≤ R$ 125.451,15 → 5; ≤ R$ 627.255,75 → 4; ≤ R$ 2.509.023,00 → 3; ≤ R$ 3.763.534,50 → 2; acima → 1.
3. **Score de Prazo**: < 6 meses → 3; 6–12 meses → 2; > 12 meses → 1.
4. **Prazo × Custo** = (Valor/5 + Prazo/3) / 2.
5. **Prioridade** = 0,75 · (GUT/125) + 0,25 · (Prazo × Custo).
6. **Prioridade final** = Prioridade + **fator de ajuste do CODIR** (com justificativa).
7. **Pontos de complexidade (art. 11)**: Nível I = 1, II = 2, III = 3 (por faixa/tipo de atividade); **+1** se bem tombado; serviço emergencial (§5º) pontua e pode exceder o limite (§2º).

**Limites monitorados:** **6 pontos** simultâneos por profissional (titular + substituto, art. 12); equipes de planejamento ≤ **2×** os profissionais da especialidade (art. 13).

---

## 5. Fluxo 1 — Acessar e triar (painel interno)

**Passo a passo**

1. Entre com seu e-mail e senha.

@fig login

2. No **Painel**, autenticado, a tabela ganha a coluna **Fiscal técnico** e o filtro **“Minhas atribuições”**; o cartão **Carga da equipe** aparece **logo acima da fila**, para ficar sempre visível independentemente do tamanho da lista.
3. Para triar, filtre por **status “Recebido”** (ou por especialidade) e abra as demandas pendentes.

@fig eng-painel

> **Triagem recomendada:** comece pelas demandas **Recebidas** mais antigas; mova rapidamente para **Em análise**; abra **diligência** quando faltar informação.

> **Exportações:** além do **Baixar PDF da fila**, o painel interno tem **Baixar Excel** (.xlsx com todas as colunas — classificação, escores, alocação e observações), disponível apenas para Engenharia, Chefe e Administrador.

> **Ordenação do Painel.** A lista é organizada por **status**, na sequência operacional — **Em atendimento → Recebido → Em análise → Em diligência → Aguardando CODIR → Na fila → Suspenso → Concluído → Não enquadrado → Cancelado → Excluído** —, com a **prioridade** ordenando dentro de cada status. Assim o que está em andamento aparece primeiro; encerradas e excluídas ficam no fim. *(O status **Excluído** — arquivo morto — só aparece para Chefe/Admin.)*

> **Notificações (sino do cabeçalho).** O ícone de **sino**, ao lado do seu nome, traz um **contador** de avisos não lidos e abre a sua **área pessoal de notificações** — uma lista em que **cada linha é um link** direto para a demanda. A Engenharia é avisada quando: uma **nova demanda** é cadastrada nas **suas disciplinas**; há **diligência** (devolução/resposta) ou **novo comentário** em demandas em que você está **envolvido** (fiscalização/planejamento) — ou, se ainda não há equipe alocada, nas demandas das **suas disciplinas**; e quando qualquer demanda é **concluída**. Abrir a notificação a marca como lida; há também **“marcar todas como lidas”**. Você nunca é notificado das suas próprias ações. Os avisos já lidos são removidos automaticamente após 30 dias.

---

## 6. Fluxo 2 — Abrir e ler uma demanda

Clique em uma linha do painel para abrir o detalhe. A página é dividida em duas colunas:

- **Esquerda:** dados da solicitação e **histórico** completo.
- **Direita:** **Priorização**, **Avaliação técnica**, **Gestão**, **Alocação** e **Observações** — esta última um **histórico de comentários públicos** (fio interno da Engenharia e fio externo do solicitante/CODIR).

@fig eng-demanda

> **Editar dados da solicitação.** Enquanto a demanda **não foi submetida ao CODIR** (status Recebido, Em análise ou Em diligência), o cartão **“Editar dados da solicitação”** permite corrigir localização, tipo, situação do projeto, valor, prazo, processo SUAP, objeto, descrição, especialidades e o sinalizador emergencial. A edição é aberta a **Engenharia, Chefia, Administração e CODIR** (qualquer demanda) e ao **Campus** (apenas as da própria unidade). Ao entrar em **“Aguardando aprovação do CODIR”**, os dados **congelam para todos**; para corrigir, **reverta o status** (Fluxo 5) e a edição reabre. A **unidade (campus) não é editável** (compõe o identificador). Cada alteração registra no **histórico** e no **log de auditoria** **exatamente quais campos** mudaram — ex.: *“Dados da solicitação editados — campos: Processo SUAP, Valor estimado, Prazo estimado”*.

> **Observações (comentários públicos).** Cada demanda tem dois fios de comentários — o **da Engenharia (interna)** e o **do solicitante / CODIR (externa)** — **visíveis a todos**, inclusive no painel público, em modo leitura. Cada comentário registra **autor e data/hora**. Quem pode **escrever**: no fio interno, Engenharia/Chefia/Administração; no externo, o Campus (da própria unidade), o CODIR e a Administração. O **autor pode editar** o próprio comentário (fica marcado *(editado)*) e **excluí-lo**; além do autor, podem excluir — no interno, a Chefia/Administração; no externo, o CODIR/Solicitante/Administração. Toda ação fica no log de auditoria.

---

## 7. Fluxo 3 — Avaliação técnica (GUT)

Este é o núcleo do trabalho da Engenharia.

**Passo a passo**

1. Abra a demanda (Fluxo 2).
2. No cartão **Avaliação técnica (GUT)**, preencha os campos numerados:

@fig eng-gut

| Nº | Campo | Como preencher |
|----|-------|----------------|
| ① | **Gravidade do dano (G)** | Escala 1–5 (ver Apêndice A). |
| ② | **Urgência da intervenção (U)** | Escala 1–5. |
| ③ | **Tendência de evolução (T)** | Escala 1–5. |
| ④ | **Tipo de atividade da SENG** | Fiscalização de Obra, Fiscalização de Projeto, Elaboração de Projeto ou Equipe de Planejamento. |
| ⑤ | **Prazo considerado** | < 6, 6–12 ou > 12 meses (base do Score de Prazo). |
| ⑥ | **Valor considerado (R$)** | Estimativa orçamentária usada nas faixas de valor. |

3. Marque, quando couber: **“Bem tombado confirmado”** (+1 ponto, §4º) e/ou **“Serviço emergencial”** (art. 11, §5º).
4. *(Apenas Chefia/Admin)* É possível definir **Pontos (manual)**. O cálculo automático do art. 11 depende do **valor considerado**: **sem valor, a Fiscalização de Obra/Projeto não recebe pontos automaticamente** (a ficha sinaliza “informe o valor para calcular”) — informe o valor ou defina os pontos aqui. *(Elaboração de Projeto = 3, independe de valor.)*
5. Clique em **Salvar avaliação**. A **prioridade é recalculada automaticamente** e aparece no cartão **Priorização**.

@fig eng-prioriz

---

## 8. Fluxo 4 — Tramitar status, diligência e encaminhamento ao CODIR

No cartão **Gestão** ficam as transições de status disponíveis para o seu perfil.

@fig eng-gestao

**Encaminhar ao CODIR**

1. Conclua a avaliação GUT (Fluxo 3).
2. No cartão **Gestão**, aplique o status **“Aguardando aprovação do CODIR”**.
3. A partir daí, a demanda fica disponível para o CODIR aprovar e, se for o caso, ajustar.

**Abrir diligência (pedir complemento ao campus)**

1. No cartão **Gestão**, aplique **“Em diligência”**.
2. Registre no histórico o que falta (locais, área estimada, etc.).
3. O **campus** responde pela própria página; ao enviar, a demanda **retorna para “Em análise”**.

---

## 9. Fluxo 5 — Trava de “Em atendimento”

Quando a demanda entra em **Em atendimento** (ou é **Concluída**), o sistema **trava** a classificação:

- A **avaliação técnica** não pode mais ser alterada.
- A demanda **não pode ser excluída**.
- A trava vale na **interface** e nas **regras de segurança** do banco.

@fig eng-travada

> **Desfazer um status indevido (Chefe/Admin).** Se uma demanda for marcada **Em atendimento** por engano, a **Chefia/Administração** pode **revertê-la diretamente**: no cartão **Gestão** aparecem os botões **Na fila**, **Aguardando aprovação do CODIR** e **Em análise**. Uma demanda **Concluída** por engano pode ser **reaberta** para **Em atendimento**. A ação pede confirmação e é registrada no histórico (muda **apenas o status** — a classificação é preservada; reverter o atendimento libera os pontos do art. 12, reabrir a conclusão volta a contá-los).
>
> Para **editar os dados** de uma demanda em atendimento, o caminho continua sendo **Suspender → editar → retomar o atendimento**.
>
> **Excluir = arquivo morto (recuperável por 30 dias).** O botão **Excluir demanda** (Chefe/Admin, fora de atendimento/concluída) **não apaga na hora**: a demanda vai para o **arquivo morto** (status **Excluído**), some do Painel para os demais perfis e aparece no fim da lista **só para Chefe/Admin**. Ao abrir a demanda, há a opção **Resgatar** (volta ao status anterior). Passados **30 dias**, é removida **definitivamente** (limpeza automática quando um Chefe/Admin abre o sistema). É a rede de proteção contra exclusões acidentais.

---

## 10. Fluxo 6 — Alocação de fiscais (Chefia)

**Perfil necessário: Chefe de Seção (ou Administrador).**

**Passo a passo**

1. Abra uma demanda (preferencialmente **Na fila** ou **Em atendimento**).
2. No cartão **Gestão**, seção **Alocação**, marque (em listas de **seleção múltipla**):
   - **Fiscais técnicos titulares** — **um ou mais**. Use mais de um quando a fiscalização for **compartilhada** (p. ex., o titular pediu exoneração e a fiscalização ficou a cargo de dois servidores) ou em obras **multidisciplinares**, com fiscais de especialidades diferentes.
   - **Fiscais técnicos substitutos** — zero, um ou mais.
   - **Equipe de planejamento** (art. 13), marcando os integrantes.
3. Cada nome mostra a **especialidade** e a **carga atual** (ex.: `Civil (3/6)`). **Cada fiscal alocado (titular ou substituto) pontua** pelo art. 11.
4. Um mesmo profissional **não pode** ser titular e substituto na mesma demanda.
5. Se a alocação **exceder o limite de 6 pontos** (art. 12), o sistema **avisa** e pede confirmação (serviço emergencial pode exceder, §2º).
6. Clique em **Salvar alocação**.

@fig eng-alocacao

---

## 11. Fluxo 7 — Carga da equipe (art. 12)

No **Painel** autenticado, o cartão **Carga da equipe** consolida a pontuação de cada profissional.

@fig eng-carga

- A barra indica o uso em relação ao **limite de 6 pontos**.
- São separados **pontos regulares**, **emergenciais** e de **planejamento**.
- Use para **equilibrar** a distribuição antes de novas alocações.

---

## 12. Fluxo 8 — Profissionais (cadastro e art. 13)

**Perfil necessário: Chefe de Seção (ou Administrador).**

O cadastro está em **Profissionais** (menu superior).

@fig eng-profissionais

**Cadastrar/editar um profissional**

1. Clique em **+ Novo profissional**.
2. Preencha os campos:

@fig eng-prof-novo

| Nº | Campo | Como preencher |
|----|-------|----------------|
| ① | **Usuário** | Selecione um **usuário já cadastrado** — nome e e-mail são derivados automaticamente (o e-mail é a **chave do vínculo** com o login). Não achou? Cadastre-o antes em **Administração → Novo usuário**. |
| ② | **Cargo** | Engenheiro(a) ou Arquiteto(a). |
| ③ | **Área / especialidade** | Arquitetura, Civil, Elétrica, Mecânica ou Segurança do Trabalho. |
| ④ | **Observação** | Texto livre (ex.: “em licença até 09/2026”). |

3. Marque **Ativo** para tornar o profissional elegível à alocação.
4. Clique em **Salvar**.

> **Art. 13.** O painel mostra, por especialidade, quantas participações em equipes de planejamento existem em relação ao limite (2× os profissionais da especialidade).

---

## 13. Fluxo 9 — Parâmetros do sistema (Chefia)

**Perfil necessário: Chefe de Seção (ou Administrador).**

Em **Administração**, o cartão **Parâmetros do sistema** controla o cálculo.

@fig eng-parametros

- **Ano do Plano** — usado nos IDs das novas demandas.
- **Valor de referência (art. 75-I)** — base das faixas de valor e dos pontos; atualizado anualmente por decreto.
- **Peso do GUT** e **Peso do Prazo×Custo** — devem somar **1,00**.
- **Limite de pontos por profissional** (art. 12).

> Ao salvar, **todas as prioridades são recalculadas automaticamente**.

---

## 14. Fluxo 10 — Administração: usuários e log (Administrador)

**Perfil necessário: Administrador.** A página de **Administração** é organizada em **abas**: **Usuários**, **Parâmetros do sistema** e **Log de auditoria** — clique na aba desejada para alternar.

**Cadastrar um novo usuário**

1. Em **Administração**, no cartão **Usuários**, clique em **+ Novo usuário**.

@fig eng-usuarios

2. Preencha o formulário:

@fig eng-usuario-novo

| Nº | Campo | Como preencher |
|----|-------|----------------|
| ① | **Nome** | Nome completo da pessoa. |
| ② | **E-mail** | Para a SENG, use o **mesmo e-mail** que será o do profissional — o vínculo é automático. |
| ③ | **Perfil** | Campus, Engenharia, Chefe de Seção, CODIR ou Administrador. |
| ④ | **Campi** | Apenas para o perfil **Campus** — marque **uma ou mais** unidades. O cadastrador atua em todos os campi marcados (ex.: **CREIR + Realengo I**, quando há gestão compartilhada). |
| ⑤ | **Senha inicial** | Mínimo de 6 caracteres; a pessoa troca depois em “Minha conta”. |

3. Clique em **Salvar**. A credencial e o perfil são criados de uma só vez (sem console externo).

**Salvaguardas e auditoria**

- Um administrador **não pode revogar o próprio perfil**; sempre resta ao menos um administrador ativo.
- O **Log de auditoria** registra **toda** modificação (o quê, quando, quem), de forma **imutável** — visível apenas ao Administrador.

@fig eng-log

---

## 15. Fluxo 11 — Módulo de Chamados (intake, triagem e desfechos)

O **Chamado** é a **porta de entrada única** da Engenharia. O campus abre um chamado; a SENG **tria** e define o **desfecho** — inclusive **converter em Demanda** de obra, com a classificação preenchida aqui, na triagem.

@fig fluxo-chamado

> O mesmo fluxo, em notação BPMN editável (Bizagi Modeler), está em `docs/fluxo-chamados.bpmn` no repositório.

**Onde fica:** menu **Chamados**. A SENG vê **todos** os chamados; o campus vê só os da própria unidade.

### Painel de chamados

- Lista por **status operacional** e **prazo (SLA)**; filtros por **situação** (ativos / em atraso / encerrados / todos), **campus**, **categoria** e **busca**.
- A **faixa de SLA** (no prazo / vencendo / vencido) é ao mesmo tempo **alerta** e filtro rápido.
- **Baixar PDF**: relatório efêmero (timbre + data/hora) da lista filtrada.
- **+ Abrir chamado**: a SENG também pode abrir um chamado (ex.: demanda de origem interna).

@fig ch-painel

### Triagem (cartão “Triagem”)

1. **Iniciar triagem** (Aberto → Em triagem).
2. **Solicitar diligência**: escreva o que falta; o chamado vai a **Em diligência**, o campus é avisado e o **SLA pausa**.
3. **Desfecho** — escolha e aplique:
   - **Obra (vira Demanda)** — abre o bloco de **classificação** (tipo de demanda, projeto existe, tombado, prazo, valor, Processo SUAP e **especialidades**, já pré-marcadas pela disciplina da categoria). Ao confirmar, cria-se a **Demanda** (status Recebido) vinculada ao chamado, que segue o fluxo **GUT → CODIR → fila**. O chamado passa a **“Encaminhado à fila de Obras”**, com link para a demanda.
   - **Consultoria** / **Laudo** — o chamado vai a **Em atendimento**; conclua depois em **“Concluir o atendimento”** (registra a orientação/NT e marca **Resolvido**; o campus é avisado).
   - **Encaminhar a outro setor** — selecione o setor e registre a orientação (status **Encaminhado**).
   - **Improcedente** / **Duplicado** — encerra com o motivo.

@fig ch-triagem

### Anexos, comentários e histórico

- **Anexos**: imagens e PDF (até 10 MB) — enviados pela SENG a qualquer tempo e pelo campus enquanto o chamado está aberto/triagem/diligência.
- **Comentários**: fio público campus ↔ SENG.
- **Histórico**: cada evento com data/hora e autor.

### Nota Técnica (minuta)

Nos desfechos **consultoria/laudo**, o cartão **Desfecho** traz **“Gerar Nota Técnica (minuta)”** — um PDF na estrutura DECOF-SENG (cabeçalho institucional, `NOTA TÉCNICA Nº ___/AAAA/DECOF-SENG`, Assunto, Referência ao chamado, Histórico, Análise técnica e Conclusão/Recomendação). É **rascunho**: revise, numere e assine antes de oficializar.

### Notificações do chamado

- **Novo chamado** → engenheiros/arquitetos da **disciplina** da categoria (ou toda a Engenharia, se a categoria não tiver disciplina).
- **Diligência / desfecho / resolvido** → o **campus** dono.

> **Segurança dos anexos.** Os arquivos ficam no Cloud Storage **sob autenticação**, restritos ao prefixo `chamados/`, só imagem/PDF e com limite de tamanho; a **descoberta** é controlada pelo chamado (Firestore) e as **URLs são tokenizadas**. *(Detalhe técnico: o isolamento por campus na própria camada de Storage depende de custom claims — ver docs/ADR-002.)*

---

## 16. Apêndice A — Escalas GUT completas

**G — Gravidade do dano**

| Valor | Descrição |
|-------|-----------|
| 1 | Dano mínimo — impacta em melhorias pontuais |
| 2 | Dano leve |
| 3 | Dano regular |
| 4 | Grande dano |
| 5 | Dano gravíssimo — determinações (TCU, CGU, MPU, PGR e CP2) |

**U — Urgência da intervenção**

| Valor | Descrição |
|-------|-----------|
| 1 | Não há pressa |
| 2 | Pode aguardar |
| 3 | Mais cedo possível |
| 4 | Alguma urgência |
| 5 | Ação imediata |

**T — Tendência de evolução**

| Valor | Descrição |
|-------|-----------|
| 1 | Desaparece ou não piora |
| 2 | Piora em longo prazo |
| 3 | Piora em médio prazo |
| 4 | Piora em pouco tempo |
| 5 | Piora rapidamente |

> O **índice GUT** é o produto **G × U × T** (de 1 a 125). Ele entra na prioridade com o peso definido nos Parâmetros (padrão: 0,75 do GUT + 0,25 dos pontos de complexidade do art. 11).

---

## 17. Apêndice B — Status e transições por perfil

**Transições gerenciais** (para onde cada status pode ir):

| De | Para |
|----|------|
| Recebido | Em análise · Cancelado · Não enquadrado |
| Em análise | Em diligência · Aguardando CODIR · Na fila · Suspenso · Cancelado · Não enquadrado |
| Em diligência | Em análise · Cancelado |
| Aguardando CODIR | Na fila · Em análise · Suspenso · Cancelado |
| Na fila | Em atendimento · Aguardando CODIR · Suspenso · Cancelado |
| Em atendimento | Concluído · Suspenso |
| Suspenso | Em análise · Na fila · Em atendimento · Cancelado |
| Concluído · Cancelado · Não enquadrado | *(estados finais)* |

**Quem aplica cada transição**

- **Engenharia** — triagem: Em análise, Em diligência e o encaminhamento ao CODIR (“Aguardando aprovação do CODIR”).
- **CODIR** — aprova a demanda (de “Aguardando CODIR” para “Na fila”).
- **Chefe de Seção / Administrador** — **status total**, incluindo iniciar e encerrar o atendimento e as reversões abaixo.

**Reversões — somente Chefe de Seção / Administrador** (para desfazer erros):

| De | Pode voltar para |
|----|------------------|
| Em atendimento | Na fila · Aguardando CODIR · Em análise |
| Concluído | Em atendimento |

**Travas importantes**

- **Em atendimento** e **Concluído** bloqueiam a **exclusão** e a **alteração de classificação** (os pontos do art. 12 ficam “congelados” no atendimento).
- A **edição dos dados** da solicitação vai só até a submissão ao CODIR: é permitida em **Recebido**, **Em análise** e **Em diligência**; ao entrar em “Aguardando aprovação do CODIR”, congela para todos os perfis. Reverter para uma etapa anterior reabre a edição.
- Toda alteração de dados registra, no histórico, **quais campos** foram efetivamente alterados.

---

## 18. Apêndice C — Boas práticas

- **Classifique antes de avaliar.** Defina o tipo de atividade (fiscalização ou elaboração) — ele orienta a carga e a equipe.
- **GUT com critério.** Avalie G, U e T de forma defensável; o índice é público e sustenta a posição na fila.
- **Use a diligência a favor do campus.** Em vez de cancelar por falta de dados, devolva em diligência com um pedido objetivo.
- **Respeite o limite do art. 12.** Antes de alocar, confira a carga do profissional (teto de pontos nos Parâmetros).
- **Documente no histórico e nas observações.** A Observação da Engenharia (interna) registra o racional técnico; ela é pública para leitura, então escreva com clareza institucional.
- **Reversão é exceção.** Desfazer “Em atendimento” ou reabrir “Concluído” serve para corrigir erros — e sempre fica registrado.
- **Não exclua por impulso.** A exclusão move a demanda ao arquivo morto (30 dias); prefira Cancelado ou Suspenso quando o encerramento for legítimo.

---

## 19. Apêndice D — Solução de problemas (FAQ)

**Não consigo avaliar o GUT.**
Confira o status: a avaliação ocorre na triagem (Recebido/Em análise). Em atendimento ou concluída, a classificação está travada.

**O CODIR não consegue aprovar.**
A demanda precisa estar em “Aguardando aprovação do CODIR”. Encaminhe-a (após a análise GUT) para liberar a deliberação.

**Preciso alterar dados de uma demanda já enviada ao CODIR.**
A edição congela na submissão ao CODIR. Se for indispensável, a Chefia pode reverter o status para “Em análise”, reabrindo a edição.

**Aloquei um fiscal e a carga não bateu.**
A carga só conta a partir de “Em atendimento” (art. 12). Reversões devolvem os pontos ao contador.

**Excluí uma demanda por engano.**
Ela está no **arquivo morto** por 30 dias (visível ao Chefe/Admin no fim do Painel, com status “Excluído”). Abra-a e use **Resgatar**.

**Um cadastrador de campus aparece com mais de uma unidade.**
É esperado: cadastradores podem ser associados a vários campi (ex.: CREIR + Realengo I), em casos de gestão compartilhada.

---

## 20. Apêndice E — Glossário

- **SENG / DECOF** — Seção de Engenharia e a Diretoria de Engenharia, Contratos e Fiscalização à qual ela se vincula.
- **SUAP** — Sistema Unificado de Administração Pública; sistema eletrônico de processos do CPII.
- **GUT** — Gravidade × Urgência × Tendência (escala 1–5 por eixo; produto de 1 a 125).
- **Pontos de complexidade (art. 11)** — pontuação que reflete a complexidade da demanda (tombamento, projeto a contratar, especialidades, etc.).
- **Prioridade calculada** — índice que ordena a fila (GUT + valor + prazo, ponderados pelos pesos dos Parâmetros).
- **Fator de ajuste (CODIR)** — valor somado à prioridade; sinalizado com `*` na fila.
- **Limite do art. 12** — teto de pontos de carga por profissional (padrão: 6).
- **Equipe (art. 13)** — composição titular/substituto(s) por demanda.
- **Arquivo morto** — demandas excluídas, retidas 30 dias antes da exclusão definitiva.
- **Serviço emergencial (art. 11, §5º)** — risco iminente a pessoas ou patrimônio; **não** é fura-fila: a demanda ainda passa pelo CODIR.
- **Não enquadrado (Art. 18)** — demanda que não é obra ou serviço de engenharia da SENG.