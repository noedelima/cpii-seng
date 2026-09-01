// =============================================================================
// Utilitários HTTP para as Functions (modelo v4).
// ⚠️ O Azure Static Web Apps CONSOME o header `Authorization` para a própria
// autenticação. Por isso o frontend envia o ID token do Firebase no header
// **`x-fb-token`** (ver js/api.js), que o SWA repassa intacto — igual ao truque
// do `x-sb-token` no SANE.
// =============================================================================
const { verifyIdToken } = require('./auth');

const json = (status, body) => ({ status, jsonBody: body });

// Envolve um handler exigindo um ID token válido (header x-fb-token).
// Injeta { request, context, user:{ uid, email, token } }.
function withAuth(handler) {
  return async (request, context) => {
    let user;
    try {
      const token = request.headers.get('x-fb-token') || '';
      user = await verifyIdToken(token);
    } catch (e) {
      return json(401, { error: 'não autorizado', detalhe: String(e.message || e) });
    }
    try {
      return await handler({ request, context, user });
    } catch (e) {
      const msg = String(e.message || e);
      context.error && context.error('handler', e);
      // Negativa das Security Rules chega como 403/PERMISSION_DENIED do Firestore:
      // devolver 403 com mensagem clara em vez de um "erro interno" opaco.
      if (msg.includes('PERMISSION_DENIED') || msg.includes(' 403:')) {
        return json(403, { error: 'permissão negada pelas regras de segurança', detalhe: msg });
      }
      return json(500, { error: 'erro interno', detalhe: msg });
    }
  };
}

module.exports = { json, withAuth };
