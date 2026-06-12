// =============================================================================
// Configuração do Firebase (PRODUÇÃO) — projeto cpii-seng
// -----------------------------------------------------------------------------
// A apiKey do Firebase Web não é um segredo: o controle de acesso é feito
// pelas Security Rules (firebase/firestore.rules) e pelo Firebase Auth.
// O alerta "Secrets detected" do GitHub para esta chave é falso positivo
// esperado. Endurecimento aplicado: chave restrita às APIs do Firebase e a
// requisições originadas de noedelima.github.io (+ localhost p/ dev) — fora
// do site retorna 403 (testado). Gerencie em:
// https://console.cloud.google.com/apis/credentials?project=cpii-seng
// Para voltar ao MODO DEMONSTRAÇÃO (dados fictícios), troque o objeto por null.
// =============================================================================
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBTrzbePWCr7OvTMptcaYr8GyZsY2363kc',
  authDomain: 'cpii-seng.firebaseapp.com',
  projectId: 'cpii-seng',
  storageBucket: 'cpii-seng.firebasestorage.app',
  messagingSenderId: '704635294862',
  appId: '1:704635294862:web:560bf12df2f4c63acfe5df',
};
