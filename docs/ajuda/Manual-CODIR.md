# Manual do CODIR — Sistema de Gestão de Demandas SENG

**Colégio Pedro II · Seção de Engenharia — SENG/DECOF**
**Portaria nº 7503/REITORIA/CPII, de 24/11/2025**

Guia do Conselho Diretor (CODIR) para **aprovar** demandas de obras e serviços de engenharia e, quando necessário, aplicar um **fator de ajuste** de prioridade — sempre com justificativa e total rastreabilidade. Escrito também para servir de base às **seções de ajuda do portal**.

> [!nota] **Sobre as imagens.** As telas são **reproduções fiéis** do sistema (mesmas cores e componentes), com dados de exemplo e **marcadores numerados** apenas didáticos. Acompanham o **tema claro/escuro** da página.

---

## Sumário

1. O papel do CODIR
2. O que mudou: separação de funções
3. Onde o CODIR atua no ciclo
4. Como ler a prioridade
5. Fluxo 1 — Acessar e ler a fila
6. Fluxo 2 — Abrir uma demanda para deliberar
7. Fluxo 3 — Aprovar a demanda
8. Fluxo 4 — Definir o fator de ajuste
9. Fluxo 5 — Conferir o efeito do ajuste
10. Apêndice A — Quando o CODIR atua (e travas)
11. Apêndice B — Transparência e auditoria
12. Apêndice C — Boas práticas
13. Apêndice D — Solução de problemas (FAQ)
14. Apêndice E — Glossário

---

## 1. O papel do CODIR

No novo fluxo, o CODIR é a instância que **aprova** as demandas já avaliadas tecnicamente pela Seção de Engenharia e, quando entende necessário, **ajusta** a prioridade. O sistema oferece ao Conselho uma base **objetiva e transparente** para decidir:

- O índice **GUT** e a **prioridade calculada** de cada demanda;
- O **valor**, o **prazo** e os **pontos de complexidade** (art. 11);
- O **histórico** completo da demanda.

Toda deliberação fica **registrada** (histórico da demanda + log de auditoria).

---

## 2. O que mudou: separação de funções

A Portaria 7503/2025 separa a **avaliação técnica** (Engenharia) da **decisão de mérito** (CODIR):

- A **Engenharia** aplica o GUT e calcula a prioridade de forma padronizada.
- O **CODIR** aprova e pode ajustar a prioridade. *(A Chefia da SENG deixou de acumular essa função.)*
- Ao **aprovar**, a demanda **entra na fila automaticamente**.
- O **ajuste** exige **justificativa** e fica sinalizado na fila com um asterisco (\*).

---

## 3. Onde o CODIR atua no ciclo

Caminho principal da demanda:

**Em análise → Aguardando aprovação do CODIR → Na fila → Em atendimento → Concluído**

O CODIR atua a partir do status **“Aguardando aprovação do CODIR”** (após a análise GUT). Também é possível rever o ajuste enquanto a demanda está **Na fila** ou **Suspensa**. Demandas **Em atendimento** ou **Concluídas** ficam **travadas** (não aceitam aprovação nem ajuste).

> **Origem por chamado.** As demandas chegam ao CODIR a partir da **triagem de um chamado**: quando a SENG classifica um chamado como **obra**, ele é convertido em demanda (status Recebido), avaliado (GUT) e então enviado para a sua aprovação. Para o CODIR, o fluxo de deliberação é o mesmo — muda apenas a **porta de entrada** (o chamado unificou a antiga “Nova solicitação”).

> **Projeto + Obra.** Uma demanda que exigia projeto e obra **volta ao CODIR como obra** (com projeto existente) quando a etapa de projeto é concluída — reaprove e reposicione na fila normalmente, conferindo o GUT e o valor reavaliados para a obra.

---

## 4. Como ler a prioridade

A fila é ordenada pela **prioridade final**, composta por:

- **GUT** = Gravidade × Urgência × Tendência (1 a 125) — peso 0,75.
- **Prazo × Custo** — combina as faixas de valor e de prazo — peso 0,25.
- **Prioridade** = 0,75 · (GUT/125) + 0,25 · (Prazo × Custo).
- **Prioridade final** = Prioridade + **fator de ajuste do CODIR**.

A coluna **Pts** mostra os **pontos de complexidade** (art. 11) — o esforço estimado da equipe técnica.

---

## 5. Fluxo 1 — Acessar e ler a fila

**Passo a passo**

1. Entre com seu e-mail e senha. *(A consulta à fila e o PDF são públicos; o login habilita a deliberação.)*

@fig login

2. No **Painel**, veja a fila ordenada por prioridade, com **GUT**, **Prioridade** e **Pts**.
3. Use os **filtros** (campus, status, tipo de atividade, especialidade) ou a **busca**.
4. Se desejar, clique em **Baixar PDF da fila** (relatório com timbre e data/hora).

@fig codir-painel

**Leitura das colunas**

| Coluna | Significado |
|--------|-------------|
| **Fila** | Posição entre as demandas com status “Na fila”. |
| **GUT** | Gravidade × Urgência × Tendência (1 a 125). |
| **Prioridade** | Prioridade final (cálculo + ajuste do CODIR). Um `*` indica que há ajuste aplicado. |
| **Pts** | Pontos de complexidade (art. 11). |

> **Notificações (sino do cabeçalho).** O ícone de **sino**, ao lado do seu nome, traz um **contador** de avisos não lidos e abre a sua **área pessoal de notificações**, em que **cada linha é um link** para a demanda. O CODIR é avisado quando uma demanda é **enviada para aprovação** (após a análise GUT) e quando qualquer demanda é **concluída**. Abrir a notificação a marca como lida; há também **“marcar todas como lidas”**. Os avisos já lidos são removidos automaticamente após 30 dias.

---

## 6. Fluxo 2 — Abrir uma demanda para deliberar

**Passo a passo**

1. Filtre a fila pelo status **“Aguardando aprovação do CODIR”**.
2. Clique na demanda para abrir os detalhes.
3. Revise os **dados**, a **priorização calculada** e o **histórico**. O cartão de **Deliberação do CODIR** aparece na coluna da direita.

@fig codir-demanda

---

## 7. Fluxo 3 — Aprovar a demanda

No cartão **Deliberação do CODIR**:

@fig codir-deliberacao

1. **① “Aprovada pelo CODIR”** — marque esta caixa para validar a demanda. Ao marcar, a demanda **entra automaticamente na fila**.
2. A ação é registrada no **histórico** com data e responsável.

> A aprovação só fica disponível quando a demanda está em **“Aguardando aprovação do CODIR”** (ou status posteriores elegíveis). Antes da análise GUT, o cartão informa que a deliberação ainda não está liberada.

---

## 8. Fluxo 4 — Definir o fator de ajuste

Quando o Conselho entender que a ordem deve ser ajustada (por relevância institucional, risco, acessibilidade, etc.):

1. **② Fator de ajuste** — informe um número somado à prioridade calculada. Ex.: **+0,05** (sobe na fila) ou **−0,03** (desce). Use valores pequenos.
2. **③ Justificativa** — **obrigatória**. Descreva o motivo da deliberação (ela fica registrada).
3. Clique em **Salvar ajuste**.

> O ajuste **altera a posição** da demanda na fila e é sinalizado com `*` na coluna de prioridade, garantindo transparência. Use com **parcimônia**: o cálculo já reflete os critérios da Portaria.

---

## 9. Fluxo 5 — Conferir o efeito do ajuste

Após salvar, confira o resultado no cartão **Priorização**:

@fig codir-prioriz-ajuste

- A **Prioridade final** = prioridade calculada **+** fator de ajuste.
- A linha **“Ajuste (CODIR)”** exibe o valor e a justificativa.
- Ao aprovar, a demanda passa a **“Na fila”** e assume sua posição (com a marca `*`).

@fig codir-aprovada

---

## 10. Apêndice A — Quando o CODIR atua (e travas)

| Situação da demanda | Deliberação do CODIR |
|---------------------|----------------------|
| Recebido / Em análise / Em diligência | Indisponível (aguarda a análise GUT da Engenharia). |
| **Aguardando aprovação do CODIR** | **Disponível** — aprovar e/ou ajustar. |
| Na fila | Disponível — rever o ajuste. |
| Suspenso | Disponível. |
| Em atendimento / Concluído | **Travada** — não aceita aprovação nem ajuste. |

---

## 11. Apêndice B — Transparência e auditoria

- O **Painel** e o **PDF** são públicos (a fila e a posição de cada demanda são abertas; nomes de profissionais ficam ocultos na visão pública).
- O **histórico** de cada demanda registra cada aprovação e ajuste, com data e autor.
- O **log de auditoria** (visível ao Administrador) guarda toda modificação de forma **imutável**.
- A fila sinaliza com `*` as demandas com fator de ajuste do CODIR.

---

## 12. Apêndice C — Boas práticas de deliberação

- **Decida sobre a base objetiva.** O GUT e a prioridade calculada já refletem os critérios da Portaria; use-os como ponto de partida.
- **Ajuste com parcimônia.** O fator de ajuste é exceção, não regra. Prefira valores pequenos e reserve-os para casos de relevância institucional, risco ou acessibilidade que o cálculo não capture.
- **Justifique sempre.** A justificativa é obrigatória e fica registrada. Escreva de modo que qualquer pessoa, lendo depois, entenda o motivo.
- **Cada ajuste é público.** A marca `*` na fila sinaliza a intervenção do CODIR e afeta a posição relativa de outras demandas — reordene com cuidado.
- **Delibere no momento certo.** A ação só abre quando a demanda está em “Aguardando aprovação do CODIR”. Não há o que decidir antes da análise GUT da Engenharia.
- **Leia o histórico.** Antes de deliberar, abra a demanda e percorra o histórico e as observações — eles trazem o contexto da triagem.

---

## 13. Apêndice D — Solução de problemas (FAQ)

**Não encontro o cartão “Deliberação do CODIR”.**
A demanda provavelmente ainda não passou pela análise GUT, ou já está em atendimento/concluída (deliberação travada). O cartão só fica ativo em “Aguardando aprovação do CODIR” (e, para rever o ajuste, em “Na fila” ou “Suspenso”).

**Aprovei uma demanda por engano.**
Procure a Chefia da SENG: os perfis Chefe de Seção/Administrador podem reverter o status (desfazer a entrada na fila), mantendo tudo registrado no histórico.

**Quero mudar só a prioridade, sem aprovar.**
São ações independentes. Você pode salvar o fator de ajuste sem marcar “Aprovada”, e vice-versa — mas a demanda só entra na fila quando aprovada.

**Defini um ajuste e a posição não mudou como eu esperava.**
A prioridade final é a calculada **mais** o ajuste; demandas vizinhas podem ter índices próximos. Confira o cartão Priorização, que mostra o valor calculado, o ajuste e a prioridade final.

**Não consigo aprovar — o sistema diz que está travado.**
Demandas “Em atendimento” ou “Concluído” não aceitam deliberação. Se for necessário rever, a Chefia pode reverter o status antes.

---

## 14. Apêndice E — Glossário

- **SENG** — Seção de Engenharia do Colégio Pedro II, vinculada à **DECOF** (Diretoria de Engenharia, Contratos e Fiscalização).
- **CODIR** — instância colegiada que **aprova** as demandas avaliadas pela SENG e define o **fator de ajuste**.
- **SUAP** — Sistema Unificado de Administração Pública; o sistema eletrônico de processos do CPII.
- **GUT** — método de priorização: **G**ravidade × **U**rgência × **T**endência (escala de 1 a 5 em cada eixo).
- **Prioridade calculada** — índice que ordena a fila, combinando o GUT com valor, prazo e os pontos de complexidade (art. 11).
- **Fator de ajuste** — valor somado pelo CODIR à prioridade calculada; sinalizado com `*` na fila.
- **Prioridade final** — prioridade calculada + fator de ajuste.
- **Na fila** — demanda aprovada, aguardando atendimento, na posição dada pela prioridade.
- **Aguardando aprovação do CODIR** — status em que a deliberação do Conselho fica disponível.
- **Histórico / log de auditoria** — registros imutáveis de cada ação (na demanda e no sistema).
- **Chamado** — porta de entrada da Engenharia; toda demanda de obra nasce da **triagem** de um chamado do campus.