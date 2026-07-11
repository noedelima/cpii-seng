// =============================================================================
// Linha do tempo unificada — comentários + anexos + eventos de histórico —
// compartilhada por DEMANDAS e CHAMADOS (unificação dos workflows).
//
// Comentários: fio ÚNICO no campo `comentarios`
//   [{ id, ts, texto, autor, autorUid, role, editadoEm? }]
// Identificação: visualização PÚBLICA mostra a origem/perfil (ex.: "Campus",
// "Engenharia", "CODIR"); autenticados veem também o NOME do autor.
// Compatibilidade: os fios antigos (obsInterna/obsExterna e textos legados)
// são mesclados na exibição, somente leitura; a escrita vai só para o novo.
// =============================================================================
import { el, toast, confirmar, fmtDataHora, previewAnexo } from './ui.js';

export const ROTULO_ROLE = {
  campus: 'Campus', engenharia: 'Engenharia', chefe: 'Engenharia — Chefia',
  codir: 'CODIR', admin: 'Administração',
};
const rotulo = (role) => ROTULO_ROLE[role] || 'Sistema';

// Mescla o fio novo com os antigos (compat de leitura; antigos ficam imutáveis).
export function comentariosDe(doc, extras = {}) {
  const conv = (arr, origem) => (Array.isArray(arr) ? arr : []).map(c => ({ ...c, role: c.role || origem, _antigo: true }));
  const leg = (txt, origem) => txt ? [{ id: 'leg-' + origem, ts: doc.atualizadoEm || doc.criadoEm || 0, texto: txt, autor: '(registro anterior)', role: origem, _antigo: true }] : [];
  return [
    ...(Array.isArray(doc.comentarios) ? doc.comentarios : []),
    ...conv(doc.obsInterna, 'engenharia'),
    ...conv(doc.obsExterna, 'campus'),
    ...leg(extras.obsEngenharia, 'engenharia'),
    ...leg(doc.obsSolicitante, 'campus'),
  ];
}

const novoId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let emEdicao = null; // id do comentário em edição inline

// cfg: { doc, user, rerender, extras?, anexos?, podeComentar, podeModerar,
//        salvar(comentarios, evento), aoComentar?() }
// `salvar` grava o array novo (campo `comentarios`) com o evento de histórico.
export function renderLinhaTempo(cfg) {
  const { doc, user, rerender, extras = {}, anexos = [], podeComentar, podeModerar, salvar, aoComentar } = cfg;
  const coms = comentariosDe(doc, extras);
  const itens = [
    ...coms.map(c => ({ ts: c.ts || 0, tipo: 'comentario', c })),
    ...(user ? anexos.map(a => ({ ts: a.ts || 0, tipo: 'anexo', a })) : []),
    ...((doc.historico || []).map(h => ({ ts: h.ts || 0, tipo: 'evento', h }))),
  ].sort((x, y) => y.ts - x.ts);

  const atuais = () => Array.isArray(doc.comentarios) ? doc.comentarios.slice() : [];
  const podeEditar = (c) => !!(user && !c._antigo && user.uid && user.uid === c.autorUid);
  const podeExcluir = (c) => !!(user && !c._antigo && (user.uid === c.autorUid || podeModerar));

  const quem = (c) => user
    ? `${c.autor || '—'} · ${rotulo(c.role)}`
    : rotulo(c.role);

  const itemComentario = (c) => {
    if (emEdicao === c.id) {
      const tae = el('textarea', { rows: 3, maxlength: 4000 }); tae.value = c.texto;
      return el('li', { class: 'lt-item lt-coment' }, tae, el('div', { class: 'obs-acoes' },
        el('button', { class: 'btn primario sm', onclick: async () => {
          const t = tae.value.trim(); if (!t) { toast('Comentário vazio.', 'erro'); return; }
          const arr = atuais().map(x => x.id === c.id ? { ...x, texto: t, editadoEm: Date.now() } : x);
          emEdicao = null; await salvar(arr, 'Comentário editado'); toast('Comentário atualizado.');
        } }, 'Salvar'),
        el('button', { class: 'btn ghost sm', onclick: () => { emEdicao = null; rerender(); } }, 'Cancelar')));
    }
    return el('li', { class: 'lt-item lt-coment' },
      el('div', { class: 'obs-meta' }, el('strong', {}, quem(c)),
        c.tag ? el('span', { class: 'coment-tag' }, c.tag) : null,
        ` · ${fmtDataHora(c.ts)}`, c.editadoEm ? ' · (editado)' : ''),
      el('div', { class: 'obs-texto' }, c.texto),
      (podeEditar(c) || podeExcluir(c)) ? el('div', { class: 'obs-acoes' },
        podeEditar(c) ? el('button', { class: 'btn ghost sm', onclick: () => { emEdicao = c.id; rerender(); } }, 'Editar') : null,
        podeExcluir(c) ? el('button', { class: 'btn ghost sm perigo', onclick: async () => {
          const ok = await confirmar('Excluir comentário?', 'A ação fica registrada no histórico.', { ok: 'Excluir', perigo: true });
          if (!ok) return;
          await salvar(atuais().filter(x => x.id !== c.id), 'Comentário excluído'); toast('Comentário excluído.');
        } }, 'Excluir') : null) : null);
  };

  const itemAnexo = (a) => el('li', { class: 'lt-item lt-anexo' },
    el('div', { class: 'obs-meta' }, el('strong', {}, a.por || '—'), ` · ${fmtDataHora(a.ts)} · anexo`),
    el('button', { class: 'lt-anexo-link', onclick: () => previewAnexo(a), 'aria-label': `Pré-visualizar ${a.titulo || a.nome}` },
      (a.thumbUrl || (a.tipo || '').indexOf('image/') === 0)
        ? el('img', { class: 'lt-thumb', src: a.thumbUrl || a.url, alt: '', loading: 'lazy' })
        : el('span', { class: 'lt-pdf' }, 'PDF'),
      el('span', {}, a.titulo || a.nome)));

  const itemEvento = (h) => el('li', { class: 'lt-item lt-evento' },
    el('span', { class: 'tl-quando' }, fmtDataHora(h.ts)),
    el('span', { class: 'tl-acao' }, h.acao),
    user ? el('span', { class: 'tl-quem' }, h.user) : null);

  let entrada = null;
  if (podeComentar && user) {
    const tan = el('textarea', { rows: 2, maxlength: 4000, placeholder: 'Escrever um comentário…' });
    entrada = el('div', { class: 'lt-entrada' }, tan, el('div', { class: 'form-acoes' },
      el('button', { class: 'btn', onclick: async () => {
        const t = tan.value.trim(); if (!t) return;
        const arr = [...atuais(), { id: novoId(), ts: Date.now(), texto: t, autor: user.nome, autorUid: user.uid, role: user.role }];
        await salvar(arr, 'Comentário adicionado');
        if (aoComentar) await aoComentar();
        tan.value = '';
        toast('Comentário adicionado.');
      } }, 'Comentar')));
  }

  return el('section', { class: 'card' },
    el('h2', {}, 'Linha do tempo'),
    el('p', { class: 'sub' }, user
      ? 'Comentários, anexos e eventos em ordem cronológica. Edição e exclusão conforme o perfil.'
      : 'Comentários identificados pela origem (perfil) e eventos em ordem cronológica.'),
    entrada,
    itens.length
      ? el('ol', { class: 'lt-lista' }, itens.map(it =>
          it.tipo === 'comentario' ? itemComentario(it.c) : it.tipo === 'anexo' ? itemAnexo(it.a) : itemEvento(it.h)))
      : el('p', { class: 'obs-vazio' }, 'Sem registros ainda.'));
}
