# Migração para o Azure Static Web Apps — Fase 1 (host)

Espelha o SANE (`ADR-001-host-e-backend.md`), adaptado ao cpii-seng, que é um app
**estático sem build** (HTML/CSS/JS ES modules na raiz).

Nesta fase **só muda a hospedagem**: o app continua igual, falando com o
**Firebase** (Auth + Firestore) como hoje. Banco e autenticação **não se movem**.
A camada de API entra na **Fase 2**.

## Estado atual (Opção B — o Portal gerencia o CI/CD)

- **Recurso:** Azure Static Web App **`cpii-seng`** (plano **Free**), no grupo de
  recursos **`rg-cpii-seng`**.
- **URL:** `https://polite-forest-0f8e6fe10.<região>.azurestaticapps.net`
  (o valor exato está no campo **URL** do recurso, na *Visão geral*).
- **Deploy:** workflow **gerado pelo Portal** —
  `.github/workflows/azure-static-web-apps-polite-forest-0f8e6fe10.yml`
  (roda no push para `main` e cria *previews* de PR). O **token de deploy** já foi
  cadastrado automaticamente como secret
  `AZURE_STATIC_WEB_APPS_API_TOKEN_POLITE_FOREST_0F8E6FE10`.
  Config (correta para app sem build): `app_location: "/"`, `api_location: ""`,
  `output_location: ""`.
- **`staticwebapp.config.json`** (raiz): fallback de SPA → `index.html`, cabeçalhos
  de segurança e `404 → index (200)`. Sem `apiRuntime` (entra na Fase 2).
- **`redirect/`**: páginas que redirecionam o endereço antigo para o novo,
  preservando a rota em hash — **ainda não ativas** (ver adiante).
- O workflow manual `azure-swa.yml` foi **removido** (era redundante com o do Portal).

O SWA roda **em paralelo** ao GitHub Pages: os dois no ar, apontando para o mesmo
Firebase — dá para validar com os dados reais, sem risco.

## Virar a URL canônica (quando validar)

1. Em `redirect/index.html` e `redirect/404.html`, troque
   `https://SEU-APP.azurestaticapps.net` pela **URL real** do SWA (ou por um
   domínio próprio, se configurar um).
2. Em `.github/workflows/pages.yml`, troque **`path: .`** por **`path: ./redirect`**.
   A partir daí o Pages passa a **redirecionar** para o SWA. Reverter: volte a
   `path: .`.
3. *(Opcional)* Domínio próprio no SWA (o Free permite) + HTTPS.

## Próximas fases (resumo)

- **Fase 2 — API:** subir `api/` (Azure Functions) validando o **ID token do
  Firebase** e acessando o Firestore, atrás de uma flag, estrangulando tela por
  tela (padrão do SANE, trocando Supabase/PostgREST/RLS por Firebase/Admin/rules).
  Aí entra `"platform": { "apiRuntime": "node:20" }` no `staticwebapp.config.json`.
- **Fase 3 — banco (paridade plena com o SANE):** avaliar Firestore → Supabase
  (Postgres + RLS) atrás da API, e migração de autenticação. É a fase maior; pode
  ser adiada ou dispensada.
