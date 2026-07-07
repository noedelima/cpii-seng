// GET /api/me — perfil do usuário logado. Valida o ID token do Firebase e lê
// `usuarios/{uid}` no Firestore COM o token do próprio usuário (as Security
// Rules aprovam ou negam). Prova a esteira ponta a ponta (auth + dados sob RLS).
const { app } = require('@azure/functions');
const { json, withAuth } = require('../shared/http');
const { docGet } = require('../shared/firestore');

app.http('me', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: withAuth(async ({ user }) => {
    const perfil = await docGet('usuarios/' + user.uid, user.token);
    return json(200, { uid: user.uid, email: user.email, perfil });
  }),
});
