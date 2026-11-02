/* DespensAPP · Cliente de IA. La IA vive en el intermediario (worker/): aquí solo se envía la foto o el texto,
   se recibe un JSON fijo y la app lo convierte en productos del catálogo con cálculo normal (sin IA). */
const AI = (() => {
  const PREF = 'despensapp-ai', LEFT = 'despensapp-ai-left';
  const url = () => (window.DESPENSAPP_AI_URL || '').replace(/\/+$/, '');
  const on = () => { try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; } };
  const setOn = v => { try { localStorage.setItem(PREF, v ? 'on' : 'off'); } catch {} };
  const configured = () => !!url() && Sync.configured();
  const ready = () => configured() && on();
  function why() {
    if (!url()) return 'La IA aún no está configurada en esta instalación';
    if (!Sync.configured()) return 'La IA necesita la configuración de Firebase';
    if (!on()) return 'Las funciones de IA están desactivadas (Hogar → Inteligencia artificial)';
    return '';
  }
  function left() {
    try { const x = JSON.parse(localStorage.getItem(LEFT) || 'null'); return x && x.day === Money.today() ? x.n : null; } catch { return null; }
  }

  async function call(task, body) {
    if (!ready()) throw new Error(why());
    if (!navigator.onLine) throw new Error('Necesitas internet para usar la IA');
    const token = await Sync.idToken();
    // Una boleta larga (100+ líneas) puede tomar más: la IA escribe cada producto
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), task === 'boleta' ? 180000 : 90000);
    try {
      const r = await fetch(`${url()}/${task}`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j.error || 'No se pudo completar con IA');
      if (j.restantes != null) { try { localStorage.setItem(LEFT, JSON.stringify({ day: Money.today(), n: j.restantes })); } catch {} }
      return j;
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('La IA tardó demasiado. Intenta de nuevo.');
      throw e;
    } finally { clearTimeout(timer); }
  }

  async function b64Of(blob) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(await Photos.toDataURL(blob));
    return { image: m[2], mime: /^image\/(jpeg|png|webp)$/.test(m[1]) ? m[1] : 'image/jpeg' };
  }
  // Varias partes de una misma boleta larga, en orden de arriba hacia abajo
  async function partsBody(blobs) {
    if (blobs.length === 1) return b64Of(blobs[0]);
    return { images: await Promise.all(blobs.map(b64Of)) };
  }

  // Foto → JPEG comprimido en base64 (máx. 1600 px, como las boletas guardadas).
  // Si es muy larga (pantallazo de boleta) se envía en partes para que no se achique hasta ser ilegible.
  async function photoBody(blobOrId) {
    let blob = blobOrId;
    if (typeof blobOrId === 'string') blob = await Photos.get(blobOrId) || await Sync.fetchPhoto(blobOrId);
    if (!blob) throw new Error('No se encontró la foto');
    const parts = await Docs.imageSlices(blob).catch(() => null);
    if (parts && parts.length > 1) return partsBody(parts);
    if (blob.size > 1.5e6 || !/jpeg/.test(blob.type)) blob = await Photos.compress(blob, 1600, 0.8);
    return b64Of(blob);
  }

  // Cuerpo para leer una boleta: foto (id o Blob), PDF o Word.
  // PDF digital → su texto exacto (no se pierde nada por largo que sea); PDF escaneado → imágenes en partes legibles.
  async function attachBody(src) {
    if (src && typeof src === 'object' && src.kind) {
      const blob = await Docs.blobOf(src);
      if (!blob) throw new Error('No se encontró el archivo');
      if (src.kind === 'pdf') {
        const text = await Docs.pdfText(blob).catch(() => '');
        if (Docs.usableText(text)) return { text };
        return partsBody(await Docs.pdfSlices(blob));
      }
      const text = await Docs.docxText(blob);
      if (!text.trim()) throw new Error('El documento Word no tiene texto para leer');
      return { text };
    }
    return photoBody(src);
  }

  /* ---------- De lo leído al catálogo (cálculo normal) ---------- */
  const norm = s => Catalog.slug(s || '').replace(/-/g, ' ').trim();
  const sing = s => s.replace(/(es|s)$/, '');
  function match(it) {
    const tries = [it.generico, it.nombre, (it.generico || '').split(' ')[0]].filter(Boolean);
    for (const q of tries) {
      const res = Catalog.search(q);
      if (!res.length) continue;
      const nq = norm(q);
      const best = res.find(r => norm(r.item.name) === nq || sing(norm(r.item.name)) === sing(nq))
        || res.find(r => norm(r.item.name).startsWith(nq) || nq.startsWith(sing(norm(r.item.name))))
        || (q === it.nombre ? null : res[0]);
      if (!best) continue;
      const vars = Catalog.variants(best.c, best.item.id);
      const hay = norm(`${it.variante || ''} ${it.nombre || ''}`);
      const v = vars.find(x => it.variante && norm(x.name) === norm(it.variante))
        || vars.slice().sort((a, b) => b.name.length - a.name.length).find(x => hay.includes(norm(x.name)))
        || vars[0];
      return { c: best.c, i: best.item.id, v: v ? v.id : '' };
    }
    return null;
  }
  const unit = u => (u === 'l' ? 'L' : ['un', 'g', 'kg', 'ml', 'L'].includes(u) ? u : 'un');
  const mLabel = m => (m ? `${Catalog.item(m.c, m.i).emoji} ${Catalog.label(m.c, m.i, m.v)}` : '');

  // Producto no reconocido → producto personalizado (queda disponible en el catálogo del hogar)
  function ensureCustom(name, u) {
    const id = 'x-' + Catalog.slug(name).slice(0, 40);
    const key = 'otros|' + id;
    if (!Store.state.shop.custom[key]) Store.state.shop.custom[key] = { name, emoji: '📦', u: u || 'un', tags: [], t: Store.now() };
    return { c: 'otros', i: id, v: '' };
  }

  // Texto de restricciones del hogar para el Chef IA
  function restrictions() {
    const out = [];
    Store.state.household.members.forEach(m => {
      const d = Diet.info(m), parts = [];
      (d.tags || []).forEach(t => { if (DIETS[t]) parts.push(DIETS[t].name); });
      (d.items || []).forEach(i => { const f = Catalog.find(i); parts.push('no come ' + (f ? f.item.name : i)); });
      if (d.note) parts.push(d.note);
      if (parts.length) out.push(`${m}: ${parts.join(', ')}`);
    });
    return out;
  }

  return { ready, configured, on, setOn, why, left, call, photoBody, attachBody, match, unit, mLabel, ensureCustom, restrictions };
})();
