# Azure Static Web Apps — hospedagem de produção (Fases 1 e 2 concluídas)

Espelha o SANE (`ADR-001-host-e-backend.md`), adaptado ao cpii-seng, que é um app
**estático sem build** (HTML/CSS/JS ES modules na raiz).

**Estado:** a migração de host está **concluída** — a produção é o **Azure Static
Web Apps**, com a **camada de API (Fase 2)** publicada em `/api/*`
(ver `docs/API-CAMADA.md`). O app fala com o **Firebase** (Auth + Firestore +
Storage); banco e autenticação não se moveram.

## Estado atual (Opção B — o Portal gerencia o CI/CD)

- **Recurso:** Azure Static Web App **`cpii-seng`** (plano **Free**), no grupo de
  recursos **`rg-cpii-seng`**.
- **URL (produção):** `https://polite-forest-0f8e6fe10.7.azurestaticapps.net`.
- **Deploy:** workflow **gerado pelo Portal** —
  `.github/workflows/azure-static-web-apps-polite-forest-0f8e6fe10.yml`
  (roda no push para `main` e cria *previews* de PR). O **token de deploy** já foi
  cadastrado automaticamente como secret
  `AZURE_STATIC_WEB_APPS_API_TOKEN_POLITE_FOREST_0F8E6FE10`.
  Config (correta para app sem build): `app_location: "/"`, `api_location: "api"`,
  `output_location: ""`.
- **`staticwebapp.config.json`** (raiz): fallback de SPA → `index.html`, cabeçalhos
  de segurança, `404 → index (200)` e `"platform": { "apiRuntime": "node:20" }`
  (Functions da Fase 2), com `/api/*` no `navigationFallback.exclude`.
- **`redirect/`**: páginas publicadas no **GitHub Pages** (endereço antigo), que
  **redirecionam** para o SWA preservando a rota em hash — **ativas**:
  `.github/workflows/pages.yml` publica `path: ./redirect` (o Pages não serve mais
  o app; reverter = voltar a `path: .`).
- O workflow manual `azure-swa.yml` foi **removido** (era redundante com o do Portal).

## Pendências opcionais

- Domínio próprio no SWA (o plano Free permite) + HTTPS.
- **Fase 3 — banco (paridade plena com o SANE):** avaliar Firestore → Supabase
  (Postgres + RLS) atrás da API, e migração de autenticação. É a fase maior; pode
  ser adiada ou dispensada.
