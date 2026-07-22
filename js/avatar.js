// =============================================================================
// Avatar — foto de perfil (interna) com fallback de iniciais em cor derivada
// do nome. Uso: avatar(nome, fotoUrl, tamanho).
// =============================================================================
import { el } from './ui.js';

const CORES = ['#55633C', '#A6925A', '#8E2A2F', '#4A5834', '#7A6832', '#3E4A2E'];

export function avatar(nome, fotoUrl, tam = 40) {
  if (fotoUrl) {
    return el('img', { class: 'avatar', src: fotoUrl, alt: '', loading: 'lazy',
      style: `width:${tam}px;height:${tam}px` });
  }
  const partes = String(nome || '?').trim().split(/\s+/).filter(Boolean);
  const ini = ((partes[0]?.[0] || '?') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
  let h = 0; for (const c of String(nome || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return el('span', { class: 'avatar avatar-ini', 'aria-hidden': 'true',
    style: `width:${tam}px;height:${tam}px;background:${CORES[h % CORES.length]};font-size:${Math.round(tam * 0.38)}px` }, ini);
}

// Reduz e recorta (quadrado central) a imagem escolhida para foto de perfil.
export async function reduzirFoto(file, tam = 256) {
  const img = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = c.height = tam;
  const m = Math.min(img.width, img.height);
  c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, tam, tam);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
}
