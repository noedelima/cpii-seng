// Transições de FASE da entrada única (v2.0 — ADR-004). Rodam sob o token do
// usuário; as Security Rules decidem quem pode (escaladaOk / devolucaoOk).
// O servidor monta o patch a partir do estado atual — o cliente só informa a
// classificação (escalada) ou o motivo (devolução) — e carimba autoria/horário.
const { app } = require('@azure/functions');
const { json, withAuth, ErroPublico } = require('../shared/http');
const { docGet, writePatch, enc, encFields, perfilDe, commitComLog } = require('../shared/firestore');

const idValido = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(id);
function exigirId(id) { if (!idValido(id)) throw new ErroPublico(400, 'Identificador inválido.'); }
// Classificação aceita na escalada (demais campos são do servidor).
const CLASSIFICACAO = ['objeto', 'tipoDemanda', 'projetoExiste', 'etapa', 'tombado', 'prazoEstimado',
  'valorEstimado', 'processoSuap', 'especialidades', 'emergencial', 'solicitante', 'local'];

// POST /api/entradas/{id}/escalar — chamado → demanda (mesmo registro).
// body: { classificacao: {...}, parecer?: string }
app.http('escalarEntrada', {
  methods: ['POST'], authLevel: 'anonymous', route: 'entradas/{id}/escalar',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const cl = (body && body.classificacao) || {};
    const parecer = String((body && body.parecer) || '').trim().slice(0, 4000);
    const e = await docGet('entradas/' + id, user.token);
    if (!e) return json(404, { error: 'Registro não encontrado.' });
    if (e.trilha !== 'chamado') return json(409, { error: 'O registro já está na fase demanda.' });
    if (!['triagem', 'atendimento', 'resolvido'].includes(e.statusChamado))
      return json(409, { error: 'Só é possível escalar chamados em triagem, em atendimento ou resolvidos.' });
    if (!cl.objeto || !Array.isArray(cl.especialidades) || !cl.especialidades.length)
      throw new ErroPublico(400, 'Informe o objeto e ao menos uma especialidade.');
    const now = Date.now();
    const patch = {};
    CLASSIFICACAO.forEach(k => { if (cl[k] !== undefined) patch[k] = cl[k]; });
    const reescalada = e.status === 'devolvido';
    Object.assign(patch, {
      trilha: 'demanda', statusChamado: 'obra', desfecho: 'obra', status: 'recebido',
      codirAprovado: false, ajuste: null, fase: null,
    });
    if (!e.criadoEm) patch.criadoEm = now;
    if (parecer) patch.resolucao = { texto: parecer };
    const perfil = await perfilDe(user);
    const acao = reescalada ? 'Reescalado para demanda — nova deliberação' : 'Escalado para demanda (fila de Obras)';
    const ev = enc({ ts: now, user: perfil.nome || user.email || 'Sistema', acao });
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    await commitComLog(user, [writePatch('entradas/' + id, fields, mask, ev)],
      reescalada ? 'Chamado reescalado [via API]' : 'Chamado escalado [via API]', id, cl.objeto);
    return json(200, { ok: true, id, reescalada });
  }),
});

// POST /api/entradas/{id}/converter-em-chamado — v2.0.1: demanda cadastrada
// direto (sem fase de chamado) ganha a fase de chamado em triagem. Chefia (rules).
// body: { motivo, categoria, slaDias? }
app.http('converterEmChamado', {
  methods: ['POST'], authLevel: 'anonymous', route: 'entradas/{id}/converter-em-chamado',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const motivo = String((body && body.motivo) || '').trim().slice(0, 1000);
    const categoria = String((body && body.categoria) || '').trim().slice(0, 40);
    const slaDias = Math.min(90, Math.max(1, Number(body && body.slaDias) || 15));
    if (motivo.length < 3) throw new ErroPublico(400, 'Informe o motivo da conversão.');
    if (!/^[a-z0-9-]{2,40}$/.test(categoria)) throw new ErroPublico(400, 'Informe a categoria do chamado.');
    const e = await docGet('entradas/' + id, user.token);
    if (!e) return json(404, { error: 'Registro não encontrado.' });
    if (e.trilha !== 'demanda' || e.statusChamado)
      return json(409, { error: 'Só demandas cadastradas diretamente (sem fase de chamado) podem ser convertidas.' });
    const perfil = await perfilDe(user);
    const now = Date.now();
    const sol = e.solicitante || {};
    const patch = {
      trilha: 'chamado', statusChamado: 'triagem', status: 'devolvido', statusAnterior: e.status, desfecho: null,
      assunto: String(e.objeto || 'Solicitação').slice(0, 140), categoria, urgencia: e.emergencial ? 'emergencial' : 'media',
      autor: { nome: sol.nome || perfil.nome || '', email: sol.email || '', uid: '' },
      aberturaEm: now, prazoLimite: now + slaDias * 86400000,
      devolucao: { tipo: 'conversao', motivo, por: perfil.nome || user.email || '', papel: perfil.role || '', em: now },
    };
    const ev = enc({ ts: now, user: perfil.nome || user.email || 'Sistema', acao: `Convertida em chamado (triagem) — ${motivo}`.slice(0, 300) });
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    await commitComLog(user, [writePatch('entradas/' + id, fields, mask, ev)],
      'Demanda convertida em chamado [via API]', id, motivo);
    return json(200, { ok: true, id });
  }),
});

// POST /api/entradas/{id}/devolver — demanda → chamado (mesmo registro).
// body: { motivo: string }. Chefia/Admin até o planejamento; CODIR na deliberação (rules).
app.http('devolverEntrada', {
  methods: ['POST'], authLevel: 'anonymous', route: 'entradas/{id}/devolver',
  handler: withAuth(async ({ request, user }) => {
    const id = request.params.id; exigirId(id);
    const body = await request.json().catch(() => ({}));
    const motivo = String((body && body.motivo) || '').trim().slice(0, 1000);
    if (motivo.length < 3) throw new ErroPublico(400, 'Informe o motivo da devolução.');
    const e = await docGet('entradas/' + id, user.token);
    if (!e) return json(404, { error: 'Registro não encontrado.' });
    if (e.trilha !== 'demanda' || !e.statusChamado)
      return json(409, { error: 'Só demandas originadas de chamado podem ser devolvidas.' });
    const perfil = await perfilDe(user);
    const now = Date.now();
    const patch = {
      trilha: 'chamado', statusChamado: 'triagem', status: 'devolvido', statusAnterior: e.status,
      desfecho: null,
      devolucao: { motivo, por: perfil.nome || user.email || '', papel: perfil.role || '', em: now },
    };
    const ev = enc({ ts: now, user: perfil.nome || user.email || 'Sistema', acao: `Devolvida ao chamado — ${motivo}`.slice(0, 300) });
    const fields = encFields(patch);
    const mask = Object.keys(patch);
    fields.atualizadoEm = enc(now); mask.push('atualizadoEm');
    await commitComLog(user, [writePatch('entradas/' + id, fields, mask, ev)],
      'Demanda devolvida ao chamado [via API]', id, motivo);
    return json(200, { ok: true, id });
  }),
});
