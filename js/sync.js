/* despensAPP · Hogar compartido: motor local-first con merge por entidad + Firebase Firestore */

/* ---------- Merge determinista (last-writer-wins por entidad + lápidas) ---------- */
const Merge = {
  canon(o) {
    if (Array.isArray(o)) return '[' + o.map(Merge.canon).join(',') + ']';
    if (o && typeof o === 'object') return '{' + Object.keys(o).sort().filter(k => o[k] !== undefined).map(k => JSON.stringify(k) + ':' + Merge.canon(o[k])).join(',') + '}';
    return JSON.stringify(o);
  },
  newer(x, y) { // devuelve el más reciente; desempata por contenido para que sea determinista
    if (!x) return y; if (!y) return x;
    const tx = x.t || 0, ty = y.t || 0;
    if (tx !== ty) return ty > tx ? y : x;
    return Merge.canon(y) > Merge.canon(x) ? y : x;
  },
  map(a = {}, b = {}, ns, tomb) {
    const out = {};
    new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => {
      const p = Merge.newer(a[k], b[k]);
      if (!p) return;
      if (tomb[ns + k] && tomb[ns + k] >= (p.t || 0)) return;
      out[k] = p;
    });
    return out;
  },
  arr(a = [], b = [], ns, tomb) {
    const ma = Object.fromEntries(a.map(x => [x.id, x]));
    const mb = Object.fromEntries(b.map(x => [x.id, x]));
    return Object.values(Merge.map(ma, mb, ns, tomb));
  },
  state(a, b) {
    const tomb = { ...a.tomb };
    Object.entries(b.tomb || {}).forEach(([k, t]) => { if (!tomb[k] || t > tomb[k]) tomb[k] = t; });
    const cut = Date.now() - 60 * 86400000;
    Object.keys(tomb).forEach(k => { if (tomb[k] < cut) delete tomb[k]; });
    const ha = a.household || {}, hb = b.household || {};
    const household = (hb.t || 0) > (ha.t || 0) ? hb : (ha.t || 0) > (hb.t || 0) ? ha : (Merge.canon(hb) > Merge.canon(ha) ? hb : ha);
    const extraVar = {};
    new Set([...Object.keys(a.shop.extraVar || {}), ...Object.keys(b.shop.extraVar || {})]).forEach(k => {
      extraVar[k] = [...new Set([...(a.shop.extraVar[k] || []), ...((b.shop.extraVar || {})[k] || [])])].sort();
    });
    const logMap = {};
    [...(a.log || []), ...(b.log || [])].forEach(l => { logMap[l.id] = l; });
    return {
      v: 1,
      household,
      pantry: { items: Merge.map(a.pantry.items, b.pantry.items, 'p:', tomb) },
      shop: {
        sel: Merge.map(a.shop.sel, b.shop.sel, 's:', tomb),
        custom: Merge.map(a.shop.custom, b.shop.custom, 'c:', tomb),
        extraVar,
        mode: a.shop.mode, // preferencia local
      },
      expenses: Merge.arr(a.expenses, b.expenses, 'e:', tomb).sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.created || 0) - (x.created || 0)),
      menu: Merge.arr(a.menu, b.menu, 'm:', tomb).sort((x, y) => (x.date || '').localeCompare(y.date || '')),
      recipes: Merge.map(a.recipes, b.recipes, 'r:', tomb),
      log: Object.values(logMap).sort((x, y) => y.t - x.t).slice(0, 300),
      tomb,
    };
  },
  shared(s) { // parte del estado que se comparte (sin preferencias locales)
    const c = JSON.parse(JSON.stringify(s));
    delete c.shop.mode;
    return c;
  },
};

/* ---------- Motor de sincronización ---------- */
const Sync = (() => {
  let fb = null, db = null, ref = null, unsub = null, timer = null, lastRemote = '';
  let status = 'off';
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // El código de sincronización vive en el registro de hogares (uno por hogar)
  const code = () => (Store.activeHome() || {}).code || '';
  const setCode = c => Store.setHomeCode(c);

  function setStatus(s) {
    status = s;
    const el = $('#syncDot');
    if (el) { el.dataset.s = s; el.title = label(); }
    if (typeof App !== 'undefined' && App.ready && App.tab === 'hogar') App.render();
  }
  function label() {
    return { off: 'Sin hogar compartido', nocfg: 'Firebase sin configurar', connecting: 'Conectando…', online: 'Sincronizado', offline: 'Sin conexión (se sincroniza al volver)', error: 'Error de sincronización' }[status] || status;
  }

  function configured() { return !!(window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.firebase); }

  async function ensureFirebase() {
    if (!configured()) { setStatus('nocfg'); throw new Error('Firebase no está configurado (firebase-config.js)'); }
    if (!fb) {
      fb = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
      db = firebase.firestore();
      try { await db.enablePersistence({ synchronizeTabs: true }); } catch {}
    }
    if (!firebase.auth().currentUser) await firebase.auth().signInAnonymously();
    return db;
  }

  async function connect(c) {
    setStatus('connecting');
    await ensureFirebase();
    if (unsub) unsub();
    ref = db.collection('hogares').doc(c);
    setCode(c);
    unsub = ref.onSnapshot({ includeMetadataChanges: false }, snap => onSnap(snap), err => { console.warn(err); setStatus('error'); });
  }

  function onSnap(snap) {
    setStatus(navigator.onLine ? 'online' : 'offline');
    if (!snap.exists) { push(); return; }
    const d = snap.data();
    if (!d || !d.data) return;
    let remote;
    try { remote = JSON.parse(d.data); } catch { return; }
    remote = Object.assign(Store.defaults(), remote);
    remote.shop = Object.assign({ sel: {}, custom: {}, extraVar: {} }, remote.shop);
    remote.pantry = Object.assign({ items: {} }, remote.pantry);
    lastRemote = Merge.canon(Merge.shared(remote));
    const local = Store.state;
    const merged = Merge.state(local, remote);
    const mergedC = Merge.canon(Merge.shared(merged));
    if (mergedC !== Merge.canon(Merge.shared(local))) {
      const known = new Set(local.log.map(l => l.id));
      const fresh = merged.log.filter(l => !known.has(l.id) && l.dev !== Store.dev).slice(0, 3);
      Store.replace(merged, { remote: true });
      fresh.reverse().forEach(l => UI.toast(`<b>${esc(l.who)}</b> ${esc(l.text)}`, { type: 'live', ms: 4000 }));
    }
    if (mergedC !== lastRemote) schedule();
  }

  function schedule() {
    if (!ref) return;
    clearTimeout(timer);
    timer = setTimeout(push, 700);
  }

  async function push() {
    if (!ref) return;
    const data = Merge.shared(Store.state);
    const c = Merge.canon(data);
    if (c === lastRemote) return;
    try {
      await ref.set({ data: JSON.stringify(data), t: Date.now(), by: Store.dev, name: Store.state.household.name });
      lastRemote = c;
    } catch (e) { console.warn('push', e); setStatus(navigator.onLine ? 'error' : 'offline'); }
  }

  function newCode() {
    let s = '';
    const r = crypto.getRandomValues(new Uint8Array(6));
    r.forEach(x => { s += ALPHA[x % ALPHA.length]; });
    return s;
  }

  async function create() {
    const c = newCode();
    await connect(c);
    Store.log('hogar', `creó el hogar compartido ${c}`);
    Store.commit();
    await push();
    // subir fotos existentes
    Store.state.expenses.forEach(e => (e.photos || []).forEach(async id => { const b = await Photos.get(id); if (b) uploadPhoto(id, b); }));
    return c;
  }

  async function join(c) {
    c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) throw new Error('Código inválido');
    await ensureFirebase();
    const snap = await db.collection('hogares').doc(c).get();
    if (!snap.exists) throw new Error('No existe un hogar con ese código');
    await connect(c);
    Store.log('hogar', 'se unió al hogar');
    Store.commit();
    return c;
  }

  function disconnect() {
    clearTimeout(timer);
    if (unsub) unsub();
    unsub = null; ref = null; lastRemote = '';
    setStatus(configured() ? 'off' : 'nocfg');
  }
  function leave() { disconnect(); setCode(''); }
  // Cambio de hogar: sube lo pendiente, se desconecta y se reconecta al código del nuevo hogar
  async function switchTo(fn) {
    if (ref) { try { await push(); } catch {} }
    disconnect();
    fn();
    const c = code();
    if (c && configured()) { try { await connect(c); } catch (e) { console.warn(e); setStatus('error'); } }
  }

  async function uploadPhoto(id, blob) {
    if (!ref) return;
    try {
      const d = await Photos.toDataURL(blob);
      if (d.length > 950000) return; // límite de documento Firestore
      await ref.collection('fotos').doc(id).set({ d, t: Date.now() });
    } catch (e) { console.warn('foto', e); }
  }
  async function fetchPhoto(id) {
    if (!ref) return null;
    try {
      const s = await ref.collection('fotos').doc(id).get();
      if (!s.exists) return null;
      const b = await Photos.fromDataURL(s.data().d);
      await Photos.put(id, b);
      return b;
    } catch { return null; }
  }
  async function deletePhoto(id) { if (ref) try { await ref.collection('fotos').doc(id).delete(); } catch {} }

  function joinLink(c = code()) { return location.origin + location.pathname + '?hogar=' + c; }

  async function init() {
    window.addEventListener('online', () => { if (ref) { setStatus('online'); push(); } });
    window.addEventListener('offline', () => { if (ref) setStatus('offline'); });
    if (!configured()) { setStatus('nocfg'); return; }
    setStatus('off');
    const c = code();
    if (c) { try { await connect(c); } catch (e) { console.warn(e); setStatus('error'); } }
  }

  return {
    init, create, join, leave, disconnect, switchTo, schedule, push, uploadPhoto, fetchPhoto, deletePhoto, joinLink, configured,
    get code() { return code(); }, get status() { return status; }, label,
  };
})();
