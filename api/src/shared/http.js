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
      context.error && context.error('handler', e);
      return json(500, { error: 'erro interno', detalhe: String(e.message || e) });
    }
  };
}

module.exports = { json, withAuth };
