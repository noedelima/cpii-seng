// =============================================================================
// Miniatura da 1ª página de um PDF (client-side, no momento do upload).
// pdf.js (pdfjs-dist) carregado sob demanda de arquivos locais versionados. Best-effort: qualquer falha (offline, PDF protegido,
// worker bloqueado) retorna null e o anexo segue sem miniatura.
// =============================================================================
const PDFJS = '/vendor/pdfjs-dist/pdf.min.mjs';
const WORKER = '/vendor/pdfjs-dist/pdf.worker.min.mjs';

let _lib = null;
async function lib() {
  if (_lib) return _lib;
  const pdfjs = await import(PDFJS);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(WORKER,location.origin).href;
  _lib = pdfjs;
  return pdfjs;
}

// Retorna um Blob JPEG (miniatura ~larguraMax px) ou null.
export async function thumbDePdf(file, larguraMax = 480) {
  try {
    const pdfjs = await lib();
    const data = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2, larguraMax / base.width) });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
    doc.destroy();
    return blob;
  } catch (e) { console.warn('thumbDePdf', e); return null; }
}
