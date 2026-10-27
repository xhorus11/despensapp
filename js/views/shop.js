/* despensAPP · Mi Lista + Modo En el Súper (calculadora en vivo, descuentos, comparador) */
const ShopView = (() => {
  let editKey = null;
  let pf = null; // formulario de precio

  function budgetBar(cart) {
    const b = +Store.state.household.shopBudget || 0;
    if (!b) return `<div class="cart-total"><span>En el carro</span><b>${Money.fmt(cart)}</b></div>`;
    const pct = Math.min(100, cart / b * 100);
    const over = cart > b;
    const lvl = over ? 'bad' : pct > 80 ? 'warn' : 'ok';
    return `<div class="thermo ${lvl}">
      <div class="thermo-top"><span>${ico('cart')} Carro <b>${Money.fmt(cart)}</b></span><span>Meta ${Money.fmt(b)}</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <small>${over ? `${ico('alert')} Te pasaste por ${Money.fmt(cart - b)}` : `Te quedan ${Money.fmt(b - cart)}`}</small>
    </div>`;
  }

  function srcText(e) { return (e.src || []).filter(Boolean).join(' '); }

  function row(e, superMode) {
    const it = Catalog.item(e.c, e.i);
    const vv = Catalog.variant(e.c, e.i, e.v);
    const conf = Diet.conflicts(e.c, e.i, e.v);
    const cau = Diet.cautions(e.c, e.i, e.v);
    const have = Pantry.have(e.c, e.i, e.v, e.u);
    return `<div class="row card-row shop-row ${e.done ? 'done' : ''} ${superMode ? 'big' : ''}" data-act="${superMode ? 'shopPrice' : 'shopEdit'}" data-key="${esc(e.key)}">
      <button class="check ${e.done ? 'on' : ''}" data-act="shopToggle" data-key="${esc(e.key)}" aria-label="Marcar">${ico('check')}</button>
      <span class="em">${it.emoji}</span>
      <span class="grow"><b>${esc(it.name)}</b><small>${vv ? esc(vv.name) : ''}${srcText(e) ? ` <i class="src">${esc(srcText(e))}</i>` : ''}</small>
        ${conf.length ? `<span class="warn-inline">${ico('alert')} ${esc(Diet.warnText(conf))}</span>` : ''}
        ${cau.length ? `<span class="caution-inline">${ico('info')} ${esc(Diet.cautionText(cau))}</span>` : ''}
        ${!e.done && have.q > 0 ? `<span class="hint-inline">${ico('pantry')} ya hay ${Units.fmt(have.q, e.u)} en casa</span>` : ''}
        ${e.note ? `<span class="hint-inline">${esc(e.note)}</span>` : ''}</span>
      <span class="amt">${Units.fmt(e.q, e.u)}${e.done && e.price != null ? `<b class="price">${Money.fmt(e.price)}</b>${e.disc ? `<s>${Money.fmt(e.orig)}</s>` : ''}` : ''}</span>
    </div>`;
  }

  function render() {
    const s = Store.state.shop;
    const all = Shop.entries();
    const pending = all.filter(e => !e.done);
    const done = all.filter(e => e.done);
    const cart = Shop.cartTotal();
    const superMode = !!s.mode;
    const groups = {};
    pending.forEach(e => { (groups[e.c] = groups[e.c] || []).push(e); });

    return `
    <div class="mode-switch">
      <button class="seg ${!superMode ? 'on' : ''}" data-act="shopMode" data-val="0">${ico('list')} Planificar</button>
      <button class="seg ${superMode ? 'on' : ''}" data-act="shopMode" data-val="1">${ico('cart')} En el Súper</button>
    </div>
    ${superMode ? budgetBar(cart) : ''}
    <div class="quick-actions">
      <button class="qa" data-act="shopAdd">${ico('plus')}<span>Catálogo</span></button>
      ${AI.ready() ? `<button class="qa ai" data-act="aiListOpen">${ico('sparkles')}<span>Escribir o dictar</span></button>` : ''}
      <button class="qa" data-act="shopFromPantry">${ico('pantry')}<span>Desde despensa</span></button>
      <button class="qa" data-act="shopFromMenu">${ico('menu')}<span>Desde menú</span></button>
      <button class="qa" data-act="shopCompare">${ico('scale')}<span>Comparador</span></button>
      <button class="qa" data-act="shopShare">${ico('share')}<span>Compartir</span></button>
    </div>
    ${all.length ? `
      ${pending.length ? Object.keys(groups).sort((a, b) => Catalog.cats().findIndex(c => c.id === a) - Catalog.cats().findIndex(c => c.id === b)).map(c => `
        <h4 class="sec-title">${Catalog.cat(c).emoji} ${esc(Catalog.cat(c).name)} <small>${groups[c].length}</small></h4>
        <div class="list">${groups[c].map(e => row(e, superMode)).join('')}</div>`).join('')
        : `<div class="card center done-all">${ico('check', 'big')}<h4>¡Todo en el carro!</h4><p>Cierra la compra para pasar los productos a la despensa.</p></div>`}
      ${done.length ? `<h4 class="sec-title">${ico('cart')} En el carro <small>${done.length}</small></h4>
        <div class="list">${done.map(e => row(e, superMode)).join('')}</div>` : ''}
      <div class="btn-row">
        ${done.length ? `<button class="btn primary grow" data-act="shopClose">${ico('check')} Cerrar compra (${done.length})</button>` : ''}
        <button class="btn ghost" data-act="shopClearDone" ${done.length ? '' : 'hidden'}>${ico('trash')} Vaciar carro</button>
      </div>
      <div class="spacer"></div>
      ${superMode ? `<div class="sticky-cart"><div><small>${done.length}/${all.length} productos</small><b>${Money.fmt(cart)}</b></div>
        <button class="btn primary" data-act="shopClose" ${done.length ? '' : 'disabled'}>${ico('check')} Cerrar</button></div>` : ''}`
      : UI.empty('cart', 'Tu lista está vacía', 'Agrega desde el catálogo, desde lo que se acabó en la despensa o con los faltantes del menú.', `<button class="btn primary" data-act="shopAdd">${ico('plus')} Agregar productos</button>`)}
    ${!superMode || !all.length ? `<button class="fab" data-act="shopAdd" aria-label="Agregar">${ico('plus')}</button>` : ''}`;
  }

  /* ---------- Acciones básicas ---------- */
  Actions.shopMode = el => { Store.state.shop.mode = el.dataset.val === '1'; Store.save(); App.render(); UI.haptic(6); };
  Actions.shopAdd = () => Picker.open({ mode: 'shop', title: 'Agregar a Mi Lista' });
  Actions.shopToggle = el => {
    const e = Store.state.shop.sel[el.dataset.key];
    if (!e) return;
    if (!e.done && Store.state.shop.mode) { Actions.shopPrice(el); return; }
    e.done = !e.done; e.t = Store.now();
    if (!e.done) { e.price = null; delete e.disc; delete e.orig; }
    Store.log('shop', `${e.done ? 'marcó como comprado' : 'desmarcó'} ${Catalog.label(e.c, e.i, e.v)}`);
    Store.commit(); UI.haptic(e.done ? [8, 30, 8] : 6);
  };

  function editSheet() {
    const e = Store.state.shop.sel[editKey];
    if (!e) return '';
    const it = Catalog.item(e.c, e.i);
    const vars = Catalog.variants(e.c, e.i);
    const units = Units.list.filter(u => Units.base(it, 1, u).grp === Units.base(it, 1, it.u).grp || u === 'un');
    return `
      ${vars.length ? `<label class="lbl">Variante</label><div class="chips wrap">${vars.map(v => `<button class="chip ${v.id === e.v ? 'on' : ''}" data-act="shopSetVar" data-val="${v.id}">${esc(v.name)}</button>`).join('')}</div>` : ''}
      <label class="lbl">Cantidad</label>
      <div class="qty-row">
        <button class="icon-btn lg" data-act="shopStep" data-d="-1">${ico('minus')}</button>
        <input class="qty-in" type="number" inputmode="decimal" step="any" value="${e.q}" data-change="shopSetQty">
        <button class="icon-btn lg" data-act="shopStep" data-d="1">${ico('plus')}</button>
      </div>
      ${UI.chips(units, e.u, 'shopSetUnit')}
      <label class="lbl">Nota</label>
      <input value="${esc(e.note || '')}" placeholder="Marca preferida, tamaño…" data-change="shopSetNote">
      ${(e.src || []).length ? `<p class="hint">${ico('info')} Origen: ${esc(srcText(e))}</p>` : ''}
      <div class="btn-col">
        <button class="btn primary block" data-act="shopPrice" data-key="${esc(editKey)}">${ico('tag')} Marcar comprado con precio</button>
        <button class="btn danger ghost block" data-act="shopDelete">${ico('trash')} Quitar de la lista</button>
      </div>`;
  }
  Actions.shopEdit = el => {
    editKey = el.dataset.key;
    const e = Store.state.shop.sel[editKey];
    UI.open(`${Catalog.item(e.c, e.i).emoji} ${esc(Catalog.item(e.c, e.i).name)}`, editSheet);
  };
  function ed() { const e = Store.state.shop.sel[editKey]; e.t = Store.now(); return e; }
  Actions.shopStep = el => { const e = ed(); e.q = Math.max(0, Math.round((e.q + (e.u === 'un' ? 1 : Units.step(e.u)) * (+el.dataset.d)) * 100) / 100); Store.commit(); UI.refresh(); };
  Actions.shopSetQty = el => { const e = ed(); e.q = Math.max(0, parseFloat(el.value) || 0); Store.commit(); };
  Actions.shopSetUnit = el => { const e = ed(); const cv = Units.convert(Catalog.item(e.c, e.i), e.q, e.u, el.dataset.val); e.u = el.dataset.val; e.q = cv != null ? Math.round(cv * 100) / 100 : 1; Store.commit(); UI.refresh(); };
  Actions.shopSetNote = el => { const e = ed(); e.note = el.value.trim(); Store.commit(); };
  Actions.shopSetVar = el => {
    const e = Store.state.shop.sel[editKey];
    const nk = Shop.key(e.c, e.i, el.dataset.val);
    if (nk === editKey) return;
    Shop.remove(editKey);
    Store.state.shop.sel[nk] = { ...e, v: el.dataset.val, t: Store.now() };
    delete Store.state.tomb['s:' + nk];
    editKey = nk; Store.commit(); UI.refresh();
  };
  Actions.shopDelete = el => UI.confirmTap(el, () => {
    const e = Store.state.shop.sel[editKey];
    Store.log('shop', `quitó ${Catalog.label(e.c, e.i, e.v)} de la lista`);
    Shop.remove(editKey); Store.commit(); UI.closeAll();
  });

  /* ---------- Precio real + descuentos + precio por kilo ---------- */
  const DISCOUNTS = [['', 'Sin desc.'], ['p10', '−10%'], ['p20', '−20%'], ['p30', '−30%'], ['p50', '−50%'], ['2x1', '2×1'], ['3x2', '3×2'], ['4x3', '4×3'], ['2do50', '2º al 50%']];
  function applyDisc(base, q, d) {
    if (!d) return base;
    if (d[0] === 'p') return base * (1 - (+d.slice(1)) / 100);
    const n = Math.max(1, Math.round(q));
    const unit = base / n;
    if (d === '2x1') return unit * (n - Math.floor(n / 2));
    if (d === '3x2') return unit * (n - Math.floor(n / 3));
    if (d === '4x3') return unit * (n - Math.floor(n / 4));
    if (d === '2do50') return unit * (n - Math.floor(n / 2) * 0.5);
    return base;
  }
  function pfCalc() {
    const base = pf.mode === 'cu' ? pf.price * (pf.q || 1) : pf.price;
    const final = Math.round(applyDisc(base || 0, pf.q, pf.disc));
    // precio por kg / L
    let per = '';
    const it = Catalog.item(pf.c, pf.i);
    let content = null;
    if (pf.size > 0) content = Units.base(null, pf.size * (pf.q || 1), pf.sizeU);
    else if (pf.u !== 'un') content = Units.base(it, pf.q, pf.u);
    else if (it.size) content = Units.base(it, pf.q, 'un');
    if (content && content.v > 0 && final > 0) {
      if (content.grp === 'm') per = `${Money.fmt(final / content.v * 1000)} / kg`;
      else if (content.grp === 'v') per = `${Money.fmt(final / content.v * 1000)} / L`;
    } else if (pf.u === 'un' && pf.q > 0 && final > 0) per = `${Money.fmt(final / pf.q)} c/u`;
    return { base, final, per };
  }
  function priceSheet() {
    const e = Store.state.shop.sel[pf.key];
    if (!e) return '';
    const r = pfCalc();
    return `
      <p class="sub center">${esc(Catalog.label(e.c, e.i, e.v))} · ${Units.fmt(pf.q, pf.u)}</p>
      <div class="seg-row">
        <button class="seg ${pf.mode === 'tot' ? 'on' : ''}" data-act="pfMode" data-val="tot">Precio total</button>
        <button class="seg ${pf.mode === 'cu' ? 'on' : ''}" data-act="pfMode" data-val="cu">Precio c/u × ${Units.num(pf.q)}</button>
      </div>
      <div class="money-in"><span>$</span><input id="pfPrice" type="number" inputmode="numeric" min="0" step="any" placeholder="0" value="${pf.price || ''}" data-input="pfPrice" autofocus></div>
      <label class="lbl">Cantidad comprada</label>
      <div class="qty-row">
        <button class="icon-btn" data-act="pfStep" data-d="-1">${ico('minus')}</button>
        <input class="qty-in" type="number" inputmode="decimal" step="any" value="${pf.q}" data-input="pfQty">
        <span class="unit">${pf.u}</span>
        <button class="icon-btn" data-act="pfStep" data-d="1">${ico('plus')}</button>
      </div>
      <label class="lbl">${ico('percent')} Oferta / descuento</label>
      ${UI.chips(DISCOUNTS, pf.disc, 'pfDisc')}
      <label class="lbl">${ico('scale')} Contenido por envase (para precio por kilo/litro)</label>
      <div class="grid2 tight">
        <input type="number" inputmode="decimal" min="0" step="any" placeholder="${pf.u === 'un' ? 'ej: 400' : 'opcional'}" value="${pf.size || ''}" data-input="pfSize">
        <select data-change="pfSizeU">${['g', 'kg', 'ml', 'L'].map(u => `<option ${u === pf.sizeU ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>
      <div class="price-result" id="pfRes">${pfResHtml(r)}</div>
      <div class="btn-col">
        <button class="btn primary block lg" data-act="pfSave">${ico('cart')} Al carro</button>
        <button class="btn ghost block" data-act="pfNoPrice">${ico('check')} Al carro sin precio</button>
        ${e.done ? `<button class="btn danger ghost block" data-act="pfUndo">${ico('x')} Sacar del carro</button>` : ''}
      </div>`;
  }
  function pfResHtml(r) {
    const b = +Store.state.household.shopBudget || 0;
    const prevPrice = (Store.state.shop.sel[pf.key] || {}).done ? +(Store.state.shop.sel[pf.key].price || 0) : 0;
    const after = Shop.cartTotal() - prevPrice + r.final;
    return `<div><small>Total línea</small><b>${Money.fmt(r.final)}</b>${r.final !== Math.round(r.base) && r.base ? `<s>${Money.fmt(r.base)}</s>` : ''}</div>
      <div><small>Valor útil</small><b>${r.per || '—'}</b></div>
      <div><small>Carro quedaría</small><b class="${b && after > b ? 'bad' : ''}">${Money.fmt(after)}</b></div>`;
  }
  function pfUpdate() { const r = $('#pfRes'); if (r) r.innerHTML = pfResHtml(pfCalc()); }

  Actions.shopPrice = (el, ev) => {
    if (ev && ev.target && ev.target.closest('[data-act="shopToggle"]') && el.dataset.act !== 'shopToggle') return;
    const key = el.dataset.key;
    const e = Store.state.shop.sel[key];
    if (!e) return;
    pf = { key, c: e.c, i: e.i, q: e.q, u: e.u, price: e.done ? (e.orig || e.price || 0) : (e.lastPrice || 0), mode: 'tot', disc: e.disc || '', size: e.size || 0, sizeU: e.sizeU || 'g' };
    const title = `${Catalog.item(e.c, e.i).emoji} ¿Cuánto costó?`;
    if (UI.isOpen()) UI.replace(title, priceSheet); else UI.open(title, priceSheet);
  };
  Actions.pfMode = el => { pf.mode = el.dataset.val; UI.refresh(); };
  Actions.pfPrice = el => { pf.price = parseFloat(el.value) || 0; pfUpdate(); };
  Actions.pfQty = el => { pf.q = parseFloat(el.value) || 0; pfUpdate(); };
  Actions.pfStep = el => { pf.q = Math.max(0, Math.round((pf.q + (pf.u === 'un' ? 1 : Units.step(pf.u)) * (+el.dataset.d)) * 100) / 100); pf.price = parseFloat($('#pfPrice').value) || 0; UI.refresh(); };
  Actions.pfDisc = el => { pf.disc = el.dataset.val; pf.price = parseFloat($('#pfPrice').value) || 0; UI.refresh(); };
  Actions.pfSize = el => { pf.size = parseFloat(el.value) || 0; pfUpdate(); };
  Actions.pfSizeU = el => { pf.sizeU = el.value; pfUpdate(); };
  function markDone(withPrice) {
    const e = Store.state.shop.sel[pf.key];
    const r = pfCalc();
    e.q = pf.q; e.done = true; e.t = Store.now();
    if (withPrice && r.final > 0) {
      e.price = r.final; e.lastPrice = pf.price;
      if (pf.disc) { e.disc = pf.disc; e.orig = Math.round(r.base); } else { delete e.disc; delete e.orig; }
      e.size = pf.size || 0; e.sizeU = pf.sizeU; e.per = r.per;
    } else { e.price = null; }
    Store.log('shop', `echó al carro ${Catalog.label(e.c, e.i, e.v)}${e.price ? ' (' + Money.fmt(e.price) + ')' : ''}`);
    Store.commit(); UI.closeAll(); UI.haptic([8, 30, 8]);
    const b = +Store.state.household.shopBudget || 0, cart = Shop.cartTotal();
    if (b && cart > b) UI.toast(`Carro ${Money.fmt(cart)}: te pasaste del presupuesto`, { type: 'err' });
  }
  Actions.pfSave = () => {
    pf.price = parseFloat($('#pfPrice').value) || 0;
    if (!pf.price) { UI.toast('Ingresa el precio o usa "sin precio"', { type: 'err' }); return; }
    markDone(true);
  };
  Actions.pfNoPrice = () => markDone(false);
  Actions.pfUndo = () => {
    const e = Store.state.shop.sel[pf.key];
    e.done = false; e.price = null; delete e.disc; delete e.orig; e.t = Store.now();
    Store.commit(); UI.closeAll();
  };

  /* ---------- Cerrar compra ---------- */
  Actions.shopClose = () => {
    const done = Shop.entries().filter(e => e.done);
    if (!done.length) return;
    const total = Shop.cartTotal();
    const noPrice = done.filter(e => e.price == null).length;
    UI.open('Cerrar compra', () => `
      <div class="big-total"><small>Total del carro</small><b>${Money.fmt(total)}</b>${noPrice ? `<span class="hint">${noPrice} sin precio</span>` : ''}</div>
      <div class="list compact">${done.map(e => `<div class="row"><span class="em">${Catalog.item(e.c, e.i).emoji}</span><span class="grow">${esc(Catalog.label(e.c, e.i, e.v))}<small>${Units.fmt(e.q, e.u)}</small></span><b>${e.price != null ? Money.fmt(e.price) : '—'}</b></div>`).join('')}</div>
      <p class="hint">${ico('pantry')} Los ${done.length} productos pasarán a la Despensa y se creará un borrador de gasto en Finanzas.</p>
      <button class="btn primary block lg" data-act="shopCloseGo">${ico('check')} Cerrar y registrar gasto</button>
      <button class="btn ghost block" data-act="shopCloseNoExp">Solo pasar a la despensa</button>`);
  };
  function doClose(withExpense) {
    const r = Shop.close();
    Store.log('shop', `cerró la compra: ${r.items.length} productos a la despensa${r.total ? ' por ' + Money.fmt(r.total) : ''}`);
    let exp = null;
    if (withExpense) {
      exp = {
        id: Store.uid('exp_'), amount: r.total, cat: 'Supermercado', desc: 'Compra supermercado', date: Money.today(),
        payer: Store.me() || Store.state.household.members[0] || '', among: Store.state.household.members.slice(),
        method: 'Débito', docType: 'Boleta', docNum: '', photos: [], notes: '', items: r.items, draft: true,
        created: Store.now(), t: Store.now(),
      };
      Store.state.expenses.unshift(exp);
    }
    Store.state.shop.mode = false;
    Store.commit();
    UI.closeAll();
    UI.toast(`${r.items.length} productos guardados en la despensa`, { icon: 'pantry' });
    if (exp) setTimeout(() => { App.go('money'); MoneyView.edit(exp.id); }, 350);
  }
  Actions.shopCloseGo = () => doClose(true);
  Actions.shopCloseNoExp = () => doClose(false);
  Actions.shopClearDone = el => UI.confirmTap(el, () => {
    Shop.entries().filter(e => e.done).forEach(e => Shop.remove(e.key));
    Store.commit();
  }, 'Borrar comprados');

  /* ---------- Desde despensa ---------- */
  Actions.shopFromPantry = () => {
    UI.open('Agregar desde la despensa', () => {
      const list = Pantry.entries().sort((a, b) => (Pantry.isLow(b) || Pantry.isEmpty(b)) - (Pantry.isLow(a) || Pantry.isEmpty(a)));
      if (!list.length) return UI.empty('pantry', 'Despensa vacía', 'Aún no hay productos en casa.');
      return `<p class="hint">Primero lo que se acabó o está bajo el mínimo.</p><div class="list">${list.map(e => {
        const it = Catalog.item(e.c, e.i);
        const on = Shop.onList(e.c, e.i, e.v, it.u) > 0;
        return `<button class="row" data-act="shopFromPantryAdd" data-key="${esc(e.key)}" ${on ? 'disabled' : ''}>
          <span class="em">${it.emoji}</span><span class="grow"><b>${esc(Catalog.label(e.c, e.i, e.v))}</b><small>Hay ${Units.fmtA(e.a)}${Pantry.isLow(e) ? ' · bajo mínimo' : ''}</small></span>
          ${on ? `<span class="pill ok">${ico('check')} en lista</span>` : ico('plus', 'muted')}</button>`;
      }).join('')}</div>`;
    });
  };
  Actions.shopFromPantryAdd = el => {
    const e = Pantry.get(el.dataset.key); const it = Catalog.item(e.c, e.i);
    Shop.add(e.c, e.i, e.v, Math.max(e.minStock || 0, it.u === 'un' ? 1 : Units.step(it.u)), it.u, '· reponer');
    Store.log('shop', `agregó ${Catalog.label(e.c, e.i, e.v)} a la lista`);
    Store.commit(); UI.refresh(); UI.haptic(6);
  };

  /* ---------- Desde menú ---------- */
  Actions.shopFromMenu = () => {
    UI.open('Faltantes del menú', () => {
      const today = Money.today();
      const evs = Store.state.menu.filter(m => !m.del && !m.cooked && m.recipeId && m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
      if (!evs.length) return UI.empty('menu', 'Sin comidas planificadas', 'Agenda recetas en el Menú y aquí podrás enviar solo lo que falta.', `<button class="btn primary" data-act="goTab" data-val="menu">${ico('menu')} Ir al Menú</button>`);
      return `<button class="btn primary block" data-act="shopMenuAll">${ico('send')} Enviar faltantes de todo (${evs.length})</button>
        <div class="list">${evs.map(m => { const r = Recipes.get(m.recipeId); return `<div class="row"><span class="em">${r ? r.emoji : '🍽️'}</span>
          <span class="grow"><b>${esc(m.title)}</b><small>${UI.fmtDate(m.date)} · ${esc(m.type)} · ${m.people} pers.</small></span>
          <button class="btn sm ghost" data-act="shopMenuOne" data-id="${m.id}">${ico('send')}</button></div>`; }).join('')}</div>`;
    });
  };
  Actions.shopMenuOne = el => { const r = MenuView.sendMissing(el.dataset.id); UI.toast(r.added.length ? `${r.added.length} faltantes a la lista` : 'Tienes todo en la despensa', { icon: 'cart' }); };
  Actions.shopMenuAll = () => {
    const today = Money.today(); let n = 0;
    Store.state.menu.filter(m => !m.del && !m.cooked && m.recipeId && m.date >= today).forEach(m => { n += MenuView.sendMissing(m.id, true).added.length; });
    Store.commit(); UI.closeAll(); UI.toast(n ? `${n} faltantes agregados` : 'Tienes todo lo necesario', { icon: 'cart' });
  };

  /* ---------- Comparador de valor útil ---------- */
  let cmp = [{ n: 'A', p: '', s: '', u: 'g' }, { n: 'B', p: '', s: '', u: 'g' }];
  function cmpCalc() {
    return cmp.map(o => {
      const b = Units.base(null, parseFloat(o.s) || 0, o.u);
      const p = parseFloat(o.p) || 0;
      const per = b.v > 0 && p > 0 ? p / b.v * (b.grp === 'c' ? 1 : 1000) : null;
      return { ...o, per, grp: b.grp };
    });
  }
  function cmpRes() {
    const r = cmpCalc().filter(x => x.per);
    if (r.length < 2) return '<p class="hint">Ingresa precio y contenido de al menos dos opciones.</p>';
    const best = r.reduce((a, b) => (a.per <= b.per ? a : b));
    const worst = r.reduce((a, b) => (a.per >= b.per ? a : b));
    const lab = best.grp === 'm' ? '/ kg' : best.grp === 'v' ? '/ L' : 'c/u';
    const save = Math.round((1 - best.per / worst.per) * 100);
    return r.map(x => `<div class="cmp-res ${x === best ? 'best' : ''}"><b>${esc(x.n)}</b><span>${Money.fmt(x.per)} ${lab}</span>${x === best ? `<em>${ico('check')} conviene</em>` : `<small>+${Math.round((x.per / best.per - 1) * 100)}%</small>`}</div>`).join('') +
      (save > 0 ? `<p class="hint center">Ahorras ${save}% eligiendo <b>${esc(best.n)}</b></p>` : '');
  }
  Actions.shopCompare = () => {
    UI.open('Comparador de precio', () => `
      <p class="hint">¿El formato grande conviene? Compara el precio por kilo, litro o unidad.</p>
      ${cmp.map((o, k) => `<div class="cmp-row">
        <input value="${esc(o.n)}" data-input="cmpSet" data-k="${k}" data-f="n" class="cmp-n">
        <div class="money-in sm"><span>$</span><input type="number" inputmode="numeric" placeholder="Precio" value="${o.p}" data-input="cmpSet" data-k="${k}" data-f="p"></div>
        <input type="number" inputmode="decimal" placeholder="Cont." value="${o.s}" data-input="cmpSet" data-k="${k}" data-f="s">
        <select data-change="cmpSet" data-k="${k}" data-f="u">${['g', 'kg', 'ml', 'L', 'un'].map(u => `<option ${u === o.u ? 'selected' : ''}>${u}</option>`).join('')}</select>
      </div>`).join('')}
      <div class="btn-row"><button class="btn ghost sm" data-act="cmpAdd">${ico('plus')} Opción</button><button class="btn ghost sm" data-act="cmpReset">${ico('x')} Limpiar</button></div>
      <div id="cmpRes">${cmpRes()}</div>`);
  };
  Actions.cmpSet = el => { cmp[+el.dataset.k][el.dataset.f] = el.value; const r = $('#cmpRes'); if (r) r.innerHTML = cmpRes(); };
  Actions.cmpAdd = () => { cmp.push({ n: String.fromCharCode(65 + cmp.length), p: '', s: '', u: cmp[0].u }); UI.refresh(); };
  Actions.cmpReset = () => { cmp = [{ n: 'A', p: '', s: '', u: 'g' }, { n: 'B', p: '', s: '', u: 'g' }]; UI.refresh(); };

  /* ---------- Compartir lista ---------- */
  function listText() {
    const pend = Shop.pending();
    const g = {};
    pend.forEach(e => { (g[e.c] = g[e.c] || []).push(e); });
    const lines = [`🛒 ${Store.state.household.name} — Mi Lista`, ''];
    Object.keys(g).forEach(c => {
      lines.push(`*${Catalog.cat(c).emoji} ${Catalog.cat(c).name}*`);
      g[c].forEach(e => lines.push(`☐ ${Catalog.label(e.c, e.i, e.v)} — ${Units.fmt(e.q, e.u)}${e.note ? ' (' + e.note + ')' : ''}`));
      lines.push('');
    });
    if (!pend.length) lines.push('(lista vacía)');
    return lines.join('\n');
  }
  Actions.shopShare = () => {
    UI.open('Compartir lista', () => `<pre class="preview">${esc(listText())}</pre>
      <div class="grid2"><button class="btn primary" data-act="shopShareWA">${ico('whatsapp')} WhatsApp</button><button class="btn ghost" data-act="shopShareCopy">${ico('copy')} Copiar</button></div>`);
  };
  Actions.shopShareWA = () => UI.whatsapp(listText());
  Actions.shopShareCopy = () => UI.copy(listText());

  return { render };
})();
