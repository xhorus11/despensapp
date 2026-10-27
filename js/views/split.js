/* despensAPP · Cuentas separadas: dividir una boleta por persona, por productos y por aportes */
const SplitView = (() => {
  let sp = null; // { id, isNew, e (copia del gasto), split }

  const members = () => Store.state.household.members;
  const num = v => { const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; };
  const lid = () => Store.uid('ln');

  function initialSplit(e) {
    if (e.split) return JSON.parse(JSON.stringify(e.split));
    const people = (e.among && e.among.length ? e.among : members()).slice();
    if (!people.length) people.push(Store.me() || 'Yo');
    return {
      people,
      lines: (e.items || []).filter(x => x.price).map(x => ({ id: lid(), n: x.n, price: x.price, who: [] })),
      restWho: [],
      contrib: e.payer ? [{ who: e.payer, amount: +e.amount || 0 }] : [],
    };
  }

  /* ---------- Abrir ---------- */
  function open(id) {
    const e = Store.state.expenses.find(x => x.id === id);
    if (!e) return;
    sp = { id, isNew: false, e: JSON.parse(JSON.stringify(e)), split: initialSplit(e), showPhoto: false };
    UI.open('Cuentas separadas', render, b => Photos.hydrate(b), { tall: true });
  }
  function openNew() {
    const mem = members();
    const me = Store.me() && mem.includes(Store.me()) ? Store.me() : mem[0] || '';
    const e = { id: Store.uid('exp_'), amount: 0, cat: 'Supermercado', desc: '', date: Money.today(), payer: me, among: mem.slice(),
      method: 'Débito', docType: 'Boleta', docNum: '', photos: [], notes: '', items: [] };
    sp = { id: e.id, isNew: true, e, split: initialSplit(e), showPhoto: false };
    sp.split.contrib = me ? [{ who: me, amount: 0 }] : [];
    UI.open('Nueva boleta dividida', render, b => Photos.hydrate(b), { tall: true });
  }
  // Lista de boletas para elegir (botón "Cuentas separadas" de Plata)
  function picker() {
    const list = Money.list().filter(e => e.cat !== 'Ajuste').slice(0, 40);
    UI.open('Cuentas separadas', () => `
      <p class="hint">Elige una boleta para dividirla por persona o por productos, o crea una nueva.</p>
      <button class="btn primary block" data-act="splitNew">${ico('plus')} Nueva boleta dividida</button>
      <div class="list">${list.map(e => `<button class="row card-row" data-act="splitOpen" data-id="${e.id}">
          <span class="em">${Money.catEmoji(e.cat)}</span>
          <span class="grow"><b>${esc(e.desc || e.cat)}</b><small>${UI.fmtDate(e.date)}${(e.photos || []).length ? ' · con boleta' : ''}${(e.items || []).length ? ` · ${e.items.length} productos` : ''}</small>
            ${e.split ? `<span class="pill ok">${ico('users')} dividida entre ${e.split.people.length}</span>` : ''}</span>
          <b class="amt">${Money.fmt(e.amount)}</b></button>`).join('') || UI.empty('receipt', 'Sin boletas', 'Registra un gasto o crea una boleta dividida.')}</div>`, null, { tall: true });
  }

  /* ---------- Render ---------- */
  function personChips(who, act, k) {
    const all = !who || !who.length;
    return `<div class="split-who">
      <button class="pchip ${all ? 'on' : ''}" data-act="${act}" data-k="${k}" data-p="">Todos</button>
      ${sp.split.people.map(p => `<button class="pchip ${!all && who.includes(p) ? 'on' : ''}" data-act="${act}" data-k="${k}" data-p="${esc(p)}">${esc(p)}</button>`).join('')}
    </div>`;
  }

  function summaryHtml() {
    const c = Money.splitCalc({ ...sp.e, split: sp.split });
    const restTxt = Math.abs(c.rest) < 0.5 ? '' : c.rest > 0
      ? `${Money.fmt(c.rest)} sin asignar a productos (bolsas, redondeo, otros)`
      : `Los productos suman ${Money.fmt(-c.rest)} más que la boleta (descuento)`;
    return `
      ${restTxt ? `<div class="split-rest">${ico('info')}<div><b>${restTxt}</b><small>Se reparte entre:</small>${personChips(sp.split.restWho, 'spRestWho', 0)}</div></div>` : ''}
      <h4 class="sec-title">${ico('users')} Resumen</h4>
      <div class="split-sum">
        <div class="ss-h"><span>Persona</span><span>Consumió</span><span>Aportó</span><span>Saldo</span></div>
        ${c.rows.map(r => `<div class="ss-r"><span><b>${esc(r.name)}</b></span><span>${Money.fmt(r.cons)}</span><span>${Money.fmt(r.paid)}</span>
          <span class="${r.net > 0.5 ? 'pos' : r.net < -0.5 ? 'neg' : ''}">${Math.abs(r.net) < 0.5 ? 'a mano' : (r.net > 0 ? '+' : '') + Money.fmt(r.net)}</span></div>`).join('')}
      </div>
      ${Math.abs(c.contribDiff) > 0.5 ? `<div class="warn">${ico('alert')} ${c.contribDiff > 0 ? `Faltan ${Money.fmt(c.contribDiff)} por asignar en "Quién pagó"` : `Los aportes superan la boleta en ${Money.fmt(-c.contribDiff)}`}</div>` : `<p class="hint center">${ico('check')} Aportes cuadrados con el total de la boleta</p>`}
      ${(() => { const s = Money.settle(c.rows.map(r => ({ member: r.name, net: r.net }))); return s.length ? `<div class="split-settle">${s.map(x => `<div><b>${esc(x.from)}</b> ${ico('arrowR')} <b>${esc(x.to)}</b><span>${Money.fmt(x.amount)}</span></div>`).join('')}</div>` : ''; })()}`;
  }

  function render() {
    const e = sp.e, s = sp.split;
    return `
      <section class="split-receipt">
        ${(e.photos || []).length ? `
          <div class="split-photos">${e.photos.map(id => `<div class="thumb"><img data-photo="${id}" alt="boleta" data-act="fxView" data-id="${id}"></div>`).join('')}
            <label class="thumb add" for="spCam">${ico('camera')}<small>Otra foto</small></label></div>
          <button class="btn ghost sm block" data-act="spTogglePhoto">${ico('eye')} ${sp.showPhoto ? 'Ocultar boleta' : 'Ver boleta mientras divido'}</button>
          ${sp.showPhoto ? `<div class="split-photo-big"><img data-photo="${e.photos[0]}" alt="boleta"></div>` : ''}`
        : `<div class="split-nophoto">${ico('receipt')}<span>Adjunta la boleta como respaldo</span>
            <label class="btn sm primary" for="spCam">${ico('camera')} Cámara</label><label class="btn sm ghost" for="spGal">${ico('image')} Galería</label></div>`}
        <input type="file" id="spCam" accept="image/*" capture="environment" hidden data-change="spPhoto">
        <input type="file" id="spGal" accept="image/*" multiple hidden data-change="spPhoto">
      </section>

      <div class="grid2">
        <div><label class="lbl">Descripción</label><input value="${esc(e.desc || '')}" placeholder="Ej: Lider compra semanal" data-input="spDesc"></div>
        <div><label class="lbl">Fecha</label><input type="date" value="${e.date}" data-change="spDate"></div>
      </div>
      <label class="lbl">Total de la boleta</label>
      <div class="money-in"><span>$</span><input type="number" inputmode="numeric" min="0" step="any" value="${e.amount || ''}" placeholder="0" data-input="spAmount"></div>

      <label class="lbl">${ico('users')} Personas</label>
      <div class="split-people">${s.people.map((p, k) => `<div class="sp-person"><span class="avatar sm">${esc((p || '?')[0])}</span>
          <input value="${esc(p)}" data-change="spRename" data-k="${k}" aria-label="Nombre">
          <button class="icon-btn sm" data-act="spDelPerson" data-k="${k}" aria-label="Quitar">${ico('x')}</button></div>`).join('')}</div>
      <div class="chips">${members().filter(m => !s.people.includes(m)).map(m => `<button class="chip add" data-act="spAddPerson" data-p="${esc(m)}">+ ${esc(m)}</button>`).join('')}
        <button class="chip add" data-act="spAddPerson" data-p="">+ Otra persona</button></div>

      <label class="lbl">${ico('zap')} División rápida</label>
      <div class="chips">
        <button class="chip" data-act="spEqual">Partes iguales</button>
        ${s.people.map(p => `<button class="chip" data-act="spAllTo" data-p="${esc(p)}">Todo a ${esc(p)}</button>`).join('')}
      </div>

      <h4 class="sec-title">${ico('list')} Productos <small>${s.lines.length}</small></h4>
      <p class="hint">Asigna cada producto a quien lo consumió. "Todos" lo reparte en partes iguales.</p>
      <div class="split-lines">${s.lines.map((l, k) => `<div class="sp-line">
          <div class="sp-line-top">
            <input class="sp-n" value="${esc(l.n)}" placeholder="Producto" data-input="spLineN" data-k="${k}">
            <div class="money-in sm"><span>$</span><input type="number" inputmode="numeric" step="any" value="${l.price || ''}" placeholder="0" data-input="spLineP" data-k="${k}"></div>
            <button class="icon-btn sm" data-act="spDelLine" data-k="${k}" aria-label="Quitar">${ico('trash')}</button>
          </div>${personChips(l.who, 'spLineWho', k)}</div>`).join('')}</div>
      <div class="btn-row">
        <button class="btn ghost sm" data-act="spAddLine">${ico('plus')} Producto</button>
        ${(e.items || []).length && !s.lines.length ? `<button class="btn ghost sm" data-act="spLoadItems">${ico('cart')} Cargar productos de la compra</button>` : ''}
      </div>

      <h4 class="sec-title">${ico('wallet')} Quién pagó <small>aportes</small></h4>
      <div class="split-contrib">${s.contrib.map((c, k) => `<div class="sp-contrib">
          <select data-change="spContribWho" data-k="${k}">${s.people.map(p => `<option ${p === c.who ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select>
          <div class="money-in sm"><span>$</span><input type="number" inputmode="numeric" step="any" value="${c.amount || ''}" placeholder="0" data-input="spContribAmt" data-k="${k}"></div>
          <button class="icon-btn sm" data-act="spDelContrib" data-k="${k}" aria-label="Quitar">${ico('x')}</button></div>`).join('')}</div>
      <div class="btn-row"><button class="btn ghost sm" data-act="spAddContrib">${ico('plus')} Aporte</button>
        <button class="btn ghost sm" data-act="spFillContrib">${ico('check')} Completar con el resto</button></div>

      <div id="spSum">${summaryHtml()}</div>

      <div class="btn-col">
        <button class="btn primary block lg" data-act="spSave">${ico('check')} Guardar división</button>
        <div class="grid2">
          <button class="btn ghost" data-act="spShare">${ico('whatsapp')} Enviar resumen</button>
          ${!sp.isNew && Store.state.expenses.find(x => x.id === sp.id && x.split) ? `<button class="btn danger ghost" data-act="spRemove">${ico('x')} Quitar división</button>` : '<span></span>'}
        </div>
      </div>`;
  }

  const refresh = () => { UI.refresh(); Photos.hydrate(); };
  const updSum = () => { const el = $('#spSum'); if (el) el.innerHTML = summaryHtml(); };
  function toggleWho(who, p) {
    if (!p) return [];
    const next = who.includes(p) ? who.filter(x => x !== p) : [...who, p];
    return next.length === sp.split.people.length ? [] : next;
  }

  /* ---------- Acciones ---------- */
  Actions.moneySplit = () => picker();
  Actions.splitOpen = el => open(el.dataset.id);
  Actions.splitNew = () => openNew();
  Actions.spTogglePhoto = () => { sp.showPhoto = !sp.showPhoto; refresh(); };
  Actions.spPhoto = async el => {
    const files = [...(el.files || [])];
    if (!files.length) return;
    UI.toast('Procesando foto…', { icon: 'camera' });
    for (const f of files) { try { sp.e.photos = [...(sp.e.photos || []), await Photos.add(f)]; } catch { UI.toast('No se pudo leer la imagen', { type: 'err' }); } }
    el.value = ''; refresh();
  };
  Actions.spDesc = el => { sp.e.desc = el.value; };
  Actions.spDate = el => { sp.e.date = el.value || Money.today(); };
  Actions.spAmount = el => {
    const prev = +sp.e.amount || 0;
    sp.e.amount = num(el.value);
    // Si había un solo aporte por el total, lo seguimos ajustando
    if (sp.split.contrib.length === 1 && Math.abs((+sp.split.contrib[0].amount || 0) - prev) < 0.5) {
      sp.split.contrib[0].amount = sp.e.amount;
      const ci = $('[data-input="spContribAmt"][data-k="0"]'); if (ci) ci.value = sp.e.amount || '';
    }
    updSum();
  };
  Actions.spRename = el => {
    const k = +el.dataset.k, old = sp.split.people[k], nw = el.value.trim();
    if (!nw || nw === old) { el.value = old; return; }
    if (sp.split.people.includes(nw)) { UI.toast('Ya hay alguien con ese nombre', { type: 'err' }); el.value = old; return; }
    const ren = arr => arr.map(x => (x === old ? nw : x));
    sp.split.people[k] = nw;
    sp.split.lines.forEach(l => { l.who = ren(l.who || []); });
    sp.split.restWho = ren(sp.split.restWho || []);
    sp.split.contrib.forEach(c => { if (c.who === old) c.who = nw; });
    refresh();
  };
  Actions.spAddPerson = el => {
    let p = el.dataset.p;
    if (!p) { let n = 1; do { p = `Persona ${sp.split.people.length + n}`; n++; } while (sp.split.people.includes(p)); }
    sp.split.people.push(p);
    refresh();
    if (!el.dataset.p) setTimeout(() => { const ins = $$('.sp-person input'); const last = ins[ins.length - 1]; if (last) { last.focus(); last.select(); } }, 60);
  };
  Actions.spDelPerson = el => {
    const s = sp.split, p = s.people[+el.dataset.k];
    if (s.people.length < 2) { UI.toast('Debe quedar al menos una persona', { type: 'err' }); return; }
    s.people.splice(+el.dataset.k, 1);
    s.lines.forEach(l => { l.who = (l.who || []).filter(x => x !== p); });
    s.restWho = (s.restWho || []).filter(x => x !== p);
    s.contrib = s.contrib.filter(c => c.who !== p);
    refresh();
  };
  Actions.spEqual = () => {
    sp.split.lines.forEach(l => { l.who = []; }); sp.split.restWho = [];
    refresh(); UI.toast('Todo repartido en partes iguales', { icon: 'users' });
  };
  Actions.spAllTo = el => {
    const p = el.dataset.p;
    sp.split.lines.forEach(l => { l.who = [p]; }); sp.split.restWho = [p];
    refresh(); UI.toast(`Todo asignado a ${esc(p)}`, { icon: 'user' });
  };
  Actions.spAddLine = () => {
    sp.split.lines.push({ id: lid(), n: '', price: 0, who: [] });
    refresh();
    setTimeout(() => { const ins = $$('.sp-n'); const last = ins[ins.length - 1]; if (last) last.focus(); }, 60);
  };
  Actions.spLoadItems = () => {
    sp.split.lines = (sp.e.items || []).map(x => ({ id: lid(), n: x.n, price: x.price || 0, who: [] }));
    refresh();
  };
  Actions.spDelLine = el => { sp.split.lines.splice(+el.dataset.k, 1); refresh(); };
  Actions.spLineN = el => { sp.split.lines[+el.dataset.k].n = el.value; };
  Actions.spLineP = el => { sp.split.lines[+el.dataset.k].price = num(el.value); updSum(); };
  Actions.spLineWho = el => { const l = sp.split.lines[+el.dataset.k]; l.who = toggleWho(l.who || [], el.dataset.p); refresh(); };
  Actions.spRestWho = el => { sp.split.restWho = toggleWho(sp.split.restWho || [], el.dataset.p); refresh(); };
  Actions.spAddContrib = () => {
    const used = sp.split.contrib.map(c => c.who);
    const who = sp.split.people.find(p => !used.includes(p)) || sp.split.people[0];
    sp.split.contrib.push({ who, amount: 0 });
    refresh();
  };
  Actions.spDelContrib = el => { sp.split.contrib.splice(+el.dataset.k, 1); refresh(); };
  Actions.spContribWho = el => { sp.split.contrib[+el.dataset.k].who = el.value; updSum(); };
  Actions.spContribAmt = el => { sp.split.contrib[+el.dataset.k].amount = num(el.value); updSum(); };
  Actions.spFillContrib = () => {
    const c = Money.splitCalc({ ...sp.e, split: sp.split });
    if (Math.abs(c.contribDiff) < 0.5) { UI.toast('Los aportes ya cuadran', { icon: 'check' }); return; }
    if (!sp.split.contrib.length) sp.split.contrib.push({ who: sp.e.payer || sp.split.people[0], amount: 0 });
    const last = sp.split.contrib[sp.split.contrib.length - 1];
    last.amount = Math.max(0, (+last.amount || 0) + c.contribDiff);
    refresh();
  };

  function shareText() {
    const c = Money.splitCalc({ ...sp.e, split: sp.split });
    const lines = [`🧾 ${sp.e.desc || 'Boleta'} · ${UI.fmtDate(sp.e.date, { day: 'numeric', month: 'short' })} — Total ${Money.fmt(c.amount)}`, ''];
    sp.split.lines.filter(l => l.price).forEach(l => lines.push(`• ${l.n || 'Producto'}: ${Money.fmt(l.price)} → ${l.who && l.who.length ? l.who.join(', ') : 'todos'}`));
    if (Math.abs(c.rest) >= 0.5) lines.push(`• Resto de la boleta: ${Money.fmt(c.rest)} → ${sp.split.restWho && sp.split.restWho.length ? sp.split.restWho.join(', ') : 'todos'}`);
    lines.push('', '*Cuentas separadas*');
    c.rows.forEach(r => lines.push(`${r.name}: consumió ${Money.fmt(r.cons)}, aportó ${Money.fmt(r.paid)} → ${Math.abs(r.net) < 0.5 ? 'a mano' : r.net > 0 ? 'le deben ' + Money.fmt(r.net) : 'debe ' + Money.fmt(-r.net)}`));
    const s = Money.settle(c.rows.map(r => ({ member: r.name, net: r.net })));
    if (s.length) { lines.push(''); s.forEach(x => lines.push(`➡️ ${x.from} le transfiere ${Money.fmt(x.amount)} a ${x.to}`)); }
    lines.push('', '— despensAPP');
    return lines.join('\n');
  }
  Actions.spShare = () => UI.whatsapp(shareText());

  Actions.spSave = () => {
    const e = sp.e, s = sp.split;
    if (!(+e.amount > 0)) { UI.toast('Ingresa el total de la boleta', { type: 'err' }); return; }
    s.lines = s.lines.filter(l => (l.n || '').trim() || +l.price);
    s.contrib = s.contrib.filter(c => +c.amount > 0);
    e.split = s;
    const c = Money.splitCalc(e);
    if (Math.abs(c.contribDiff) > 0.5 && !sp.confirmDiff) {
      sp.confirmDiff = true;
      UI.toast(`Los aportes no cuadran (${Money.fmt(c.contribDiff)}). Toca Guardar otra vez para guardar igual.`, { type: 'err', ms: 4500 });
      return;
    }
    s.t = Store.now();
    // Compatibilidad: pagador principal y participantes del hogar
    const top = s.contrib.slice().sort((a, b) => b.amount - a.amount)[0];
    if (top) e.payer = top.who;
    e.among = s.people.filter(p => members().includes(p));
    e.t = Store.now();
    if (!e.created) e.created = Store.now();
    const k = Store.state.expenses.findIndex(x => x.id === e.id);
    if (k >= 0) Store.state.expenses[k] = e; else Store.state.expenses.unshift(e);
    Store.log('money', `dividió ${e.desc ? '"' + e.desc + '"' : 'una boleta'} de ${Money.fmt(e.amount)} entre ${s.people.length} personas`);
    Store.commit(); UI.closeAll();
    UI.toast('División guardada · Cuentas claras actualizadas', { icon: 'users' });
  };
  Actions.spRemove = el => UI.confirmTap(el, () => {
    const e = Store.state.expenses.find(x => x.id === sp.id);
    if (e) { delete e.split; e.t = Store.now(); Store.log('money', `quitó la división de ${e.desc || 'una boleta'}`); Store.commit(); }
    UI.closeAll(); UI.toast('División quitada', { icon: 'x' });
  }, 'Quitar división');

  return { open, openNew, picker };
})();
