# ADR-002 — Módulo de Chamados (intake + triagem da SENG)

**Status:** aceito · **Data:** 2026-07 · **Decisor:** Noé (eng. responsável)

## Contexto

Hoje os campi abrem chamados de engenharia no **SUAP**. Queremos **suplantar
esse módulo** e integrá-lo ao SENG Demandas: o campus abre um chamado, a SENG
tria, e o desfecho pode virar **Demanda de Obra** (fila do CODIR), **consultoria/
laudo** (encerra com orientação/Nota Técnica) ou **encaminhamento** a outro setor
(ex.: orientação para a manutenção). Isso também traz de volta os tipos
**Laudo** e **Assessoria** (ocultados do cadastro de demandas) como trilhas de
consultoria — a expansão prevista quando os ocultamos.

## Decisões

1. **Chamado é entidade própria** (coleção `chamados`), que **promove** uma
   Demanda quando é obra. Mantém a **fila do CODIR limpa** (só obras/serviços
   reais); consultorias, laudos e encaminhamentos vivem no chamado.
2. **Anexos via Firebase Storage** (o projeto subiu para **Blaze**, com alerta de
   orçamento de R$ 10). Bucket por chamado; regras por campus/perfil; limites de
   tipo (imagem/PDF) e tamanho. *(Alternativa avaliada: Cloudflare R2 — descartada
   por preferência de simplicidade.)*
3. **SUAP:** o chamado **substitui o ticket**; o **Processo SUAP** entra só quando
   o chamado vira **obra/contratação** (o campo `processoSuap` já existe na Demanda).
4. **Categorias + SLA desde já:** catálogo de assuntos, cada um com disciplina e
   prazo (SLA). O painel sinaliza no prazo / vencendo / vencido.
5. **Reaproveitar** o máximo do que já existe: papéis/rules, observações
   (comentários), notificações, histórico, arquivo morto, PDF efêmero, a camada
   de API e a skill `ia-engenharia` (para a Nota Técnica de resolução).

## Modelo de dados (coleção `chamados`) — como implementado

ID no padrão **`CH + ANO + SIGLA DO CAMPUS + SEQUENCIAL`** (ex.: `CH2026CSCII001`;
campos auxiliares `ano` e `seq`). Documento:

`id · ano · seq · campus · autor{nome,email,uid} · categoria · assunto ·
descricao · local · urgencia · anexos[] · status · aberturaEm · prazoLimite ·
diligenciaDesde? · atualizadoEm · desfecho? · atendentes[]? ·
resolucao{setor?, texto, parecerTriagem?}? · demandaId? ·
obsInterna[] · obsExterna[] · comentarios[] · historico[]`.

*(Evolução v2 sobre o esboço original: a triagem vive em `desfecho`/`atendentes`
em vez de um objeto `triagem`; `comentarios[]` é o fio único da linha do tempo;
`diligenciaDesde` é a marca da pausa de SLA.)*

## Ciclo de vida (workflow v2)

`Aberto → Em triagem →` **desfecho**:
- **Obra** → cria/vincula uma **Demanda** (segue GUT→CODIR→fila); status `obra`.
- **Consultoria** / **Laudo** → `atendimento` (com `atendentes[]`) → **Resolvido**
  (orientação/NT). **Escalada:** em `atendimento` ou já `resolvido`, o chamado
  pode ser **convertido em demanda de obra** sem novo chamado (nota do
  fluxograma v2) — o histórico segue no dossiê da demanda (`chamadoOrigem`).
- **Encaminhado** a outro setor (manutenção/DTI/Adm) → orientação → `encaminhado`.
- **Improcedente** / **Duplicado** / **Cancelado** (cancelamento pela SENG, com
  motivo obrigatório).

Estado lateral **Em diligência** (SENG pede complemento; **o SLA pausa**).

## SLA

`prazoLimite = aberturaEm + slaDias(categoria)`. Vencido = `now > prazoLimite` em
status ativo. O relógio **pausa** em *Em diligência*: ao entrar, grava-se
`diligenciaDesde` (o restante congela e a UI exibe **“SLA pausado”**); ao sair
(resposta do campus ou retomada da SENG), `prazoLimite += now − diligenciaDesde`
e a marca é limpa — o tempo em diligência não é descontado. Nas rules, o campus
só pode **estender** `prazoLimite`, nunca reduzir.

## Segurança (rules)

- **Leitura:** SENG (interno) e o **campus dono** do chamado. *(Não é público —
  diferente da fila de demandas.)*
- **Abertura:** campus (da própria unidade) ou SENG.
- **Triagem/resolução/status:** SENG (eng/chefe) e admin.
- **Campus dono:** responder diligência, comentar (obs externa) e anexar, no
  próprio chamado.
- **Escritas passam pela camada de API** (onde ela existe), como as demandas.

### Anexos (Cloud Storage) — limitação cross-service e controles compensatórios

O ideal seria espelhar as regras do Firestore no Storage com `firestore.get`
(papel do usuário + campus do chamado). Porém as **regras cross-service** do
Storage exigem bucket e Firestore em **local compatível**; aqui o bucket está em
**us-central1** (nível gratuito) e o Firestore em **southamerica-east1** — logo
`firestore.get/exists` **não resolvem** (negam tudo). Testado em 07/07/2026
(inclusive isolando `exists` puro). Mover o bucket para a mesma região custaria o
nível gratuito, então foi mantido em us-central1.

**Regras adotadas** (`firebase/storage.rules`): autenticação obrigatória, restrito
ao prefixo `chamados/`, apenas imagem/PDF até 10 MB, todo o resto negado.
**Controles compensatórios:** base de usuários **fechada** (contas só pelo admin,
sem cadastro público); a **descoberta** dos arquivos é controlada no Firestore (a
lista `anexos` vive no doc do chamado, com regras por SENG/campus) e as **URLs de
download são tokenizadas** e imprevisíveis. Risco residual: um usuário autenticado
que adivinhe um caminho completo poderia ler arquivo de outro campus — baixo, dado
o público interno fechado e as URLs com token.

**Hardening implementado (2026-07-10, v1.12.0)** — isolamento por papel/campus
na própria camada de Storage, sem cross-service, via **custom claims**
(`role`/`campi`) no ID token:

- **Definição das claims:** endpoints na camada de API (Azure Functions) —
  `POST /api/claims/self` (o próprio usuário; copia o SEU doc `/usuarios/{uid}`,
  sem escalada possível) e `POST /api/claims/sync` (admin, após criar/editar/
  desativar usuário). Fonte da verdade continua sendo `/usuarios/{uid}` no
  Firestore, sob as rules.
- **Credencial:** service account **dedicada**, papel único
  `roles/firebaseauth.admin` (Firebase Authentication Admin) — gere contas/
  claims, **não acessa Firestore/Storage**. Chave JSON na App Setting
  `FB_SA_JSON` do SWA (nunca no repositório); implementação REST zero-deps
  (`api/src/shared/adminAuth.js`). Sem a App Setting → endpoints respondem 501
  e nada quebra (recurso dormente).
- **Sincronização automática:** no login, o `FirebaseProvider` compara as
  claims do token com o perfil; divergiu → chama `claims/self` e renova o token
  (`getIdToken(true)`). Ao salvar usuário, o admin dispara `claims/sync` do
  afetado (efetiva na próxima renovação do token dele, ≤ 1 h).
- **Storage rules v2:** `request.auth.token.get('role'/'campi')` — leitura por
  interno (inclui CODIR) ou campus dono do caminho `chamados/{campus}/…`;
  create/update/delete por SENG (eng/chefe/admin) ou campus dono; token sem
  claims é negado. Espelham as rules do Firestore.
- **Ordem de ativação:** 1) deploy do código (SWA CI/CD); 2) criar a SA e a App
  Setting `FB_SA_JSON`; 3) usuários renovam claims no próximo acesso
  (automático); 4) só então `firebase deploy --only storage`. **Rollback:**
  restaurar as rules anteriores (histórico git) e republicar — os controles
  compensatórios acima voltam a ser a proteção vigente.

## Roadmap

1. **Núcleo:** abrir + triagem + desfechos + conversão em Demanda + comentários +
   notificações + painel. *(Esta etapa começa pelo esquema + rules.)*
2. **Anexos** (Firebase Storage).
3. **SLA + catálogo + relatórios.**
4. **NT gerada** (reuso `ia-engenharia`) + templates.

## Riscos / rollback

Coleção e telas **novas** — não afetam o que já roda; o menu só expõe o módulo
quando pronto. Reversível (feature isolada). Custo de Storage contido pelo alerta
de orçamento (R$ 10) no Blaze.
