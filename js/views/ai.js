/* despensAPP · Pantallas de IA: leer boleta, inventario por foto, lista por texto/voz y Chef IA.
   Todo lo que propone la IA se muestra para revisar y corregir antes de guardar. */
const AIView = (() => {
  let run = 0;      // permite descartar respuestas que llegan después de cancelar
  let rv = null;    // revisión en curso

  const can = () => { const w = AI.why(); if (w) { UI.toast(w, { type: 'err' }); return false; } if (!navigator.onLine) { UI.toast('Necesitas internet para usar la IA', { type: 'err' }); return false; } return true; };
  const alive = my => my === run && UI.isOpen();
  const fmt = n => Math.round(+n || 0).toLocaleString('es-CL');
  const num = v => { const s = String(v == null ? '' : v).trim().replace(/\s/g, ''); if (!s) return 0; const x = +s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); return isFinite(x) ? x : 0; };
  const UNITS = ['un', 'g', 'kg', 'ml', 'L'];
  const privacy = what => `${ico('info')} Solo se envía ${what}. Revisarás todo antes de guardar.`;

  function loading(title, msg, what) {
    const my = ++run;
    UI.open(title, () => `<div class="ai-loading"><div class="ai-orb">${ico('sparkles')}</div><p>${msg}</p><small>${privacy(what)}</small></div>
      <button class="btn ghost block" data-act="aiCancel">Cancelar</button>`);
    return my;
  }
  function fail(my, err, retry) {
    if (!alive(my)) return;
    UI.replace('No se pudo completar', () => `<div class="warn">${ico('alert')} ${esc(err.message || err)}</div>
      ${retry ? `<button class="btn primary block" data-act="aiRetry">${ico('sync')} Intentar de nuevo</button>` : ''}
      <button class="btn ghost block" data-act="aiCancel">Volver</button>`);
    rv = rv || {}; rv.retry = retry;
  }
  Actions.aiCancel = () => { run++; UI.close(); };
  Actions.aiRetry = () => { const f = rv && rv.retry; run++; UI.close(); if (f) f(); };

  // Guarda en la despensa las filas marcadas (cálculo normal, sin IA)
  function toPantry(rows) {
    let n = 0;
    rows.filter(r => r.on && r.cant > 0).forEach(r => {
      const m = r.m || AI.ensureCustom(r.nombre, AI.unit(r.unidad));
      Pantry.add(m.c, m.i, m.v, r.cant, AI.unit(r.unidad));
      n++;
    });
    return n;
  }
  const matchChip = (r, k) => `<button class="ai-match ${r.m ? '' : 'none'}" data-act="aiPickMatch" data-k="${k}">${r.m ? esc(AI.mLabel(r.m)) : `${ico('search')} Elegir producto`}</button>`;
  Actions.aiPickMatch = el => {
    const r = rv.rows[+el.dataset.k];
    Picker.open({ mode: 'recipe', title: '¿Qué producto es?', onPick: c => { r.m = { c: c.c, i: c.i, v: c.v }; r.on = true; UI.refresh(); } });
  };
  Actions.aiRowOn = el => { rv.rows[+el.dataset.k].on = el.checked; const b = $('#aiGoCount'); if (b) b.textContent = rv.rows.filter(r => r.on).length; };
  Actions.aiRowSet = el => {
    const r = rv.rows[+el.dataset.k], f = el.dataset.f;
    r[f] = f === 'cant' || f === 'total' ? num(el.value) : el.value;
    if (rv.kind === 'boleta') { const c = $('#aiCheck'); if (c) c.innerHTML = checkHtml(); }
  };
  Actions.aiRowDel = el => { rv.rows.splice(+el.dataset.k, 1); UI.refresh(); };

  /* =================== Boleta =================== */
  // opts: { photo: id|Blob, dest: 'gasto'|'split'|'despensa', onUse(res) }
  async function boleta(opts) {
    if (!can()) return;
    rv = { kind: 'boleta', dest: opts.dest, onUse: opts.onUse, retry: () => boleta(opts) };
    const my = loading('Leyendo tu boleta…', 'La IA está leyendo el local, la fecha, los productos y los precios.', 'la foto de la boleta');
    try {
      const j = await AI.call('boleta', await AI.photoBody(opts.photo));
      if (!alive(my)) return;
      const d = j.data;
      rv = {
        kind: 'boleta', dest: opts.dest, onUse: opts.onUse, model: j.model, retry: rv.retry,
        head: { proveedor: d.proveedor, fecha: d.fecha || Money.today(), nDoc: d.nDoc, tipoDoc: d.tipoDoc, medioPago: d.medioPago, categoria: d.categoria, detalle: d.detalle, total: d.total, propina: d.propina },
        rows: d.items.map(it => ({ ...it, m: it.despensa ? AI.match(it) : null, on: it.despensa && opts.dest === 'despensa' })),
        pantry: opts.dest === 'despensa', expense: opts.dest === 'despensa', legible: d.legible, avisos: d.avisos,
      };
      rv.rows.forEach(r => { if (r.despensa && r.m && opts.dest === 'despensa') r.on = true; });
      UI.replace('Revisa tu boleta', boletaSheet);
      UI.haptic([10, 30, 10]);
      if (d.legible === false) UI.toast('La foto se ve poco clara: revisa bien los datos', { type: 'err' });
    } catch (e) { fail(my, e, rv.retry); }
  }
  function checkHtml() {
    const sum = rv.rows.reduce((s, r) => s + (+r.total || 0), 0) + (+rv.head.propina || 0), diff = Math.round((+rv.head.total || 0) - sum);
    return diff === 0
      ? `<div class="ai-check ok">${ico('check')} La suma de los productos cuadra con el total</div>`
      : `<div class="ai-check warn">${ico('alert')} Los productos suman ${Money.fmt(sum)} y el total dice ${Money.fmt(rv.head.total)} (diferencia ${Money.fmt(Math.abs(diff))}). Revisa los precios.</div>`;
  }
  function boletaSheet() {
    const h = rv.head;
    return `
      ${rv.avisos && rv.avisos.length ? `<div class="warn">${ico('alert')} ${rv.avisos.map(esc).join(' · ')}</div>` : ''}
      <label class="lbl">Local</label><input value="${esc(h.proveedor)}" placeholder="Ej: Lider Ñuñoa" data-input="aiHead" data-f="proveedor">
      <div class="grid2">
        <div><label class="lbl">Fecha</label><input type="date" value="${esc(h.fecha)}" data-change="aiHead" data-f="fecha"></div>
        <div><label class="lbl">N° documento</label><input inputmode="numeric" value="${esc(h.nDoc)}" data-input="aiHead" data-f="nDoc"></div>
      </div>
      <div id="aiCheck">${checkHtml()}</div>
      <div class="ai-th"><span>Producto</span><span>Cant.</span><span>Precio</span><span></span></div>
      <div class="ai-rows">${rv.rows.map((r, k) => `<div class="ai-row">
          <div class="ai-r-top">
            <div class="ai-n"><input value="${esc(r.nombre)}" data-input="aiRowSet" data-k="${k}" data-f="nombre" aria-label="Producto">${r.orig && r.orig !== r.nombre ? `<small>${esc(r.orig)}</small>` : ''}</div>
            <input class="ai-q" inputmode="decimal" value="${String(r.cant).replace('.', ',')}" data-input="aiRowSet" data-k="${k}" data-f="cant" aria-label="Cantidad">
            <input class="ai-t" inputmode="numeric" value="${fmt(r.total)}" data-input="aiRowSet" data-k="${k}" data-f="total" aria-label="Precio">
            <button class="icon-btn sm" data-act="aiRowDel" data-k="${k}" aria-label="Quitar">${ico('x')}</button>
          </div>
          ${rv.pantry && r.total > 0 ? `<div class="ai-r-pantry"><label class="check-line sm"><input type="checkbox" ${r.on ? 'checked' : ''} data-change="aiRowOn" data-k="${k}"> A la despensa</label>${matchChip(r, k)}</div>` : ''}
        </div>`).join('')}</div>
      <button class="btn ghost sm" data-act="aiAddRow">${ico('plus')} Agregar producto</button>
      <div class="grid2">
        <div><label class="lbl">Total de la boleta</label><div class="money-in sm"><span>$</span><input inputmode="numeric" value="${fmt(h.total)}" data-input="aiHead" data-f="total"></div></div>
        <div><label class="lbl">Propina</label><div class="money-in sm"><span>$</span><input inputmode="numeric" value="${fmt(h.propina)}" data-input="aiHead" data-f="propina"></div></div>
      </div>
      <label class="lbl">Categoría sugerida</label>
      ${UI.chips(Money.CATS.filter(([c]) => c !== 'Ajuste').map(([c, e]) => [c, `${e} ${c}`]), h.categoria, 'aiCat')}
      <label class="lbl">Detalle</label><input value="${esc(h.detalle)}" placeholder="Ej: Compra semanal (verduras, lácteos)" data-input="aiHead" data-f="detalle">
      <label class="ai-switch"><input type="checkbox" ${rv.pantry ? 'checked' : ''} data-change="aiPantryOn"><span><b>Guardar productos en la despensa</b><small>Agrega a la despensa los productos marcados.</small></span></label>
      ${rv.dest === 'despensa' ? `<label class="ai-switch"><input type="checkbox" ${rv.expense ? 'checked' : ''} data-change="aiExpenseOn"><span><b>Registrar también el gasto</b><small>Crea el gasto en Plata con la boleta de respaldo.</small></span></label>` : ''}
      <div class="btn-col">
        <button class="btn primary block lg" data-act="aiUseBoleta">${ico('check')} Usar estos datos</button>
        <button class="btn ghost block" data-act="aiCancel">Volver sin cambios</button>
      </div>
      <p class="hint center">Leída con ${esc(rv.model || 'IA')}</p>`;
  }
  Actions.aiHead = el => {
    const f = el.dataset.f;
    rv.head[f] = ['total', 'propina'].includes(f) ? num(el.value) : el.value;
    if (['total', 'propina'].includes(f)) { const c = $('#aiCheck'); if (c) c.innerHTML = checkHtml(); }
  };
  Actions.aiCat = el => { rv.head.categoria = el.dataset.val; UI.refresh(); };
  Actions.aiAddRow = () => { rv.rows.push({ nombre: '', orig: '', cant: 1, unidad: 'un', total: 0, despensa: true, m: null, on: false }); UI.refresh(); };
  Actions.aiPantryOn = el => {
    rv.pantry = el.checked;
    rv.rows.forEach(r => { if (r.total > 0 && r.despensa !== false) r.on = el.checked && !!r.m; });
    UI.refresh();
  };
  Actions.aiExpenseOn = el => { rv.expense = el.checked; };
  Actions.aiUseBoleta = () => {
    const h = rv.head;
    const res = {
      ...h, items: rv.rows.filter(r => r.nombre || r.total).map(r => ({ n: r.nombre || r.orig || 'Producto', q: r.cant || 1, u: AI.unit(r.unidad), price: Math.round(+r.total || 0) })),
      desc: [h.proveedor, h.detalle].filter(Boolean).join(' · '), pantryCount: 0, expense: rv.expense,
    };
    if (rv.pantry) {
      res.pantryCount = toPantry(rv.rows);
      if (res.pantryCount) Store.log('pantry', `agregó ${res.pantryCount} productos de una boleta leída con IA a la despensa`);
    }
    const f = rv.onUse;
    run++;
    UI.close();
    if (f) f(res);
    if (res.pantryCount) UI.toast(`${res.pantryCount} productos guardados en la despensa`, { icon: 'pantry' });
  };

  /* =================== Revisión de listas (foto de despensa / texto) =================== */
  function listSheet() {
    const isList = rv.kind === 'lista';
    return `
      ${rv.avisos && rv.avisos.length ? `<div class="info">${ico('info')} ${rv.avisos.map(esc).join(' · ')}</div>` : ''}
      <p class="hint">${isList ? 'Revisa los productos y sus cantidades.' : 'Productos que la IA vio en la foto. Desmarca lo que no corresponda.'} Toca el producto del catálogo para cambiarlo.</p>
      <div class="ai-rows">${rv.rows.map((r, k) => `<div class="ai-row ${r.on ? '' : 'off'}">
          <div class="ai-r-head"><label class="check-line sm"><input type="checkbox" ${r.on ? 'checked' : ''} data-change="aiRowOn" data-k="${k}"></label>
            <input class="ai-name" value="${esc(r.nombre)}" data-input="aiRowSet" data-k="${k}" data-f="nombre" aria-label="Producto">
            ${r.sugerido ? '<span class="pill">sugerido</span>' : ''}${r.confianza && r.confianza !== 'alta' ? `<span class="pill ${r.confianza === 'baja' ? 'warn' : ''}">${r.confianza === 'baja' ? 'dudoso' : 'probable'}</span>` : ''}
            <button class="icon-btn sm" data-act="aiRowDel" data-k="${k}" aria-label="Quitar">${ico('x')}</button></div>
          <div class="ai-r-pantry">${matchChip(r, k)}
            <input class="ai-q" inputmode="decimal" value="${String(r.cant).replace('.', ',')}" data-input="aiRowSet" data-k="${k}" data-f="cant" aria-label="Cantidad">
            <select data-change="aiRowSet" data-k="${k}" data-f="unidad" aria-label="Unidad">${UNITS.map(u => `<option ${AI.unit(r.unidad) === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        </div>`).join('') || UI.empty('search', 'No se encontró nada', 'Intenta con otra foto o escribe los productos.')}</div>
      <div class="btn-col">
        <button class="btn primary block lg" data-act="aiListGo">${ico(isList ? 'cart' : 'pantry')} Agregar <b id="aiGoCount">${rv.rows.filter(r => r.on).length}</b> a ${isList ? 'Mi Lista' : 'la despensa'}</button>
        <button class="btn ghost block" data-act="aiCancel">Volver sin cambios</button>
      </div>`;
  }
  Actions.aiListGo = () => {
    const rows = rv.rows.filter(r => r.on && r.cant > 0);
    if (!rows.length) { UI.toast('No hay productos marcados', { type: 'err' }); return; }
    if (rv.kind === 'lista') {
      rows.forEach(r => { const m = r.m || AI.ensureCustom(r.nombre, AI.unit(r.unidad)); Shop.add(m.c, m.i, m.v, r.cant, AI.unit(r.unidad), '· con IA'); });
      Store.log('shop', `agregó ${rows.length} productos a la lista con IA`);
    } else {
      toPantry(rows);
      Store.log('pantry', `agregó ${rows.length} productos a la despensa desde una foto (IA)`);
    }
    Store.commit();
    run++; UI.closeAll();
    UI.toast(`${rows.length} productos agregados a ${rv.kind === 'lista' ? 'Mi Lista' : 'la despensa'}`, { icon: rv.kind === 'lista' ? 'cart' : 'pantry' });
  };

  /* ---------- Foto del refri o la despensa ---------- */
  async function despensaFoto(file) {
    if (!can()) return;
    rv = { kind: 'despensa', retry: () => despensaFoto(file) };
    const my = loading('Mirando tu despensa…', 'La IA está reconociendo los productos de la foto.', 'esta foto');
    try {
      const j = await AI.call('despensa', await AI.photoBody(file));
      if (!alive(my)) return;
      rv = { kind: 'despensa', retry: rv.retry, avisos: j.data.avisos, rows: j.data.items.map(it => { const m = AI.match(it); return { ...it, m, on: !!m && it.confianza !== 'baja' }; }) };
      UI.replace('Revisa el inventario', listSheet);
    } catch (e) { fail(my, e, rv.retry); }
  }

  /* ---------- Lista por texto o voz ---------- */
  let draftText = '';
  function listaSheet() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    return `<p class="hint">Escribe o dicta lo que necesitas, como se lo dirías a alguien. La IA lo convierte en tu lista.</p>
      <textarea id="aiText" rows="5" placeholder="Ej: 2 kilos de papas, leche sin lactosa, pan para la once y algo para el asado del sábado" data-input="aiText">${esc(draftText)}</textarea>
      ${Rec ? `<button class="btn ghost block" data-act="aiMic" id="aiMicBtn">${ico('mic')} Dictar</button>` : ''}
      <div class="chips">${['Lo de siempre para el desayuno', 'Algo para el asado', 'Once para 6 personas', 'Útiles de aseo del mes'].map(x => `<button class="chip" data-act="aiExample" data-val="${esc(x)}">${esc(x)}</button>`).join('')}</div>
      <button class="btn primary block lg" data-act="aiListaGo">${ico('sparkles')} Convertir en lista</button>`;
  }
  Actions.aiText = el => { draftText = el.value; };
  Actions.aiExample = el => { draftText = (draftText ? draftText.trim() + ', ' : '') + el.dataset.val.toLowerCase(); UI.refresh(); };
  let rec = null;
  Actions.aiMic = el => {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (rec) { rec.stop(); return; }
    rec = new Rec(); rec.lang = 'es-CL'; rec.interimResults = false; rec.continuous = true;
    const base = draftText ? draftText.trim() + ', ' : '';
    let said = '';
    rec.onresult = e => { said = [...e.results].map(r => r[0].transcript).join(' '); const t = $('#aiText'); draftText = base + said; if (t) t.value = draftText; };
    rec.onend = () => { rec = null; const b = $('#aiMicBtn'); if (b) b.innerHTML = `${ico('mic')} Dictar`; };
    rec.onerror = () => { UI.toast('No se pudo usar el micrófono', { type: 'err' }); };
    rec.start();
    el.innerHTML = `${ico('mic')} Escuchando… toca para terminar`;
  };
  Actions.aiListaGo = async () => {
    if (rec) rec.stop();
    const text = (($('#aiText') || {}).value || draftText).trim();
    if (!text) { UI.toast('Escribe o dicta qué necesitas', { type: 'err' }); return; }
    draftText = text;
    UI.close();
    rv = { kind: 'lista', retry: () => { openLista(); } };
    const my = loading('Armando tu lista…', 'La IA está entendiendo lo que necesitas.', 'el texto que escribiste');
    try {
      const j = await AI.call('lista', { text });
      if (!alive(my)) return;
      rv = { kind: 'lista', retry: rv.retry, rows: j.data.items.map(it => ({ ...it, m: AI.match(it), on: true })) };
      UI.replace('Revisa tu lista', listSheet);
      draftText = '';
    } catch (e) { fail(my, e, rv.retry); }
  };
  function openLista() { if (!can()) return; UI.open('Lista con IA', listaSheet); }

  /* =================== Chef IA =================== */
  const chef = { venc: true, people: 0, pedido: '', tiempo: '', seen: [] };
  function chefSheet() {
    const exp = Pantry.expiring().filter(e => !Pantry.isEmpty(e));
    const restr = AI.restrictions();
    return `<p class="hint">Te propongo una receta con lo que tienes, priorizando lo que está por vencer y respetando las dietas y la salud de la casa.</p>
      ${exp.length ? `<label class="ai-switch"><input type="checkbox" ${chef.venc ? 'checked' : ''} data-change="chefVenc"><span><b>Usar lo que está por vencer</b><small>${exp.slice(0, 6).map(e => esc(Catalog.item(e.c, e.i).name)).join(', ')}${exp.length > 6 ? '…' : ''}</small></span></label>` : `<div class="info">${ico('check')} No hay productos por vencer: usaré lo que hay en la despensa.</div>`}
      <div class="qty-row slim"><span class="lbl">Personas</span>
        <button class="icon-btn" data-act="chefPeople" data-d="-1">${ico('minus')}</button><b class="qty-b">${chef.people}</b>
        <button class="icon-btn" data-act="chefPeople" data-d="1">${ico('plus')}</button></div>
      <label class="lbl">Tiempo</label>
      ${UI.chips([['', 'Sin apuro'], ['15 minutos', '15 min'], ['30 minutos', '30 min'], ['1 hora', '1 hora']], chef.tiempo, 'chefTiempo')}
      <label class="lbl">¿Qué se te antoja? <small class="hint">(opcional)</small></label>
      <input id="chefPedido" value="${esc(chef.pedido)}" placeholder="Ej: algo calentito, sin horno, para llevar al trabajo…">
      ${restr.length ? `<div class="info">${ico('leaf')} Respetará: ${restr.map(esc).join(' · ')}</div>` : ''}
      <button class="btn primary block lg" data-act="chefGo">${ico('sparkles')} Proponer receta</button>`;
  }
  function openChef() {
    if (!can()) return;
    chef.people = chef.people || Math.max(1, Store.state.household.members.length || 2);
    UI.open('Chef IA', chefSheet);
  }
  Actions.chefVenc = el => { chef.venc = el.checked; };
  Actions.chefPeople = el => { chef.pedido = ($('#chefPedido') || {}).value || chef.pedido; chef.people = Math.max(1, chef.people + (+el.dataset.d)); UI.refresh(); };
  Actions.chefTiempo = el => { chef.pedido = ($('#chefPedido') || {}).value || chef.pedido; chef.tiempo = el.dataset.val; UI.refresh(); };
  Actions.chefGo = () => { const p = $('#chefPedido'); if (p) chef.pedido = p.value.trim(); UI.close(); chefCall(); };
  async function chefCall() {
    const all = Pantry.entries().filter(e => !Pantry.isEmpty(e));
    const exp = chef.venc ? Pantry.expiring().filter(e => !Pantry.isEmpty(e)) : [];
    const lbl = e => `${Catalog.label(e.c, e.i, e.v)} (${Units.fmtA(e.a)})`;
    rv = { kind: 'receta', retry: chefCall };
    const my = loading('Pensando una receta…', 'El Chef IA está combinando lo que tienes en casa.', 'la lista de productos y las restricciones de la casa');
    try {
      const j = await AI.call('receta', {
        personas: chef.people, porVencer: exp.map(lbl), disponibles: all.map(lbl), restricciones: AI.restrictions(),
        pedido: chef.pedido, tiempo: chef.tiempo, evitar: chef.seen.slice(-6),
      });
      if (!alive(my)) return;
      const r = j.data;
      chef.seen.push(r.nombre);
      rv = { kind: 'receta', retry: chefCall, r, ings: r.ingredientes.map(it => ({ ...it, m: AI.match(it) })) };
      UI.replace(esc(r.nombre), recetaSheet, null, { tall: true });
    } catch (e) { fail(my, e, rv.retry); }
  }
  function recetaSheet() {
    const r = rv.r;
    return `<div class="rec-head"><span class="em xl">${esc(r.emoji)}</span><div><small>${esc(r.categoria)} · ${ico('clock')} ${r.minutos} min · ${r.porciones} porciones</small><h2>${esc(r.nombre)}</h2><span class="pill ai">${ico('sparkles')} Sugerida por IA</span></div></div>
      ${r.usaPorVencer.length ? `<div class="info">${ico('leaf')} Aprovecha: ${r.usaPorVencer.map(esc).join(', ')}</div>` : ''}
      <h4 class="sec-title">Ingredientes</h4>
      <div class="list compact">${rv.ings.map(g => {
        const u = g.unidad;
        const h = g.m ? Pantry.have(g.m.c, g.m.i, g.m.v, u) : { q: 0 };
        const st = h.approx || h.q >= g.cant ? ['ok', 'en casa'] : h.q > 0 ? ['part', `faltan ${Units.fmt(Units.round(g.cant - h.q, u), u)}`] : ['miss', 'falta'];
        return `<div class="row ing ${st[0]}"><span class="em">${g.m ? Catalog.item(g.m.c, g.m.i).emoji : '📦'}</span><span class="grow">${esc(g.nombre)}<small>${st[1]}</small></span><b>${Units.fmt(g.cant, u)}</b></div>`;
      }).join('')}</div>
      <h4 class="sec-title">Preparación</h4><ol class="steps">${r.pasos.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      ${r.nota ? `<p class="hint">${ico('info')} ${esc(r.nota)}</p>` : ''}
      <p class="hint">${ico('alert')} Revisa la receta antes de cocinar: al guardarla, la app aplica los mismos avisos de dietas y salud que al resto del recetario.</p>
      <div class="btn-col">
        <button class="btn primary block lg" data-act="chefSave">${ico('book')} Guardar en mi recetario</button>
        <button class="btn ghost block" data-act="chefAgain">${ico('sync')} Otra idea</button>
      </div>`;
  }
  Actions.chefAgain = () => { run++; UI.close(); chefCall(); };
  Actions.chefSave = () => {
    const r = rv.r;
    const ings = rv.ings.map(g => { const m = g.m || AI.ensureCustom(g.nombre, g.unidad); return { c: m.c, i: m.i, v: m.v, q: g.cant, u: g.unidad }; });
    const id = 'rc_ia_' + Catalog.slug(r.nombre).slice(0, 30) + '_' + Date.now().toString(36).slice(-4);
    Store.state.recipes[id] = {
      id, name: r.nombre, emoji: r.emoji, cat: r.categoria, min: r.minutos, serves: r.porciones, ings,
      steps: [...r.pasos, ...(r.nota ? ['💡 ' + r.nota] : [])], custom: true, ai: true, t: Store.now(),
    };
    Store.log('menu', `guardó la receta "${r.nombre}" sugerida por el Chef IA`);
    Store.commit();
    run++; UI.closeAll();
    UI.toast('Receta guardada en tu recetario', { icon: 'book' });
    setTimeout(() => MenuView.openRec(id, r.porciones), 120);
  };

  /* =================== Entradas desde la despensa =================== */
  Actions.aiPantryMenu = () => {
    if (!can()) return;
    UI.open('Agregar con IA', () => `
      <label class="ai-opt" for="aiBolIn"><span class="ai-opt-ico">${ico('receipt')}</span><span><b>Boleta del súper</b><small>Pasa lo comprado a la despensa y, si quieres, registra el gasto.</small></span>${ico('chevR', 'muted')}</label>
      <label class="ai-opt" for="aiFridgeIn"><span class="ai-opt-ico">${ico('camera')}</span><span><b>Foto del refri o la despensa</b><small>La IA reconoce los productos y te propone el inventario.</small></span>${ico('chevR', 'muted')}</label>
      <input type="file" id="aiBolIn" accept="image/*" capture="environment" hidden data-change="aiBolFile">
      <input type="file" id="aiFridgeIn" accept="image/*" capture="environment" hidden data-change="aiFridgeFile">
      <p class="hint">${privacy('la foto')}</p>`);
  };
  Actions.aiFridgeFile = el => { const f = el.files && el.files[0]; el.value = ''; if (!f) return; UI.close(); despensaFoto(f); };
  Actions.aiBolFile = async el => {
    const f = el.files && el.files[0]; el.value = '';
    if (!f) return;
    UI.close();
    let photoId = null;
    try { photoId = await Photos.add(f); } catch { UI.toast('No se pudo leer la imagen', { type: 'err' }); return; }
    boleta({
      photo: photoId, dest: 'despensa', onUse: res => {
        if (res.expense) {
          const mem = Store.state.household.members;
          const me = Store.me() && mem.includes(Store.me()) ? Store.me() : mem[0] || '';
          const items = res.items.concat(res.propina ? [{ n: 'Propina', q: 1, u: 'un', price: res.propina }] : []);
          Store.state.expenses.unshift({
            id: Store.uid('exp_'), amount: res.total, cat: res.categoria, desc: res.desc, date: res.fecha || Money.today(), payer: me, among: mem.slice(),
            method: res.medioPago || 'Débito', docType: res.tipoDoc || 'Boleta', docNum: res.nDoc, photos: [photoId], notes: 'Leída con IA', items, created: Store.now(), t: Store.now(),
          });
          Store.log('money', `registró una boleta de ${Money.fmt(res.total)} leída con IA`);
          UI.toast(`Gasto de ${Money.fmt(res.total)} registrado en Plata`, { icon: 'receipt' });
        }
        Store.commit();
      },
    });
  };

  return { boleta, despensaFoto, openLista, openChef };
})();

Actions.aiListOpen = () => AIView.openLista();
Actions.aiChef = () => AIView.openChef();
