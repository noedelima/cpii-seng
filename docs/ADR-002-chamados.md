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

## Modelo de dados (coleção `chamados`)

`id (CH-AAAA-NNNN) · campus · autor{nome,email,uid} · categoria · assunto ·
descricao · local · urgencia · anexos[] · status · aberturaEm · prazoLimite ·
atualizadoEm · triagem{responsavel, em, desfecho, disciplina} ·
resolucao{tipo, texto, encaminhadoA, ntRef, encerradoEm, por} · demandaId? ·
obsInterna[] · obsExterna[] · historico[]`.

## Ciclo de vida

`Aberto → Em triagem →` **desfecho**:
- **Obra** → cria/vincula uma **Demanda** (segue GUT→CODIR→fila); status `obra`.
- **Consultoria** / **Laudo** → `atendimento` → **Resolvido** (orientação/NT).
- **Encaminhado** a outro setor (manutenção/DTI/Adm) → orientação → `encaminhado`.
- **Improcedente** / **Duplicado** / **Cancelado**.

Estado lateral **Em diligência** (SENG pede complemento; **o SLA pausa**).

## SLA

`prazoLimite = aberturaEm + slaDias(categoria)`. Vencido = `now > prazoLimite` em
status ativo. O relógio **pausa** em *Em diligência* (aguardando o campus).

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

**Hardening futuro** (isolamento por campus na própria camada de Storage, sem
cross-service): **custom claims** (`role`/`campi`) no token, definidos por uma
função de bloqueio de login (Firebase Auth) ou callable com Admin SDK; as regras
passariam a usar `request.auth.token.role`/`.campi` — sem `firestore.get` e sem
dependência de região.

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
