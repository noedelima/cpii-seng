// =============================================================================
// Miniatura da 1ª página de um PDF (client-side, no momento do upload).
// pdf.js (pdfjs-dist 4.10.38) carregado sob demanda de uma cópia LOCAL
// verificada (vendor/pdfjs — auditoria #14). Best-effort: qualquer falha
// (PDF protegido, worker bloqueado) retorna null e o anexo segue sem miniatura.
// =============================================================================
const PDFJS = '/vendor/pdfjs/pdf.min.mjs';
const WORKER = '/vendor/pdfjs/pdf.worker.min.mjs';

let _lib = null;
async function lib() {
  if (_lib) return _lib;
  const pdfjs = await import(PDFJS);
  // Worker de mesma origem (worker-src 'self' no CSP).
  pdfjs.GlobalWorkerOptions.workerSrc = WORKER;
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
