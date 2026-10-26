# Remediação da auditoria de segurança — v1.31.0 (26/10/2026)

**Origem:** auditoria Codex Security sobre a v1.30.0 (commit `8498651`), relatório de
05/10/2026 e verificação local de 06/10/2026: **15 achados** (1 alta, 11 médias,
3 baixas), 13 confirmados e 2 condicionais à ativação do LDAP. O pacote original
(relatório, achados, evidências e scripts) foi preservado fora do repositório.

**Decisões de produto (Noé, 26/10/2026):**

- **Visitante sem login:** vê a **ficha resumida**: objeto, campus, status/fase,
  tipo, especialidades, atividade, GUT/prioridade/ajuste, prazo, valor estimado,
  emergencial e datas. Não vê descrição, localização, processo SUAP, linha do
  tempo, comentários, anexos nem nomes.
- **Abertura de chamado:** o autor é sempre o usuário autenticado; o campo
  **"Em nome de"** (`solicitanteRepresentado`) registra quem originou o pedido.
- **Comentários:** o autor edita ou apaga só o **próprio** comentário; Chefia e
  Admin moderam. O histórico de eventos aceita apenas acréscimos.
- **Infraestrutura autorizada:** fechar o cadastro público de contas; ligar a
  integração Storage↔Firestore (IAM); vendorizar as bibliotecas de PDF e XLSX.

## Disposição por achado

| # | Achado | Correção |
|---|---|---|
| 1 | `demandas` e `config` com leitura pública integral | `/demandas` exige perfil (equipe, CODIR e apoio veem todas; campus vê as do seu campus). A fila pública lê a projeção **`/publicas`**, que as rules só aceitam como **espelho fiel** da demanda (igualdade campo a campo via `getAfter`). A Agenda interna saiu de `config/params` (público) para `config/agenda` (só equipe). |
| 2 | Conta sem perfil lê o diretório e cria notificações arbitrárias | Cadastro público de contas **desativado** no Firebase Auth; credenciais criadas só pela API (`POST /api/usuarios/credencial`, somente admin, só e-mail `@cp2.g12.br`). Notificações exigem remetente ativo, destinatário em `diretorio/atual.uidsAtivos`, tipo da lista fechada, demanda ou chamado existente, link interno (`#/demanda|chamado/ID`) e esquema fechado. Diretório lido só por perfil ativo. |
| 3 | Apoio cancela tarefas | Cancelar exige Chefia/Admin (criação e atualização). Editar, mover e reatribuir continuam com o apoio. |
| 4 | Listas inteiras de comentários e histórico substituíveis | Histórico e observações legadas só aceitam acréscimos. Comentários: no máximo uma entrada removida e uma incluída por gravação; a incluída deve ser do próprio autor; a removida, do autor ou por moderação. Anexos: inclusão (até 5 por envio) carimbada com `porUid` e apontando para o Storage do próprio registro; edição só de título, descrição e miniatura; remoção pelo autor ou pela SENG. |
| 5 | Campus altera campos internos do workflow | O campus edita apenas os **dados da solicitação** (lista fechada). Na resposta à diligência, só descrição e status. O CODIR segue a mesma lista na edição de dados. |
| 6 | Campus reabre chamado encerrado e estende o SLA livremente | Transições do campus validadas pelo estado anterior (apenas aberto, triagem ou diligência; diligência → triagem ao responder). O prazo só se recompõe pelo **tempo efetivamente pausado** (+10 min de folga), e `diligenciaDesde` é zerado na saída. |
| 7 | LDAP com senha em claro fora de `ldaps:` | **Falha fechada**: só `ldaps://`, certificado validado e TLS ≥ 1.2. URL insegura deixa o recurso dormente. O LDAP segue desativado em produção. |
| 8 | Anexos sem vínculo com o registro pai | Storage rules consultam o Firestore: o registro precisa existir e ser do campus do caminho; o campus anexa em chamado só quando aberto, em triagem ou em diligência; demanda fora do arquivo morto. Sem sobrescrita; envio carimbado com `metadata.uid`; o campus remove só o que enviou. |
| 9 | Janela de revogação pelas custom claims | O perfil é lido **ao vivo** no Firestore: desativação ou mudança de papel valem na hora. As claims continuam sincronizadas, mas deixaram de ser a autoridade. |
| 10 | LDAP faz bind antes da elegibilidade e sem limites | Elegibilidade no Portal **antes** do bind. Resposta 401 uniforme. Limites por matrícula (5), por IP (20) e de concorrência (3) a cada 15 min, ajustáveis por App Settings, **a validar com a DTI** antes da ativação. |
| 11 | Log de auditoria com identidade, horário e campos livres | Rules conferem uid, nome do perfil e e-mail do token, horário plausível (±30 min) e esquema fechado. Pela API, o log entra **no mesmo commit** da operação. |
| 12 | Autoria do chamado informada pelo cliente | O autor é o usuário autenticado (rules e API carimbam), com esquema fechado na abertura, histórico inicial de no máximo uma entrada e datas plausíveis. Representação no campo separado. |
| 13 | Actions por tag móvel e `npm install` sem trava | Todas as Actions fixadas por **SHA de commit**. O passo `npm install` foi removido (`github-script` v7 já traz o `core`). `persist-credentials: false`. |
| 14 | Bibliotecas de CDN sem verificação | Cópias locais em `vendor/` (ver `vendor/README.md`): pacotes npm com o SHA-512 do registro conferido antes da extração; SheetJS 0.20.3 do CDN oficial (a 0.18.5 do npm tem CVEs). CSP sem `cdn.jsdelivr.net`. |
| 15 | API devolve mensagens internas | Mensagens controladas mais **código de correlação**; o detalhe vai só para o log da Function, sanitizado de tokens e senhas. |

## Infraestrutura alterada (com registro na coleção `logs`)

- IAM: `roles/firebaserules.firestoreServiceAgent` para
  `service-704635294862@gcp-sa-firebasestorage.iam.gserviceaccount.com`.
  O diagnóstico `diag/crossservice` respondeu **404** (integração ativa) **com
  regiões distintas** (bucket us-central1, Firestore southamerica-east1). A
  hipótese de região do ADR-002 estava errada: faltava o papel IAM.
- Firebase Auth: `client.permissions.disabledUserSignup = true`.
- Dados: 70 fichas públicas, 7 datas `concluidoEm`, Agenda movida e
  `diretorio/atual.uidsAtivos` com 43 usuários.

## Evidências de teste (antes da publicação)

- **Firestore rules:** 68/68 casos na API `firebaserules :test`. Cada ataque
  reproduzido pela auditoria é **negado**; regressões de fluxo (artefatos,
  CODIR, obra direta, conclusão, comentários e anexos próprios, diligência com
  SLA) seguem **permitidas**.
- **Storage rules:** 29/29 casos (perfil ao vivo e registro pai simulados).
- **API:** os 15 módulos carregam; testes unitários de `urlSegura` (#7),
  `sanitizar` e respostas de erro (#15).

## Riscos residuais (aceitos e documentados)

- Gravações feitas **direto** pelo cliente, fora da API (tarefas, autoatendimento
  do profissional), mantêm o log em melhor esforço: as rules garantem a
  veracidade do que é gravado, mas não obrigam o registro.
- O SDK do Firebase continua carregado de `www.gstatic.com` (fora do escopo do
  achado #14).
- Os contadores do LDAP são por instância; a barreira definitiva é o bloqueio
  do AD, a combinar com a DTI.
- Dados que estiveram públicos antes da v1.31 (descrições, comentários, URLs de
  anexos com token) podem ter sido coletados por terceiros. A rotação dos tokens
  de download dos anexos antigos fica como providência opcional.
