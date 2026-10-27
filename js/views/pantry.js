/* despensAPP · Vista Despensa */
const PantryView = (() => {
  const f = { q: '', filter: 'all' };
  let editKey = null;

  function expBadge(e) {
    const s = Pantry.expState(e);
    if (s === 'none') return '';
    const d = Pantry.daysTo(e.exp);
    const txt = d < 0 ? `vencido hace ${-d} d` : d === 0 ? 'vence hoy' : d === 1 ? 'vence mañana' : `vence en ${d} d`;
    return `<span class="sem ${s}"><i></i>${txt}</span>`;
  }

  function filtered() {
    let list = Pantry.entries();
    const q = Catalog.slug(f.q).replace(/-/g, ' ');
    if (q) list = list.filter(e => Catalog.slug(Catalog.label(e.c, e.i, e.v)).replace(/-/g, ' ').includes(q));
    if (f.filter === 'exp') list = list.filter(e => ['bad', 'warn'].includes(Pantry.expState(e)));
    else if (f.filter === 'low') list = list.filter(e => Pantry.isLow(e) || Pantry.isEmpty(e));
    else if (f.filter.startsWith('cat:')) list = list.filter(e => e.c === f.filter.slice(4));
    return list;
  }

  function row(e) {
    const it = Catalog.item(e.c, e.i);
    const vv = Catalog.variant(e.c, e.i, e.v);
    const low = Pantry.isLow(e), empty = Pantry.isEmpty(e);
    return `<div class="row card-row ${empty ? 'dim' : ''}" data-act="pantryEdit" data-key="${esc(e.key)}">
      <span class="em">${it.emoji}</span>
      <span class="grow"><b>${esc(it.name)}</b><small>${vv ? esc(vv.name) : ''}</small>
        <span class="meta">${expBadge(e)}${low ? `<span class="pill warn">${ico('alert')} bajo mínimo</span>` : ''}${empty ? '<span class="pill">agotado</span>' : ''}</span></span>
      <span class="amt">${Units.fmtA(e.a)}</span>
      <button class="icon-btn" data-act="pantryQuick" data-key="${esc(e.key)}" aria-label="Consumir">${ico('minus')}</button>
    </div>`;
  }

  function render() {
    const all = Pantry.entries();
    const list = filtered();
    const exp = Pantry.expiring(), low = Pantry.lowList();
    const cats = [...new Set(all.map(e => e.c))];
    const groups = {};
    list.forEach(e => { (groups[e.c] = groups[e.c] || []).push(e); });
    Object.values(groups).forEach(g => g.sort((a, b) => Catalog.label(a.c, a.i, a.v).localeCompare(Catalog.label(b.c, b.i, b.v))));

    return `
    <section class="hero-mini">
      <div class="stat"><b>${all.length}</b><span>productos</span></div>
      <div class="stat ${exp.length ? 'warn' : ''}"><b>${exp.length}</b><span>por vencer</span></div>
      <div class="stat ${low.length ? 'bad' : ''}"><b>${low.length}</b><span>bajo mínimo</span></div>
    </section>
    ${low.length ? `<div class="card suggest">
        <div class="row-h">${ico('sparkles')}<div class="grow"><b>Sugerencia</b><small>${low.slice(0, 4).map(e => esc(Catalog.item(e.c, e.i).name)).join(', ')}${low.length > 4 ? '…' : ''} ${low.length === 1 ? 'está' : 'están'} bajo el mínimo</small></div></div>
        <button class="btn primary sm" data-act="pantryLowToList">${ico('cart')} Agregar ${low.length} a Mi Lista</button>
      </div>` : ''}
    <div class="toolbar">
      <div class="search-box">${ico('search')}<input type="search" placeholder="Buscar en la despensa" value="${esc(f.q)}" data-input="pantrySearch"></div>
      ${AI.ready() ? `<button class="icon-btn ai" data-act="aiPantryMenu" aria-label="Agregar con IA">${ico('sparkles')}</button>` : ''}
      <button class="icon-btn" data-act="pantryExport" aria-label="Exportar">${ico('share')}</button>
    </div>
    <div class="chips scroll">
      ${[['all', 'Todo'], ['exp', 'Por vencer'], ['low', 'Reponer']].map(([k, l]) => `<button class="chip ${f.filter === k ? 'on' : ''}" data-act="pantryFilter" data-val="${k}">${l}</button>`).join('')}
      ${cats.map(c => { const ct = Catalog.cat(c); return `<button class="chip ${f.filter === 'cat:' + c ? 'on' : ''}" data-act="pantryFilter" data-val="cat:${c}">${ct.emoji} ${esc(ct.name)}</button>`; }).join('')}
    </div>
    <div id="pantryList">
    ${list.length ? Object.keys(groups).sort((a, b) => Catalog.cat(a).name.localeCompare(Catalog.cat(b).name)).map(c => `
      <h4 class="sec-title">${Catalog.cat(c).emoji} ${esc(Catalog.cat(c).name)} <small>${groups[c].length}</small></h4>
      <div class="list">${groups[c].map(row).join('')}</div>`).join('')
      : all.length ? UI.empty('search', 'Nada por aquí', 'Prueba con otro filtro o búsqueda.')
      : UI.empty('pantry', 'Tu despensa está vacía', 'Agrega lo que tienes en casa o cierra una compra para llenarla automáticamente.', `<button class="btn primary" data-act="pantryAdd">${ico('plus')} Agregar productos</button>`)}
    </div>
    <button class="fab" data-act="pantryAdd" aria-label="Agregar">${ico('plus')}</button>`;
  }

  /* ---------- Edición ---------- */
  function editSheet() {
    const e = Pantry.get(editKey);
    if (!e) return UI.empty('box', 'Producto eliminado', '');
    const it = Catalog.item(e.c, e.i);
    const conf = Diet.conflicts(e.c, e.i, e.v);
    const units = Object.keys(e.a || {});
    if (!units.length) units.push(it.u);
    const addable = Units.list.filter(u => !units.includes(u));
    return `
      <p class="sub center">${esc(Catalog.label(e.c, e.i, e.v))}</p>
      ${conf.length ? `<div class="warn">${ico('alert')} ${esc(Diet.warnText(conf))}</div>` : ''}
      <label class="lbl">Cantidades</label>
      ${units.map(u => `<div class="qty-row">
          <button class="icon-btn lg" data-act="pantryStep" data-u="${u}" data-d="-1">${ico('minus')}</button>
          <input class="qty-in" type="number" inputmode="decimal" step="any" min="0" value="${Math.round((e.a[u] || 0) * 1000) / 1000}" data-change="pantrySetQty" data-u="${u}">
          <span class="unit">${u}</span>
          <button class="icon-btn lg" data-act="pantryStep" data-u="${u}" data-d="1">${ico('plus')}</button>
        </div>`).join('')}
      ${addable.length ? `<div class="chips"><span class="hint">Sumar otra unidad:</span>${addable.map(u => `<button class="chip add" data-act="pantryAddUnit" data-u="${u}">+ ${u}</button>`).join('')}</div>` : ''}
      <div class="grid2">
        <div><label class="lbl">Vencimiento</label><input type="date" value="${e.exp || ''}" data-change="pantrySetExp"></div>
        <div><label class="lbl">Stock mínimo (${it.u})</label><input type="number" inputmode="decimal" min="0" step="any" value="${e.minStock || ''}" placeholder="0" data-change="pantrySetMin"></div>
      </div>
      ${e.exp ? `<p class="hint">${expBadge(e)}</p>` : ''}
      <div class="btn-col">
        <button class="btn warn block" data-act="pantryFinished">${ico('cart')} Se acabó → Mandar a la lista</button>
        <button class="btn ghost block" data-act="pantryToList">${ico('plus')} Agregar a la lista (sin vaciar)</button>
        <button class="btn danger ghost block" data-act="pantryDelete">${ico('trash')} Eliminar de la despensa</button>
      </div>`;
  }

  function cur() { return Store.state.pantry.items[editKey]; }

  Actions.pantryAdd = () => Picker.open({ mode: 'pantry', title: 'Agregar a la Despensa' });
  Actions.pantrySearch = el => { f.q = el.value; const box = $('#pantryList'); const tmp = document.createElement('div'); tmp.innerHTML = render(); box.innerHTML = tmp.querySelector('#pantryList').innerHTML; };
  Actions.pantryFilter = el => { f.filter = el.dataset.val; App.render(); };
  Actions.pantryEdit = (el, ev) => {
    if (ev.target.closest('[data-act="pantryQuick"]')) return;
    editKey = el.dataset.key;
    const e = cur();
    UI.open(`${Catalog.item(e.c, e.i).emoji} ${esc(Catalog.item(e.c, e.i).name)}`, editSheet);
  };
  Actions.pantryQuick = el => {
    const key = el.dataset.key;
    const e = Store.state.pantry.items[key];
    if (!e) return;
    const before = JSON.parse(JSON.stringify(e));
    const [u] = Object.keys(e.a).filter(k => e.a[k] > 0);
    if (!u) { UI.toast('Ya está agotado', { icon: 'info' }); return; }
    const step = u === 'un' ? 1 : Units.step(u);
    e.a = { ...e.a, [u]: Math.max(0, Math.round((e.a[u] - Math.min(step, e.a[u])) * 1000) / 1000) };
    e.t = Store.now();
    const label = Catalog.label(e.c, e.i, e.v);
    Store.log('pantry', `consumió ${Units.fmt(Math.min(step, before.a[u]), u)} de ${label}`);
    Store.commit();
    UI.haptic(10);
    const empty = Pantry.isEmpty(e);
    UI.toast(empty ? `${esc(label)} se acabó` : `−${Units.fmt(step, u)} ${esc(label)}`, {
      icon: 'minus',
      action: empty ? { label: 'A la lista', fn: () => { const it = Catalog.item(e.c, e.i); Shop.add(e.c, e.i, e.v, it.u === 'un' ? 1 : Units.step(it.u), it.u, '· se acabó'); Store.log('shop', `mandó ${label} a la lista`); Store.commit(); UI.toast('Agregado a Mi Lista', { icon: 'cart' }); } }
        : { label: 'Deshacer', fn: () => { Store.state.pantry.items[key] = { ...before, t: Store.now() }; Store.commit(); } },
    });
  };
  Actions.pantryStep = el => {
    const e = cur(); const u = el.dataset.u;
    const step = u === 'un' ? 1 : Units.step(u);
    e.a = { ...e.a, [u]: Math.max(0, Math.round(((e.a[u] || 0) + step * (+el.dataset.d)) * 1000) / 1000) };
    e.t = Store.now(); Store.commit(); UI.refresh(); UI.haptic(4);
  };
  Actions.pantrySetQty = el => {
    const e = cur(); const v = parseFloat(el.value);
    e.a = { ...e.a, [el.dataset.u]: isNaN(v) ? 0 : Math.max(0, v) }; e.t = Store.now(); Store.commit();
  };
  Actions.pantryAddUnit = el => { const e = cur(); e.a = { ...e.a, [el.dataset.u]: 0 }; e.t = Store.now(); Store.commit(); UI.refresh(); };
  Actions.pantrySetExp = el => { const e = cur(); e.exp = el.value; e.t = Store.now(); Store.commit(); UI.refresh(); };
  Actions.pantrySetMin = el => { const e = cur(); e.minStock = parseFloat(el.value) || 0; e.t = Store.now(); Store.commit(); };
  Actions.pantryFinished = () => {
    const e = cur(); const it = Catalog.item(e.c, e.i); const label = Catalog.label(e.c, e.i, e.v);
    Shop.add(e.c, e.i, e.v, Math.max(e.minStock || 0, it.u === 'un' ? 1 : Units.step(it.u)), it.u, '· se acabó');
    e.a = Object.fromEntries(Object.keys(e.a).map(u => [u, 0])); e.t = Store.now();
    Store.log('pantry', `marcó ${label} como agotado y lo mandó a la lista`);
    Store.commit(); UI.closeAll(); UI.toast(`${esc(label)} → Mi Lista`, { icon: 'cart' });
  };
  Actions.pantryToList = () => {
    const e = cur(); const it = Catalog.item(e.c, e.i);
    Shop.add(e.c, e.i, e.v, Math.max(e.minStock || 0, it.u === 'un' ? 1 : Units.step(it.u)), it.u, '· reponer');
    Store.log('shop', `agregó ${Catalog.label(e.c, e.i, e.v)} a la lista`);
    Store.commit(); UI.toast('Agregado a Mi Lista', { icon: 'cart' });
  };
  Actions.pantryDelete = el => UI.confirmTap(el, () => {
    const e = cur(); const label = Catalog.label(e.c, e.i, e.v);
    Pantry.remove(editKey); Store.log('pantry', `eliminó ${label} de la despensa`);
    Store.commit(); UI.closeAll(); UI.toast('Eliminado', { icon: 'trash' });
  });
  Actions.pantryLowToList = () => {
    const low = Pantry.lowList();
    low.forEach(e => {
      const it = Catalog.item(e.c, e.i);
      const grp = Units.base(it, 1, it.u).grp;
      const have = Units.fromBase(it, Pantry.total(e, grp), grp, it.u) || 0;
      const miss = Math.max(e.minStock - have, it.u === 'un' ? 1 : 0.0001);
      Shop.add(e.c, e.i, e.v, Units.round(miss, it.u), it.u, '· stock mínimo');
    });
    Store.log('shop', `agregó ${low.length} productos bajo stock a la lista`);
    Store.commit(); UI.toast(`${low.length} productos a Mi Lista`, { icon: 'cart' });
  };

  /* ---------- Exportar ---------- */
  function text(kind) {
    const h = Store.state.household.name;
    let list = Pantry.entries().filter(e => !Pantry.isEmpty(e));
    let title = `🏠 ${h} — Qué nos queda en casa`;
    if (kind === 'exp') { list = Pantry.expiring(); title = `⏰ ${h} — Por vencer`; }
    if (kind === 'low') { list = Pantry.entries().filter(e => Pantry.isLow(e) || Pantry.isEmpty(e)); title = `🛒 ${h} — Faltantes / reponer`; }
    const g = {};
    list.forEach(e => { (g[e.c] = g[e.c] || []).push(e); });
    const lines = [title, UI.fmtDate(Money.today(), { weekday: 'long', day: 'numeric', month: 'long' }), ''];
    Object.keys(g).forEach(c => {
      lines.push(`*${Catalog.cat(c).emoji} ${Catalog.cat(c).name}*`);
      g[c].forEach(e => {
        const d = Pantry.daysTo(e.exp);
        lines.push(`• ${Catalog.label(e.c, e.i, e.v)} — ${Units.fmtA(e.a)}${d != null && d < 5 ? (d < 0 ? ' (vencido)' : ` (vence en ${d} d)`) : ''}`);
      });
      lines.push('');
    });
    if (!list.length) lines.push('(nada que listar)');
    lines.push('— enviado desde despensAPP');
    return lines.join('\n');
  }
  let expKind = 'all';
  Actions.pantryExport = () => {
    UI.open('Compartir despensa', () => `
      ${UI.chips([['all', 'Qué nos queda'], ['exp', 'Por vencer'], ['low', 'Faltantes']], expKind, 'pantryExpKind')}
      <pre class="preview" id="pxText">${esc(text(expKind))}</pre>
      <div class="grid2">
        <button class="btn primary" data-act="pantryShareWA">${ico('whatsapp')} WhatsApp</button>
        <button class="btn ghost" data-act="pantryShareTxt">${ico('share')} Compartir</button>
        <button class="btn ghost" data-act="pantryCopy">${ico('copy')} Copiar</button>
        <button class="btn ghost" data-act="pantryPng">${ico('image')} Imagen PNG</button>
      </div>`);
  };
  Actions.pantryExpKind = el => { expKind = el.dataset.val; UI.refresh(); };
  Actions.pantryShareWA = () => UI.whatsapp(text(expKind));
  Actions.pantryShareTxt = () => UI.share(text(expKind));
  Actions.pantryCopy = () => UI.copy(text(expKind));
  Actions.pantryPng = () => Exporter.textPng(text(expKind), 'despensa.png');

  return { render };
})();
