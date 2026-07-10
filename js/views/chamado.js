// =============================================================================
// Detalhe / triagem de chamado. SENG triam (desfecho); campus dono complementa,
// comenta e responde diligências. Desfecho "obra" converte o chamado em Demanda.
// =============================================================================
import { el, frag, campo, select, toast, confirmar, previewAnexo, fmtDataHora, fmtData } from '../ui.js';
import {
  statusChamadoNome, statusChamadoCor, categoriaChamado, categoriaChamadoNome, campusNome,
  URGENCIA_CHAMADO, DESFECHO_CHAMADO, SETORES_ENCAMINHAMENTO, STATUS_CHAMADO_ABERTO, slaChamado,
  TIPOS_DEMANDA, PROJETO_EXISTE, PRAZOS, ESPECIALIDADES, precisaEtapaProjeto,
} from '../config.js';
import { store } from '../store.js';
import { can, ehCampusDe } from '../auth.js';
import { notificar, notificarChamado } from '../notificacoes.js';

const urgenciaNome = (id) => (URGENCIA_CHAMADO.find(u => u.id === id) || {}).nome || id || '—';
const espDaDisciplina = (d) => !d ? [] : (['Civil', 'Elétrica', 'Mecânica'].includes(d) ? ['Engenharia ' + d] : [d]);

export function viewChamado(rerender, id) {
  const s = store();
  const user = s.user;
  if (!user) { location.hash = '#/login'; return frag(); }

  const c = s.getChamado(id);
  if (!c) {
    return frag(el('section', { class: 'card' },
      el('h1', {}, 'Chamado não encontrado'),
      el('p', { class: 'sub' }, 'Ele pode ter sido removido ou você não tem acesso a esta unidade.'),
      el('a', { class: 'btn ghost', href: '#/chamados' }, '← Voltar aos chamados')));
  }

  const ehSeng = ['engenharia', 'chefe', 'admin'].includes(user.role);
  const ehDono = ehCampusDe(user, c.campus);
  const terminal = !STATUS_CHAMADO_ABERTO.includes(c.status);
  const sla = slaChamado(c);

  // Wrapper de ação: aplica patch/evento, dispara notificação opcional, dá feedback.
  const acao = async (patch, evento, notif) => {
    try {
      await s.atualizarChamado(c.id, patch, evento);
      if (notif) await notificarChamado(s, notif, { ...c, ...patch });
      toast('Chamado atualizado.');
    } catch (err) { toast(err.message || 'Falha ao atualizar.', 'erro'); }
  };

  // ---------------------------------------------------------------- cabeçalho
  const slaChip = terminal ? null : el('span', {
    class: `ch-sla ${sla.estado === 'vencido' ? 'sla-vencido' : sla.estado === 'vencendo' ? 'sla-alerta' : 'sla-ok'}`,
  }, sla.estado === 'vencido' ? `SLA atrasado ${Math.abs(sla.dias)}d` : `SLA: ${sla.dias}d`);

  const topo = el('section', { class: 'hero' },
    el('div', {},
      el('div', { class: 'ch-topo-linha' },
        el('span', { class: 'ch-id mono' }, c.id),
        el('span', { class: `badge ${statusChamadoCor(c.status)}` }, statusChamadoNome(c.status)),
        slaChip),
      el('h1', {}, c.assunto || '(sem assunto)'),
      el('p', { class: 'sub' }, `${categoriaChamadoNome(c.categoria)} · ${campusNome(c.campus)}`)),
    el('a', { class: 'btn ghost sm', href: '#/chamados' }, '← Chamados'));

  // ------------------------------------------------------------------ dados
  const linhaMeta = (rot, val) => el('div', { class: 'meta-item' },
    el('span', { class: 'meta-rot' }, rot), el('span', { class: 'meta-val' }, val || '—'));

  const dados = el('section', { class: 'card' },
    el('h2', {}, 'Dados do chamado'),
    el('div', { class: 'meta-grid' },
      linhaMeta('Campus', campusNome(c.campus)),
      linhaMeta('Categoria', categoriaChamadoNome(c.categoria)),
      linhaMeta('Urgência', urgenciaNome(c.urgencia)),
      linhaMeta('Localização', c.local),
      linhaMeta('Aberto em', fmtDataHora(c.aberturaEm)),
      linhaMeta('Prazo (SLA)', c.prazoLimite ? fmtData(c.prazoLimite) : '—'),
      linhaMeta('Solicitante', c.autor?.nome)),
    el('h3', { class: 'sub-titulo' }, 'Descrição'),
    el('p', { class: 'ch-descricao' }, c.descricao || '—'));

  // Chamado já convertido em demanda
  const cartaoDemanda = c.demandaId ? el('section', { class: 'card destaque' },
    el('h2', {}, 'Encaminhado à fila de Obras'),
    el('p', {}, 'Este chamado foi convertido na demanda ',
      el('a', { class: 'link', href: `#/demanda/${c.demandaId}` }, c.demandaId), '.'),
    (c.resolucao?.texto ? el('p', { class: 'ch-descricao' }, c.resolucao.texto) : null)) : null;

  // Resolução/parecer + minuta de Nota Técnica (consultoria/laudo)
  const temConsultoria = ['consultoria', 'laudo'].includes(c.desfecho);
  const desfechoNome = (id) => (DESFECHO_CHAMADO.find(d => d.id === id) || {}).nome || id;
  const btnNT = el('button', { class: 'btn', onclick: async (ev) => {
    const b = ev.currentTarget; b.disabled = true; const t = b.textContent; b.textContent = 'Gerando…';
    try {
      const { gerarNotaTecnicaChamado } = await import('../pdf.js');
      await gerarNotaTecnicaChamado({ chamado: c, assinante: { nome: user.nome } });
      toast('Minuta de Nota Técnica gerada. Revise e numere antes de assinar.');
    } catch (e) { toast('Falha ao gerar a NT: ' + (e.message || e), 'erro'); }
    b.disabled = false; b.textContent = t;
  } }, 'Gerar Nota Técnica (minuta)');
  const cartaoResolucao = ((c.resolucao || temConsultoria) && !c.demandaId) ? el('section', { class: 'card' },
    el('h2', {}, 'Desfecho'),
    c.desfecho ? el('p', {}, el('strong', {}, 'Trilha: '), desfechoNome(c.desfecho)) : null,
    c.resolucao?.setor ? el('p', {}, el('strong', {}, 'Encaminhado a: '), c.resolucao.setor) : null,
    c.resolucao?.texto ? el('p', { class: 'ch-descricao' }, c.resolucao.texto) : null,
    (ehSeng && temConsultoria) ? el('div', { class: 'form-acoes' }, btnNT,
      el('span', { class: 'sub' }, 'Rascunho — revise e numere antes de assinar.')) : null) : null;

  // ---------------------------------------------------------------- anexos
  const anexos = renderAnexos(c, s, user, ehSeng, ehDono);

  // -------------------------------------------------------------- comentários
  const comentarios = renderComentarios(c, s, user, ehSeng, ehDono, acao);

  // ------------------------------------------------------------------ triagem
  const triagem = ehSeng ? renderTriagem(c, s, user, terminal, acao, rerender) : null;

  // ----------------------------------------------- responder diligência (campus)
  const respostaCampus = (ehDono && c.status === 'diligencia') ? renderRespostaCampus(c, s, user, acao) : null;

  // ------------------------------------------------------------------ histórico
  const hist = (c.historico || []).slice().reverse();
  const historico = el('section', { class: 'card' },
    el('h2', {}, 'Histórico'),
    hist.length
      ? el('ul', { class: 'timeline' }, hist.map(h => el('li', {},
          el('span', { class: 'tl-data' }, fmtDataHora(h.ts)),
          el('span', { class: 'tl-acao' }, `${h.acao}${h.user ? ' — ' + h.user : ''}`))))
      : el('p', { class: 'sub' }, 'Sem eventos.'));

  return frag(topo, dados, cartaoDemanda, cartaoResolucao, anexos, triagem, respostaCampus, comentarios, historico);
}

// ----------------------------------------------------------------------------
// Cartão de triagem (SENG): status rápido + desfecho + resolução.
// ----------------------------------------------------------------------------
function renderTriagem(c, s, user, terminal, acao, rerender) {
  const secao = el('section', { class: 'card triagem' }, el('h2', {}, 'Triagem'));

  if (terminal) {
    secao.append(el('p', { class: 'sub' }, `Chamado encerrado (${statusChamadoNome(c.status)}). `,
      c.status === 'obra' ? 'O andamento segue na demanda vinculada.' : 'Reabertura, se necessária, pela Chefia.'));
    return secao;
  }

  // Ações rápidas de status
  const rapidas = el('div', { class: 'triagem-acoes' });
  if (c.status === 'aberto') {
    rapidas.append(el('button', { class: 'btn', onclick: () => acao({ status: 'triagem' }, 'Triagem iniciada') }, 'Iniciar triagem'));
  }

  // Diligência (pedir complemento ao campus)
  const inDilig = el('textarea', { rows: 2, maxlength: 1500, placeholder: 'O que falta esclarecer? (será enviado ao campus)' });
  const btnDilig = el('button', { class: 'btn', onclick: async () => {
    const txt = inDilig.value.trim();
    if (!txt) { toast('Escreva o que precisa ser complementado.', 'erro'); return; }
    const obs = [...(c.obsExterna || []), comentario(user, txt, 'Diligência')];
    await acao({ status: 'diligencia', obsExterna: obs }, 'Diligência solicitada ao campus', 'chamado-diligencia');
    inDilig.value = '';
  } }, 'Solicitar diligência');

  // Desfecho da triagem
  const selDesf = select(DESFECHO_CHAMADO, { placeholder: 'Selecione o desfecho…' });
  const selSetor = select(SETORES_ENCAMINHAMENTO.map(x => ({ id: x, nome: x })), { placeholder: 'Setor de destino…' });
  const wrapSetor = campo('Setor de destino', selSetor);
  wrapSetor.style.display = 'none';
  const inParecer = el('textarea', { rows: 3, maxlength: 4000, placeholder: 'Parecer / orientação (registrado no chamado e enviado ao campus quando resolver).' });

  // Classificação da demanda — preenchida ao converter em OBRA. Unifica a antiga
  // "Nova solicitação": a demanda nasce classificada aqui, na triagem.
  const disc = (categoriaChamado(c.categoria) || {}).disciplina;
  const espPre = espDaDisciplina(disc);
  const selTipo = select(TIPOS_DEMANDA.filter(t => !t.oculto), { value: 'obra', placeholder: null });
  const selProjeto = select(PROJETO_EXISTE, { value: 'nao', placeholder: null });
  const selTombado = select([{ id: 'sim', nome: 'Sim' }, { id: 'nao', nome: 'Não' }, { id: 'ns', nome: 'Não sei' }], { value: 'ns', placeholder: null });
  const selPrazo = select(PRAZOS, { placeholder: 'Sem previsão definida' });
  const inValor = el('input', { type: 'number', min: 0, step: 'any', placeholder: 'Ex.: 250000 (opcional)' });
  const inSuap = el('input', { type: 'text', maxlength: 25, placeholder: 'Ex.: 23040.001234/2026-11 (se houver)' });
  const espChecks = ESPECIALIDADES.map(e2 => el('label', { class: 'chip-check' },
    el('input', { type: 'checkbox', value: e2, ...(espPre.includes(e2) ? { checked: true } : {}) }), ' ' + e2));
  const wrapObra = el('div', { class: 'obra-campos' },
    el('div', { class: 'form-linha' }, campo('Tipo de demanda *', selTipo), campo('Projeto já existe? *', selProjeto)),
    el('div', { class: 'form-linha' }, campo('Imóvel tombado?', selTombado), campo('Previsão de prazo', selPrazo)),
    el('div', { class: 'form-linha' }, campo('Valor estimado (R$)', inValor), campo('Processo SUAP', inSuap)),
    campo('Especialidades envolvidas *', el('div', { class: 'chips' }, espChecks)));
  wrapObra.style.display = 'none';
  const lerObra = () => ({
    tipoDemanda: selTipo.value, projetoExiste: selProjeto.value, tombado: selTombado.value,
    prazoEstimado: selPrazo.value || null, valorEstimado: inValor.value || null, processoSuap: inSuap.value.trim(),
    especialidades: espChecks.map(l => l.querySelector('input')).filter(x => x.checked).map(x => x.value),
  });

  selDesf.onchange = () => {
    wrapSetor.style.display = selDesf.value === 'encaminhado' ? '' : 'none';
    wrapObra.style.display = selDesf.value === 'obra' ? '' : 'none';
  };

  const btnDesf = el('button', { class: 'btn primario', onclick: () => aplicarDesfecho(c, s, user, { desfecho: selDesf.value, setor: selSetor.value, parecer: inParecer.value.trim(), obra: lerObra() }, acao) }, 'Aplicar desfecho');

  // Resolver (consultoria/laudo em atendimento → resolvido)
  const resolver = c.status === 'atendimento' ? el('div', { class: 'triagem-bloco' },
    el('h3', { class: 'sub-titulo' }, 'Concluir o atendimento'),
    campo('Orientação / referência da Nota Técnica', el('textarea', { rows: 3, maxlength: 4000, placeholder: 'Resumo da orientação ou nº da NT emitida.', id: 'ch-resolucao-txt' })),
    el('button', { class: 'btn primario', onclick: async (ev) => {
      const txt = ev.target.closest('.triagem-bloco').querySelector('#ch-resolucao-txt').value.trim();
      if (!txt) { toast('Descreva a orientação/desfecho.', 'erro'); return; }
      await acao({ status: 'resolvido', resolucao: { texto: txt } }, 'Chamado resolvido (consultoria/laudo)', 'chamado-resolvido');
    } }, 'Marcar como resolvido')) : null;

  secao.append(
    rapidas,
    el('div', { class: 'triagem-bloco' },
      el('h3', { class: 'sub-titulo' }, 'Diligência'),
      campo('Mensagem ao campus', inDilig), el('div', { class: 'form-acoes' }, btnDilig)),
    el('div', { class: 'triagem-bloco' },
      el('h3', { class: 'sub-titulo' }, 'Desfecho'),
      campo('Decisão da triagem', selDesf,
        'Obra → cria a demanda (classifique abaixo). Consultoria/Laudo → atendimento pela SENG. Encaminhado → outro setor.'),
      wrapSetor,
      wrapObra,
      campo('Parecer / orientação', inParecer),
      el('div', { class: 'form-acoes' }, btnDesf)),
    ...(resolver ? [resolver] : []));
  return secao;
}

async function aplicarDesfecho(c, s, user, { desfecho, setor, parecer, obra = {} }, acao) {
  if (!desfecho) { toast('Selecione um desfecho.', 'erro'); return; }
  const def = DESFECHO_CHAMADO.find(d => d.id === desfecho);

  if (desfecho === 'obra') {
    const esp = (obra.especialidades && obra.especialidades.length)
      ? obra.especialidades : espDaDisciplina((categoriaChamado(c.categoria) || {}).disciplina);
    if (!esp.length) { toast('Selecione ao menos uma especialidade.', 'erro'); return; }
    const ok = await confirmar('Converter em demanda de obra',
      `O chamado ${c.id} passará a "Encaminhado à fila de Obras" e será criada uma nova demanda vinculada, com a classificação informada, que entra no fluxo de priorização (GUT/CODIR). Confirmar?`,
      { ok: 'Converter em demanda' });
    if (!ok) return;
    try {
      const tipoDemanda = obra.tipoDemanda || 'obra';
      const projetoExiste = obra.projetoExiste || 'nao';
      const did = await s.criarDemanda({
        campus: c.campus, local: c.local || '', tipoDemanda, projetoExiste,
        etapa: precisaEtapaProjeto({ tipoDemanda, projetoExiste }) ? 'projeto' : null,
        tombado: obra.tombado || 'ns', prazoEstimado: obra.prazoEstimado || null,
        valorEstimado: obra.valorEstimado ? Number(obra.valorEstimado) : null,
        processoSuap: obra.processoSuap || '',
        objeto: (c.assunto || 'Demanda de obra').slice(0, 120),
        descricao: `${c.descricao || ''}${parecer ? '\n\nParecer da triagem: ' + parecer : ''}\n\n[Originado do chamado ${c.id}]`,
        emergencial: c.urgencia === 'emergencial', especialidades: esp, status: 'recebido',
        solicitante: { nome: c.autor?.nome || user.nome, email: c.autor?.email || '' },
        historico: [{ ts: Date.now(), user: user.nome, acao: `Solicitação registrada (originada do chamado ${c.id})` }],
      });
      await s.atualizarChamado(c.id, { status: 'obra', desfecho: 'obra', demandaId: did, resolucao: parecer ? { texto: parecer } : null },
        `Convertido na demanda ${did} (fila de Obras)`);
      await notificar(s, 'nova', { id: did, objeto: c.assunto, especialidades: esp });
      await notificarChamado(s, 'chamado-desfecho', c);
      toast(`Demanda ${did} criada a partir do chamado.`);
      location.hash = `#/demanda/${did}`;
    } catch (err) { toast(err.message || 'Falha ao converter.', 'erro'); }
    return;
  }

  if (desfecho === 'consultoria' || desfecho === 'laudo') {
    await acao({ status: def.status, desfecho, resolucao: parecer ? { texto: parecer } : null },
      `Desfecho: ${def.nome}`);
    return;
  }

  if (desfecho === 'encaminhado') {
    if (!setor) { toast('Selecione o setor de destino.', 'erro'); return; }
    await acao({ status: 'encaminhado', desfecho, resolucao: { setor, texto: parecer } },
      `Encaminhado a: ${setor}`, 'chamado-desfecho');
    return;
  }

  // improcedente / duplicado
  await acao({ status: def.status, desfecho, resolucao: parecer ? { texto: parecer } : null },
    `Desfecho: ${def.nome}`, 'chamado-desfecho');
}

// ----------------------------------------------------------------------------
// Campus responde a diligência: complementa e devolve para triagem.
// ----------------------------------------------------------------------------
function renderRespostaCampus(c, s, user, acao) {
  const inTxt = el('textarea', { rows: 3, maxlength: 3000, placeholder: 'Informação complementar solicitada pela Engenharia.' });
  const btn = el('button', { class: 'btn primario', onclick: async () => {
    const txt = inTxt.value.trim();
    if (!txt) { toast('Escreva o complemento.', 'erro'); return; }
    const obs = [...(c.obsExterna || []), comentario(user, txt)];
    await acao({ status: 'triagem', obsExterna: obs }, 'Complemento enviado pelo campus');
    inTxt.value = '';
  } }, 'Responder diligência');
  return el('section', { class: 'card destaque' },
    el('h2', {}, 'Diligência — resposta do campus'),
    el('p', { class: 'sub' }, 'A Engenharia solicitou um complemento. Responda abaixo para retomar a triagem.'),
    campo('Complemento', inTxt), el('div', { class: 'form-acoes' }, btn));
}

// ----------------------------------------------------------------------------
// Comentários (fio público campus ↔ SENG). Dono e SENG podem comentar.
// ----------------------------------------------------------------------------
function renderComentarios(c, s, user, ehSeng, ehDono, acao) {
  const lista = c.obsExterna || [];
  const podeComentar = ehSeng || ehDono;

  const itens = lista.length
    ? el('ul', { class: 'coment-lista' }, lista.slice().reverse().map(o => el('li', { class: 'coment' },
        el('div', { class: 'coment-cab' },
          el('strong', {}, o.autor || 'Usuário'),
          o.tag ? el('span', { class: 'coment-tag' }, o.tag) : null,
          el('span', { class: 'coment-data' }, fmtDataHora(o.ts))),
        el('p', { class: 'coment-txt' }, o.texto))))
    : el('p', { class: 'sub' }, 'Sem comentários.');

  let entrada = null;
  if (podeComentar) {
    const inTxt = el('textarea', { rows: 2, maxlength: 3000, placeholder: 'Escrever um comentário…' });
    const btn = el('button', { class: 'btn', onclick: async () => {
      const txt = inTxt.value.trim();
      if (!txt) return;
      const obs = [...(c.obsExterna || []), comentario(user, txt)];
      await acao({ obsExterna: obs }, 'Comentário adicionado');
      inTxt.value = '';
    } }, 'Comentar');
    entrada = el('div', { class: 'coment-entrada' }, inTxt, el('div', { class: 'form-acoes' }, btn));
  }

  return el('section', { class: 'card' }, el('h2', {}, 'Comentários'), itens, entrada);
}

// Objeto de comentário padronizado (fio público).
function comentario(user, texto, tag) {
  return { ts: Date.now(), autor: user.nome, role: user.role, texto, ...(tag ? { tag } : {}) };
}

// ----------------------------------------------------------------------------
// Anexos (fotos/plantas/PDF) via Cloud Storage. SENG sempre; campus dono até a
// triagem (aberto/triagem/diligência). Imagens e PDF, até 10 MB.
// ----------------------------------------------------------------------------
const TIPOS_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const tipoAnexoOk = (t) => TIPOS_IMG.includes(t) || t === 'application/pdf';
const ehImagem = (t) => (t || '').indexOf('image/') === 0;
function fmtTam(n) {
  if (!n) return '';
  return n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}
function renderAnexos(c, s, user, ehSeng, ehDono) {
  const lista = c.anexos || [];
  const podeAnexar = ehSeng || (ehDono && ['aberto', 'triagem', 'diligencia'].includes(c.status));

  // Estado FRESCO no momento de gravar: a lista parte do chamado atual no store
  // (não do `c` capturado no render) — gravações concorrentes não se sobrescrevem.
  const anexosAtuais = () => ((s.getChamado(c.id) || c).anexos || []);
  let enviando = false; // trava de reentrância (duplo clique/reenvio no meio do upload)

  const adicionar = async (files, btn) => {
    if (enviando) { toast('Aguarde — já há um envio em andamento.'); return; }
    enviando = true;
    const rotulo = btn ? btn.textContent : '';
    if (btn) btn.disabled = true;
    try {
      const novos = [];
      for (const f of files) {
        if ((f.size || 0) > 10 * 1048576) { toast(`${f.name}: acima de 10 MB.`, 'erro'); continue; }
        if (!tipoAnexoOk(f.type)) { toast(`${f.name}: use imagem (JPG/PNG/WebP) ou PDF.`, 'erro'); continue; }
        try {
          if (btn) btn.textContent = `Enviando ${f.name.slice(0, 24)}… 0%`;
          novos.push(await s.uploadAnexoChamado(c.id, c.campus, f, (p) => {
            if (btn) btn.textContent = `Enviando ${f.name.slice(0, 24)}… ${Math.round(p * 100)}%`;
          }));
        } catch (e) { toast(e.message || `Falha ao enviar ${f.name}.`, 'erro'); }
      }
      if (!novos.length) return;
      const base = anexosAtuais();
      const anexos = [...base, ...novos.filter(n => !base.some(x => x.path === n.path))];
      await s.atualizarChamado(c.id, { anexos }, `Anexo(s): ${novos.map(x => x.nome).join(', ')}`.slice(0, 110));
      toast('Anexo(s) adicionado(s).');
    } finally {
      enviando = false;
      if (btn) { btn.disabled = false; btn.textContent = rotulo; }
    }
  };

  const remover = async (a) => {
    const ok = await confirmar('Remover anexo', `Remover "${a.nome}"? Esta ação não pode ser desfeita.`, { ok: 'Remover', perigo: true });
    if (!ok) return;
    try {
      await s.removerAnexoChamado(a.path);
      const anexos = anexosAtuais().filter(x => x.path !== a.path);
      await s.atualizarChamado(c.id, { anexos }, `Anexo removido: ${a.nome}`.slice(0, 110));
      toast('Anexo removido.');
    } catch (e) { toast(e.message || 'Falha ao remover.', 'erro'); }
  };

  // Clique abre a pré-visualização (lightbox); "abrir em nova aba" fica no modal.
  const galeria = lista.length
    ? el('div', { class: 'anexos-grid' }, lista.map(a => el('div', { class: 'anexo' },
        el('button', { class: 'anexo-link', title: `${a.nome}${a.tamanho ? ' · ' + fmtTam(a.tamanho) : ''}`, 'aria-label': `Pré-visualizar ${a.nome}`, onclick: () => previewAnexo(a) },
          ehImagem(a.tipo)
            ? el('img', { class: 'anexo-thumb', src: a.url, alt: a.nome, loading: 'lazy' })
            : el('span', { class: 'anexo-file' }, 'PDF'),
          el('span', { class: 'anexo-nome' }, a.nome)),
        podeAnexar ? el('button', { class: 'anexo-rm', title: 'Remover', 'aria-label': 'Remover anexo', onclick: () => remover(a) }, '×') : null)))
    : el('p', { class: 'sub' }, 'Sem anexos.');

  let entrada = null;
  if (podeAnexar) {
    const btnAdd = el('button', { class: 'btn' }, '+ Adicionar anexo');
    const input = el('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, style: 'display:none',
      onchange: (e) => { const fs = [...e.target.files]; e.target.value = ''; adicionar(fs, btnAdd); } });
    btnAdd.onclick = () => { if (!enviando) input.click(); };
    entrada = el('div', { class: 'anexo-add' }, input, btnAdd,
      el('span', { class: 'sub' }, 'Imagens ou PDF, até 10 MB.'));
  } else if (ehDono) {
    entrada = el('p', { class: 'sub' }, 'Anexos podem ser incluídos enquanto o chamado está em aberto/triagem/diligência.');
  }

  return el('section', { class: 'card' }, el('h2', {}, 'Anexos'), galeria, entrada);
}
