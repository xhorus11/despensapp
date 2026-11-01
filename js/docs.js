/* DespensAPP · Boletas digitales (PDF y Word) adjuntas a los gastos.
   Se guardan tal cual en IndexedDB (mismo almacén que las fotos) y, si el hogar es compartido, se suben a Firestore.
   pdf.js (vendor/) se carga solo al abrir o leer un PDF. Los .docx se leen descomprimiendo el ZIP en el teléfono. */
const Docs = (() => {
  const MAX = 10 * 1024 * 1024;   // 10 MB por archivo
  const SYNC_MAX = 700 * 1024;    // ~ límite de un documento de Firestore en base64
  const PDF = 'application/pdf';
  const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const ACCEPT = '.pdf,.docx,application/pdf,' + DOCX;

  function kind(f) {
    const n = (f.name || '').toLowerCase(), t = f.type || '';
    if (t === PDF || n.endsWith('.pdf')) return 'pdf';
    if (t === DOCX || n.endsWith('.docx')) return 'docx';
    if (n.endsWith('.doc')) return 'doc';
    return '';
  }
  const isDoc = f => !!kind(f);
  const sizeTxt = b => (b > 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  // Guarda el archivo y devuelve sus datos para el gasto: { id, name, kind, type, size, local }
  async function add(file) {
    const k = kind(file);
    if (k === 'doc') throw new Error('Los .doc antiguos no se pueden leer: guárdalo como .docx o PDF');
    if (!k) throw new Error('Formato no admitido (usa PDF o Word .docx)');
    if (file.size > MAX) throw new Error('El archivo pesa más de 10 MB');
    const id = Store.uid('doc');
    const blob = new Blob([await file.arrayBuffer()], { type: k === 'pdf' ? PDF : DOCX });
    await Photos.put(id, blob);
    const local = blob.size > SYNC_MAX;
    if (!local && typeof Sync !== 'undefined') Sync.uploadPhoto(id, blob);
    return { id, name: (file.name || `boleta.${k}`).slice(0, 120), kind: k, type: blob.type, size: blob.size, local };
  }
  async function blobOf(meta) {
    let b = await Photos.get(meta.id);
    if (!b && typeof Sync !== 'undefined') b = await Sync.fetchPhoto(meta.id);
    return b;
  }

  /* ---------- PDF ---------- */
  let pdfP = null;
  function loadPdf() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfP) pdfP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = () => { pdfP = null; rej(new Error('No se pudo cargar el lector de PDF')); };
      document.head.appendChild(s);
    });
    return pdfP;
  }
  async function pdfDoc(blob) {
    const lib = await loadPdf();
    return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
  }
  async function renderPage(pdf, n, width) {
    const page = await pdf.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: width / v1.width });
    const cv = document.createElement('canvas');
    cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    return cv;
  }
  // Primeras páginas del PDF como una sola imagen JPEG (para la IA y el informe)
  async function pdfToImage(blob, maxPages = 2, width = 1400) {
    const pdf = await pdfDoc(blob);
    const pages = [];
    for (let n = 1; n <= Math.min(maxPages, pdf.numPages); n++) pages.push(await renderPage(pdf, n, width));
    const cv = document.createElement('canvas');
    cv.width = width; cv.height = pages.reduce((s, p) => s + p.height, 0);
    const ctx = cv.getContext('2d');
    let y = 0; pages.forEach(p => { ctx.drawImage(p, 0, y); y += p.height; });
    return new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.85));
  }

  /* ---------- Word (.docx): texto desde word/document.xml ---------- */
  async function docxText(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('El archivo Word está dañado');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let k = 0; k < count; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
      if (name === 'word/document.xml') {
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        let data = buf.subarray(start, start + csize);
        if (method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        const xml = new TextDecoder().decode(data);
        const txt = xml.replace(/<w:tab\/>/g, '\t').replace(/<w:br\/>/g, '\n').replace(/<\/w:p>/g, '\n').replace(/<\/w:tc>/g, '\t').replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
        return txt.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      }
      p += 46 + nlen + elen + clen;
    }
    throw new Error('No se encontró el texto del documento Word');
  }

  /* ---------- Vista ---------- */
  const icon = m => (m.kind === 'pdf' ? 'file' : 'receipt');
  function cardHtml(m, delAct, k) {
    return `<div class="doc-card" data-act="docView" data-id="${esc(m.id)}">
      <span class="doc-ico ${m.kind}">${ico(icon(m))}<b>${m.kind === 'pdf' ? 'PDF' : 'DOCX'}</b></span>
      <span class="grow"><b>${esc(m.name)}</b><small>${sizeTxt(m.size || 0)}${m.local ? ' · solo en este teléfono' : ''}</small></span>
      ${delAct ? `<button class="icon-btn sm" data-act="${delAct}" data-k="${k}" aria-label="Quitar">${ico('x')}</button>` : ''}
    </div>`;
  }
  const metaById = id => {
    for (const e of Store.state.expenses) { const m = (e.files || []).find(f => f.id === id); if (m) return m; }
    return (Docs._pending || []).find(f => f.id === id) || null;
  };
  async function view(meta) {
    const blob = await blobOf(meta);
    if (!blob) { UI.toast('El archivo está en otro teléfono del hogar y aún no se descarga', { type: 'err' }); return; }
    const url = URL.createObjectURL(blob);
    UI.open(esc(meta.name), () => `
      <div class="doc-view" id="docView">${meta.kind === 'pdf' ? `<div class="ai-loading"><div class="ai-orb">${ico('file')}</div><p>Abriendo PDF…</p></div>` : '<p class="hint">Leyendo documento…</p>'}</div>
      <div class="grid2">
        ${meta.kind === 'pdf' ? `<a class="btn ghost" href="${url}" target="_blank" rel="noopener">${ico('eye')} Abrir aparte</a>` : '<span></span>'}
        <a class="btn ghost" href="${url}" download="${esc(meta.name)}">${ico('download')} Descargar</a>
      </div>`, async body => {
      const box = body.querySelector('#docView');
      try {
        if (meta.kind === 'pdf') {
          const pdf = await pdfDoc(blob);
          box.innerHTML = '';
          const w = Math.min(1200, (box.clientWidth || 360) * (window.devicePixelRatio || 1));
          for (let n = 1; n <= Math.min(pdf.numPages, 8); n++) { const cv = await renderPage(pdf, n, w); cv.className = 'doc-page'; box.appendChild(cv); }
          if (pdf.numPages > 8) box.insertAdjacentHTML('beforeend', `<p class="hint center">Se muestran 8 de ${pdf.numPages} páginas. Usa “Abrir aparte” para verlo completo.</p>`);
        } else {
          box.innerHTML = `<pre class="doc-text">${esc(await docxText(blob))}</pre>`;
        }
      } catch (e) { box.innerHTML = `<div class="warn">${ico('alert')} ${esc(e.message)}</div>`; }
    }, { tall: true, onClose: () => setTimeout(() => URL.revokeObjectURL(url), 1000) });
  }
  Actions.docView = (el, ev) => { if (ev && ev.target.closest('[data-act]') !== el) return; const m = metaById(el.dataset.id); if (m) view(m); };

  return { ACCEPT, kind, isDoc, add, blobOf, pdfToImage, docxText, cardHtml, view, sizeTxt, _pending: [] };
})();
