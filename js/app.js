/* despensAPP · Arranque, navegación y onboarding */
const App = (() => {
  const VERSION = '1.2.0';
  const TABS = {
    home:   { title: 'Inicio',    icon: 'home',   view: () => HomeView },
    pantry: { title: 'Despensa',  icon: 'pantry', view: () => PantryView },
    shop:   { title: 'Mi Lista',  icon: 'cart',   view: () => ShopView },
    menu:   { title: 'Menú',      icon: 'menu',   view: () => MenuView },
    money:  { title: 'Plata',     icon: 'wallet', view: () => MoneyView },
    hogar:  { title: 'Hogar',     icon: 'users',  view: () => HogarView, hidden: true },
  };
  const A = { VERSION, tab: 'home', ready: false };

  function tabbar() {
    const pend = Shop.pending().length;
    const alerts = Pantry.expiring().length + Pantry.lowList().length;
    return Object.entries(TABS).filter(([, t]) => !t.hidden).map(([k, t]) => {
      const badge = k === 'shop' && pend ? pend : k === 'pantry' && alerts ? alerts : 0;
      return `<button class="tab ${A.tab === k ? 'on' : ''}" data-act="goTab" data-val="${k}" aria-label="${t.title}">
        ${ico(t.icon)}<span>${t.title}</span>${badge ? `<i class="tab-badge">${badge > 99 ? '99+' : badge}</i>` : ''}</button>`;
    }).join('');
  }

  A.render = (opts = {}) => {
    const t = TABS[A.tab];
    $('#title').textContent = A.tab === 'home' ? 'despensAPP' : t.title;
    $('#title').classList.toggle('brand', A.tab === 'home');
    const me = Store.me();
    $('#meBtn').innerHTML = me ? `<span class="avatar sm">${esc(me[0])}</span>` : ico('users');
    $('#tabbar').innerHTML = tabbar();
    const v = $('#view');
    const html = t.view().render();
    v.innerHTML = html;
    if (opts.anim) { v.classList.remove('enter'); void v.offsetWidth; v.classList.add('enter'); }
    if (t.view().after) t.view().after();
    Photos.hydrate(v);
  };

  A.go = tab => {
    if (!TABS[tab]) return;
    const changed = tab !== A.tab;
    A.tab = tab;
    try { localStorage.setItem('despensapp-tab', tab); } catch {}
    A.render({ anim: changed });
    if (changed) window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    UI.haptic(5);
  };

  Actions.goTab = el => { UI.closeAll(); A.go(el.dataset.val); };
  Actions.openHogar = () => A.go('hogar');

  /* ---------- Onboarding ---------- */
  let ob = null;
  function obSheet() {
    return `<div class="onb">
      <picture class="onb-logo"><source srcset="img/logo.webp" type="image/webp"><img src="img/logo.png" alt="despensAPP"></picture>
      <h2>Bienvenido a despensAPP</h2>
      <p class="sub">Despensa, lista del súper, menú y plata del hogar, conectados.</p>
      <label class="lbl">¿Cómo se llama tu hogar?</label>
      <input id="obHome" value="${esc(ob.home)}" placeholder="Ej: Casa Ñuñoa">
      <label class="lbl">Tu nombre</label>
      <input id="obMe" value="${esc(ob.me)}" placeholder="Ej: Ana">
      <label class="lbl">¿Quién más vive contigo? <small class="hint">(separa con comas)</small></label>
      <input id="obOthers" value="${esc(ob.others)}" placeholder="Ej: Pablo, Cami">
      <label class="lbl">Presupuesto mensual del hogar</label>
      <div class="money-in"><span>$</span><input id="obBudget" type="number" inputmode="numeric" value="${ob.budget}" placeholder="150000"></div>
      <button class="btn primary block lg" data-act="obGo">${ico('arrowR')} Empezar</button>
      <button class="btn ghost block" data-act="obDemo">${ico('sparkles')} Probar con datos de ejemplo</button>
      ${Sync.configured() ? `<div class="inline-add"><input id="obCode" placeholder="¿Tienes código de hogar?" autocapitalize="characters" value="${esc(ob.code || '')}"><button class="btn ghost" data-act="obJoin">Unirme</button></div>` : ''}
    </div>`;
  }
  function onboarding(code) {
    ob = { home: Store.state.household.name || 'Mi Hogar', me: '', others: '', budget: 150000, code: code || '' };
    UI.open('', obSheet, null, { tall: true });
  }
  function obRead() {
    const h = Store.state.household;
    h.name = $('#obHome').value.trim() || 'Mi Hogar';
    const me = $('#obMe').value.trim();
    const others = $('#obOthers').value.split(',').map(s => s.trim()).filter(Boolean);
    h.members = [...new Set([me, ...others].filter(Boolean))];
    h.budget = parseFloat($('#obBudget').value) || 0;
    h.t = Store.now();
    if (me) Store.setMe(me);
    return me;
  }
  Actions.obGo = () => {
    const me = obRead();
    if (!me) { UI.toast('Escribe tu nombre', { type: 'err' }); return; }
    Store.log('hogar', `creó el hogar "${Store.state.household.name}"`);
    Store.commit(); UI.closeAll(); A.render();
    UI.toast(`¡Listo, ${esc(me)}! Empieza llenando tu despensa`, { icon: 'sparkles' });
  };
  Actions.obDemo = () => { obRead(); Demo.seed(); Store.commit(); UI.closeAll(); A.render(); UI.toast('Datos de ejemplo cargados', { icon: 'sparkles' }); };
  Actions.obJoin = async () => {
    const code = $('#obCode').value;
    try { await Sync.join(code); UI.closeAll(); A.render(); setTimeout(askWho, 500); }
    catch (e) { UI.toast(esc(e.message), { type: 'err' }); }
  };

  function askWho() {
    const mem = Store.state.household.members;
    UI.open('¿Quién eres?', () => `<p class="hint">Así la bitácora sabrá quién hizo cada cosa.</p>
      ${mem.length ? UI.chips(mem, Store.me(), 'whoPick') : ''}
      <div class="inline-add"><input id="whoNew" placeholder="Soy alguien nuevo…"><button class="btn primary" data-act="whoNew">${ico('plus')}</button></div>`);
  }
  A.askWho = askWho;
  A.onboarding = onboarding;
  Actions.whoPick = el => { Store.setMe(el.dataset.val); UI.closeAll(); A.render(); UI.toast(`Hola, ${esc(el.dataset.val)}`, { icon: 'user' }); };
  Actions.whoNew = () => {
    const n = $('#whoNew').value.trim(); if (!n) return;
    const h = Store.state.household;
    if (!h.members.includes(n)) { h.members.push(n); h.t = Store.now(); }
    Store.setMe(n); Store.log('hogar', 'se unió al hogar'); Store.commit(); UI.closeAll(); A.render();
  };

  /* ---------- Instalar en el dispositivo ---------- */
  let deferredPrompt = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  A.canInstall = () => !isStandalone() && (!!deferredPrompt || isIOS() || /android/i.test(navigator.userAgent));
  function updateInstallBtn() { const b = $('#installBtn'); if (b) b.hidden = !A.canInstall(); }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; updateInstallBtn(); if (A.ready) A.render(); });
  window.addEventListener('appinstalled', () => { deferredPrompt = null; updateInstallBtn(); UI.toast('¡despensAPP quedó instalada!', { icon: 'sparkles' }); if (A.ready) A.render(); });
  Actions.installApp = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const r = await deferredPrompt.userChoice;
        deferredPrompt = null; updateInstallBtn();
        if (r && r.outcome === 'accepted') UI.toast('Instalando…', { icon: 'download' });
        return;
      } catch { deferredPrompt = null; updateInstallBtn(); }
    }
    A.installHelp();
  };
  // Instrucciones manuales (iPhone/Safari o navegadores sin aviso nativo)
  A.installHelp = () => {
    const ios = isIOS();
    UI.open('Instalar despensAPP', () => `
      <div class="center"><img src="img/mascot.png" alt="" class="install-mascot"></div>
      <p class="sub center">Instálala para abrirla como una app, a pantalla completa y sin conexión.</p>
      ${ios ? `<ol class="steps">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>Toca el botón <b>Compartir</b> (cuadrado con flecha hacia arriba).</li>
          <li>Elige <b>“Agregar a pantalla de inicio”</b> y confirma con <b>Agregar</b>.</li></ol>`
        : `<ol class="steps">
          <li>Abre el menú del navegador (<b>⋮</b> arriba a la derecha en Chrome).</li>
          <li>Toca <b>“Instalar aplicación”</b> o <b>“Agregar a pantalla principal”</b>.</li>
          <li>Confirma con <b>Instalar</b>. El ícono aparecerá junto a tus apps.</li></ol>`}
      <p class="hint center">${isStandalone() ? 'Ya estás usando la app instalada.' : ''}</p>`);
  };

  /* ---------- Service Worker ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            UI.toast('Nueva versión disponible', { icon: 'sparkles', action: { label: 'Actualizar', fn: () => location.reload() }, ms: 8000 });
          }
        });
      });
    }).catch(e => console.warn('SW', e));
  }

  /* ---------- Mudanza de URL (despensapp-eb4a7.web.app → despensapp.web.app) ---------- */
  const NEW_ORIGIN = 'https://despensapp.web.app';
  const OLD_HOSTS = ['despensapp-eb4a7.web.app', 'despensapp-eb4a7.firebaseapp.com'];
  const b64u = buf => { let s = ''; new Uint8Array(buf).forEach(c => { s += String.fromCharCode(c); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  async function packKeys() {
    const keys = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('despensapp')) keys[k] = localStorage.getItem(k); }
    const bytes = new TextEncoder().encode(JSON.stringify({ v: 1, keys }));
    if (window.CompressionStream) {
      const gz = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      return 'z' + b64u(gz);
    }
    return 'p' + b64u(bytes);
  }
  async function unpackKeys(s) {
    let bytes = unb64u(s.slice(1));
    if (s[0] === 'z') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    return JSON.parse(new TextDecoder().decode(bytes)).keys;
  }
  function oldHasData() {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('despensapp-v1')) continue;
      try { const s = JSON.parse(localStorage.getItem(k)); if (s && ((s.household.members || []).length || Object.keys(s.pantry.items || {}).length || (s.expenses || []).length)) return true; } catch {}
    }
    return false;
  }
  // En el dominio antiguo: si no hay datos se redirige; si hay, se ofrece llevarlos
  function oldHostGate() {
    if (!OLD_HOSTS.includes(location.hostname)) return false;
    if (!oldHasData()) { location.replace(NEW_ORIGIN + location.pathname + location.search + location.hash); return true; }
    try { if (sessionStorage.getItem('despensapp-stay')) { setTimeout(() => UI.toast('despensAPP se mudó a despensapp.web.app', { icon: 'link', action: { label: 'Mudarme', fn: () => Actions.moveGo() }, ms: 9000 }), 800); return false; } } catch {}
    $('#tabbar').hidden = true;
    $('#view').innerHTML = `<section class="move">
      <picture><source srcset="img/logo.webp" type="image/webp"><img src="img/logo.png" alt="despensAPP" class="move-logo"></picture>
      <h2>¡Nos cambiamos de dirección!</h2>
      <p>despensAPP ahora vive en <b>despensapp.web.app</b>. Toca el botón y tus hogares, despensa, lista, menú y gastos se van contigo.</p>
      <button class="btn primary block lg" data-act="moveGo">${ico('arrowR')} Ir a despensapp.web.app con mis datos</button>
      <p class="hint">Las fotos de boletas quedan en este navegador; si tu hogar es compartido, se recuperan solas en la nueva dirección. Si instalaste la app, instálala de nuevo desde la nueva dirección.</p>
      <button class="btn ghost block" data-act="moveStay">Seguir aquí por ahora</button>
    </section>`;
    return true;
  }
  Actions.moveGo = async () => {
    try { const p = await packKeys(); location.href = NEW_ORIGIN + '/index.html#mudanza=' + p; }
    catch (e) { console.warn(e); location.href = NEW_ORIGIN; }
  };
  Actions.moveStay = () => { try { sessionStorage.setItem('despensapp-stay', '1'); } catch {} location.reload(); };
  // En el dominio nuevo: recibe la mudanza
  async function receiveMove() {
    const m = location.hash.match(/^#mudanza=(.+)$/);
    if (!m) return 0;
    history.replaceState(null, '', location.pathname + location.search);
    try { return Store.importMove(await unpackKeys(m[1])); } catch (e) { console.warn('mudanza', e); return -1; }
  }

  /* ---------- Init ---------- */
  A.init = async () => {
    const moved = await receiveMove();
    Store.load();
    UI.init();
    if (oldHostGate()) return;
    if (moved > 0) setTimeout(() => UI.toast(`¡Mudanza lista! Se trajeron ${moved} hogar${moved > 1 ? 'es' : ''}`, { icon: 'sparkles', ms: 5000 }), 600);
    if (moved < 0) setTimeout(() => UI.toast('No se pudieron traer los datos; usa Exportar/Importar en Hogar', { type: 'err', ms: 7000 }), 600);
    try { const t = localStorage.getItem('despensapp-tab'); if (TABS[t] && !TABS[t].hidden) A.tab = t; } catch {}
    const hashTab = location.hash.slice(1);
    if (TABS[hashTab]) { A.tab = hashTab; history.replaceState(null, '', location.pathname + location.search); }
    Store.on(opts => { if (A.ready) A.render(); });
    A.render();
    A.ready = true;
    updateInstallBtn();
    registerSW();
    await Sync.init();

    const params = new URLSearchParams(location.search);
    const code = params.get('hogar');
    if (code) history.replaceState(null, '', location.pathname);
    if (!Store.state.household.members.length && !Sync.code) {
      onboarding(code);
    } else if (code && code.toUpperCase() !== Sync.code) {
      try { await Sync.join(code); UI.toast(`Te uniste al hogar ${esc(code.toUpperCase())}`, { icon: 'cloud' }); if (!Store.me()) askWho(); }
      catch (e) { UI.toast(esc(e.message), { type: 'err' }); }
    }
    // Recordatorio de vencimientos al abrir
    const exp = Pantry.expiring().filter(e => Pantry.daysTo(e.exp) <= 1);
    if (exp.length) setTimeout(() => UI.toast(`${exp.length} producto${exp.length > 1 ? 's' : ''} vence${exp.length > 1 ? 'n' : ''} pronto`, { icon: 'bell', action: { label: 'Ver', fn: () => A.go('pantry') } }), 1200);
  };

  return A;
})();

/* ---------- Datos de ejemplo ---------- */
const Demo = {
  seed() {
    const s = Store.state, h = s.household;
    if (h.members.length < 2) h.members = [...new Set([...(h.members.length ? h.members : ['Ana']), 'Pablo', 'Cami'])];
    if (!Store.me()) Store.setMe(h.members[0]);
    h.diets = { ...(h.diets || {}), [h.members[h.members.length - 1]]: { tags: ['celiaco'], note: 'Sin gluten' } };
    h.shopBudget = 80000; h.t = Store.now();
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return Money.iso(x); };
    [['lacteos', 'leche', 'descremada', 3, 'un', d(6), 2], ['lacteos', 'huevo', 'color-extra', 6, 'un', d(12), 6], ['fideos', 'arroz', 'grado-1', 1, 'kg', '', 1],
     ['fideos', 'fideos', 'spaghetti-5', 400, 'g', '', 0], ['aceites', 'aceite', 'maravilla', 1, 'un', '', 1], ['fruver', 'tomate', 'larga-vida', 0.8, 'kg', d(3), 0],
     ['fruver', 'palta', 'hass', 2, 'un', d(1), 0], ['fruver', 'cebolla', 'comun', 1, 'kg', '', 0], ['lacteos', 'queso', 'gauda-laminado', 250, 'g', d(-1), 0],
     ['aseo', 'lavaloza', 'liquido', 0, 'un', '', 1], ['desayuno', 'pan', 'marraqueta', 4, 'un', d(1), 0], ['aceites', 'sal', 'fina', 1, 'kg', '', 0],
     ['carnes', 'pollo', 'trutro-corto', 1, 'kg', d(2), 0], ['aceites', 'salsatomate', 'pomarola', 2, 'un', '', 0]]
      .forEach(([c, i, v, q, u, exp, min]) => { Pantry.add(c, i, v, q, u, { exp, minStock: min }); });
    Shop.add('lacteos', 'yogurt', 'natural', 6, 'un', '');
    Shop.add('fruver', 'platano', 'ecuatoriano', 1, 'kg', '');
    Shop.add('aseo', 'papelhig', 'doble-hoja', 1, 'un', '');
    const r = Recipes.get('pastas_bolognesa');
    const ev = { id: Store.uid('ev_'), type: 'Almuerzo', title: r.name, date: d(1), recipeId: r.id, people: h.members.length, diet: 'aparte', cooked: false, t: Store.now() };
    s.menu.push(ev);
    Shop.sendMissing(Recipes.needs(r, ev.people, 'aparte'), `· para ${r.name}`);
    s.menu.push({ id: Store.uid('ev_'), type: 'Cena', title: 'Charquicán', date: d(2), recipeId: 'charquican', people: h.members.length, diet: 'aparte', cooked: false, t: Store.now() });
    s.expenses.unshift(
      { id: Store.uid('exp_'), amount: 45990, cat: 'Supermercado', desc: 'Lider compra semanal', date: d(-3), payer: h.members[1], among: h.members.slice(), method: 'Débito', docType: 'Boleta', docNum: '88219', photos: [], notes: 'Descuento con tarjeta', created: Store.now(), t: Store.now() },
      { id: Store.uid('exp_'), amount: 12400, cat: 'Verdulería', desc: 'Feria del sábado', date: d(-1), payer: h.members[0], among: h.members.slice(), method: 'Efectivo', docType: 'Sin documento', docNum: '', photos: [], notes: '', created: Store.now(), t: Store.now() },
      { id: Store.uid('exp_'), amount: 8990, cat: 'Farmacia', desc: 'Remedios', date: d(0), payer: h.members[0], among: [h.members[0]], method: 'Crédito', docType: 'Boleta', docNum: '', photos: [], notes: 'Solo mío', created: Store.now(), t: Store.now() },
    );
    Store.log('hogar', 'cargó datos de ejemplo');
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
