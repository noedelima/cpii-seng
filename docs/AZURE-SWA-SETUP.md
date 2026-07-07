# Migração para o Azure Static Web Apps — Fase 1 (host)

Espelha o que foi feito no **SANE** (`ADR-001-host-e-backend.md`), adaptado ao
cpii-seng, que é um app **estático sem build** (HTML/CSS/JS ES modules na raiz).

Nesta fase **só muda a hospedagem**: o app continua igual, falando com o
**Firebase** (Auth + Firestore) como hoje. Banco e autenticação **não se movem**.
A camada de API entra na **Fase 2**.

## O que já está no repositório

- `.github/workflows/azure-swa.yml` — publica a **raiz** do repo no Azure SWA
  (sem npm/build). Fica **inerte** (job verde, sem publicar) até existir o secret
  `AZURE_STATIC_WEB_APPS_API_TOKEN`. Roda **em paralelo** ao GitHub Pages.
- `staticwebapp.config.json` (raiz) — fallback de SPA para `/index.html`,
  cabeçalhos de segurança e `404 → index (200)`. Sem `apiRuntime` (só na Fase 2).
- `redirect/` — página que redireciona o endereço antigo para o novo,
  **preservando a rota em hash**. Ainda **não** está ativa (ver adiante).

## Lado Azure (você) — uma vez

1. **Criar o recurso** Static Web App (Portal do Azure → *Create* → *Static Web App*):
   - Plano: **Free**.
   - *Deployment source*: **Other** (o deploy vem do nosso workflow; não conecte
     o Portal ao GitHub para não criar um segundo workflow).
   - Região: a que preferir (na Fase 1 é só conteúdo estático em CDN; quando
     houver API/dados, avaliar **Brazil South**).
2. **Pegar o token:** no recurso criado → *Overview* → **Manage deployment token**
   → copiar.
3. **Cadastrar o secret no GitHub:** repositório → *Settings* → *Secrets and
   variables* → *Actions* → *New repository secret*:
   - Nome: `AZURE_STATIC_WEB_APPS_API_TOKEN`
   - Valor: o token copiado.
4. **Disparar o deploy:** faça um push em `main` (ou rode o workflow
   *Deploy to Azure Static Web Apps* manualmente em *Actions*). O app sobe na URL
   `https://<gerada>.azurestaticapps.net`.
5. **Validar** essa URL (login, painel, Ajuda, notificações). Como aponta para o
   **mesmo Firebase**, os dados são os mesmos da produção atual.

## Virar a URL canônica (opcional, quando validar)

Enquanto isso, **o GitHub Pages continua servindo o app normalmente** — nada
quebra. Quando quiser tornar o SWA o endereço oficial:

1. Nos arquivos `redirect/index.html` e `redirect/404.html`, troque
   `https://SEU-APP.azurestaticapps.net` pela **URL real** do seu SWA (ou pelo
   domínio próprio, se configurar um).
2. Em `.github/workflows/pages.yml`, troque **`path: .`** por **`path: ./redirect`**.
   A partir daí o Pages passa a **redirecionar** para o SWA em vez de servir o app.
3. *(Opcional)* Configurar **domínio próprio** no SWA (Free permite) e HTTPS.

**Reverter** a qualquer momento: volte `path: ./redirect` para `path: .` no
`pages.yml` — o Pages volta a servir o app. O SWA e o Pages são independentes.

## Próximas fases (resumo)

- **Fase 2 — API:** subir `api/` (Azure Functions) validando o **ID token do
  Firebase** e acessando o Firestore, atrás de uma flag, estrangulando tela por
  tela (padrão do SANE, trocando Supabase/PostgREST/RLS por Firebase/Admin/rules).
  Aí entra `"platform": { "apiRuntime": "node:20" }` no `staticwebapp.config.json`.
- **Fase 3 — banco (paridade plena com o SANE):** avaliar Firestore → Supabase
  (Postgres + RLS) atrás da API, e migração de autenticação. É a fase maior;
  pode ser adiada ou dispensada.
