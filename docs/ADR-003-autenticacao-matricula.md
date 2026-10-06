# ADR-003 — Matrícula como identificador principal e futura autenticação AD/LDAP

**Status:** aceito (implementação dormente) · **Data:** 11/08/2026 · **Versão:** v1.25.0

## Contexto

O Portal autentica por e-mail/senha no Firebase Auth. A instituição sinaliza uma
futura migração para o Data Center/Domínio do Colégio Pedro II (DTI), quando a
autenticação deverá usar **Matrícula + Senha de rede** (a mesma do SUAP), via
Active Directory/LDAP. É preciso preparar o backend **agora** para que a
migração seja um chaveamento de configuração, não um retrabalho.

## Decisão

1. **Matrícula SUAP = identificador principal do usuário** (v1.25).
   - Campo `matricula` em `/usuarios/{uid}` — somente dígitos (4–12), validado
     nas Security Rules (`matriculaValida`) e único na aplicação (verificação
     no `salvarUsuario`, provedores Firebase e demo).
   - Obrigatória em cadastros novos; nos legados é preenchida pela
     Administração (fonte: SUAP).
   - O **uid do Firebase permanece a chave dos documentos** — a matrícula é o
     índice de negócio (consulta, deduplicação e, no futuro, login). Nenhuma
     migração de documentos é necessária ao ativar o LDAP.

2. **Endpoint dormente `POST /api/auth/matricula`** (Azure Functions), fluxo:
   `limites → lookup de elegibilidade /usuarios por matrícula → bind LDAPS → custom
   token do Firebase → signInWithCustomToken no cliente`.
   - Depois do custom token, **nada muda**: mesmas Security Rules, mesmas
     custom claims (role/campi), mesmo app. O LDAP responde apenas pela
     **autenticação**; a **autorização** continua no Portal.
   - `shared/ldap.js`: simple bind RFC 4511 com BER mínimo sobre `tls`
     nativos — **zero dependências**, coerente com o restante da API.
   - Sem `LDAP_URL` configurada → HTTP 503; o login atual segue intocado.

## Ativação (checklist para quando a DTI liberar o domínio)

1. App Settings no SWA:
   - `LDAP_URL` — ex.: `ldaps://ad.cp2.g12.br:636` (LDAPS obrigatório, com validação de certificado; a
     Function precisa alcançar o servidor — VNet integration se interno).
   - Política explícita da DTI: `LDAP_MAX_CONCURRENT`, `LDAP_ACCOUNT_ATTEMPTS`,
     `LDAP_GLOBAL_ATTEMPTS`, `LDAP_WINDOW_SECONDS` (inteiros positivos).
   - `LDAP_GLOBAL_LIMIT_ENFORCED=true` somente após configurar e validar um
     limite global distribuído no gateway. O guard local não coordena instâncias;
     o marcador não configura o gateway. Sem política/marcador, retorna 503.
   - `LDAP_BIND_TEMPLATE` — ex.: `{matricula}@cp2.g12.br` (UPN do AD) ou
     `uid={matricula},ou=pessoas,dc=cp2,dc=g12,dc=br` (DN do OpenLDAP).
2. Service account `FB_SA_JSON` — conceder papéis adicionais:
   - **Service Account Token Creator** (emitir custom tokens);
   - **Cloud Datastore Viewer** (consulta administrativa por matrícula).
   Hoje ela tem somente *Firebase Authentication Admin* — o princípio "a API
   não eleva privilégio sobre os dados" é flexibilizado apenas para ESTA
   consulta pontual (1 filtro de igualdade em `/usuarios`).
3. Garantir `matricula` preenchida para todos os usuários ativos
   (Administração → Usuários; filtros ajudam a localizar pendentes).
4. Frontend: acrescentar o modo "Matrícula" na tela de login chamando
   `/api/auth/matricula` e `signInWithCustomToken` (pequeno; fazer na ativação
   para não exibir opção inoperante).
5. Transição: os dois métodos podem conviver (e-mail/senha continua válido até
   a DTI desativar); depois, desabilitar o provedor e-mail/senha no console do
   Firebase, mantendo-o para contas de contingência se desejado.

## Consequências

- Migração futura sem retrabalho de dados (uid preservado) e sem janela de
  indisponibilidade (métodos coexistem).
- Senhas de rede **nunca** tocam o Firebase — só o bind LDAP na Function.
- Risco controlado: endpoint dormente devolve 503 e não amplia superfície de
  ataque. Ativação exige política compatível com lockout do AD, limites por
  conta/globais/concorrência e validação da DTI; lockout sozinho não substitui
  esses controles. Contas ausentes/inativas não provocam binds.
