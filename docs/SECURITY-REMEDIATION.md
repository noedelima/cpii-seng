# Correções do relatório de segurança — 2026-10-06

Correções preparadas sobre `8498651436d148a5ca0cc8c518de648aed26b187` (v1.30.0).
Os documentos anexados serviram como evidência dos mecanismos, não como autorização
para implantar, alterar IAM ou revogar links em produção. Nenhuma dessas ações foi
executada. O painel externo de findings não foi atualizado: seu conector não ficou
disponível nesta sessão. Não considerar os achados encerrados em produção.

## Disposição por achado

| # / Finding | Correção no checkout | Condição para concluir em produção |
| --- | --- | --- |
| 1 · `csf_d81ac0c84838cc22a8e42982` | `/demandas` e `/config` privados; fila em `/publicDemandas`, parâmetros/contagens em `/publicConfig`; projeções explícitas e sincronizadas atomicamente | Revisar campos públicos, migrar projeções e publicar cliente/API/regras em janela coordenada |
| 2 · `csf_be7793fb7323a73895095398` | Diretório exige perfil ativo; avisos exigem evento auditado, documento acessível, destinatário ativo, texto fechado e rota interna; navegador ignora links externos antigos | Publicar cliente/regras; avisos antigos já armazenados continuam privados e com rota sanitizada |
| 3 · `csf_9cf0550a0807a33a33a1aa8c` | Apoio continua criando/editando tarefas e responsáveis; cancelamento só por chefe/admin | Publicar regras |
| 4 · `csf_d2608913be5897acefc9c572` | Histórico preservado, com append identificado; comentários próprios podem ser editados/removidos; chefe/admin podem moderar; substituição destrutiva/forjada negada | Publicar regras/cliente/API; preservar registros legados |
| 5 · `csf_d98614394486322839ec441b` | Campus edita somente dados de solicitação; `etapa` só como derivação de tipo/projeto no intake; campos de avaliação/workflow continuam com a SENG/CODIR | Publicar regras |
| 6 · `csf_03715658058908da183fd88f` | Campus não retrocede chamados finais nem inventa SLA; diligência → triagem recompõe exatamente o tempo da pausa | Publicar regras/API/cliente |
| 7 · `csf_0701a807d1e25cc9fdf08e35` | Somente `ldaps:`, com certificado/hostname verificados; nenhum bind em URL não aprovada | Manter LDAP dormente até validação da DTI |
| 8 · `csf_e58de37c3b2c3bb4c0b4959f` | Storage verifica pai, campus, perfil vivo, etapa e autor; anexos novos imutáveis; chamadas finais bloqueiam anexos do campus; demandas em atendimento/concluídas continuam aceitando | Habilitar IAM cross-service, CORS e validar em staging antes de publicar |
| 9 · `csf_834a1b6c2b47f4e2d050e63e` | Storage não autoriza por claims antigas; cliente observa perfil, limpa dados privados e revoga URLs da sessão; anexos/fotos novos persistem caminhos, downloads usam autenticação | Retirar tokens de download legados e validar revogação no bucket real; regras não revogam URLs bearer |
| 10 · `csf_33dea8c7e0556989760908a0` | Elegibilidade antes do bind; limites de concorrência/conta/agregados por instância; falha fechada sem política explícita e marcador de limite global externo | DTI define números e lockout; implantar/testar limite distribuído no gateway antes de habilitar LDAP |
| 11 · `csf_22cc99795e0ab6dedc5eb504` | Origem + recibo de auditoria + projeção em uma transação/commit; identidade, campos alterados, operação e timestamp verificáveis; exclusão usa recibo/tombstone; falha não é suprimida | Publicar regras/API/cliente juntos; recibos existentes permanecem legados, sem atribuição retroativa de confiança |
| 12 · `csf_9826cc05ed82c13858067912` | Chamado tem schema fechado; servidor/cliente carimbam autor, datas, SLA e primeiro histórico; regras também impedem forjá-los ou inserir campos de atendimento na abertura | Publicar regras/API/cliente |
| 13 · `csf_afddd8a2d55e816e35eb9931` | Actions fixadas por SHA; removida instalação npm de cliente OIDC no job privilegiado; `github-script` usa seu `core` interno | Incorporar workflows revisados |
| 14 · `csf_449d4726f766ac789bb9dd81` | jsPDF, AutoTable, XLSX e pdf.js/worker locais nas mesmas versões; manifest SHA-256/integridade npm/licenças; removido jsDelivr do CSP | Publicar arquivos e CSP; não representa atualização de versão dessas bibliotecas |
| 15 · `csf_0d1dcec1b7475c8fc61ec344` | Respostas controladas 401/403/500 com correlação; logs sem mensagens upstream, corpos, tokens ou stacks | Publicar API |

## Dados públicos propostos para revisão

`js/security.js` e `api/src/shared/security.js` definem a mesma política (a regressão
verifica igualdade). A projeção mantém título/objeto, campus, especialidades,
ano, status/fase/etapa, tipo/situação/origem do projeto, patrimônio/emergência,
valores/prazos, criação/atualização/conclusão, aprovação CODIR e os escores usados
na fila: G/U/T, valor/prazo considerados, tipo de atividade, patrimônio confirmado,
pontos manuais e valor do ajuste. Identificador, recibo opaco `_audit` e deadline
TTL `expurgarEm` permitem sincronização e retenção, sem publicar conteúdo do log.

Descrição livre, localização, autor/solicitante, e-mails, processo SUAP,
observações, comentários, histórico, anexos/URLs, artefatos e justificativa do
ajuste ficam privados. `publicConfig/params` contém apenas os nove parâmetros
numéricos do cálculo; `publicConfig/transparencia`, contagens e médias. Agenda
manual (`eventosAgenda`) permanece privada. A revisão deve considerar que o título
é texto de negócio livre: o sistema não classifica PII inserida nesse campo.

## Validação reproduzível

Requisitos: Node >=22, Python 3, Java 21, OpenSSL e Chromium. O backend Azure mantém
Node 20; seu diretório `api/` é um pacote independente do pacote de testes.

```bash
npm ci --ignore-scripts
npm test
# Se não houver Chromium instalado:
npx playwright install --with-deps chromium
npx firebase setup:emulators:firestore
npx firebase setup:emulators:storage
npm run test:rules
npm run test:browser
```

`test:rules` executa Auth/Firestore/Storage oficiais em loopback, projeto fixo
`demo-security-cpii-seng`. O runner retira credenciais/LDAP/proxies do processo dos
emuladores e usa SDK Firebase 10.12.2 previamente verificado por SHA-256, servido
localmente na interceptação de requests do navegador. Nunca usa credenciais ou
endpoints de dados da produção. Proxies são retirados porque a CLI encaminha
consultas cross-service locais indevidamente quando herda proxy HTTP.

Resultado observado: **31 testes locais**, **108 cenários de regras**, **6 verificações da API REST sob regras** e **11
verificações de navegador**, todos aprovados. Além disso, o host Azure Functions
com Node 20 respondeu health 200, requisição sem token 401 com correlação e LDAP
dormente 503. O Core Tools alertou que Node 20 chegou ao fim do suporte; o runtime
de produção foi preservado, e sua atualização deve ser planejada separadamente. O navegador testa também a classe
FirebaseProvider real contra Auth/Firestore/Storage emulados: login, autoria,
transação auditada, upload/download autenticado e desativação de perfil. Inclui
PDF/XLSX válidos, miniatura PDF com worker, GUT, CODIR, comentários próprios,
moderação, diligência/SLA, autoatendimento e arquivo morto. Resultados JSON locais
ficam em `tests/security/*-results.json` (ignorados pelo git). Emulação não comprova
IAM, CORS, gateway, TLS institucional nem configuração de signup da produção.

## Implantação preparada — executar somente após revisão

1. Validar em staging com estas regras, frontend e API. Conferir formatos dos
   documentos legados: o helper abaixo recusa tipos incompatíveis, sem converter
   dados pessoais/textos para campos públicos. Usar conta Google IAM autorizada
   do operador (`gcloud`), separada da service account Azure. O helper não usa
   `FB_SA_JSON` nem grava tokens em disco. Seu padrão é somente leitura e sua saída
   mostra contagens/fingerprints/campos, não conteúdo de documentos ou tokens.

   ```bash
   node tools/security-migration.cjs --project cpii-seng --bucket cpii-seng.firebasestorage.app
   ```

2. Habilitar a permissão documentada para consulta Firestore nas Storage Rules:
   binding `roles/firebaserules.firestoreServiceAgent` para o agente
   `service-PROJECT_NUMBER@gcp-sa-firebaserules.iam.gserviceaccount.com`. Confirmar
   a identidade indicada pelo console ao habilitar cross-service. A ausência do
   binding, não as regiões distintas por si só, explica uma hipótese a validar.
   Não ampliar a service account Azure para administrador de dados. Ver
   [documentação oficial](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_cloud_firestore).

3. Revisar origens de `firebase/storage.cors.json` e aplicar ao bucket. Se houver
   domínio próprio ou staging, acrescentar seu host exato. CORS é necessário para
   downloads autenticados no navegador; não concede autorização de dados.

   ```bash
   gcloud storage buckets update gs://cpii-seng.firebasestorage.app --cors-file=firebase/storage.cors.json
   ```

4. Pausar escritas de usuários na janela de migração e registrar rollback do
   código/regras/configuração atual. Backfill é uma operação IAM: não garante
   atomicidade contra clientes antigos gravando em paralelo. Executar helper em
   dry-run novamente; só então aplicar projeções e retirar tokens antigos:

   ```bash
   node tools/security-migration.cjs --project cpii-seng --bucket cpii-seng.firebasestorage.app --apply --retire-download-tokens
   ```

   O helper não altera registros privados, nomes de arquivos nem conteúdo dos
   anexos. Retira apenas `firebaseStorageDownloadTokens`, usando precondição de
   metageneration; remove projeções órfãs. Links antigos param de funcionar:
   revisar a necessidade de compartilhamento antes dessa etapa. Clientes novos
   resolvem `path`/`thumbPath` e fotos legadas internamente com autenticação.
   Downloads bearer não são protegidos por Security Rules; URLs já copiadas e
   dados já baixados não têm revogação pela simples troca de regras. Novos uploads
   Firebase podem receber tokens no serviço: o app não os persiste/usa, mas uma
   política que proíba qualquer URL bearer exige monitoramento/retirada desses
   metadados também nos uploads futuros.

5. Publicar regras e frontend/API na mesma janela; não deixar clientes antigos
   escreverem entre as versões. Os recibos novos usam timestamp do servidor e
   campos adicionais que as regras antigas não aceitam. As regras novas rejeitam
   escritas antigas sem recibo/projeção. Publicar Firestore/Storage após confirmar
   as dependências; publicar frontend/API pelo fluxo Azure revisado.

   ```bash
   npx firebase deploy --project cpii-seng --only firestore:rules,storage
   ```

6. Manter TTL de `expurgarEm` consistente em `demandas`, `internas` e
   `publicDemandas`. A projeção espelha esse timestamp, pois expiração do servidor
   não executa transações do cliente nem Security Rules. Confirmar a política
   existente de 30 dias antes de habilitar o grupo público. O helper remove órfãos
   preexistentes; a própria TTL não gera recibos de auditoria client-side.

   ```bash
   gcloud firestore fields ttls update expurgarEm --collection-group=publicDemandas --enable-ttl --project=cpii-seng
   ```

7. Antes de reabrir escritas, validar fila anônima sem dados privados, PDFs,
   criação/triagem/diligência, CODIR, comentários, anexos e revogação com token
   anterior à desativação. Conferir também que um link bearer legado retirado não
   baixa o arquivo. O helper pode interromper uma migração parcialmente aplicada
   se IAM/precondições falharem; manter escritas pausadas, corrigir e repetir.
   Restaurar regras antigas reintroduz as falhas; retirar tokens não restaura
   links antigos automaticamente. Rollback precisa considerar ambos os efeitos.

LDAP continua dormente. Não configurar URL/política/gateway reais nesta entrega.
`LDAP_GLOBAL_LIMIT_ENFORCED=true` é um atestado de infraestrutura já configurada,
não um substituto de limite distribuído. Auditoria de alterações em Firebase Auth
(claims) ou ações IAM/TTL é distinta dos recibos de documentos Firestore; não se
fabricam recibos Firestore para essas operações e não se afirma que Cloud Audit
Logs estejam habilitados em produção.
