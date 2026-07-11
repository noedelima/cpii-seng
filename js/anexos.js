// =============================================================================
// Anexos — componente compartilhado por DEMANDAS e CHAMADOS (unificação).
// Grid de cards com miniatura (imagem própria; PDF: 1ª página via pdf.js),
// título/descrição (modal no envio + lápis para editar), lightbox, remoção,
// trava de reentrância e estado FRESCO no momento de gravar.
//
// cfg: {
//   lista()            → anexos atuais do documento (estado fresco do store)
//   podeAnexar         → bool
//   upload(file, onP)  → sobe o arquivo, devolve o objeto anexo
//   uploadThumb(blob, base) → sobe a miniatura, devolve { path, url } (opcional)
//   removerStorage(path)    → apaga do Storage
//   salvar(anexos, evento)  → grava a lista no documento
//   aoMudar?()         → pós-gravação (ex.: notificação)
// }
// =============================================================================
import { el, toast, confirmar, campo, previewAnexo } from './ui.js';
import { thumbDePdf } from './pdf-thumb.js';

const TIPOS_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const tipoAnexoOk = (t) => TIPOS_IMG.includes(t) || t === 'application/pdf';
const ehImagem = (t) => (t || '').indexOf('image/') === 0;
function fmtTam(n) {
  if (!n) return '';
  return n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
}

// Modal de título/descrição (envio e edição). Resolve [{file?, titulo, descricao}] ou null.
export function pedirMetaAnexos(files, tituloModal = 'Dados do(s) anexo(s)') {
  return new Promise((resolve) => {
    const linhas = files.map(f => {
      const t = el('input', { type: 'text', maxlength: 80, value: f._titulo || String(f.name || '').replace(/\.[^.]+$/, '') });
      const d = el('input', { type: 'text', maxlength: 200, value: f._descricao || '', placeholder: 'Descrição (opcional)' });
      return { f, t, d, no: el('div', { class: 'anexo-meta-linha' },
        el('span', { class: 'sub mono' }, f.name), campo('Título', t), campo('Descrição', d)) };
    });
    const close = (v) => { wrap.remove(); resolve(v); };
    const wrap = el('div', { class: 'modal-wrap', onclick: (e) => e.target === wrap && close(null) },
      el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': tituloModal },
        el('h3', {}, tituloModal),
        ...linhas.map(l => l.no),
        el('div', { class: 'modal-acoes' },
          el('button', { class: 'btn ghost', onclick: () => close(null) }, 'Cancelar'),
          el('button', { class: 'btn primario', onclick: () => close(linhas.map(l => ({
            file: l.f, titulo: l.t.value.trim() || l.f.name, descricao: l.d.value.trim(),
          }))) }, 'Confirmar'))));
    document.body.append(wrap);
    linhas[0].t.focus();
  });
}

// Backfill de miniaturas para PDFs antigos (sem thumbUrl). Silencioso, best-effort.
const _thumbsFeitas = new Set();
export async function backfillThumbs(cfg) {
  if (!cfg.uploadThumb) return;
  const pendentes = (cfg.lista() || []).filter(a =>
    a.tipo === 'application/pdf' && !a.thumbUrl && a.url && a.path && !_thumbsFeitas.has(a.path));
  for (const a of pendentes) {
    _thumbsFeitas.add(a.path);
    try {
      const r = await fetch(a.url);
      if (!r.ok) continue;
      const blob = await thumbDePdf(await r.blob());
      if (!blob) continue;
      const t = await cfg.uploadThumb(blob, String(a.nome || 'anexo').replace(/\.pdf$/i, ''));
      const anexos = cfg.lista().map(x => x.path === a.path ? { ...x, thumbUrl: t.url, thumbPath: t.path } : x);
      await cfg.salvar(anexos, null);
    } catch (e) { console.warn('backfillThumbs', e); }
  }
}

export function renderAnexosCard(cfg) {
  const lista = cfg.lista() || [];
  let enviando = false;

  const adicionar = async (files, btn) => {
    if (enviando) { toast('Aguarde — já há um envio em andamento.'); return; }
    const validos = files.filter(f => {
      if ((f.size || 0) > 10 * 1048576) { toast(`${f.name}: acima de 10 MB.`, 'erro'); return false; }
      if (!tipoAnexoOk(f.type)) { toast(`${f.name}: use imagem (JPG/PNG/WebP) ou PDF.`, 'erro'); return false; }
      return true;
    });
    if (!validos.length) return;
    const metas = await pedirMetaAnexos(validos);
    if (!metas) return;
    enviando = true;
    const rotulo = btn ? btn.textContent : '';
    if (btn) btn.disabled = true;
    try {
      const novos = [];
      for (const m of metas) {
        const f = m.file;
        try {
          if (btn) btn.textContent = `Enviando ${f.name.slice(0, 24)}… 0%`;
          const anexo = await cfg.upload(f, (p) => {
            if (btn) btn.textContent = `Enviando ${f.name.slice(0, 24)}… ${Math.round(p * 100)}%`;
          });
          anexo.titulo = m.titulo; anexo.descricao = m.descricao;
          if (f.type === 'application/pdf' && cfg.uploadThumb) {
            if (btn) btn.textContent = `Gerando miniatura de ${f.name.slice(0, 20)}…`;
            const blob = await thumbDePdf(f);
            if (blob) {
              try {
                const t = await cfg.uploadThumb(blob, f.name.replace(/\.pdf$/i, ''));
                anexo.thumbUrl = t.url; anexo.thumbPath = t.path;
              } catch (e) { console.warn('thumb upload', e); }
            }
          }
          novos.push(anexo);
        } catch (e) { toast(e.message || `Falha ao enviar ${f.name}.`, 'erro'); }
      }
      if (!novos.length) return;
      const base = cfg.lista() || [];
      const anexos = [...base, ...novos.filter(n => !base.some(x => x.path === n.path))];
      await cfg.salvar(anexos, `Anexo(s): ${novos.map(x => x.titulo || x.nome).join(', ')}`.slice(0, 110));
      if (cfg.aoMudar) await cfg.aoMudar();
      toast('Anexo(s) adicionado(s).');
    } finally {
      enviando = false;
      if (btn) { btn.disabled = false; btn.textContent = rotulo; }
    }
  };

  const remover = async (a) => {
    const ok = await confirmar('Remover anexo', `Remover "${a.titulo || a.nome}"? Esta ação não pode ser desfeita.`, { ok: 'Remover', perigo: true });
    if (!ok) return;
    try {
      await cfg.removerStorage(a.path);
      if (a.thumbPath) await cfg.removerStorage(a.thumbPath);
      const anexos = (cfg.lista() || []).filter(x => x.path !== a.path);
      await cfg.salvar(anexos, `Anexo removido: ${a.titulo || a.nome}`.slice(0, 110));
      if (cfg.aoMudar) await cfg.aoMudar();
      toast('Anexo removido.');
    } catch (e) { toast(e.message || 'Falha ao remover.', 'erro'); }
  };

  const editarMeta = async (a) => {
    const meta = await pedirMetaAnexos([{ name: a.nome, _titulo: a.titulo, _descricao: a.descricao }], 'Editar dados do anexo');
    if (!meta) return;
    const { titulo, descricao } = meta[0];
    const anexos = (cfg.lista() || []).map(x => x.path === a.path ? { ...x, titulo, descricao } : x);
    await cfg.salvar(anexos, `Anexo atualizado: ${titulo}`.slice(0, 110));
    toast('Dados do anexo atualizados.');
  };

  const galeria = lista.length
    ? el('div', { class: 'anexos-grid' }, lista.map(a => el('div', { class: 'anexo' },
        el('button', { class: 'anexo-link', title: `${a.titulo || a.nome}${a.descricao ? ' — ' + a.descricao : ''}${a.tamanho ? ' · ' + fmtTam(a.tamanho) : ''}`, 'aria-label': `Pré-visualizar ${a.titulo || a.nome}`, onclick: () => previewAnexo(a) },
          ehImagem(a.tipo)
            ? el('img', { class: 'anexo-thumb', src: a.url, alt: a.titulo || a.nome, loading: 'lazy' })
            : (a.thumbUrl
              ? el('img', { class: 'anexo-thumb', src: a.thumbUrl, alt: a.titulo || a.nome, loading: 'lazy' })
              : el('span', { class: 'anexo-file' }, 'PDF')),
          el('span', { class: 'anexo-nome' }, a.titulo || a.nome)),
        cfg.podeAnexar ? el('button', { class: 'anexo-edit', title: 'Editar título/descrição', 'aria-label': 'Editar dados do anexo', onclick: () => editarMeta(a) }, '✎') : null,
        cfg.podeAnexar ? el('button', { class: 'anexo-rm', title: 'Remover', 'aria-label': 'Remover anexo', onclick: () => remover(a) }, '×') : null)))
    : el('p', { class: 'sub' }, 'Sem anexos.');

  if (cfg.podeAnexar) backfillThumbs(cfg);

  let entrada = null;
  if (cfg.podeAnexar) {
    const btnAdd = el('button', { class: 'btn' }, '+ Adicionar anexo');
    const input = el('input', { type: 'file', accept: 'image/*,application/pdf', multiple: true, style: 'display:none',
      onchange: (e) => { const fs = [...e.target.files]; e.target.value = ''; adicionar(fs, btnAdd); } });
    btnAdd.onclick = () => { if (!enviando) input.click(); };
    entrada = el('div', { class: 'anexo-add' }, input, btnAdd,
      el('span', { class: 'sub' }, 'Imagens ou PDF, até 10 MB.'));
  } else if (cfg.avisoSemPermissao) {
    entrada = el('p', { class: 'sub' }, cfg.avisoSemPermissao);
  }

  return el('section', { class: 'card' }, el('h2', {}, 'Anexos'), galeria, entrada);
}
