# Ativação da produção (Firebase) — ~15 minutos

O sistema publicado no GitHub Pages funciona em **modo demonstração** (dados
fictícios no navegador). Para uso real e multiusuário, ative o backend Firebase
(plano gratuito *Spark* é suficiente):

## 1. Criar o projeto
1. Acesse https://console.firebase.google.com → **Adicionar projeto** (ex.: `cpii-seng`).
2. Desative o Google Analytics (não é necessário).

## 2. Ativar a autenticação
1. **Criação → Authentication → Começar**.
2. Em *Sign-in method*, ative **E-mail/senha** (somente a 1ª opção).
3. Em **Users → Adicionar usuário**, crie os primeiros acessos
   (ex.: o seu e do administrador). Anote o **UID** de cada um.

## 3. Criar o banco Firestore
1. **Criação → Firestore Database → Criar banco** → modo **produção** →
   região `southamerica-east1` (São Paulo).
2. Em **Regras**, cole o conteúdo de [`firestore.rules`](firestore.rules) e publique.
   (Alternativa via CLI: `npx -y firebase-tools@latest deploy --only firestore:rules`.)

## 4. Criar os perfis iniciais
No Firestore, crie a coleção **`usuarios`** com um documento por usuário,
usando o **UID** como ID do documento:

```json
// usuarios/{UID}
{ "nome": "Noé de Lima Bezerra", "email": "noe@cp2.g12.br", "role": "admin", "ativo": true }
```

Papéis válidos: `campus` (exige campo extra `"campus": "CSCII"` etc.),
`engenharia`, `chefe`, `codir` (aprovação e fator de ajuste) e `admin`.
Crie pelo menos um `admin` e um `chefe`. Usuários da Engenharia devem usar o
mesmo e-mail cadastrado em **Profissionais** — o vínculo é automático.
Crie também o documento **`config/params`**:

```json
// config/params
{ "anoPlano": 2027, "valorRef": 125451.15, "pesoGUT": 0.75, "pesoPxC": 0.25, "limitePontos": 6 }
```

## 5. Registrar o app Web e colar a configuração
1. **Visão geral do projeto → ⚙ → Configurações do projeto → Seus apps → Web (`</>`)**.
2. Registre (ex.: `seng-demandas`), **sem** Firebase Hosting.
3. Copie o objeto `firebaseConfig` exibido e cole em **`js/firebase-config.js`**:

```js
export const FIREBASE_CONFIG = {
  apiKey: '...', authDomain: 'cpii-seng.firebaseapp.com', projectId: 'cpii-seng',
  storageBucket: 'cpii-seng.firebasestorage.app', messagingSenderId: '...', appId: '...',
};
```

4. Em **Authentication → Settings → Authorized domains**, adicione o domínio
   do GitHub Pages (ex.: `SEU-USUARIO.github.io`).
5. Faça commit/push — o GitHub Pages publica e o sistema sai do modo demonstração.

> A `apiKey` do Firebase Web **não é segredo**: a segurança é garantida pelas
> Security Rules. Mesmo assim, restrinja a chave ao domínio do Pages em
> https://console.cloud.google.com/apis/credentials se desejar camada extra.

## 6. Cadastros iniciais no sistema
Entre com o usuário `admin` e cadastre os profissionais da SENG (menu
**Profissionais**) e os demais usuários (menu **Administração → Novo
usuário** — a credencial é criada pela própria interface, com senha inicial;
cada pessoa troca a senha depois em **Minha conta**, no nome no topo da
página). O console do Firebase fica como alternativa, não como exigência.

## Custos e limites
Plano gratuito: 50 mil leituras/dia, 20 mil gravações/dia, 1 GiB — muito acima
da necessidade do fluxo de demandas do CP2.
