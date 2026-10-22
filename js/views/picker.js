/* despensAPP · Selector de catálogo (compartido por Despensa y Lista) */
const Picker = (() => {
  let cfg = null;               // { mode: 'pantry'|'shop', title, onPick }
  let st = { q: '', cat: null };
  let cur = null;               // ítem en edición: {c,i,v,q,u,exp,minStock}

  function open(opts) {
    cfg = opts; st = { q: '', cat: null };
    UI.open(opts.title || 'Agregar producto', render, after, { tall: true });
  }

  function render() {
    return `<div class="search-box sticky">${ico('search')}<input id="pickQ" type="search" placeholder="Buscar en ${countItems()} productos…" value="${esc(st.q)}" data-input="pickSearch" autocomplete="off" autofocus></div>
      <div id="pickRes">${results()}</div>`;
  }
  function after(b) { /* nada extra */ }
  function countItems() { return Catalog.cats().reduce((s, c) => s + c.items.length, 0); }

  function results() {
    if (st.q.trim()) {
      const r = Catalog.search(st.q);
      return (r.length ? `<div class="list">${r.map(x => itemRow(x.c, x.item, x.vhit)).join('')}</div>` : UI.empty('search', 'Sin resultados', `No encontramos "${esc(st.q)}".`)) +
        `<button class="btn ghost block" data-act="pickCustom" data-name="${esc(st.q)}">${ico('plus')} Crear producto "${esc(st.q)}"</button>`;
    }
    if (st.cat) {
      const ct = Catalog.cats().find(c => c.id === st.cat);
      return `<button class="btn ghost sm" data-act="pickCat" data-val="">${ico('chevL')} Categorías</button>
        <h4 class="sec-title">${ct.emoji} ${esc(ct.name)}</h4>
        <div class="list">${ct.items.map(it => itemRow(ct.id, it)).join('')}</div>
        <button class="btn ghost block" data-act="pickCustom" data-cat="${ct.id}">${ico('plus')} Producto personalizado</button>`;
    }
    return `<div class="cat-grid">${Catalog.cats().map(c => `<button class="cat-tile" data-act="pickCat" data-val="${c.id}"><span class="em">${c.emoji}</span><span>${esc(c.name)}</span><small>${c.items.length}</small></button>`).join('')}</div>
      <button class="btn ghost block" data-act="pickCustom">${ico('plus')} Producto personalizado</button>`;
  }

  function itemRow(c, it, vhit) {
    const k = cfg && cfg.mode === 'shop' ? Shop.entries().filter(e => e.c === c && e.i === it.id && !e.done).length : Pantry.entries().filter(e => e.c === c && e.i === it.id).length;
    const sub = vhit && vhit.length ? vhit.map(v => v.name).join(' · ') : Catalog.variants(c, it.id).slice(0, 4).map(v => v.name).join(' · ');
    return `<button class="row" data-act="pickItem" data-c="${c}" data-i="${it.id}" ${vhit && vhit.length === 1 ? `data-v="${vhit[0].id}"` : ''}>
      <span class="em">${it.emoji}</span>
      <span class="grow"><b>${esc(it.name)}</b><small>${esc(sub)}</small></span>
      ${k ? `<span class="badge">${k}</span>` : ''}${ico('plus', 'muted')}</button>`;
  }

  /* ---- Detalle: variante + cantidad ---- */
  function openItem(c, i, v) {
    const it = Catalog.item(c, i);
    const vars = Catalog.variants(c, i);
    const isShop = cfg.mode === 'shop';
    const ex = isShop ? null : Pantry.get(Pantry.key(c, i, v || (vars[0] && vars[0].id) || ''));
    cur = { c, i, v: v || (vars[0] ? vars[0].id : ''), q: it.u === 'kg' || it.u === 'L' ? 1 : it.u === 'g' || it.u === 'ml' ? (it.u === 'g' ? 500 : 1000) : 1, u: it.u, exp: '', minStock: ex ? ex.minStock || 0 : 0 };
    UI.open(`${it.emoji} ${esc(it.name)}`, renderItem, null);
  }

  function renderItem() {
    const it = Catalog.item(cur.c, cur.i);
    const vars = Catalog.variants(cur.c, cur.i);
    const conf = Diet.conflicts(cur.c, cur.i, cur.v);
    const cau = Diet.cautions(cur.c, cur.i, cur.v);
    const isShop = cfg.mode === 'shop';
    const have = Pantry.have(cur.c, cur.i, cur.v, cur.u, false);
    const units = Units.list.filter(u => Units.base(it, 1, u).grp === Units.base(it, 1, it.u).grp || u === 'un' || u === it.u);
    return `
      ${vars.length ? `<label class="lbl">Variante</label>
      <div class="chips wrap">${vars.map(x => `<button class="chip ${x.id === cur.v ? 'on' : ''}" data-act="pickVar" data-val="${x.id}">${esc(x.name)}</button>`).join('')}
        <button class="chip add" data-act="pickNewVar">${ico('plus')} Variante</button></div>` :
      `<button class="chip add" data-act="pickNewVar">${ico('plus')} Agregar variante</button>`}
      ${cur.addingVar ? `<div class="inline-add"><input id="newVar" placeholder="Marca, formato, sabor…"><button class="btn primary sm" data-act="pickNewVarSave">${ico('check')}</button></div>` : ''}
      ${conf.length ? `<div class="warn">${ico('alert')} ${esc(Diet.warnText(conf))}</div>` : ''}
      ${cau.length ? `<div class="caution">${ico('info')} ${esc(Diet.cautionText(cau))}</div>` : ''}
      <label class="lbl">Cantidad</label>
      <div class="qty-row">
        <button class="icon-btn lg" data-act="pickStep" data-d="-1">${ico('minus')}</button>
        <input id="pickQty" class="qty-in" type="number" inputmode="decimal" step="any" min="0" value="${cur.q}" data-input="pickQtyIn">
        <button class="icon-btn lg" data-act="pickStep" data-d="1">${ico('plus')}</button>
      </div>
      ${UI.chips(units, cur.u, 'pickUnit')}
      ${isShop || cfg.mode === 'recipe' ? '' : `
        <div class="grid2">
          <div><label class="lbl">Vence (opcional)</label><input type="date" id="pickExp" value="${cur.exp}"></div>
          <div><label class="lbl">Stock mínimo (${it.u})</label><input type="number" inputmode="decimal" id="pickMin" min="0" step="any" value="${cur.minStock || ''}" placeholder="0"></div>
        </div>`}
      ${have.q > 0 ? `<p class="hint">${ico('pantry')} En despensa: ${Units.fmtA((Pantry.get(Pantry.key(cur.c, cur.i, cur.v)) || {}).a)}</p>` : ''}
      <button class="btn primary block lg" data-act="pickAdd">${ico(isShop ? 'cart' : cfg.mode === 'recipe' ? 'check' : 'pantry')} ${isShop ? 'Agregar a Mi Lista' : cfg.mode === 'recipe' ? 'Usar en la receta' : 'Guardar en Despensa'}</button>`;
  }

  function readCur() {
    const q = parseFloat(($('#pickQty') || {}).value);
    if (!isNaN(q)) cur.q = q;
    const e = $('#pickExp'); if (e) cur.exp = e.value;
    const m = $('#pickMin'); if (m) cur.minStock = parseFloat(m.value) || 0;
  }

  Actions.pickSearch = el => { st.q = el.value; $('#pickRes').innerHTML = results(); };
  Actions.pickCat = el => { st.cat = el.dataset.val || null; $('#pickRes').innerHTML = results(); $('#sheetBody .sheet-content').scrollTop = 0; };
  Actions.pickItem = el => openItem(el.dataset.c, el.dataset.i, el.dataset.v);
  Actions.pickVar = el => { readCur(); cur.v = el.dataset.val; UI.refresh(); };
  Actions.pickUnit = el => {
    readCur();
    const it = Catalog.item(cur.c, cur.i);
    const cv = Units.convert(it, cur.q, cur.u, el.dataset.val);
    cur.u = el.dataset.val;
    cur.q = cv != null ? Math.round(cv * 100) / 100 : (cur.u === 'un' ? 1 : Units.step(cur.u));
    UI.refresh();
  };
  Actions.pickQtyIn = el => { const q = parseFloat(el.value); if (!isNaN(q)) cur.q = q; };
  Actions.pickStep = el => {
    readCur();
    const s = Units.step(cur.u) * (+el.dataset.d);
    cur.q = Math.max(0, Math.round((cur.q + s) * 100) / 100);
    $('#pickQty').value = cur.q; UI.haptic(4);
  };
  Actions.pickNewVar = () => { readCur(); cur.addingVar = true; UI.refresh(); setTimeout(() => { const x = $('#newVar'); x && x.focus(); }, 50); };
  Actions.pickNewVarSave = () => {
    const name = ($('#newVar') || {}).value || '';
    if (!name.trim()) { cur.addingVar = false; UI.refresh(); return; }
    const k = cur.c + '|' + cur.i;
    const ev = Store.state.shop.extraVar;
    ev[k] = [...new Set([...(ev[k] || []), name.trim()])];
    cur.v = Catalog.slug(name.trim());
    cur.addingVar = false;
    Store.log('catalog', `agregó la variante "${name.trim()}" a ${Catalog.item(cur.c, cur.i).name}`);
    Store.commit();
    UI.refresh();
  };
  Actions.pickAdd = () => {
    readCur();
    if (!(cur.q > 0)) { UI.toast('Ingresa una cantidad', { type: 'err' }); return; }
    const label = Catalog.label(cur.c, cur.i, cur.v);
    if (cfg.mode === 'recipe') {
      UI.close(); UI.close();
      cfg.onPick({ ...cur });
      return;
    }
    if (cfg.mode === 'shop') {
      Shop.add(cur.c, cur.i, cur.v, cur.q, cur.u, cfg.src || '');
      Store.log('shop', `agregó ${Units.fmt(cur.q, cur.u)} de ${label} a la lista`);
    } else {
      Pantry.add(cur.c, cur.i, cur.v, cur.q, cur.u, { exp: cur.exp, minStock: cur.minStock });
      Store.log('pantry', `agregó ${Units.fmt(cur.q, cur.u)} de ${label} a la despensa`);
    }
    Store.commit();
    UI.toast(`${Catalog.item(cur.c, cur.i).emoji} ${esc(label)} agregado`);
    UI.close();
    if (cfg.onPick) cfg.onPick(cur);
    const r = $('#pickRes'); if (r) r.innerHTML = results();
  };

  /* ---- Producto personalizado ---- */
  let cust = null;
  Actions.pickCustom = el => {
    cust = { name: el.dataset.name || '', emoji: '📦', cat: el.dataset.cat || st.cat || 'fruver', u: 'un' };
    UI.open('Producto personalizado', () => `
      <label class="lbl">Nombre</label><input id="cuName" value="${esc(cust.name)}" placeholder="Ej: Salsa de ají casera" autofocus>
      <div class="grid2">
        <div><label class="lbl">Emoji</label><input id="cuEmoji" value="${esc(cust.emoji)}" maxlength="4" class="center big"></div>
        <div><label class="lbl">Unidad</label><select id="cuUnit">${Units.list.map(u => `<option ${u === cust.u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      </div>
      <label class="lbl">Categoría</label>
      <select id="cuCat">${Catalog.cats().map(c => `<option value="${c.id}" ${c.id === cust.cat ? 'selected' : ''}>${c.emoji} ${esc(c.name)}</option>`).join('')}</select>
      <label class="lbl">Contiene (para avisos de dieta)</label>
      <div class="chips wrap">${Object.entries(TAG_NAMES).map(([k, n]) => `<label class="chip check"><input type="checkbox" value="${k}" class="cuTag"> ${n}</label>`).join('')}</div>
      <button class="btn primary block lg" data-act="pickCustomSave">${ico('check')} Crear producto</button>`);
  };
  Actions.pickCustomSave = () => {
    const name = $('#cuName').value.trim();
    if (!name) { UI.toast('Ponle un nombre', { type: 'err' }); return; }
    const c = $('#cuCat').value, id = 'x-' + Catalog.slug(name);
    Store.state.shop.custom[c + '|' + id] = {
      name, emoji: $('#cuEmoji').value.trim() || '📦', u: $('#cuUnit').value,
      tags: $$('.cuTag').filter(x => x.checked).map(x => x.value), t: Store.now(),
    };
    Store.log('catalog', `creó el producto ${name}`);
    Store.commit();
    UI.close();
    openItem(c, id, '');
  };

  return { open };
})();
