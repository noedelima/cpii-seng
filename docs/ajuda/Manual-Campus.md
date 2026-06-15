# Manual do Campus — Sistema de Gestão de Demandas SENG

**Colégio Pedro II · Seção de Engenharia — SENG/DECOF**
**Portaria nº 7503/REITORIA/CPII, de 24/11/2025**

Guia completo, passo a passo, para as unidades (campi) **cadastrarem e acompanharem** demandas de obras e serviços de engenharia. Este material foi escrito para servir também como **conteúdo das seções de ajuda do portal**: cada seção numerada é autocontida e pode ser publicada como um artigo de ajuda independente.

> **Nota sobre as imagens.** As telas deste manual foram reproduzidas a partir do próprio código do sistema, em **modo de demonstração** (dados fictícios). A aparência é idêntica à do sistema real; apenas os dados (campi, objetos, valores) são exemplos. Os marcadores vermelhos numerados (①, ②, …) foram acrescentados sobre os campos para fins didáticos — eles **não** aparecem no sistema.

---

## Sumário

1. A quem se destina e o que muda
2. Antes de começar (pré-requisitos)
3. Conceitos essenciais (papéis, fluxo e status)
4. Fluxo 1 — Acessar o sistema
5. Fluxo 2 — Consultar a fila (painel público)
6. Fluxo 3 — Cadastrar uma nova solicitação (campo a campo)
7. Fluxo 4 — Acompanhar uma demanda
8. Fluxo 5 — Responder a uma diligência
9. Fluxo 6 — Minha conta e troca de senha
10. Apêndice A — O que **não** é demanda da SENG (Art. 18)
11. Apêndice B — Tabela de status
12. Apêndice C — Boas práticas
13. Apêndice D — Solução de problemas (FAQ)
14. Apêndice E — Glossário

---

## 1. A quem se destina e o que muda

Este manual é para os responsáveis pelo cadastro de demandas nos campi — tipicamente a **DIAD** e a **Prefeitura** de cada unidade, além de substitutos e delegados.

O sistema substitui o antigo levantamento anual (Formulário + Excel + Power BI) por um **cadastro contínuo e on-line**. Na prática:

- Você registra a demanda **assim que a necessidade surge** — não precisa esperar a coleta anual.
- A fila de demandas é **pública e transparente**: qualquer pessoa vê o status e a posição.
- A **priorização é padronizada** (critérios GUT, valor e prazo, conforme a Portaria 7503/2025).
- Todo o **histórico** fica registrado (quem fez o quê e quando).

**O que você consegue fazer no sistema:** consultar a fila e baixar o relatório (sem login); cadastrar solicitações do seu campus; acompanhar o andamento; responder diligências; e trocar a sua senha.

---

## 2. Antes de começar (pré-requisitos)

- **Navegador atualizado** (Chrome, Edge ou Firefox). O sistema é responsivo e funciona em computador, tablet e celular.
- **Credencial de acesso**: e-mail institucional e senha, com perfil **Campus** já vinculado à sua unidade. Se ainda não tem acesso, solicite à SENG/Administração.
- **Informações da demanda em mãos**: localização, tipo (obra, projeto, laudo…), uma breve descrição do problema e, se houver, o **número do Processo SUAP** e uma estimativa de valor.

> **Dica.** Mesmo sem login você já pode **consultar a fila** (Fluxo 2). O login é necessário apenas para **cadastrar** e **acompanhar**.

---

## 3. Conceitos essenciais (papéis, fluxo e status)

**Quem faz o quê**

- **Campus (você)** — cadastra solicitações do seu campus e responde diligências.
- **Seção de Engenharia (SENG)** — faz a triagem, a avaliação técnica (GUT) e a execução/fiscalização.
- **CODIR** — aprova a demanda e pode ajustar a prioridade, com justificativa.
- **Administração** — cadastra usuários e mantém os parâmetros do sistema.

**Ciclo de vida da demanda (caminho principal)**

**Recebido → Em análise → Aguardando aprovação do CODIR → Na fila → Em atendimento → Concluído**

**Estados laterais possíveis**

- **Em diligência** — a SENG precisa de informações complementares e devolve a demanda para você responder.
- **Suspenso** — temporariamente parada.
- **Cancelado** — encerrada sem atendimento.
- **Não enquadrado (Art. 18)** — não é uma demanda de engenharia da SENG (ver Apêndice A).

---

## 4. Fluxo 1 — Acessar o sistema

A **consulta à fila** e o **relatório em PDF** são **públicos** — não exigem login. Para **cadastrar** e **acompanhar**, é preciso entrar.

**Passo a passo**

1. Abra o endereço do sistema no navegador.
2. Clique em **Entrar** (canto superior direito).
3. Informe o seu **e-mail institucional** e a **senha**.
4. Clique em **Entrar**. Você será levado ao Painel, já autenticado.

![Tela de acesso ao sistema](docs/ajuda/img/login.png)
*Figura 1 — Tela de acesso. A consulta e o PDF são públicos; o login habilita cadastro e acompanhamento.*

> **Segurança**
> - O perfil **Campus** já vem amarrado à sua unidade — você só cadastra e enxerga as ações do seu próprio campus.
> - A senha pode ser trocada por você a qualquer momento (Fluxo 6).
> - Nunca compartilhe sua senha. Em caso de dúvida sobre o acesso, fale com a SENG.

---

## 5. Fluxo 2 — Consultar a fila (painel público)

O **Painel** lista todas as demandas, com campus, objeto, status, índice GUT, prioridade e data de atualização.

![Painel público com a fila de demandas](docs/ajuda/img/pub-dashboard.png)
*Figura 2 — Painel público: fila de demandas, barra de filtros e botão de exportação em PDF.*

**O que você pode fazer aqui**

1. **Filtrar** a fila por **campus**, **status**, **tipo de atividade**, **especialidade** ou por **busca livre** (digite parte do objeto, da descrição ou do nome do campus).
2. **Abrir uma demanda**: clique em qualquer linha da tabela para ver os detalhes.
3. **Baixar o PDF da fila**: clique em **Baixar PDF da fila** para gerar um relatório com timbre e data/hora. O arquivo é baixado para o seu computador e **não fica armazenado** no sistema (relatório efêmero).

**Como ler a tabela**

- **Fila** — posição (1º, 2º, …) apenas das demandas com status **Na fila**.
- **GUT** — índice de gravidade × urgência × tendência.
- **Prioridade** — valor final de priorização; um **asterisco (\*)** indica que o CODIR aplicou um fator de ajuste.
- **Atualização** — data/hora da última movimentação.

---

## 6. Fluxo 3 — Cadastrar uma nova solicitação (campo a campo)

Este é o fluxo mais importante para o campus.

**Passo a passo**

1. Faça login (Fluxo 1).
2. No Painel, clique em **+ Nova solicitação** (botão no topo).

![Painel autenticado do campus, com o botão Nova solicitação](docs/ajuda/img/campus-painel.png)
*Figura 3 — Após entrar, use o botão “+ Nova solicitação”.*

3. O formulário abre em branco. Os campos obrigatórios são marcados com asterisco (\*).

![Formulário de nova solicitação em branco](docs/ajuda/img/campus-nova-vazia.png)
*Figura 4 — Formulário em branco, pronto para preenchimento.*

4. Preencha os campos. A figura a seguir mostra o formulário **preenchido** com os campos **numerados** de ① a ⑪; o detalhamento vem logo abaixo.

![Formulário de nova solicitação com os campos numerados de 1 a 11](docs/ajuda/img/campus-nova-preenchida.png)
*Figura 5 — Formulário preenchido (campos numerados ① a ⑪).*

### Detalhamento dos campos 1 a 6

![Detalhe dos campos 1 a 6](docs/ajuda/img/campus-form-a.png)
*Figura 6 — Campos ① a ⑥.*

| Nº | Campo | Como preencher |
|----|-------|----------------|
| ① | **Campus / unidade** | Já vem definido pelo seu perfil — não é necessário alterar. |
| ② | **Localização no campus** | Onde fica a intervenção: bloco, pavimento, salas. Ex.: *Bloco B, 2º pavimento, salas 201–204*. |
| ③ | **Tipo de demanda** | Obra/reforma, elaboração de projeto, projeto e obra, laudo/avaliação técnica, assessoria técnica ou outro. |
| ④ | **Projeto já existe?** | *Sim, completo* / *Sim, parcial (precisa complementar)* / *Não — necessita contratar projeto*. |
| ⑤ | **Imóvel tombado / patrimônio histórico?** | *Sim* / *Não* / *Não sei informar*. Influencia a complexidade e a pontuação. |
| ⑥ | **Previsão de prazo desejada** | *Menos de 6 meses* / *6 a 12 meses* / *Mais de 12 meses* (ou sem previsão). |

### Detalhamento dos campos 7 a 11

![Detalhe dos campos 7 a 11](docs/ajuda/img/campus-form-b.png)
*Figura 7 — Campos ⑦ a ⑪, especialidades e o aviso de serviço emergencial.*

| Nº | Campo | Como preencher |
|----|-------|----------------|
| ⑦ | **Valor estimado (R$)** | Opcional. Se você conhece uma estimativa, informe — ajuda na priorização. |
| ⑧ | **Processo SUAP** | Número do **Processo SUAP**, se já houver (ex.: `23040.001234/2026-11`). |
| ⑨ | **Objeto resumido** | Título curto e claro. Ex.: *Reforma do telhado da quadra coberta*. |
| ⑩ | **Especialidades envolvidas** | Marque **uma ou mais**: Arquitetura, Engenharia Civil, Elétrica, Mecânica, Segurança do Trabalho. |
| ⑪ | **Descrição completa** | O problema, o objetivo e o resultado esperado. Quanto melhor, mais rápida a triagem. |

5. **Serviço emergencial:** marque essa opção **apenas** quando houver **risco iminente** à segurança de pessoas ou ao patrimônio (art. 11, §5º). Não marque por padrão.
6. Clique em **Registrar solicitação**.
7. A demanda é criada com status **Recebido** e recebe um identificador automático no padrão `ANO + SIGLA DO CAMPUS + SEQUENCIAL` (ex.: `2026CSCII01`). Você é levado direto à página de detalhes.

> **Dica.** Antes de cadastrar, confira no Painel (Fluxo 2) se a demanda **já não foi registrada** pelo seu campus, para evitar duplicidade.

---

## 7. Fluxo 4 — Acompanhar uma demanda

Depois de cadastrada, acompanhe a evolução a qualquer momento.

**Passo a passo**

1. No Painel, **filtre pelo seu campus** ou use a busca pelo objeto.
2. Clique na linha da demanda para abrir os detalhes.
3. Confira o **status atual** (selo colorido) e o **Histórico** completo, que registra cada etapa: registro, análise, diligência, aprovação do CODIR, entrada na fila, atendimento e conclusão.

![Página de detalhes de uma demanda, com status e histórico](docs/ajuda/img/campus-demanda-acompanhar.png)
*Figura 8 — Detalhe da demanda (visão do campus): dados, descrição e histórico.*

> A página mostra também a **priorização** calculada (GUT, prioridade e pontos). A **alocação de profissionais** só é exibida para usuários internos da SENG — no painel público, os nomes ficam ocultos, preservando o anonimato.

---

## 8. Fluxo 5 — Responder a uma diligência

Quando faltam informações para a SENG avaliar a demanda, ela coloca a solicitação em **Em diligência**. Cabe ao campus complementar.

**Passo a passo**

1. Ao acompanhar suas demandas (Fluxo 4), localize a que está **Em diligência** — é o sinal de que a SENG aguarda um complemento seu.
2. Abra a demanda.
3. Localize o campo **“Responder diligência”** (na página de detalhes).
4. Escreva as informações solicitadas (locais de intervenção, estimativa de área, etc.).
5. Clique em **Enviar complemento**.
6. Ao enviar, a demanda **retorna automaticamente para “Em análise”** e a SENG retoma a triagem. O seu complemento fica anexado à descrição e registrado no histórico.

![Demanda em diligência, com o campo de resposta](docs/ajuda/img/campus-demanda-diligencia.png)
*Figura 9 — Demanda “Em diligência”: use o campo “Responder diligência” para complementar.*

---

## 9. Fluxo 6 — Minha conta e troca de senha

**Passo a passo**

1. Clique no **seu nome**, no canto superior direito da página.
2. Em **Minha conta**, confira seus dados de acesso (nome, e-mail, perfil, campus).
3. Para trocar a senha, informe a **senha atual**, a **nova senha** (mínimo de 6 caracteres) e a **confirmação**.
4. Clique em **Alterar senha**.

![Tela Minha conta, com dados de acesso e troca de senha](docs/ajuda/img/campus-conta.png)
*Figura 10 — “Minha conta”: dados de acesso e troca de senha pela própria interface.*

> A nova senha deve ser **diferente** da atual e ter **ao menos 6 caracteres**. A troca é imediata e segura.

---

## 10. Apêndice A — O que **não** é demanda da SENG (Art. 18)

A Seção de Engenharia trata de **obras e serviços de engenharia**. **Não** são atendidas pela SENG (art. 18 da Portaria 7503/2025) e serão marcadas como **“Não enquadrado (Art. 18)”**:

- **Manutençã