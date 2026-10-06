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
só recompõe o prazo na transição diligência → triagem, pelo tempo real da pausa;
edições no mesmo estado preservam prazo e marca de diligência.

## Segurança (rules)

- **Leitura:** SENG (interno) e o **campus dono** do chamado. *(Não é público —
  diferente da fila de demandas.)*
- **Abertura:** campus (da própria unidade) ou SENG.
- **Triagem/resolução/status:** SENG (eng/chefe) e admin.
- **Campus dono:** responder diligência, comentar (obs externa) e anexar, no
  próprio chamado.
- **Escritas passam pela camada de API** (onde ela existe), como as demandas.

### Anexos (Cloud Storage) — consulta ao perfil e ao documento associado

As regras propostas em outubro/2026 consultam `/usuarios/{uid}` e o documento
pai em Firestore `(default)`. Claims antigas deixam de conceder acesso após
mudança de campus/papel ou desativação. Anexo exige pai existente, campus do
caminho igual ao do pai, autoria em metadata e arquivo novo. Sobrescrita é negada.
Campus anexa a chamados em aberto/triagem/diligência; demandas continuam aceitando
anexos em atendimento/concluídas. Apoio anexa; remoção continua restrita à SENG
técnica ou ao campus autor do arquivo, nas etapas permitidas.

A afirmação anterior de que regiões distintas inviabilizam `firestore.get/exists`
não foi comprovada. A auditoria identificou a ausência da permissão do agente de
serviço. A política foi validada em emuladores oficiais, incluindo consulta entre
Storage e Firestore; sua ativação no bucket real depende de IAM e de teste em
staging. O banco deve ser o `(default)`; não se propõe mudança de região.

O cliente usa downloads autenticados e URLs `blob:` da sessão. Links duráveis
antigos exigem retirada explícita dos tokens, com migração de metadata pelo
operador autorizado; somente atualizar regras não revoga esses links. CORS do
bucket deve permitir as origens do portal. As claims continuam disponíveis para
compatibilidade, mas sua sincronização deixa de ser a barreira de revogação.

A correção está preparada no checkout; não há afirmação de implantação. Ver
[procedimento e evidências](SECURITY-REMEDIATION.md) antes de publicar.

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
