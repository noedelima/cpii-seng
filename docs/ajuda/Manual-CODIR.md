# Manual do CODIR — Sistema de Gestão de Demandas SENG

**Colégio Pedro II · Seção de Engenharia — SENG/DECOF**
**Portaria nº 7503/REITORIA/CPII, de 24/11/2025**

Guia do Conselho Diretor (CODIR) para **aprovar** demandas de obras e serviços de engenharia e, quando necessário, aplicar um **fator de ajuste** de prioridade — sempre com justificativa e total rastreabilidade. Escrito também para servir de base às **seções de ajuda do portal**.

> **Nota sobre as imagens.** As telas foram reproduzidas a partir do próprio código do sistema, em **modo de demonstração** (dados fictícios). A aparência é idêntica à do sistema real. Os marcadores vermelhos numerados (①, ②, …) foram acrescentados para fins didáticos — não aparecem no sistema.

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

![Tela de acesso](docs/ajuda/img/login.png)
*Figura 1 — Acesso ao sistema.*

2. No **Painel**, veja a fila ordenada por prioridade, com **GUT**, **Prioridade** e **Pts**.
3. Use os **filtros** (campus, status, tipo de atividade, especialidade) ou a **busca**.
4. Se desejar, clique em **Baixar PDF da fila** (relatório com timbre e data/hora).

![Painel do CODIR com a fila priorizada](docs/ajuda/img/codir-painel.png)
*Figura 2 — Painel: fila ordenada por prioridade, com GUT, prioridade e pontos.*

**Leitura das colunas**

| Coluna | Significado |
|--------|-------------|
| **Fila** | Posição entre as demandas com status “Na fila”. |
| **GUT** | Gravidade × Urgência × Tendência (1 a 125). |
| **Prioridade** | Prioridade final (cálculo + ajuste do CODIR). Um `*` indica que há ajuste aplicado. |
| **Pts** | Pontos de complexidade (art. 11). |

---

## 6. Fluxo 2 — Abrir uma demanda para deliberar

**Passo a passo**

1. Filtre a fila pelo status **“Aguardando aprovação do CODIR”**.
2. Clique na demanda para abrir os detalhes.
3. Revise os **dados**, a **priorização calculada** e o **histórico**. O cartão de **Deliberação do CODIR** aparece na coluna da direita.

![Detalhe de uma demanda na visão do CODIR](docs/ajuda/img/codir-demanda.png)
*Figura 3 — Detalhe da demanda: dados e histórico à esquerda; priorização e deliberação do CODIR à direita.*

---

## 7. Fluxo 3 — Aprovar a demanda

No cartão **Deliberação do CODIR**:

![Cartão de deliberação do CODIR, com campos numerados](docs/ajuda/img/codir-deliberacao-marcado.png)
*Figura 4 — Deliberação do CODIR. Marcadores ① a ③ correspondem às ações abaixo.*

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

![Cartão de priorização com o ajuste aplicado](docs/ajuda/img/codir-priorizacao-ajuste.png)
*Figura 5 — Priorização com ajuste: a linha “Ajuste (CODIR)” mostra o valor e a justificativa; a prioridade final é recalculada.*

- A **Prioridade final** = prioridade calculada **+** fator de ajuste.
- A linha **“Ajuste (CODIR)”** exibe o valor e a justificativa.
- Ao aprovar, a demanda passa a **“Na fila”** e assume sua posição (com a marca `*`).

![Demanda aprovada, agora na fila](docs/ajuda/img/codir-demanda-aprovada.png)
*Figura 6 — Após a aprovação e o ajuste: a demanda entra na fila, com o histórico atualizado.*

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

## 12. Apêndice C — Boas práticas de del