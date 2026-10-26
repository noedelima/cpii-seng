// Endpoints de escrita da FASE CHAMADO (v2.0 — ADR-004: entrada única em
// /entradas/{id}). Rodam sob o token do usuário → as Security Rules aprovam/negam.
// A vista "chamado" usa `status`; no documento o campo é `statusChamado`
// (o `status` do registro pertence à fase demanda) — a tradução é feita aqui.
// v1.31: log de auditoria no mesmo commit (#11); AUTORIA carimbada pelo servidor (#12).
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { writePatch, writeCreate, enc, encFields, nomeDoUsuario, perfilDe, commitComLog } = require('../shared/firestore');

const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
function exigirId(id) { if (!idValido(id)) throw new ErroPublico(400, 'Identificador inválido.'); }
// Campos que a vista chamado não grava (identidade, fase, escalada/devolução têm rota própria).
const PROIBIDOS = ['autor', 'trilha', 'refs', 'ano', 'seq', 'campus', 'demandaId', 'aberturaEm'];

// PATCH /api/chamados/{id} — atualizar (triagem, resolução, status, comentários…)
app.http('atualizarChamado', {
  methods: ['PATCH'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const patch = { ...((body && body.patch) || {}) };
    if (PROIBIDOS.some(k => k in patch)) throw new ErroPublico(400, 'Campo não pode ser alterado por esta operação.');
    if ('status' in patch) { patch.statusChamado = patch.status; delete patch.status; }
    if (patch.statusChamado === 'obra') throw new ErroPublico(400, 'Use a escalada para encaminhar à fila de Obras.');
    const evento = (body && body.evento) || null;
    const now = Date.now();
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    let ev = null;
    if (evento) { const nome = await nomeDoUsuario(user); ev = enc({ ts: now, user: nome, acao: String(evento).slice(0, 300) }); }
    await commitComLog(user, [writePatch('entradas/' + id, fields, mask, ev)],
      'Chamado atualizado [via API]', id, evento || mask.join(', '));
    return json(200, { ok: true, id });
  }),
});

// PUT /api/chamados/{id} — abrir (id ANO+CAMPUS+seq calculado no cliente). body: { data: {...} }
// Toda entrada nasce na fase chamado.
app.http('criarChamado', {
  methods: ['PUT'], authLevel: 'anonymous', route: 'chamados/{id}',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const data = { ...((body && body.data) || {}) };
    delete data.status; delete data.refs;
    const perfil = await perfilDe(user);
    data.autor = { nome: perfil.nome || '', email: user.email || '', uid: user.uid };
    data.trilha = 'chamado';
    data.statusChamado = 'aberto';
    if (data.solicitanteRepresentado != null) {
      const rep = String(data.solicitanteRepresentado).trim().slice(0, 120);
      if (rep) data.solicitanteRepresentado = rep; else delete data.solicitanteRepresentado;
    }
    const agora = Date.now();
    data.historico = [{ ts: agora, user: perfil.nome || user.email || 'Sistema', acao: 'Chamado aberto' }];
    await commitComLog(user, [writeCreate('entradas/' + id, encFields(data))],
      'Chamado aberto [via API]', id, data.assunto || '');
    return json(200, { ok: true, id });
  }),
});
