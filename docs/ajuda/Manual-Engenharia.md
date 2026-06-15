# Manual Operacional da Engenharia — Sistema de Gestão de Demandas SENG

**Colégio Pedro II · Seção de Engenharia — SENG/DECOF**
**Portaria nº 7503/REITORIA/CPII, de 24/11/2025**

Guia operacional completo para a equipe da Seção de Engenharia (perfis **Engenharia**, **Chefe de Seção** e **Administrador**): triagem, avaliação técnica (GUT), tramitação, alocação de fiscais, profissionais, parâmetros e administração. Escrito também para servir de base às **seções de ajuda do portal** — cada seção é autocontida.

> **Nota sobre as imagens.** As telas foram reproduzidas a partir do próprio código do sistema, em **modo de demonstração** (dados fictícios). A aparência é idêntica à do sistema real. Os marcadores vermelhos numerados (①, ②, …) foram acrescentados sobre os campos para fins didáticos — não aparecem no sistema.

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
15. Apêndice A — Escalas GUT completas
16. Apêndice B — Status e transições por perfil
17. Apêndice C — Boas práticas
18. Apêndice D — Solução de problemas (FAQ)
19. Apêndice E — Glossário

---

## 1. Visão geral

O sistema unifica, em uma única ferramenta web, todo o ciclo das demandas de obras e serviços de engenharia — do cadastro pelo campus à conclusão pela SENG. Ele substitui o conjunto Formulário + Excel + Power BI e **replica o cálculo de priorização** já usado pela Seção, conforme a Portaria 7503/2025.

Princípios de projeto:

- **Cadastro contínuo** e **fila pública** (transparência).
- **Cálculo padronizado** de prioridade (GUT + valor + prazo).
- **Controle de carga** por profissional (limite do art. 12) e de equipes (art. 13).
- **Segurança por design**: dados públicos e internos separados; permissões validadas no servidor.
- **Rastreabilidade total**: histórico por demanda + log de auditoria.

---

## 2. Perfis e permissões

As capacidades de cada perfil espelham a Portaria e são validadas **também nas regras de segurança do banco** (não apenas na interface).

| Perfil | Pode |
|--------|------|
| **Campus** | Cadastrar solicitações do seu campus; acompanhar; complementar em diligência. |
| **Engenharia** | Tudo do Campus (qualquer campus) + ver dados internos, **avaliar (GUT)** e aplicar status de triagem (Em análise, Em diligência, Aguardando CODIR). |
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

O cálculo replica o modelo do Power BI da SENG (art. 5º, II):

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

![Tela de acesso](docs/ajuda/img/login.png)
*Figura 1 — Acesso ao sistema.*

2. No **Painel**, autenticado, a tabela ganha a coluna **Fiscal técnico** e o filtro **“Minhas atribuições”**; o cartão **Carga da equipe** aparece **logo acima da fila**, para ficar sempre visível independentemente do tamanho da lista.
3. Para triar, filtre por **status “Recebido”** (ou por especialidade) e abra as demandas pendentes.

![Painel interno da SENG, com colunas e carga da equipe](docs/ajuda/img/eng-painel.png)
*Figura 2 — Painel autenticado: coluna de fiscal técnico, filtro “Minhas atribuições” e carga da equipe.*

> **Triagem recomendada:** comece pelas demandas **Recebidas** mais antigas; mova rapidamente para **Em análise**; abra **diligência** quando faltar informação.

> **Exportações:** além do **Baixar PDF da fila**, o painel interno tem **Baixar Excel** (.xlsx com todas as colunas — classificação, escores, alocação e observações), disponível apenas para Engenharia, Chefe e Administrador.

> **Ordenação do Painel.** As demandas **encerradas** são automaticamente **deslocadas para o fim da lista**, na ordem **Concluídas → Não enquadradas → Canceladas** (Canceladas por último), preservando a prioridade dentro de cada grupo — assim a visualização inicial destaca as demandas **ativas**.

---

## 6. Fluxo 2 — Abrir e ler uma demanda

Clique em uma linha do painel para abrir o detalhe. A página é dividida em duas colunas:

- **Esquerda:** dados da solicitação e **histórico** completo.
- **Direita:** **Priorização**, **Avaliação técnica**, **Gestão**, **Alocação** e **Observações** — esta última um **histórico de comentários públicos** (fio interno da Engenharia e fio externo do solicitante/CODIR).

![Detalhe de uma demanda, em duas colunas](docs/ajuda/img/eng-demanda.png)
*Figura 3 — Detalhe da demanda: dados/histórico à esquerda; priorização, avaliação, gestão e alocação à direita.*

> **Editar dados da solicitação.** Enquanto a demanda **não foi submetida ao CODIR** (status Recebido, Em análise ou Em diligência), o cartão **“Editar dados da solicitação”** permite corrigir localização, tipo, situação do projeto, valor, prazo, processo SUAP, objeto, descrição, especialidades e o sinalizador emergencial. A edição é aberta a **Engenharia, Chefia, Administração e CODIR** (qualquer demanda) e ao **Campus** (apenas as da própria unidade). Ao entrar em **“Aguardando aprovação do CODIR”**, os dados **congelam para todos**; para corrigir, **reverta o status** (Fluxo 5) e a edição reabre. A **unidade (campus) não é editável** (compõe o identificador). Cada alteração registra no **histórico** e no **log de auditoria** **exatamente quais campos** mudaram — ex.: *“Dados da solicitação editados — campos: Processo SUAP, Valor estimado, Prazo estimado”*.

> **Observações (comentários públicos).** Cada demanda tem dois fios de comentários — o **da Engenharia (interna)** e o **do solicitante / CODIR (externa)** — **visíveis a todos**, inclusive no painel público, em modo leitura. Cada comentário registra **autor e data/hora**. Quem pode **escrever**: no fio interno, Engenharia/Chefia/Administração; no externo, o Campus (da própria unidade), o CODIR e a Administração. O **autor pode editar** o próprio comentário (fica marcado *(editado)*) e **excluí-lo**; além do autor, podem excluir — no interno, a Chefia/Administração; no externo, o CODIR/Solicitante/Administração. Toda ação fica no log de auditoria.

---

## 7. Fluxo 3 — Avaliação técnica (GUT)

Este é o núcleo do trabalho da Engenharia.

**Passo a passo**

1. Abra a demanda (Fluxo 2).
2. No cartão **Avaliação técnica (GUT)**, preencha os campos numerados:

![Cartão de avaliação técnica com campos numerados](docs/ajuda/img/eng-avaliacao-marcado.png)
*Figura 4 — Avaliação técnica (GUT). Marcadores ① a ⑥ correspondem à lista abaixo.*

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

![Cartão de priorização com GUT, scores e prioridade final](docs/ajuda/img/eng-priorizacao-card.png)
*Figura 5 — Priorização: G/U/T, GUT, Score de Valor (V) e de Prazo (P), Prazo×Custo, prioridade calculada e final, pontos (art. 11) e situação da aprovação do CODIR.*

---

## 8. Fluxo 4 — Tramitar status, diligência e encaminhamento ao CODIR

No cartão **Gestão** ficam as transições de status disponíveis para o seu perfil.

![Cartão de gestão com transições de status](docs/ajuda/img/eng-gestao-card.png)
*Figura 6 — Gestão: a Engenharia aplica os status de triagem (Em diligência, Aguardando aprovação do CODIR).*

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

![Aviso de demanda travada (em atendimento)](docs/ajuda/img/eng-demanda-travada.png)
*Figura 7 — Demanda “Em atendimento”: avaliação e exclusão bloqueadas.*

> **Desfazer um status indevido (Chefe/Admin).** Se uma demanda for marcada **Em atendimento** por engano, a **Chefia/Administração** pode **revertê-la diretamente**: no cartão **Gestão** aparecem os botões **Na fila**, **Aguardando aprovação do CODIR** e **Em análise**. Uma demanda **Concluída** por engano pode ser **reaberta** para **Em atendimento**. A ação pede confirmação e é registrada no histórico (muda **apenas o status** — a classificação é preservada; reverter o atendimento libera os pontos do art. 12, reabrir a conclusão volta a contá-los).
>
> Para **editar os dados** de uma demanda em atendimento, o caminho continua sendo **Suspender → editar → retomar o atendimento**.

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

![Cartão de gestão com a alocação de fiscais (seleção múltipla)](docs/ajuda/img/chefe-gestao-card.png)
*Figura 8 — Alocação: fiscais titulares e substitutos (um ou mais) e equipe de planejamento, cada um com a sua carga.*

---

## 11. Fluxo 7 — Carga da equipe (art. 12)

No **Painel** autenticado, o cartão **Carga da equipe** consolida a pontuação de cada profissional.

![Painel de carga da equipe](docs/ajuda/img/eng-carga-equipe.png)
*Figura 9 — Carga da equipe: pontos por profissional, com barra de uso do limite (art. 12).*

- A barra indica o uso em relação ao **limite de 6 pontos**.
- São separados **pontos regulares**, **emergenciais** e de **planejamento**.
- Use para **equilibrar** a distribuição antes de novas alocações.

---

## 12. Fluxo 8 — Profissionais (cadastro e art. 13)

**Perfil necessário: Chefe de Seção (ou Administrador).**

O cadastro está em **Profissionais** (menu superior).

![Página de profissionais, com carga e art. 13](docs/ajuda/img/chefe-profissionais.png)
*Figura 10 — Profissionais: cartões com carga individual e o painel de equipes de planejamento por especialidade (art. 13).*

**Cadastrar/editar um profissional**

1. Clique em **+ Novo profissional**.
2. Preencha os campos:

![Formulário de novo profissional, com campos numerados](docs/ajuda/img/profissional-novo.png)
*Figura 11 — Novo profissional. Marcadores ① a ④.*

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

![Cartão de parâmetros do sistema](docs/ajuda/img/chefe-parametros-card.png)
*Figura 12 — Parâmetros: ano do plano, valor de referência, pesos e limite de pontos.*

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

![Cartão de usuários da administração](docs/ajuda/img/admin-usuarios-card.png)
*Figura 13 — Lista de usuários e perfis (exclusivo do Administrador).*

2. Preencha o formulário:

![Formulário de novo usuário, com campos numerados](docs/ajuda/img/admin-novo-usuario.png)
*Figura 14 — Novo usuário. Marcadores ① a ⑤.*

| Nº | Campo | Como preencher |
|----|-------|----------------|
| ① | **Nome** | Nome completo da pessoa. |
| ② | **E-mail** | Para a SENG, use o **mesmo e-mail** que será o do profissional — o vínculo é automático. |
| ③ | **Perfil** | Campus, Engenharia, Chefe de Seção, CODIR ou Administrador. |
| ④ | **Campus** | Apenas para o perfil **Campus** — define a unidade vinculada. |
| ⑤ | **Senha inicial** | Mínimo de 6 caracteres; a pessoa troca depois em “Minha conta”. |

3. Clique em **Salvar**. A credencial e o perfil são criados de uma só vez (sem console externo).

**Salvaguardas e auditoria**

- Um administrador **não pode revogar o próprio perfil**; sempre resta ao menos um administrador ativo.
- O **Log de auditoria** registra **toda** modificação (o quê, quando, quem), de forma **imutável** — visível apenas ao Administrador.

![Log de auditoria](docs/ajuda/img/admin-log-card.png)
*Figura 15 — Log de auditoria: trilha imutável de todas as ações.*

---

## 15. Apêndice A — Escalas GUT completas

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
| 