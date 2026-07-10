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
> Security Rules. O alerta de "secret detected" do GitHub é falso positivo
> esperado. Neste projeto a chave já está **restrita por referrer** (somente
> `noedelima.github.io` + localhost) e às APIs do Firebase — requisições de
> fora do site recebem 403. Gerencie em
> https://console.cloud.google.com/apis/credentials?project=cpii-seng.
> Se publicar o site em outro domínio, acrescente-o aos referrers da chave.

## 6. Cadastros iniciais no sistema
Entre com o usuário `admin` e cadastre os profissionais da SENG (menu
**Profissionais**) e os demais usuários (menu **Administração → Novo
usuário** — a credencial é criada pela própria interface, com senha inicial;
cada pessoa troca a senha depois em **Minha conta**, no nome no topo da
página). O console do Firebase fica como alternativa, não como exigência.

## 7. Claims do Storage — anexos de chamados (recomendado)
As regras do Storage (`firebase/storage.rules`) isolam os anexos por papel/campus
lendo **custom claims** do token (`role`/`campi`), sincronizadas pela camada de
API (ADR-002). Para ativar:

1. **Service account dedicada** — no console do Google Cloud (projeto
   `cpii-seng`): **IAM e administrador → Contas de serviço → Criar**. Nome
   sugerido: `seng-claims`. Conceda **somente** o papel **Firebase
   Authentication Admin** (`roles/firebaseauth.admin`) — essa conta gere
   contas/claims e **não acessa** Firestore nem Storage.
2. **Chave JSON** — na conta criada: **Chaves → Adicionar chave → JSON**.
3. **App Setting no SWA** — portal do Azure → Static Web App →
   **Configuração (Variáveis de ambiente)** → nova configuração `FB_SA_JSON`
   com o **conteúdo inteiro** do arquivo JSON. Salvar. *(A chave não entra no
   repositório; sem ela os endpoints `/api/claims/*` respondem 501 e nada
   quebra.)*
4. **Renovação dos tokens** — automática: no próximo acesso de cada usuário o
   app compara token × perfil, sincroniza e renova sozinho.
5. **Publicar as regras** — só depois dos passos 1–4:
   `npx -y firebase-tools@latest deploy --only storage --project cpii-seng`.
   Token sem claims passa a ser **negado** no Storage.

## Custos e limites
Plano gratuito: 50 mil leituras/dia, 20 mil gravações/dia, 1 GiB — muito acima
da necessidade do fluxo de demandas do CP2.
