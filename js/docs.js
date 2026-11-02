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

  /* ---------- Para la IA: boletas largas sin perder líneas ---------- */
  // Texto real del PDF (boletas digitales): se arma línea por línea según la posición de cada palabra.
  // Es exacto y no depende de la resolución, así una boleta de 3 metros llega completa.
  async function pdfText(blob, maxPages = 12) {
    const pdf = await pdfDoc(blob);
    const out = [];
    for (let n = 1; n <= Math.min(maxPages, pdf.numPages); n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const rows = [];
      tc.items.forEach(it => {
        if (!it.str || !it.str.trim()) return;
        const x = it.transform[4], y = it.transform[5], h = Math.abs(it.transform[3]) || it.height || 8;
        let r = rows.find(r => Math.abs(r.y - y) < h * 0.45);
        if (!r) rows.push(r = { y, h, parts: [] });
        r.parts.push({ x, w: it.width || 0, s: it.str });
      });
      rows.sort((a, b) => b.y - a.y).forEach(r => {
        r.parts.sort((a, b) => a.x - b.x);
        let line = '', end = null;
        r.parts.forEach(p => {
          if (end != null && p.x - end > r.h * 0.25 && !/\s$/.test(line) && !/^\s/.test(p.s)) line += ' ';
          line += p.s; end = p.x + p.w;
        });
        out.push(line.replace(/\s+$/, ''));
      });
      if (pdf.numPages > 1) out.push('');
    }
    return out.join('\n').trim();
  }
  // ¿El texto sirve como boleta? (un PDF escaneado no trae texto, o trae basura)
  const usableText = t => t.replace(/\s/g, '').length >= 40 && (t.match(/\d[\d.,]{2,}/g) || []).length >= 3;

  // Corta una imagen muy alta en partes legibles (máx. ~1.9 veces más altas que anchas), por renglones en blanco
  function slices(cv, maxParts = 8) {
    const W = cv.width, maxH = Math.round(W * 1.9);
    if (cv.height <= maxH * 1.15) return [cv];
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const blank = y => {
      const d = ctx.getImageData(0, y, W, 1).data;
      for (let i = 0; i < d.length; i += 16) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) return false;
      return true;
    };
    const parts = [];
    let y0 = 0;
    while (y0 < cv.height) {
      let y1 = Math.min(cv.height, y0 + maxH);
      if (y1 < cv.height) {           // busca hacia arriba un renglón en blanco para no cortar una línea de texto
        for (let y = y1; y > y0 + maxH * 0.6; y--) if (blank(y)) { y1 = y; break; }
      }
      const c = document.createElement('canvas');
      c.width = W; c.height = y1 - y0;
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, c.height);
      x.drawImage(cv, 0, y0, W, c.height, 0, 0, W, c.height);
      parts.push(c);
      y0 = y1;
    }
    if (parts.length <= maxParts) return parts;
    // Demasiado larga: se reduce un poco y se vuelve a cortar (sigue legible)
    const k = Math.sqrt(maxParts / parts.length) * 0.97, s = document.createElement('canvas');
    s.width = Math.round(W * k); s.height = Math.round(cv.height * k);
    s.getContext('2d').drawImage(cv, 0, 0, s.width, s.height);
    return slices(s, maxParts);
  }
  const jpeg = cv => new Promise(res => cv.toBlob(b => res(b), 'image/jpeg', 0.85));

  // PDF escaneado → partes JPEG legibles (sin superar el límite de tamaño de lienzo de los teléfonos)
  async function pdfSlices(blob, maxPages = 6) {
    const pdf = await pdfDoc(blob);
    const out = [];
    for (let n = 1; n <= Math.min(maxPages, pdf.numPages); n++) {
      const v1 = (await pdf.getPage(n)).getViewport({ scale: 1 });
      const width = Math.round(Math.min(1100, Math.sqrt(14e6 * v1.width / v1.height)));   // ≤ 14 MP por página
      for (const c of slices(await renderPage(pdf, n, width))) out.push(c);
    }
    return Promise.all(out.slice(0, 8).map(jpeg));
  }
  // Foto o captura muy larga (ej. pantallazo de boleta) → partes legibles; null si no hace falta cortar
  async function imageSlices(blob) {
    const img = await createImageBitmap(blob);
    if (img.height <= img.width * 2.2) { img.close && img.close(); return null; }
    const width = Math.round(Math.min(img.width, 1100, Math.sqrt(14e6 * img.width / img.height)));
    const cv = document.createElement('canvas');
    cv.width = width; cv.height = Math.round(img.height * width / img.width);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    img.close && img.close();
    return Promise.all(slices(cv).map(jpeg));
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

  return { ACCEPT, kind, isDoc, add, blobOf, pdfToImage, pdfText, usableText, pdfSlices, imageSlices, docxText, cardHtml, view, sizeTxt, _pending: [] };
})();
