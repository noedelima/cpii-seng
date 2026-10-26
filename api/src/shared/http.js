// =============================================================================
// Utilitários HTTP para as Functions (modelo v4).
// ⚠️ O Azure Static Web Apps CONSOME o header `Authorization` para a própria
// autenticação. Por isso o frontend envia o ID token do Firebase no header
// **`x-fb-token`** (ver js/api.js), que o SWA repassa intacto.
//
// v1.31 (auditoria #15): respostas de erro NÃO repassam mensagens internas
// (exceções, respostas do Firestore/LDAP). O cliente recebe uma mensagem
// controlada + um código de correlação; o detalhe vai só para o log da
// Function (context.error), já sanitizado de tokens.
// =============================================================================
const crypto = require('crypto');
const { verifyIdToken } = require('./auth');

const json = (status, body) => ({ status, jsonBody: body });

// Remove do texto qualquer coisa com cara de credencial antes de logar.
function sanitizar(texto) {
  return String(texto || '')
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]')
    .replace(/(Bearer\s+)[\w.~+/=-]+/gi, '$1[token]')
    .replace(/("?(?:senha|password|private_key|access_token|refresh_token)"?\s*[:=]\s*)"[^"]*"/gi, '$1"[omitido]"')
    .slice(0, 2000);
}

// Erro com status/mensagem PÚBLICA definidos pelo próprio código (ex.: 400 de
// validação) — a mensagem pode ir ao cliente sem expor detalhes internos.
class ErroPublico extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; this.publico = true; }
}

const novoCodigo = () => crypto.randomBytes(5).toString('hex');

// Converte uma exceção em resposta segura.
function respostaDeErro(e, context, rotulo) {
  if (e && e.publico) return json(e.status || 400, { error: e.message });
  const codigo = novoCodigo();
  const msg = String((e && e.message) || e);
  if (context && context.error) context.error(`[${codigo}] ${rotulo || 'handler'}: ${sanitizar(msg)}`);
  // Negativa das Security Rules (Firestore 403/PERMISSION_DENIED): mensagem clara,
  // sem o corpo da resposta do Firestore.
  if (msg.includes('PERMISSION_DENIED') || msg.includes(' 403:')) {
    return json(403, { error: 'Permissão negada pelas regras de segurança.', codigo });
  }
  return json(500, { error: 'Erro interno. Informe o código à Seção de Engenharia se persistir.', codigo });
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
      if (context && context.warn) context.warn('auth: ' + sanitizar(e.message || e));
      return json(401, { error: 'Não autorizado. Entre novamente.' });
    }
    try {
      return await handler({ request, context, user });
    } catch (e) {
      return respostaDeErro(e, context, 'handler');
    }
  };
}

module.exports = { json, withAuth, respostaDeErro, ErroPublico, sanitizar };
