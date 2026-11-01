/* DespensAPP · Cuenta de Google (opcional).
   - La sesión anónima se CONVIERTE en cuenta de Google (linkWithPopup): mismo usuario interno, nada se pierde.
   - Los datos siguen en el teléfono; además se respaldan en usuarios/{uid}/respaldos/{gid} (solo el dueño puede leerlos).
   - En otro teléfono, al entrar con Google se recuperan los hogares (se combinan, nunca se borra nada). */
const Account = (() => {
  const FLAG = 'despensapp-google', LAST = 'despensapp-respaldo-at';
  const MAX = 900000;            // límite práctico de un documento de Firestore
  let timer = null, busy = false;

  const auth = () => firebase.auth();
  const user = () => (window.firebase && firebase.apps.length ? auth().currentUser : null);
  const enabled = () => window.DESPENSAPP_GOOGLE === true && typeof Sync !== 'undefined' && Sync.configured();
  const isGoogle = () => { const u = user(); return !!(u && !u.isAnonymous && u.providerData.some(p => p.providerId === 'google.com')); };
  const lastBackup = () => { try { return +localStorage.getItem(LAST) || 0; } catch { return 0; } };
  const flag = v => { try { v ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG); } catch {} };

  /* ---------- Nube (aislado para poder probarlo) ---------- */
  const cloud = {
    async put(uid, gid, doc) { await firebase.firestore().collection('usuarios').doc(uid).collection('respaldos').doc(gid).set(doc); },
    async list(uid) { const q = await firebase.firestore().collection('usuarios').doc(uid).collection('respaldos').get(); return q.docs.map(d => ({ gid: d.id, ...d.data() })); },
    async profile(uid, doc) { await firebase.firestore().collection('usuarios').doc(uid).set(doc, { merge: true }); },
  };

  /* ---------- Respaldo ---------- */
  async function backupHome(id) {
    const u = user(); if (!isGoogle()) return false;
    const h = Store.exportHome(id);
    if (!h || !h.data) return false;
    if (h.data.length > MAX) { console.warn('respaldo muy grande', h.name); return false; }
    await Account.cloud.put(u.uid, h.gid, { data: h.data, name: h.name, code: h.code, me: h.me, t: Date.now(), dev: Store.dev });
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
  // Respaldo automático del hogar activo unos segundos después de cada cambio
  function schedule() {
    if (!isGoogle()) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try { await backupHome(Store.activeHome().id); localStorage.setItem(LAST, String(Date.now())); } catch (e) { console.warn('respaldo', e); }
    }, 15000);
  }

  /* ---------- Restaurar ---------- */
  async function restore() {
    if (!isGoogle()) return { added: 0, merged: 0 };
    const list = await Account.cloud.list(user().uid);
    let res = { added: 0, merged: 0 };
    if (!list.length) return res;
    // Se desconecta la sincronización mientras se combinan los hogares y se reconecta al terminar
    await Sync.switchTo(() => { res = Store.restoreHomes(list); });
    return res;
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
    const res = await restore();
    await backupAll();
    const u = user();
    Store.log('hogar', 'conectó su cuenta de Google');
    Store.commit();
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
    if (isGoogle()) { App.render(); schedule(); }
  }
  async function signOut() {
    try { await backupAll(); } catch {}
    flag(false);
    await auth().signOut();
    await auth().signInAnonymously();      // la app sigue funcionando igual, con los datos del teléfono
  }

  // Cada cambio local programa un respaldo del hogar activo
  if (typeof Store !== 'undefined') Store.on(opts => { if (!opts || !opts.home) schedule(); });

  return { cloud, enabled, isGoogle, user, lastBackup, backupAll, backupHome, restore, signIn, signOut, handleRedirect, schedule };
})();
