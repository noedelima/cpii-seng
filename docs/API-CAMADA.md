# Camada de API (Azure Functions) — Fase 2

Camada de abstração entre o frontend e o Firestore, servida em `/api/*` pelo
próprio Azure Static Web Apps (plano Free). Espelha o `API-CAMADA.md` do SANE,
adaptado ao Firebase.

## Arquitetura (modelo híbrido)

```
navegador (sessão Firebase)
  → SWA  /api/*  (Azure Functions, Node 20, 1 dep: @azure/functions)
      → valida o ID token do Firebase LOCALMENTE (RS256, certificados do Google)
      → consulta o Firestore REST COM o token do usuário → as Security Rules mandam
  → JSON → a view usa
```

- **Híbrido:** as **leituras em tempo real** seguem **direto** no Firestore
  (`onSnapshot` — badge de notificações, painel ao vivo). A API cobre **escritas
  e operações sensíveis**, com a autorização validada no servidor.
- **As rules são a autoridade.** A query vai com o token do usuário; a API não
  eleva privilégio (sem service account, sem segredo novo). É o equivalente ao
  "token → PostgREST → RLS" do SANE (aqui: token → Firestore REST → Security Rules).
- **Verificação local do token** (RS256 contra os certificados públicos do
  Firebase) — evita usar a `apiKey` no servidor e, com isso, a restrição de
  *HTTP referrer* da chave Web. Zero segredos.

## ⚠️ Pegadinhas (essenciais)

1. **O SWA consome o header `Authorization`** para a própria autenticação. Por
   isso o frontend manda o ID token em **`x-fb-token`** (ver `js/api.js`), que o
   SWA repassa intacto; o `withAuth()` lê dele.
2. **Node ≥ 18** para `fetch` global → `"platform": { "apiRuntime": "node:20" }`
   em `staticwebapp.config.json`. E `/api/*` está no `navigationFallback.exclude`.
3. A `apiKey` Web é restrita por referrer a domínios conhecidos; para o app
   **logar no endereço do SWA**, adicione o domínio do SWA nos *Authorized
   domains* do Firebase Auth e nos *referenciadores HTTP* da chave (ver
   `AZURE-SWA-SETUP.md`). Isso é do lado do navegador (o servidor não usa a chave).

## Estrutura

```
api/
├── host.json                 # extension bundle v4
├── package.json              # 1 dep: @azure/functions  (main: src/functions/*.js)
└── src/
    ├── shared/
    │   ├── auth.js           # verifyIdToken (RS256 local, cache de certs)
    │   ├── firestore.js      # docGet(path, token) via Firestore REST (unwrap tipado)
    │   └── http.js           # json(), withAuth() (lê x-fb-token)
    └── functions/
        ├── health.js         # GET /api/health  (sem auth)
        └── me.js             # GET /api/me       (perfil do logado, sob as rules)
```

## Estado

| Endpoint | Padrão | Status |
|----------|--------|--------|
| `/api/health` | diagnóstico (sem auth) | ✅ validado no ar |
| `/api/me` | auth + leitura de `usuarios/{uid}` sob as rules | ✅ validado no ar (200 com o perfil) |
| `POST /api/demandas/{id}/arquivar` | **escrita** sob as rules (arquivo morto) | ✅ no ar (testado ponta a ponta) |
| `POST /api/demandas/{id}/resgatar` | **escrita** sob as rules (restaura) | ✅ no ar |
| `PATCH /api/demandas/{id}` | atualizar (status, GUT, CODIR, edição, observações/comentários) | ✅ no ar (rules enforçam; 403 em escrita inválida) |
| `PUT /api/demandas/{id}` | criar (id calculado no cliente) | ✅ no ar |
| `PATCH /api/internas/{id}` | alocação / observação técnica interna | ✅ no ar |
| `POST /api/profissionais` | criar/atualizar profissional | ✅ no ar |
| `PATCH /api/config/params` | parâmetros do sistema | ✅ no ar |

**Roteamento no provider.** As guardas ficam no `FirebaseProvider` (métodos
`criarDemanda/atualizarDemanda/setInterna/arquivar/resgatar/salvarProfissional/setParams`):
quando `apiLigada()`, a escrita vai pela API; senão, direto no Firestore. As views
**não mudam** — chamam `s.xxx()` como sempre.

**Segue direto (fora da API, por ora):** criação/edição de **usuário** (cria
 credencial no Firebase Auth — exigiria Admin SDK), **troca de senha** (Auth), e a
 mecânica interna de **notificações/diretório** (fan-out do sistema).

### Roteamento (Fase 2 concluída)

`apiLigada()` (em `js/api.js`) decide se a escrita vai pela API ou direto no
Firestore. **Padrão:** liga a API **onde ela existe** — Azure SWA / domínio
próprio; e segue **direto** no **GitHub Pages** e em **localhost** (sem Functions).
Assim a promoção é segura com os dois hosts no ar. Override por sessão: **`?api=1`**
força ligar, **`?api=0`** força desligar (localStorage); `USE_API` (config) força em
qualquer origem. As leituras seguem sempre ao vivo (onSnapshot).

## Como adicionar um endpoint (leitura sob as rules)

1. **Function** `api/src/functions/<nome>.js`:

```js
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { docGet } = require('../shared/firestore');
app.http('<nome>', { methods: ['GET'], authLevel: 'anonymous', route: '<nome>',
  handler: withAuth(async ({ user }) => {
    const d = await docGet('<colecao>/<id>', user.token); // rules aprovam/negam
    return json(200, { data: d });
  }),
});
```

2. **Cliente** em `js/api.js`: `nome: () => req('GET', '/<nome>')`.
3. **View/estado**: quando `USE_API` (config) estiver ligado para aquela fatia,
   rotear a **escrita/operação sensível** pela API; **leituras ao vivo continuam
   no Firestore**.

## Reverter / desligar

`USE_API = false` (em `js/config.js`) → tudo volta a falar direto com o Firebase.
Nenhuma migração de dados envolvida. Para escritas via Firestore REST (próximos
endpoints), o padrão será `PATCH/commit` com o token do usuário — sempre sob as
rules.
