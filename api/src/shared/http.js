// =============================================================================
// Utilitários HTTP para as Functions (modelo v4).
// ⚠️ O Azure Static Web Apps CONSOME o header `Authorization` para a própria
// autenticação. Por isso o frontend envia o ID token do Firebase no header
// **`x-fb-token`** (ver js/api.js), que o SWA repassa intacto — igual ao truque
// do `x-sb-token` no SANE.
// =============================================================================
const { verifyIdToken } = require('./auth');
const { randomUUID } = require('crypto');

const json = (status, body) => ({ status, jsonBody: body });

// Never include upstream messages, stacks, request bodies or tokens in diagnostics.
function failure(context, error, location, status = 500) {
  const correlationId = randomUUID();
  context?.error?.('api_failure', {
    correlationId, location, status,
    errorType: error instanceof Error ? error.name : 'Error',
  });
  const messages = {
    401: 'não autorizado',
    400: 'dados da requisição inválidos',
    403: 'permissão negada pelas regras de segurança',
    404: 'registro não encontrado',
    409: 'o registro foi alterado; atualize e tente novamente',
    500: 'erro interno',
  };
  return json(status, { error: messages[status] || messages[500], correlationId });
}

// Envolve um handler exigindo um ID token válido (header x-fb-token).
// Injeta { request, context, user:{ uid, email, token } }.
function withAuth(handler) {
  return async (request, context) => {
    let user;
    try {
      const token = request.headers.get('x-fb-token') || '';
      user = await verifyIdToken(token);
    } catch (e) {
      return failure(context, e, 'authentication', 401);
    }
    try {
      return await handler({ request, context, user });
    } catch (e) {
      const msg = String(e.message || e);
      const codeStatus={PERMISSION_DENIED:403,NOT_FOUND:404,ALREADY_EXISTS:409,ABORTED:409,FAILED_PRECONDITION:409,INVALID_ARGUMENT:400,UNAUTHENTICATED:401};
      if (codeStatus[e.code]) return failure(context,e,'firestore',codeStatus[e.code]);
      if (e instanceof SyntaxError || ['invalid_patch','reserved_field','unknown_chamado_field','invalid_category','history_is_append_only','invalid_mutation_path'].includes(msg))
        return failure(context, e, 'validation', 400);
      if (msg === 'mutation_not_found') return failure(context,e,'lookup',404);
      if (msg.includes('firestore commit 409:') || msg.includes('firestore commit 400:') && msg.includes('FAILED_PRECONDITION'))
        return failure(context,e,'concurrency',409);
      // Negativa das Security Rules chega como 403/PERMISSION_DENIED do Firestore:
      // devolver 403 com mensagem clara em vez de um "erro interno" opaco.
      if (msg.includes('PERMISSION_DENIED') || msg.includes(' 403:')) {
        return failure(context, e, 'authorization', 403);
      }
      return failure(context, e, 'handler');
    }
  };
}

module.exports = { json, withAuth, failure };
