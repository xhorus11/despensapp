/* despensAPP · Fotos de boletas en IndexedDB (comprimidas a 1600 px) */
const Photos = (() => {
  const DB = 'despensapp-fotos', STORE = 'fotos';
  let dbp = null;
  const urls = {};

  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(STORE, mode);
      const out = fn(t.objectStore(STORE));
      t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
      t.onerror = () => rej(t.error);
    });
  }
  const put = (id, blob) => tx('readwrite', s => s.put(blob, id));
  const del = id => { if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; } return tx('readwrite', s => s.delete(id)); };
  async function get(id) {
    const d = await db();
    return new Promise(res => {
      const r = d.transaction(STORE).objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  }
  async function url(id) {
    if (urls[id]) return urls[id];
    let b = await get(id);
    if (!b && typeof Sync !== 'undefined') b = await Sync.fetchPhoto(id);
    if (!b) return null;
    urls[id] = URL.createObjectURL(b);
    return urls[id];
  }

  function loadImg(file) {
    return new Promise((res, rej) => {
      const u = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(u), 1000); };
      img.onerror = rej;
      img.src = u;
    });
  }
  async function compress(file, max = 1600, q = 0.72) {
    const img = await loadImg(file);
    const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * sc), h = Math.round(img.naturalHeight * sc);
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    return new Promise(res => cv.toBlob(b => res(b || file), 'image/jpeg', q));
  }
  async function add(file) {
    const blob = await compress(file);
    const id = Store.uid('ph');
    await put(id, blob);
    if (typeof Sync !== 'undefined') Sync.uploadPhoto(id, blob);
    return id;
  }
  function toDataURL(blob) {
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  }
  async function fromDataURL(d) { const r = await fetch(d); return r.blob(); }

  // Rellena <img data-photo="id"> de forma diferida
  function hydrate(root = document) {
    $$('img[data-photo]', root).forEach(async img => {
      if (img.src) return;
      const u = await url(img.dataset.photo);
      if (u) img.src = u; else img.closest('.thumb') && img.closest('.thumb').classList.add('missing');
    });
  }

  return { put, get, del, url, add, compress, toDataURL, fromDataURL, hydrate };
})();
