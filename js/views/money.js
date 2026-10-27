/* despensAPP · Finanzas: presupuesto, gastos, boletas con foto, cuentas claras y reportes */
const MoneyView = (() => {
  const st = { period: null, off: 0 };
  let fx = null; // formulario de gasto

  const period = () => st.period || Store.state.household.period || 'mes';
  const members = () => Store.state.household.members;

  function thermo(spent, budget, label) {
    if (!budget) return '';
    const pct = Math.min(100, spent / budget * 100);
    const lvl = spent > budget ? 'bad' : pct > 80 ? 'warn' : 'ok';
    return `<div class="thermo ${lvl}">
      <div class="thermo-top"><span>${label}</span><span>${Math.round(spent / budget * 100)}%</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <small>${spent > budget ? `${ico('alert')} Excedido en ${Money.fmt(spent - budget)}` : `Disponible ${Money.fmt(budget - spent)} de ${Money.fmt(budget)}`}</small>
    </div>`;
  }

  function render() {
    const h = Store.state.household;
    const r = Money.range(period(), st.off);
    const list = Money.inRange(r);
    const spent = Money.spent(r);
    const cats = Money.byCat(list);
    const max = cats.length ? cats[0][1] : 1;
    const bal = Money.balances(Money.list());
    const settle = Money.settle(bal);
    const sameP = period() === h.period;
    const groups = {};
    list.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });

    return `
      <div class="chips center">${[['semana', 'Semana'], ['mes', 'Mes'], ['todo', 'Todo']].map(([k, l]) => `<button class="chip ${period() === k ? 'on' : ''}" data-act="moneyPeriod" data-val="${k}">${l}</button>`).join('')}</div>
      <section class="card money-hero" id="moneyHero">
        ${period() !== 'todo' ? `<div class="week-nav flat"><button class="icon-btn" data-act="moneyOff" data-d="-1">${ico('chevL')}</button><b>${esc(r.label)}</b><button class="icon-btn" data-act="moneyOff" data-d="1" ${st.off >= 0 ? 'disabled' : ''}>${ico('chevR')}</button></div>` : `<b class="center block">${r.label}</b>`}
        <div class="big-total"><small>Gastado</small><b>${Money.fmt(spent)}</b><span class="hint">${list.filter(e => e.cat !== 'Ajuste').length} gastos</span></div>
        ${sameP ? thermo(spent, +h.budget, 'Presupuesto meta') : ''}
        ${sameP && !h.budget ? `<button class="btn ghost sm block" data-act="moneyBudget">${ico('flame')} Fijar presupuesto meta</button>` : ''}
        ${cats.length ? `<div class="cat-bars">${cats.map(([c, v]) => `<div class="cbar"><span>${Money.catEmoji(c)} ${esc(c)}</span><b>${Money.fmt(v)}</b><i style="width:${v / max * 100}%"></i></div>`).join('')}</div>` : ''}
      </section>
      <div class="quick-actions">
        <button class="qa" data-act="moneyNew">${ico('plus')}<span>Gasto</span></button>
        <button class="qa hl" data-act="moneySplit">${ico('users')}<span>Cuentas separadas</span></button>
        <button class="qa" data-act="moneyBudget">${ico('flame')}<span>Presupuesto</span></button>
        <button class="qa" data-act="moneyPdf">${ico('file')}<span>Informe PDF</span></button>
        <button class="qa" data-act="moneyCsv">${ico('sheet')}<span>CSV Excel</span></button>
        <button class="qa" data-act="moneyPng">${ico('image')}<span>Imagen</span></button>
      </div>
      ${members().length > 1 ? `<section class="card">
        <h4 class="card-title">${ico('users')} Cuentas claras <small>historial completo</small></h4>
        <div class="bal-list">${bal.map(b => `<div class="bal"><span class="avatar">${esc(b.member[0] || '?')}</span><span class="grow"><b>${esc(b.member)}</b><small>pagó ${Money.fmt(b.paid)} · le toca ${Money.fmt(b.share)}</small></span>
          <b class="${b.net > 0.5 ? 'pos' : b.net < -0.5 ? 'neg' : ''}">${b.net > 0.5 ? '+' : ''}${Money.fmt(b.net)}</b></div>`).join('')}</div>
        ${settle.length ? `<h5 class="sec-title">Para quedar a mano</h5>${settle.map((s, k) => `<div class="settle"><span><b>${esc(s.from)}</b> ${ico('arrowR')} <b>${esc(s.to)}</b></span><b>${Money.fmt(s.amount)}</b><button class="btn sm primary" data-act="moneySettle" data-k="${k}">Saldar</button></div>`).join('')}`
          : `<p class="hint center">${ico('check')} Están a mano</p>`}
      </section>` : ''}
      <h4 class="sec-title">Movimientos</h4>
      ${list.length ? Object.keys(groups).sort().reverse().map(d => `<div class="date-h">${UI.fmtDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div class="list">${groups[d].map(e => `<button class="row card-row exp-row" data-act="moneyEdit" data-id="${e.id}">
          <span class="em">${Money.catEmoji(e.cat)}</span>
          <span class="grow"><b>${esc(e.desc || e.cat)}</b><small>${esc(e.cat)}${e.payer ? ' · pagó ' + esc(e.payer) : ''}${e.method ? ' · ' + esc(e.method) : ''}</small>
            ${e.draft ? `<span class="pill warn">borrador</span>` : ''}${(e.photos || []).length ? `<span class="pill">${ico('camera')} ${e.photos.length}</span>` : ''}${(e.items || []).length ? `<span class="pill">${e.items.length} ítems</span>` : ''}${e.split ? `<span class="pill ok">${ico('users')} dividida</span>` : ''}</span>
          <b class="amt">${Money.fmt(e.amount)}</b></button>`).join('')}</div>`).join('')
        : UI.empty('receipt', 'Sin gastos en este período', 'Registra una boleta o cierra una compra del súper para crear un gasto automáticamente.')}
      <button class="fab" data-act="moneyNew" aria-label="Nuevo gasto">${ico('plus')}</button>`;
  }

  /* ---------- Editor de gasto ---------- */
  function fxSheet() {
    const mem = members();
    return `
      ${fx.draft ? `<div class="info">${ico('sparkles')} Borrador creado desde tu compra. Revisa y adjunta la boleta.</div>` : ''}
      <div class="money-in xl"><span>$</span><input id="fxAmount" type="number" inputmode="numeric" min="0" step="any" placeholder="0" value="${fx.amount || ''}" autofocus></div>
      <input id="fxDesc" placeholder="Descripción (ej: Lider compra semanal)" value="${esc(fx.desc)}">
      <label class="lbl">Categoría</label>
      ${UI.chips(Money.CATS.map(([c, e]) => [c, `${e} ${c}`]), fx.cat, 'fxSet', 'data-f="cat"')}
      <div class="grid2">
        <div><label class="lbl">Fecha</label><input id="fxDate" type="date" value="${fx.date}"></div>
        <div><label class="lbl">N° documento</label><input id="fxDocNum" inputmode="numeric" value="${esc(fx.docNum || '')}" placeholder="Opcional"></div>
      </div>
      <label class="lbl">Documento</label>
      ${UI.chips(Money.DOCS, fx.docType, 'fxSet', 'data-f="docType"')}
      <label class="lbl">Método de pago</label>
      ${UI.chips(Money.METHODS, fx.method, 'fxSet', 'data-f="method"')}
      <div class="split-cta">
        <div class="grow"><b>${ico('users')} Cuentas separadas</b><small>${fx.split ? `Dividida entre ${fx.split.people.map(esc).join(', ')}` : 'Divide por productos, agrega o quita personas y registra quién aportó.'}</small></div>
        <button class="btn sm ${fx.split ? 'ghost' : 'primary'}" data-act="fxSplit">${fx.split ? 'Editar' : 'Dividir'}</button>
      </div>
      ${fx.split ? '' : mem.length ? `<label class="lbl">¿Quién pagó?</label>${UI.chips(mem, fx.payer, 'fxSet', 'data-f="payer"')}
        <label class="lbl">Repartir entre <small class="hint">(${fx.among.length === mem.length ? 'todos' : 'solo algunos'})</small></label>
        ${UI.chips(mem, fx.among, 'fxAmong')}
        ${fx.among.length && fx.amount ? `<p class="hint">${Money.fmt((parseFloat(fx.amount) || 0) / fx.among.length)} c/u</p>` : ''}`
        : `<div class="info">${ico('users')} Agrega integrantes en <a data-act="goTab" data-val="hogar">Hogar</a> para dividir gastos.</div>`}
      <label class="lbl">${ico('camera')} Foto de boleta</label>
      <div class="thumbs">
        ${fx.photos.map((id, k) => `<div class="thumb"><img data-photo="${id}" alt="boleta" data-act="fxView" data-id="${id}"><button class="icon-btn xs" data-act="fxDelPhoto" data-k="${k}">${ico('x')}</button></div>`).join('')}
        <label class="thumb add" for="fxCam">${ico('camera')}<small>Cámara</small></label>
        <label class="thumb add" for="fxGal">${ico('image')}<small>Galería</small></label>
      </div>
      <input type="file" id="fxCam" accept="image/*" capture="environment" hidden data-change="fxPhoto">
      <input type="file" id="fxGal" accept="image/*" multiple hidden data-change="fxPhoto">
      ${fx.photos.length ? `<button class="btn ghost sm block" data-act="fxOcr">${ico('scan')} Leer total desde la boleta (beta)</button>` : ''}
      <label class="lbl">Notas</label>
      <textarea id="fxNotes" rows="2" placeholder="Descuento con tarjeta, cuotas…">${esc(fx.notes || '')}</textarea>
      ${(fx.items || []).length ? `<details class="items"><summary>${fx.items.length} productos de la compra</summary>
        <div class="list compact">${fx.items.map(x => `<div class="row"><span class="grow">${esc(x.n)}<small>${Units.fmt(x.q, x.u)}</small></span><b>${x.price ? Money.fmt(x.price) : '—'}</b></div>`).join('')}</div></details>` : ''}
      <button class="btn primary block lg" data-act="fxSave">${ico('check')} ${fx.isNew ? 'Registrar gasto' : 'Guardar'}</button>
      ${!fx.isNew ? `<button class="btn danger ghost block" data-act="fxDelete">${ico('trash')} Eliminar gasto</button>` : ''}`;
  }
  function fxRead() {
    if (!$('#fxAmount')) return;
    fx.amount = parseFloat($('#fxAmount').value) || 0;
    fx.desc = $('#fxDesc').value.trim();
    fx.date = $('#fxDate').value || Money.today();
    fx.docNum = $('#fxDocNum').value.trim();
    fx.notes = $('#fxNotes').value.trim();
  }
  function openFx(e) {
    const mem = members();
    fx = e ? JSON.parse(JSON.stringify(e)) : {
      id: Store.uid('exp_'), amount: '', cat: 'Supermercado', desc: '', date: Money.today(),
      payer: Store.me() && mem.includes(Store.me()) ? Store.me() : mem[0] || '', among: mem.slice(),
      method: 'Débito', docType: 'Boleta', docNum: '', photos: [], notes: '', items: [], isNew: true,
    };
    fx.photos = fx.photos || []; fx.among = fx.among || [];
    UI.open(fx.isNew ? 'Nuevo gasto' : 'Editar gasto', fxSheet, b => Photos.hydrate(b), { tall: true });
  }
  function edit(id) { const e = Store.state.expenses.find(x => x.id === id); if (e) openFx(e); }

  Actions.moneyNew = () => openFx(null);
  Actions.moneyEdit = el => edit(el.dataset.id);
  Actions.moneyPeriod = el => { st.period = el.dataset.val; st.off = 0; App.render(); };
  Actions.moneyOff = el => { st.off = Math.min(0, st.off + (+el.dataset.d)); App.render(); };
  Actions.fxSet = el => { fxRead(); fx[el.dataset.f] = el.dataset.val; if (el.dataset.f === 'cat' && !fx.desc) fx.desc = ''; UI.refresh(); Photos.hydrate(); };
  Actions.fxAmong = el => {
    fxRead();
    const m = el.dataset.val;
    fx.among = fx.among.includes(m) ? fx.among.filter(x => x !== m) : [...fx.among, m];
    UI.refresh(); Photos.hydrate();
  };
  Actions.fxPhoto = async el => {
    fxRead();
    const files = [...(el.files || [])];
    if (!files.length) return;
    UI.toast('Procesando foto…', { icon: 'camera' });
    for (const f of files) { try { fx.photos.push(await Photos.add(f)); } catch (e) { UI.toast('No se pudo leer la imagen', { type: 'err' }); } }
    el.value = '';
    UI.refresh(); Photos.hydrate();
  };
  Actions.fxDelPhoto = el => { fxRead(); const [id] = fx.photos.splice(+el.dataset.k, 1); fx.removed = [...(fx.removed || []), id]; UI.refresh(); Photos.hydrate(); };
  Actions.fxView = async el => {
    const u = await Photos.url(el.dataset.id);
    if (!u) return;
    UI.open('Boleta', () => `<img class="full-photo" src="${u}" alt="boleta">`, null, { tall: true });
  };
  // Guarda el gasto (sin cerrar) y abre Cuentas separadas encima
  Actions.fxSplit = () => {
    fxRead();
    if (!(fx.amount > 0)) { UI.toast('Primero ingresa el monto de la boleta', { type: 'err' }); return; }
    const { isNew: _, removed, ...data } = fx;
    data.draft = false; data.t = Store.now(); if (!data.created) data.created = Store.now();
    if (!data.among || !data.among.length) data.among = members().slice();
    const k = Store.state.expenses.findIndex(x => x.id === data.id);
    if (k >= 0) Store.state.expenses[k] = data; else Store.state.expenses.unshift(data);
    (removed || []).forEach(id => { Photos.del(id); Sync.deletePhoto(id); });
    Store.commit();
    UI.closeAll();
    setTimeout(() => SplitView.open(data.id), 60);
  };
  Actions.fxSave = () => {
    fxRead();
    if (!(fx.amount > 0)) { UI.toast('Ingresa el monto', { type: 'err' }); return; }
    if (members().length && !fx.among.length) fx.among = members().slice();
    const isNew = fx.isNew;
    const { isNew: _, removed, ...data } = fx;
    data.draft = false; data.t = Store.now();
    if (!data.created) data.created = Store.now();
    const k = Store.state.expenses.findIndex(x => x.id === data.id);
    if (k >= 0) Store.state.expenses[k] = data; else Store.state.expenses.unshift(data);
    (removed || []).forEach(id => { Photos.del(id); Sync.deletePhoto(id); });
    Store.log('money', `${isNew ? 'registró' : 'editó'} ${data.docType === 'Sin documento' ? 'un gasto' : 'una ' + data.docType.toLowerCase()} de ${Money.fmt(data.amount)}${data.desc ? ' (' + data.desc + ')' : ''}`);
    Store.commit(); UI.closeAll();
    UI.toast(`Gasto ${isNew ? 'registrado' : 'guardado'}`, { icon: 'receipt' });
    const h = Store.state.household, r = Money.range(h.period);
    if (h.budget && Money.spent(r) > h.budget) UI.toast('Superaste el presupuesto del período', { type: 'err' });
  };
  Actions.fxDelete = el => UI.confirmTap(el, () => {
    const e = Store.state.expenses.find(x => x.id === fx.id);
    Store.state.expenses = Store.state.expenses.filter(x => x.id !== fx.id);
    Store.tomb('e:' + fx.id);
    (e && e.photos || []).forEach(id => { Photos.del(id); Sync.deletePhoto(id); });
    Store.log('money', `eliminó un gasto de ${Money.fmt(e ? e.amount : 0)}`);
    Store.commit(); UI.closeAll();
  });

  /* ---------- OCR opcional (Tesseract desde CDN, requiere conexión) ---------- */
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  }
  function parseCLP(s) { return parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0; }
  Actions.fxOcr = async el => {
    fxRead();
    if (!navigator.onLine) { UI.toast('La lectura de boletas necesita internet', { type: 'err' }); return; }
    el.disabled = true; el.innerHTML = `${ico('sync', 'spin')} Leyendo boleta…`;
    try {
      if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.0/dist/tesseract.min.js');
      const blob = await Photos.get(fx.photos[fx.photos.length - 1]);
      const { data } = await Tesseract.recognize(blob, 'spa');
      const text = data.text || '';
      const lines = text.split('\n');
      let total = 0;
      lines.forEach(l => { if (/total/i.test(l) && !/sub\s*total/i.test(l)) { const m = l.match(/\$?\s*([\d]{1,3}(?:[.,]\d{3})+|\d{3,7})/g); if (m) total = Math.max(total, parseCLP(m[m.length - 1])); } });
      if (!total) { const all = (text.match(/\$\s*[\d]{1,3}(?:[.,]\d{3})+/g) || []).map(parseCLP); if (all.length) total = Math.max(...all); }
      const folio = text.match(/(?:boleta|folio|n[°ºo]\.?)\D{0,12}(\d{3,10})/i);
      const date = text.match(/(\d{2})[\/-](\d{2})[\/-](\d{2,4})/);
      if (total) fx.amount = total;
      if (folio && !fx.docNum) fx.docNum = folio[1];
      if (date) { const y = date[3].length === 2 ? '20' + date[3] : date[3]; const iso = `${y}-${date[2]}-${date[1]}`; if (!isNaN(new Date(iso))) fx.date = iso; }
      UI.refresh(); Photos.hydrate();
      UI.toast(total ? `Total detectado: ${Money.fmt(total)} — revísalo` : 'No encontramos el total, ingrésalo a mano', { icon: 'scan', type: total ? '' : 'err' });
    } catch (e) {
      console.warn(e);
      UI.toast('No se pudo leer la boleta', { type: 'err' });
      el.disabled = false; el.innerHTML = `${ico('scan')} Leer total desde la boleta (beta)`;
    }
  };

  /* ---------- Presupuesto ---------- */
  Actions.moneyBudget = () => {
    const h = Store.state.household;
    UI.open('Presupuesto meta', () => `
      <p class="hint">Define cuánto quieren gastar antes de comprar. La app avisa en vivo si se pasan.</p>
      <label class="lbl">Presupuesto del hogar</label>
      <div class="money-in"><span>$</span><input id="bgTotal" type="number" inputmode="numeric" value="${h.budget || ''}" placeholder="150000"></div>
      ${UI.chips([['semana', 'Semanal'], ['mes', 'Mensual']], h.period, 'bgPeriod')}
      <label class="lbl">Presupuesto por compra en el súper</label>
      <div class="money-in"><span>$</span><input id="bgShop" type="number" inputmode="numeric" value="${h.shopBudget || ''}" placeholder="80000"></div>
      <p class="hint">Se usa en el termómetro del Modo En el Súper.</p>
      <button class="btn primary block lg" data-act="bgSave">${ico('check')} Guardar</button>`);
  };
  Actions.bgPeriod = el => { const h = Store.state.household; h.budget = parseFloat($('#bgTotal').value) || 0; h.shopBudget = parseFloat($('#bgShop').value) || 0; h.period = el.dataset.val; UI.refresh(); };
  Actions.bgSave = () => {
    const h = Store.state.household;
    h.budget = parseFloat($('#bgTotal').value) || 0; h.shopBudget = parseFloat($('#bgShop').value) || 0;
    Store.touchHousehold();
    Store.log('money', `fijó el presupuesto en ${Money.fmt(h.budget)} ${h.period === 'semana' ? 'semanal' : 'mensual'}`);
    Store.commit(); UI.closeAll(); UI.toast('Presupuesto guardado', { icon: 'flame' });
  };

  /* ---------- Saldar ---------- */
  Actions.moneySettle = el => {
    const s = Money.settle(Money.balances(Money.list()))[+el.dataset.k];
    if (!s) return;
    UI.confirmTap(el, () => {
      Store.state.expenses.unshift({
        id: Store.uid('exp_'), amount: s.amount, cat: 'Ajuste', desc: `${s.from} le pagó a ${s.to}`, date: Money.today(),
        payer: s.from, among: [s.to], method: 'Transferencia', docType: 'Sin documento', docNum: '', photos: [], notes: 'Saldo de cuentas claras',
        created: Store.now(), t: Store.now(),
      });
      Store.log('money', `registró que ${s.from} le pagó ${Money.fmt(s.amount)} a ${s.to}`);
      Store.commit(); UI.toast('Cuentas saldadas', { icon: 'check' });
    }, 'Confirmar pago');
  };

  Actions.moneyPdf = () => Exporter.pdf(Money.range(period(), st.off));
  Actions.moneyCsv = () => Exporter.csv(Money.range(period(), st.off));
  Actions.moneyPng = () => Exporter.nodePng($('#moneyHero'), 'resumen-gastos.png');

  return { render, edit };
})();
