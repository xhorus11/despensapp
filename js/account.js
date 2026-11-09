/* DespensAPP · Cuenta de Google (opcional).
   - La sesión anónima se CONVIERTE en cuenta de Google (linkWithPopup): mismo usuario interno, nada se pierde.
   - Los datos siguen en el teléfono; además se respaldan en usuarios/{uid}/respaldos/{gid} (solo el dueño puede leerlos).
   - En otro teléfono, al entrar con Google se recuperan los hogares (se combinan, nunca se borra nada).
   - Sincronizar: trae lo de la cuenta y sube lo de este teléfono; así varios dispositivos quedan iguales.
   - En vivo: mientras la app está abierta escucha la cuenta (usuarios/{uid}/respaldos) y sube cada cambio en segundos.
     Al abrirse y al volver a primer plano se pone al día. */
const Account = (() => {
  const FLAG = 'despensapp-google', LAST = 'despensapp-respaldo-at';
  const MAX = 900000;            // límite práctico de un documento de Firestore
  const DELAY = 1200;            // espera tras un cambio, para juntar los que vienen seguidos
  let timer = null, busy = false, flushing = false, stopLive = null, caughtUp = false, lastPull = 0;
  const pending = new Set();

  const auth = () => firebase.auth();
  const user = () => (window.firebase && firebase.apps.length ? auth().currentUser : null);
  const enabled = () => window.DESPENSAPP_GOOGLE === true && typeof Sync !== 'undefined' && Sync.configured();
  const isGoogle = () => { const u = user(); return !!(u && !u.isAnonymous && u.providerData.some(p => p.providerId === 'google.com')); };
  const lastBackup = () => { try { return +localStorage.getItem(LAST) || 0; } catch { return 0; } };
  const flag = v => { try { v ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch {} };

  /* ---------- Nube (aislado para poder probarlo) ---------- */
  const cloud = {
    async get(uid, gid) { const d = await firebase.firestore().collection('usuarios').doc(uid).collection('respaldos').doc(gid).get(); return d.exists ? d.data() : null; },
    async put(uid, gid, doc) { await firebase.firestore().collection('usuarios').doc(uid).collection('respaldos').doc(gid).set(doc); },
    async list(uid) { const q = await firebase.firestore().collection('usuarios').doc(uid).collection('respaldos').get(); return q.docs.map(d => ({ gid: d.id, ...d.data() })); },
    // Avisa cada cambio de la cuenta; lo que este mismo dispositivo aún está subiendo no se repite
    watch(uid, onDocs, onError) {
      return firebase.firestore().collection('usuarios').doc(uid).collection('respaldos').onSnapshot(q => {
        onDocs(q.docChanges().filter(c => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites).map(c => ({ gid: c.doc.id, ...c.doc.data() })), q.metadata.fromCache);
      }, onError);
    },
    async profile(uid, doc) { await firebase.firestore().collection('usuarios').doc(uid).set(doc, { merge: true }); },
  };

  /* ---------- Respaldo ---------- */
  async function backupHome(id) {
    const u = user(); if (!isGoogle()) return false;
    const h = Store.exportHome(id);
    if (!h || !h.data) return false;
    // Nunca se pisa lo respaldado: otro dispositivo pudo subir cambios que este aún no tiene
    const prev = await Account.cloud.get(u.uid, h.gid);
    const data = Store.mergeBackup(h.data, prev && prev.data);
    if (data.length > MAX) { console.warn('respaldo muy grande', h.name); return false; }
    if (prev && (prev.code || '') === (h.code || '') && Store.sameBackup(data, prev.data)) return true;   // ya está igual: no se escribe
    await Account.cloud.put(u.uid, h.gid, { data, name: h.name, code: h.code, me: h.me, t: Date.now(), dev: Store.dev });
    return true;
  }
  async function backupAll() {
    if (!isGoogle() || busy) return 0;
    busy = true;
    try {
      const u = user();
      let n = 0;
      for (const h of Store.homes()) { if (await backupHome(h.id)) n++; }
      await Account.cloud.profile(u.uid, { nombre: u.displayName || '', email: u.email || '', hogares: n, t: Date.now() });
      try { localStorage.setItem(LAST, String(Date.now())); } catch {}
      return n;
    } finally { busy = false; }
  }
  // Respaldo automático: cada hogar con cambios se sube un momento después
  function queue(id) {
    if (!isGoogle() || !id) return;
    pending.add(id);
    clearTimeout(timer);
    timer = setTimeout(flush, DELAY);
  }
  function schedule() { const h = Store.activeHome(); if (h) queue(h.id); }
  async function flush() {
    clearTimeout(timer);
    if (flushing || !pending.size || !isGoogle()) return;
    flushing = true;
    try {
      while (pending.size) {
        const id = pending.values().next().value;
        pending.delete(id);
        if (!Store.homes().some(h => h.id === id)) continue;
        await backupHome(id);
        try { localStorage.setItem(LAST, String(Date.now())); } catch {}
      }
    } catch (e) { console.warn('respaldo', e); }
    finally { flushing = false; }
  }

  /* ---------- Restaurar ---------- */
  async function restore(opts = {}) {
    if (!isGoogle()) return { added: 0, merged: 0 };
    let list = await Account.cloud.list(user().uid);
    if (opts.skipDropped) { const out = Store.droppedGids(); list = list.filter(b => !out.includes(b.gid)); }
    let res = { added: 0, merged: 0 };
    if (!list.length) return res;
    // Se desconecta la sincronización mientras se combinan los hogares y se reconecta al terminar
    await Sync.switchTo(() => { res = Store.restoreHomes(list); });
    return res;
  }

  /* ---------- Sincronizar: primero se trae lo de la cuenta, después se sube el resultado ---------- */
  async function syncNow() {
    if (!navigator.onLine) throw Object.assign(new Error('offline'), { code: 'offline' });
    const res = await restore({ skipDropped: true });
    const n = await backupAll();
    return { ...res, homes: n };
  }

  /* ---------- En vivo ---------- */
  async function onRemote(list, fromCache) {
    const out = Store.droppedGids(), nuevos = [];
    let reconnect = false;
    for (const b of list) {
      if (!b.gid || !b.data || out.includes(b.gid)) continue;
      const r = Store.absorbBackup(b);
      if (!r) continue;
      if (r.isNew) { nuevos.push(b); continue; }
      if (r.upload) queue(r.id);
      if (r.reconnect) reconnect = true;
      if (r.active && r.changed) Sync.schedule();
      if (caughtUp) r.fresh.slice().reverse().forEach(l => UI.toast(`<b>${esc(l.who)}</b> ${esc(l.text)}`, { type: 'live', ms: 4000 }));
    }
    if (nuevos.length) {
      await Sync.switchTo(() => { Store.restoreHomes(nuevos); });
      Store.emit({ home: true });
      if (caughtUp) UI.toast(`Llegó ${nuevos.length === 1 ? 'un hogar' : nuevos.length + ' hogares'} desde tu otro dispositivo`, { icon: 'cloud' });
    } else if (reconnect) await Sync.switchTo(() => {});
    // Primera lectura de la cuenta: se sube también lo que este dispositivo hizo sin conexión
    if (!caughtUp && !fromCache) { caughtUp = true; Store.homes().forEach(h => queue(h.id)); }
  }
  function goLive() {
    if (stopLive || !isGoogle()) return;
    caughtUp = false;
    stopLive = Account.cloud.watch(user().uid,
      (list, fromCache) => onRemote(list, fromCache).catch(e => console.warn('en vivo', e)),
      e => { console.warn('en vivo', e); stopLive = null; });
  }
  function endLive() { if (stopLive) stopLive(); stopLive = null; clearTimeout(timer); pending.clear(); }
  const isLive = () => !!stopLive;
  // Al volver a la app o recuperar internet: los móviles pausan la conexión en segundo plano
  async function resume(force) {
    if (!isGoogle() || !navigator.onLine) return;
    goLive();
    if (!force && Date.now() - lastPull < 20000) return;
    lastPull = Date.now();
    try { await onRemote(await Account.cloud.list(user().uid), false); Store.homes().forEach(h => queue(h.id)); }
    catch (e) { console.warn('en vivo', e); }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') resume(); else flush(); });
    window.addEventListener('online', () => resume(true));
  }

  /* ---------- Entrar / salir ---------- */
  async function signIn() {
    await Sync.ensureAuth();
    const prov = new firebase.auth.GoogleAuthProvider();
    prov.setCustomParameters({ prompt: 'select_account' });
    const cur = auth().currentUser;
    try {
      if (cur && cur.isAnonymous) await cur.linkWithPopup(prov);      // convierte la sesión: mismo usuario
      else await auth().signInWithPopup(prov);
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use' || e.code === 'auth/email-already-in-use') {
        // Esa cuenta de Google ya se usó en otro teléfono: entramos con ella (los datos de este teléfono se mantienen)
        const cred = e.credential || (firebase.auth.GoogleAuthProvider.credentialFromError && firebase.auth.GoogleAuthProvider.credentialFromError(e));
        if (!cred) throw e;
        await auth().signInWithCredential(cred);
      } else if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e.code)) {
        flag(true);
        if (cur && cur.isAnonymous) await cur.linkWithRedirect(prov); else await auth().signInWithRedirect(prov);
        return null;   // la página se recarga y continúa en handleRedirect()
      } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        return null;
      } else throw e;
    }
    return afterSignIn();
  }
  async function afterSignIn() {
    flag(true);
    Store.setDroppedGids([]);      // entrar con la cuenta recupera todos sus hogares
    const res = await restore();
    await backupAll();
    const u = user();
    Store.log('hogar', 'conectó su cuenta de Google');
    Store.commit();
    goLive();
    return { name: u.displayName || u.email || 'tu cuenta', ...res };
  }
  async function handleRedirect() {
    let flagged = false;
    try { flagged = localStorage.getItem(FLAG) === '1'; } catch {}
    if (!flagged || !enabled()) return;
    await Sync.ensureAuth();
    try {
      const r = await auth().getRedirectResult();
      if (r && r.user) { const out = await afterSignIn(); App.render(); UI.toast(`Conectado como ${esc(out.name)}`, { icon: 'user' }); return; }
    } catch (e) {
      if (e.code === 'auth/credential-already-in-use' && e.credential) { await auth().signInWithCredential(e.credential); await afterSignIn(); App.render(); return; }
      console.warn('google', e);
    }
    if (isGoogle()) { App.render(); goLive(); }
  }
  async function signOut() {
    try { await backupAll(); } catch {}
    endLive();
    flag(false);
    await auth().signOut();
    await auth().signInAnonymously();      // la app sigue funcionando igual, con los datos del teléfono
  }

  // Cada cambio local programa un respaldo del hogar activo
  if (typeof Store !== 'undefined') Store.on(opts => { if (!opts || (!opts.home && !opts.account)) schedule(); });

  return { cloud, enabled, isGoogle, user, lastBackup, backupAll, backupHome, restore, syncNow, signIn, signOut, handleRedirect, schedule, goLive, isLive, resume };
})();
