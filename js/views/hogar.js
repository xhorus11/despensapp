/* despensAPP · Hogar: integrantes, dietas, sincronización, bitácora y respaldo */
const HogarView = (() => {
  let memEdit = null;

  function syncCard() {
    const code = Sync.code;
    const s = Sync.status;
    if (!Sync.configured()) {
      return `<section class="card">
        <h4 class="card-title">${ico('cloudOff')} Hogar compartido</h4>
        <p class="hint">Para sincronizar entre teléfonos, completa <code>firebase-config.js</code> con la configuración web de tu proyecto Firebase (ver README). Mientras tanto todo funciona 100% local y offline.</p>
      </section>`;
    }
    if (!code) {
      return `<section class="card">
        <h4 class="card-title">${ico('cloud')} Hogar compartido</h4>
        <p class="hint">Comparte despensa, lista y gastos en tiempo real con quienes viven contigo.</p>
        <button class="btn primary block" data-act="syncCreate">${ico('plus')} Crear hogar compartido</button>
        <div class="inline-add"><input id="joinCode" placeholder="Código (ej: K7P2QX)" maxlength="8" autocapitalize="characters"><button class="btn ghost" data-act="syncJoin">Unirme</button></div>
        <button class="btn ghost block" data-act="syncScan">${ico('scan')} Escanear QR</button>
      </section>`;
    }
    return `<section class="card">
      <h4 class="card-title">${ico('cloud')} Hogar compartido <span class="sync-pill" data-s="${s}">${esc(Sync.label())}</span></h4>
      <div class="code-box"><small>Código del hogar</small><b>${code}</b></div>
      <div id="qrBox" class="qr-box"></div>
      <div class="grid2">
        <button class="btn ghost" data-act="syncShare">${ico('share')} Invitar</button>
        <button class="btn ghost" data-act="syncCopy">${ico('copy')} Copiar código</button>
      </div>
      <button class="btn danger ghost block" data-act="syncLeave">${ico('logout')} Salir del hogar (los datos quedan en este teléfono)</button>
    </section>`;
  }

  function homesCard() {
    const homes = Store.homes(), act = Store.activeHome();
    return `<section class="card">
      <h4 class="card-title">${ico('grid')} Mis hogares <small>${homes.length}</small></h4>
      <div class="list">${homes.map(x => `<div class="row home-row ${x.id === act.id ? 'on' : ''}">
          <button class="grow home-pick" data-act="homeSwitch" data-id="${x.id}"><b>${esc(x.name)}</b><small>${x.id === act.id ? 'Activo' : 'Toca para cambiar'}${x.code ? ' · compartido ' + esc(x.code) : ' · solo este teléfono'}</small></button>
          ${x.id === act.id ? `<span class="pill ok">${ico('check')} activo</span>` : `<button class="icon-btn sm" data-act="homeDelete" data-id="${x.id}" aria-label="Eliminar">${ico('trash')}</button>`}
        </div>`).join('')}</div>
      <div class="inline-add"><input id="newHome" placeholder="Nombre del nuevo hogar (ej: Casa de la playa)"><button class="btn primary" data-act="homeCreate">${ico('plus')}</button></div>
      <p class="hint">Cada hogar tiene su propia despensa, lista, menú, gastos e integrantes, y se sincroniza por separado.</p>
    </section>`;
  }

  function render() {
    const h = Store.state.household;
    const me = Store.me();
    return `
      ${homesCard()}
      <section class="card">
        <h4 class="card-title">${ico('home')} Hogar activo</h4>
        <label class="lbl">Nombre</label>
        <input value="${esc(h.name)}" data-change="hogarName">
        <div class="grid2">
          <div><label class="lbl">Moneda</label><select data-change="hogarCur">${['CLP', 'USD', 'EUR', 'ARS', 'PEN', 'MXN', 'COP', 'UYU', 'BOB'].map(c => `<option ${c === h.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
          <div><label class="lbl">Presupuesto</label><button class="btn ghost block" data-act="moneyBudget">${Money.fmt(h.budget)}/${h.period === 'semana' ? 'sem' : 'mes'}</button></div>
        </div>
      </section>

      <section class="card">
        <h4 class="card-title">${ico('users')} Integrantes</h4>
        <div class="list">${h.members.map(m => {
          const d = (h.diets || {})[m];
          return `<button class="row" data-act="memOpen" data-m="${esc(m)}"><span class="avatar">${esc(m[0])}</span>
            <span class="grow"><b>${esc(m)}${m === me ? ' <span class="pill ok">tú</span>' : ''}</b><small>${d && ((d.tags || []).length || (d.items || []).length) ? [...(d.tags || []).map(t => DIETS[t] ? DIETS[t].emoji + ' ' + DIETS[t].name : t), ...((d.items || []).length ? [`🚫 ${d.items.length} alimento${d.items.length > 1 ? 's' : ''}`] : [])].join(' · ') : 'Sin restricciones'}${d && d.note ? ' · ' + esc(d.note) : ''}</small></span>${ico('chevR', 'muted')}</button>`;
        }).join('')}</div>
        <div class="inline-add"><input id="newMem" placeholder="Nombre del integrante"><button class="btn primary" data-act="memAdd">${ico('plus')}</button></div>
        ${h.members.length ? `<label class="lbl">¿Quién eres en este teléfono?</label>${UI.chips(h.members, me, 'memMe')}` : ''}
      </section>

      ${syncCard()}

      <section class="card">
        <h4 class="card-title">${ico('history')} Bitácora</h4>
        <button class="btn ghost block" data-act="hogarLog">${ico('list')} Ver actividad del hogar (${Store.state.log.length})</button>
      </section>

      <section class="card">
        <h4 class="card-title">${ico('download')} Respaldo</h4>
        <div class="grid2">
          <button class="btn ghost" data-act="backupExport">${ico('download')} Exportar JSON</button>
          <label class="btn ghost" for="backupIn">${ico('upload')} Importar</label>
        </div>
        <input type="file" id="backupIn" accept="application/json,.json" hidden data-change="backupImport">
        <button class="btn danger ghost block" data-act="resetAll">${ico('trash')} ${Store.homes().length > 1 ? 'Eliminar este hogar de este teléfono' : 'Borrar todos los datos de este teléfono'}</button>
      </section>
      <section class="card about">
        <picture><source srcset="img/logo.webp" type="image/webp"><img src="img/logo.png" alt="despensAPP" class="about-logo"></picture>
        <div class="grid2">
          <a class="btn ghost" href="manual/" target="_blank" rel="noopener">${ico('book')} Manual de uso</a>
          <button class="btn ghost" data-act="installApp">${ico('download')} Instalar app</button>
        </div>
      </section>
      <p class="hint center">despensAPP v${App.VERSION} · local-first · ${navigator.onLine ? 'en línea' : 'sin conexión'}</p>`;
  }

  function after() {
    const box = $('#qrBox');
    if (box && window.QRCode && Sync.code) {
      box.innerHTML = '';
      try { new QRCode(box, { text: Sync.joinLink(), width: 168, height: 168, colorDark: '#140c33', colorLight: '#ffffff' }); } catch (e) { console.warn(e); }
    }
  }

  /* ---------- Hogar ---------- */
  Actions.hogarName = el => { Store.state.household.name = el.value.trim() || 'Mi Hogar'; Store.touchHousehold(); Store.log('hogar', `renombró el hogar a "${Store.state.household.name}"`); Store.commit(); };
  Actions.hogarCur = el => { Store.state.household.currency = el.value; Store.touchHousehold(); Store.commit(); };

  /* ---------- Integrantes ---------- */
  Actions.memAdd = () => {
    const el = $('#newMem'); const n = el.value.trim();
    if (!n) return;
    const h = Store.state.household;
    if (h.members.includes(n)) { UI.toast('Ya existe', { type: 'err' }); return; }
    h.members.push(n); Store.touchHousehold();
    if (!Store.me()) Store.setMe(n);
    Store.log('hogar', `agregó a ${n} al hogar`);
    Store.commit();
  };
  Actions.memMe = el => { Store.setMe(el.dataset.val); App.render(); UI.toast(`Hola, ${esc(el.dataset.val)}`, { icon: 'user' }); };
  function memSheet() {
    const h = Store.state.household;
    const d = (h.diets || {})[memEdit] || { tags: [], note: '', items: [] };
    const items = d.items || [];
    const chipsOf = kind => Object.entries(DIETS).filter(([, x]) => x.kind === kind).map(([k, x]) => `<button class="chip ${d.tags.includes(k) ? 'on' : ''}" data-act="memDiet" data-val="${k}">${x.emoji} ${x.name}</button>`).join('');
    return `<div class="center"><span class="avatar xl">${esc(memEdit[0])}</span><h3>${esc(memEdit)}</h3></div>
      <label class="lbl">Dietas y alergias <small class="hint">(prohíben el producto)</small></label>
      <div class="chips wrap">${chipsOf('dieta')}</div>
      <label class="lbl">Condiciones de salud <small class="hint">(avisan antes de usar una receta)</small></label>
      <div class="chips wrap">${chipsOf('salud')}</div>
      <label class="lbl">Alimentos que no puede comer</label>
      <div class="chips wrap">${items.map(i => { const f = Catalog.find(i); const it = f ? f.item : { name: i, emoji: '📦' }; return `<button class="chip on" data-act="memItemDel" data-val="${esc(i)}">${it.emoji} ${esc(it.name)} ${ico('x')}</button>`; }).join('') || '<span class="hint">Ninguno</span>'}</div>
      <div class="search-box">${ico('search')}<input id="memItemQ" placeholder="Agregar alimento (ej: palta, cilantro)" data-input="memItemSearch" autocomplete="off"></div>
      <div id="memItemRes" class="chips wrap"></div>
      <label class="lbl">Nota</label>
      <input id="memNote" value="${esc(d.note || '')}" placeholder="Ej: celíaca estricta, indicación médica…" data-change="memNote">
      <p class="hint">${ico('info')} La lista, el selector y el recetario avisarán qué no es apto, propondrán alternativas y mostrarán un aviso antes de usar una receta. No reemplaza la indicación de un profesional de salud.</p>
      <button class="btn danger ghost block" data-act="memDel">${ico('trash')} Quitar del hogar</button>`;
  }
  function memD() {
    const h = Store.state.household; h.diets = h.diets || {};
    const d = h.diets[memEdit] = h.diets[memEdit] || { tags: [], note: '', items: [] };
    d.items = d.items || [];
    return d;
  }
  Actions.memItemSearch = el => {
    const r = el.value.trim().length > 1 ? Catalog.search(el.value).slice(0, 8) : [];
    $('#memItemRes').innerHTML = r.map(x => `<button class="chip add" data-act="memItemAdd" data-val="${x.item.id}">${x.item.emoji} ${esc(x.item.name)}</button>`).join('');
  };
  Actions.memItemAdd = el => { const d = memD(); if (!d.items.includes(el.dataset.val)) d.items.push(el.dataset.val); Store.touchHousehold(); Store.commit(); UI.refresh(); };
  Actions.memItemDel = el => { const d = memD(); d.items = d.items.filter(i => i !== el.dataset.val); Store.touchHousehold(); Store.commit(); UI.refresh(); };
  Actions.memOpen = el => { memEdit = el.dataset.m; UI.open('Integrante', memSheet); };
  Actions.memDiet = el => {
    const h = Store.state.household; h.diets = h.diets || {};
    const d = h.diets[memEdit] = h.diets[memEdit] || { tags: [], note: '' };
    d.tags = d.tags.includes(el.dataset.val) ? d.tags.filter(t => t !== el.dataset.val) : [...d.tags, el.dataset.val];
    Store.touchHousehold(); Store.commit(); UI.refresh();
  };
  Actions.memNote = el => {
    const h = Store.state.household; h.diets = h.diets || {};
    const d = h.diets[memEdit] = h.diets[memEdit] || { tags: [], note: '' };
    d.note = el.value.trim(); Store.touchHousehold(); Store.commit();
  };
  Actions.memDel = el => UI.confirmTap(el, () => {
    const h = Store.state.household;
    h.members = h.members.filter(m => m !== memEdit);
    if (h.diets) delete h.diets[memEdit];
    if (Store.me() === memEdit) Store.setMe('');
    Store.touchHousehold(); Store.log('hogar', `quitó a ${memEdit} del hogar`);
    Store.commit(); UI.closeAll();
  });

  /* ---------- Sync ---------- */
  Actions.syncCreate = async el => {
    el.disabled = true;
    try { const c = await Sync.create(); UI.toast(`Hogar ${c} creado`, { icon: 'cloud' }); App.render(); }
    catch (e) { UI.toast(esc(e.message), { type: 'err' }); el.disabled = false; }
  };
  async function doJoin(code) {
    try {
      // Si este hogar ya tiene datos, la unión se hace en un hogar nuevo para no mezclar despensas
      if (!Store.isEmptyHome()) {
        const nm = 'Hogar ' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        await Sync.switchTo(() => Store.createHome(nm));
      }
      const c = await Sync.join(code);
      UI.toast(`Te uniste al hogar ${c}`, { icon: 'cloud' });
      App.render();
      if (!Store.me() || !Store.state.household.members.includes(Store.me())) setTimeout(() => App.askWho(), 600);
    } catch (e) { UI.toast(esc(e.message), { type: 'err' }); }
  }
  Actions.syncJoin = () => doJoin(($('#joinCode') || {}).value);
  Actions.syncShare = () => UI.share(`Únete a nuestro hogar "${Store.state.household.name}" en despensAPP 🏠\nCódigo: ${Sync.code}\n${Sync.joinLink()}`, 'Invitación despensAPP');
  Actions.syncCopy = () => UI.copy(Sync.code);
  Actions.syncLeave = el => UI.confirmTap(el, () => { Sync.leave(); App.render(); UI.toast('Saliste del hogar compartido', { icon: 'cloudOff' }); });

  /* ---------- Escáner QR ---------- */
  let stream = null, raf = null;
  function stopScan() { if (raf) cancelAnimationFrame(raf); raf = null; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; }
  Actions.syncScan = async () => {
    UI.open('Escanear QR del hogar', () => `<div class="scanner"><video id="scanVid" playsinline muted></video><div class="scan-frame"></div></div><p class="hint center">Apunta al código QR que aparece en el teléfono de tu hogar.</p>`, null, { onClose: stopScan });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = $('#scanVid'); v.srcObject = stream; await v.play();
      const cv = document.createElement('canvas'); const ctx = cv.getContext('2d', { willReadFrequently: true });
      const det = 'BarcodeDetector' in window ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
      const tick = async () => {
        if (!stream) return;
        let txt = null;
        if (v.readyState >= 2) {
          if (det) { try { const r = await det.detect(v); if (r[0]) txt = r[0].rawValue; } catch {} }
          else if (window.jsQR) { cv.width = v.videoWidth; cv.height = v.videoHeight; ctx.drawImage(v, 0, 0); const r = jsQR(ctx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height); if (r) txt = r.data; }
        }
        if (txt) {
          const m = txt.match(/hogar=([A-Z0-9]+)/i) || txt.match(/^([A-Z0-9]{6})$/i);
          if (m) { stopScan(); UI.closeAll(); UI.haptic([10, 40, 10]); doJoin(m[1]); return; }
        }
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) { UI.toast('No se pudo abrir la cámara', { type: 'err' }); }
  };

  /* ---------- Bitácora ---------- */
  const LOGK = { pantry: ['pantry', 'Despensa'], shop: ['cart', 'Lista'], money: ['wallet', 'Finanzas'], menu: ['menu', 'Menú'], hogar: ['home', 'Hogar'], catalog: ['tag', 'Catálogo'] };
  let logF = '';
  Actions.hogarLog = () => {
    UI.open('Bitácora del hogar', () => {
      const list = Store.state.log.filter(l => !logF || l.k === logF);
      return `${UI.chips([['', 'Todo'], ...Object.entries(LOGK).map(([k, [, n]]) => [k, n])], logF, 'logFilter')}
        <div class="timeline">${list.map(l => `<div class="log-row"><span class="tl-ico">${ico((LOGK[l.k] || ['info'])[0])}</span><span class="grow"><b>${esc(l.who)}</b> ${esc(l.text)}<small>${new Date(l.t).toLocaleString('es-CL', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span></div>`).join('') || UI.empty('history', 'Sin actividad', 'Aún no hay movimientos.')}</div>`;
    }, null, { tall: true });
  };
  Actions.logFilter = el => { logF = el.dataset.val; UI.refresh(); };

  /* ---------- Respaldo ---------- */
  Actions.backupExport = () => {
    const blob = new Blob([JSON.stringify(Store.state, null, 1)], { type: 'application/json' });
    UI.download(blob, `despensapp-respaldo-${Money.today()}.json`);
  };
  Actions.backupImport = async el => {
    const f = el.files && el.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!data.household || !data.pantry) throw new Error('Archivo no válido');
      Store.replace(Merge.state(Store.state, Object.assign(Store.defaults(), data)));
      Store.commit();
      UI.toast('Respaldo importado (combinado con tus datos)', { icon: 'upload' });
    } catch (e) { UI.toast('No se pudo importar: ' + esc(e.message), { type: 'err' }); }
    el.value = '';
  };
  Actions.resetAll = el => UI.confirmTap(el, async () => {
    if (Store.homes().length > 1) {
      const id = Store.activeHome().id;
      await Sync.switchTo(() => { Store.deleteHome(id); });
      App.render(); UI.toast('Hogar eliminado de este teléfono', { icon: 'trash' });
      return;
    }
    Sync.leave(); Store.reset(); try { localStorage.removeItem('despensapp-me'); } catch {} location.reload();
  }, 'Borrar este hogar');

  /* ---------- Varios hogares ---------- */
  Actions.homeSwitch = async el => {
    const id = el.dataset.id;
    if (id === Store.activeHome().id) return;
    UI.closeAll();
    await Sync.switchTo(() => Store.switchHome(id));
    App.render();
    UI.toast(`Ahora estás en ${esc(Store.state.household.name)}`, { icon: 'home' });
    if (!Store.me() && Store.state.household.members.length) setTimeout(() => App.askWho(), 300);
  };
  Actions.homeCreate = async () => {
    const n = ($('#newHome') || {}).value || '';
    UI.closeAll();
    await Sync.switchTo(() => Store.createHome(n.trim() || 'Nuevo hogar'));
    App.render();
    App.onboarding();
  };
  Actions.homeDelete = el => UI.confirmTap(el, () => {
    const h = Store.homes().find(x => x.id === el.dataset.id);
    Store.deleteHome(el.dataset.id);
    App.render(); UI.toast(`${esc(h ? h.name : 'Hogar')} eliminado de este teléfono`, { icon: 'trash' });
  }, 'Eliminar');
  // Selector rápido de hogar (desde Inicio)
  Actions.homeSwitcher = () => {
    UI.open('Cambiar de hogar', () => `<div class="list">${Store.homes().map(x => `<button class="row card-row" data-act="homeSwitch" data-id="${x.id}">
        <span class="avatar">${esc((x.name || '?')[0])}</span><span class="grow"><b>${esc(x.name)}</b><small>${x.code ? 'Compartido · ' + esc(x.code) : 'Solo este teléfono'}</small></span>
        ${x.id === Store.activeHome().id ? `<span class="pill ok">${ico('check')} activo</span>` : ico('chevR', 'muted')}</button>`).join('')}</div>
      <button class="btn ghost block" data-act="goTab" data-val="hogar">${ico('plus')} Crear o unirme a otro hogar</button>`);
  };

  return { render, after };
})();
