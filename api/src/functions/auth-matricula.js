// =============================================================================
// Autenticação por MATRÍCULA/SENHA DE REDE (AD/LDAP) — ADR-003 — DORMENTE.
// Fluxo (quando ativado pela DTI):
//   1. POST /api/auth/matricula { matricula, senha }
//   2. Limites de tentativas e de concorrência (abaixo).
//   3. Elegibilidade NO PORTAL primeiro (matrícula cadastrada e ativa) — só
//      então o bind no AD (v1.31, auditoria #10: o Portal não vira um oráculo
//      de força bruta contra o domínio institucional para matrículas que nem
//      têm acesso aqui).
//   4. Bind LDAPS (shared/ldap.js — somente TLS, #7) → custom token Firebase.
//
// Respostas de falha são UNIFORMES (401 genérico) para não revelar se a
// matrícula existe no Portal ou no AD.
//
// LIMITES (padrões conservadores, AJUSTÁVEIS por App Settings — a validar com a
// DTI antes da ativação, em função da política de bloqueio do AD):
//   LDAP_MAX_TENTATIVAS_MATRICULA (5)  por matrícula, na janela
//   LDAP_MAX_TENTATIVAS_IP        (20) por IP de origem, na janela
//   LDAP_JANELA_MIN               (15) minutos
//   LDAP_MAX_CONCORRENCIA         (3)  binds simultâneos por instância
// Os contadores são em memória (por instância da Function): contêm rajadas e
// tentativas distribuídas modestas; a barreira definitiva é o bloqueio do AD.
//
// ATIVAÇÃO (checklist — ver docs/ADR-003-autenticacao-matricula.md):
//   • App Settings: LDAP_URL (ldaps://…), LDAP_BIND_TEMPLATE.
//   • Service account FB_SA_JSON com papéis adicionais: Service Account Token
//     Creator (custom token) e Cloud Datastore Viewer (consulta por matrícula).
// Sem LDAP_URL (ou com URL não-ldaps) → 503 e nada muda no login atual.
// =============================================================================
const { app } = require('@azure/functions');
const { json, respostaDeErro } = require('../shared/http');
const { PROJECT_ID } = require('../shared/auth');
const { claimsDisponiveis, accessToken, customToken, SCOPE_DATASTORE } = require('../shared/adminAuth');
const { ldapBind, ldapDisponivel } = require('../shared/ldap');

const num = (v, padrao) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : padrao; };
const LIM = {
  porMatricula: num(process.env.LDAP_MAX_TENTATIVAS_MATRICULA, 5),
  porIp: num(process.env.LDAP_MAX_TENTATIVAS_IP, 20),
  janelaMs: num(process.env.LDAP_JANELA_MIN, 15) * 60000,
  concorrencia: num(process.env.LDAP_MAX_CONCORRENCIA, 3),
};

// ---- limitador simples em memória ------------------------------------------
const tentativas = new Map(); // chave → [timestamps]
function registrarEExcedeu(chave, max) {
  const agora = Date.now();
  const lista = (tentativas.get(chave) || []).filter(t => agora - t < LIM.janelaMs);
  lista.push(agora);
  tentativas.set(chave, lista);
  if (tentativas.size > 5000) { // poda defensiva
    for (const [k, v] of tentativas) if (!v.some(t => agora - t < LIM.janelaMs)) tentativas.delete(k);
  }
  return lista.length > max;
}
let emCurso = 0;

const NEGADO = () => json(401, { error: 'Matrícula ou senha de rede inválida, ou acesso não cadastrado no Portal.' });

// Consulta administrativa: /usuarios com matricula == X (REST runQuery).
async function usuarioPorMatricula(matricula) {
  const t = await accessToken(SCOPE_DATASTORE);
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'usuarios' }],
      where: { fieldFilter: { field: { fieldPath: 'matricula' }, op: 'EQUAL', value: { stringValue: matricula } } },
      limit: 2,
    } }),
  });
  if (!r.ok) throw new Error('runQuery ' + r.status);
  const docs = (await r.json()).filter((x) => x.document);
  if (docs.length !== 1) return null; // ausente ou duplicada → nega
  const d = docs[0].document;
  return {
    uid: d.name.split('/').pop(),
    ativo: !(d.fields.ativo && d.fields.ativo.booleanValue === false),
    nome: d.fields.nome ? d.fields.nome.stringValue : '',
  };
}

function ipDe(request) {
  const xf = request.headers.get('x-forwarded-for') || request.headers.get('x-azure-clientip') || '';
  return (xf.split(',')[0] || '').trim().replace(/:\d+$/, '') || 'desconhecido';
}

app.http('authMatricula', {
  methods: ['POST'], authLevel: 'anonymous', route: 'auth/matricula',
  handler: async (request, context) => {
    if (!ldapDisponivel())
      return json(503, { error: 'Autenticação por matrícula ainda não habilitada — aguarda a integração com o domínio institucional (DTI).' });
    if (!claimsDisponiveis())
      return json(503, { error: 'Autenticação por matrícula indisponível no momento.' });
    let reservou = false;
    try {
      const body = await request.json().catch(() => ({}));
      const matricula = String(body.matricula || '').trim();
      const senha = String(body.senha || '');
      if (!/^\d{4,12}$/.test(matricula) || !senha || senha.length > 256)
        return json(400, { error: 'Informe matrícula (somente números) e a senha de rede.' });

      // 1) Limites — contam toda tentativa, válida ou não.
      const excIp = registrarEExcedeu('ip:' + ipDe(request), LIM.porIp);
      const excMat = registrarEExcedeu('mat:' + matricula, LIM.porMatricula);
      if (excIp || excMat)
        return json(429, { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
      if (emCurso >= LIM.concorrencia)
        return json(503, { error: 'Serviço ocupado. Tente novamente em instantes.' });
      emCurso++; reservou = true;

      // 2) Elegibilidade no Portal ANTES de tocar o AD (#10).
      const u = await usuarioPorMatricula(matricula);
      if (!u || !u.ativo) return NEGADO();

      // 3) Credencial de rede (AD/LDAPS) — mesma do SUAP.
      const dn = (process.env.LDAP_BIND_TEMPLATE || '{matricula}@cp2.g12.br').replaceAll('{matricula}', matricula);
      const bind = await ldapBind(process.env.LDAP_URL, dn, senha);
      if (!bind.ok) return NEGADO();

      // 4) Sessão Firebase (custom token) — rules seguem valendo.
      return json(200, { token: customToken(u.uid), uid: u.uid, nome: u.nome });
    } catch (e) {
      return respostaDeErro(e, context, 'auth/matricula');
    } finally {
      if (reservou) emCurso--;
    }
  },
});
