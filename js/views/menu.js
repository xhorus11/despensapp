/* despensAPP · Planificador de menú + Recetario inteligente */
const MenuView = (() => {
  const st = { sub: 'semana', week: 0, q: '', cat: '', onlyOk: false };
  const TYPES = ['Desayuno', 'Almuerzo', 'Once', 'Cena', 'Colación'];
  let rec = null;   // receta abierta { id, people }
  let sch = null;   // formulario de agendar
  let mealId = null;

  const people0 = () => Math.max(1, Store.state.household.members.length || 2);

  function weekDays() {
    const r = Money.range('semana', st.week);
    const d0 = new Date(r.from + 'T12:00:00');
    return Array.from({ length: 7 }, (_, k) => { const d = new Date(d0); d.setDate(d0.getDate() + k); return Money.iso(d); });
  }

  function ingStatus(n) {
    const h = Pantry.have(n.c, n.i, n.v, n.u);
    if (h.approx) return { s: 'ok', txt: 'hay (otra unidad)' };
    if (h.q >= n.q - 1e-6) return { s: 'ok', txt: 'en casa' };
    if (h.q > 0) return { s: 'part', txt: `faltan ${Units.fmt(Units.round(n.q - h.q, n.u), n.u)}` };
    return { s: 'miss', txt: 'falta' };
  }

  function mealNeeds(m) {
    const r = Recipes.get(m.recipeId);
    return r ? Recipes.needs(r, m.people || people0(), m.diet || 'aparte') : [];
  }

  /* ---------- Semana ---------- */
  function renderWeek() {
    const days = weekDays();
    const today = Money.today();
    const label = st.week === 0 ? 'Esta semana' : st.week === 1 ? 'Próxima semana' : st.week === -1 ? 'Semana pasada' : Money.range('semana', st.week).label;
    return `
      <div class="week-nav">
        <button class="icon-btn" data-act="menuWeek" data-d="-1">${ico('chevL')}</button>
        <div><b>${label}</b><small>${UI.fmtDate(days[0], { day: 'numeric', month: 'short' })} – ${UI.fmtDate(days[6], { day: 'numeric', month: 'short' })}</small></div>
        <button class="icon-btn" data-act="menuWeek" data-d="1">${ico('chevR')}</button>
      </div>
      <button class="btn ghost block sm" data-act="menuWeekMissing">${ico('send')} Enviar faltantes de la semana a Mi Lista</button>
      ${days.map(d => {
        const meals = Store.state.menu.filter(m => !m.del && m.date === d).sort((a, b) => TYPES.indexOf(a.type) - TYPES.indexOf(b.type));
        return `<div class="day ${d === today ? 'today' : ''} ${d < today ? 'past' : ''}">
          <div class="day-h"><b>${UI.fmtDate(d, { weekday: 'long' })}</b><small>${UI.fmtDate(d, { day: 'numeric', month: 'short' })}</small>
            <button class="icon-btn sm" data-act="menuAddDay" data-date="${d}" aria-label="Agregar comida">${ico('plus')}</button></div>
          ${meals.map(m => {
            const r = Recipes.get(m.recipeId);
            const miss = !m.cooked && r ? mealNeeds(m).filter(n => ingStatus(n).s !== 'ok').length : 0;
            return `<button class="meal ${m.cooked ? 'cooked' : ''}" data-act="menuMeal" data-id="${m.id}">
              <span class="em">${r ? r.emoji : '🍽️'}</span>
              <span class="grow"><small>${esc(m.type)} · ${m.people || people0()} pers.</small><b>${esc(m.title)}</b></span>
              ${m.cooked ? `<span class="pill ok">${ico('check')} cocinado</span>` : r ? (miss ? `<span class="pill warn">${miss} faltan</span>` : `<span class="pill ok">listo</span>`) : ''}
            </button>`;
          }).join('')}
        </div>`;
      }).join('')}`;
  }

  /* ---------- Recetario ---------- */
  function renderBook() {
    const q = Catalog.slug(st.q).replace(/-/g, ' ');
    let list = Recipes.all();
    if (q) list = list.filter(r => Catalog.slug(r.name).replace(/-/g, ' ').includes(q) || r.ings.some(g => Catalog.slug(Catalog.item(g.c, g.i).name).replace(/-/g, ' ').includes(q)));
    if (st.cat === '__can') list = list.filter(r => r.ings.every(n => ingStatus({ ...n }).s === 'ok'));
    else if (st.cat) list = list.filter(r => r.cat === st.cat);
    if (st.onlyOk) list = list.filter(r => Recipes.compat(r).every(x => (x.ok || x.fixable) && !x.cautions));
    const anyDiet = Store.state.household.members.some(m => Diet.forbidden(m).length || Diet.cautionTags(m).length || Diet.bannedItems(m).length);
    return `
      <div class="toolbar">
        <div class="search-box">${ico('search')}<input type="search" placeholder="Receta o ingrediente…" value="${esc(st.q)}" data-input="menuSearch"></div>
        <button class="icon-btn" data-act="recNew" aria-label="Nueva receta">${ico('plus')}</button>
      </div>
      <div class="chips scroll">
        <button class="chip ${!st.cat ? 'on' : ''}" data-act="menuCat" data-val="">Todas</button>
        <button class="chip ${st.cat === '__can' ? 'on' : ''}" data-act="menuCat" data-val="__can">${ico('pantry')} Con lo que hay</button>
        ${anyDiet ? `<button class="chip ${st.onlyOk ? 'on' : ''}" data-act="menuOnlyOk">${ico('leaf')} Aptas para todos</button>` : ''}
        ${Recipes.cats().map(c => `<button class="chip ${st.cat === c ? 'on' : ''}" data-act="menuCat" data-val="${esc(c)}">${esc(c)}</button>`).join('')}
      </div>
      <p class="hint">${list.length} recetas</p>
      <div class="rec-grid" id="recGrid">${list.map(r => {
        const comp = Recipes.compat(r);
        const have = r.ings.filter(n => ingStatus(n).s === 'ok').length;
        return `<button class="rec-card" data-act="recOpen" data-id="${r.id}">
          <span class="em">${r.emoji}</span><b>${esc(r.name)}</b>
          <small>${ico('clock')} ${r.min} min · ${esc(r.cat)}</small>
          <span class="rec-foot"><span class="have" style="--p:${Math.round(have / r.ings.length * 100)}%">${have}/${r.ings.length}</span>
          ${comp.map(x => `<span class="dot ${x.ok ? (x.cautions ? 'caution' : 'ok') : x.fixable ? 'warn' : 'bad'}" title="${esc(x.member)}">${esc(x.member[0] || '?')}</span>`).join('')}</span>
        </button>`;
      }).join('') || UI.empty('book', 'Sin recetas', 'Prueba otra búsqueda.')}</div>`;
  }

  function render() {
    return `<div class="mode-switch">
        <button class="seg ${st.sub === 'semana' ? 'on' : ''}" data-act="menuSub" data-val="semana">${ico('calendar')} Semana</button>
        <button class="seg ${st.sub === 'book' ? 'on' : ''}" data-act="menuSub" data-val="book">${ico('book')} Recetario</button>
      </div>
      ${st.sub === 'semana' ? renderWeek() : renderBook()}
      <button class="fab" data-act="${st.sub === 'semana' ? 'menuAddDay' : 'recNew'}" data-date="${Money.today()}" aria-label="Agregar">${ico('plus')}</button>`;
  }

  /* ---------- Ficha de receta ---------- */
  function recSheet() {
    const r = Recipes.get(rec.id);
    const needs = Recipes.needs(r, rec.people, rec.diet || 'aparte');
    const comp = Recipes.compat(r);
    const miss = needs.filter(n => ingStatus(n).s !== 'ok').length;
    return `
      <div class="rec-head"><span class="em xl">${r.emoji}</span><div><small>${esc(r.cat)} · ${ico('clock')} ${r.min} min</small><h2>${esc(r.name)}</h2></div></div>
      <div class="qty-row slim">
        <span class="lbl">Personas</span>
        <button class="icon-btn" data-act="recPeople" data-d="-1">${ico('minus')}</button><b class="qty-b">${rec.people}</b>
        <button class="icon-btn" data-act="recPeople" data-d="1">${ico('plus')}</button>
      </div>
      ${comp.length ? `<div class="compat">${comp.map(x => `<span class="pill ${x.ok ? (x.cautions ? 'caution' : 'ok') : x.fixable ? 'warn' : 'bad'}">${x.ok && !x.cautions ? ico('check') : ico('alert')} ${esc(x.member)}${x.ok ? (x.cautions ? ' precaución' : ' apto') : x.fixable ? ' adaptable' : ' no apto'}</span>`).join('')}</div>
        ${comp.some(x => !x.ok || x.cautions) ? guardHtml(r, rec.diet || 'aparte') : ''}
        ${comp.some(x => !x.ok) ? `<label class="lbl">Restricciones</label>${UI.chips([['aparte', 'Porción aparte'], ['apto', 'Todo el plato apto'], ['no', 'Sin adaptar']], rec.diet || 'aparte', 'recDiet')}` : ''}` : ''}
      <h4 class="sec-title">Ingredientes <small>${miss ? `${miss} faltan` : 'tienes todo'}</small></h4>
      <div class="list compact">${needs.map(n => {
        const s = ingStatus(n);
        return `<div class="row ing ${s.s}"><span class="em">${Catalog.item(n.c, n.i).emoji}</span>
          <span class="grow">${esc(Catalog.label(n.c, n.i, n.v))}<small>${s.txt}${n.note ? ' · ' + esc(n.note) : ''}</small></span><b>${Units.fmt(n.q, n.u)}</b></div>`;
      }).join('')}</div>
      ${r.steps && r.steps.length ? `<h4 class="sec-title">Preparación</h4><ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      <div class="btn-col">
        <button class="btn primary block lg" data-act="recSchedule">${ico('calendar')} Agendar en el menú</button>
        <div class="grid2">
          <button class="btn ghost" data-act="recMissing" ${miss ? '' : 'disabled'}>${ico('cart')} Faltantes a lista</button>
          <button class="btn ghost" data-act="recCook">${ico('chef')} Cociné esto</button>
        </div>
        ${r.custom ? `<button class="btn danger ghost block" data-act="recDelete">${ico('trash')} Eliminar receta</button>` : ''}
      </div>`;
  }
  function openRec(id, people, diet) {
    rec = { id, people: people || people0(), diet: diet || 'aparte' };
    const r = Recipes.get(id);
    UI.open(esc(r.name), recSheet, null, { tall: true });
  }

  /* ---------- Agendar ---------- */
  function schSheet() {
    const days = Array.from({ length: 14 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() + k); return Money.iso(d); });
    const r = sch.recipeId ? Recipes.get(sch.recipeId) : null;
    const comp = r ? Recipes.compat(r) : [];
    return `
      ${r ? `<div class="row"><span class="em">${r.emoji}</span><span class="grow"><b>${esc(r.name)}</b><small>${r.min} min</small></span><button class="btn sm ghost" data-act="schPickRecipe">Cambiar</button></div>`
        : `<label class="lbl">¿Qué vamos a comer?</label>
           <input id="schTitle" placeholder="Ej: Asado, Delivery, Sobras…" value="${esc(sch.title || '')}">
           <button class="btn ghost block" data-act="schPickRecipe">${ico('book')} Elegir del recetario</button>`}
      <label class="lbl">Día</label>
      <div class="chips scroll">${days.map(d => `<button class="chip ${d === sch.date ? 'on' : ''}" data-act="schDate" data-val="${d}">${UI.fmtDate(d)}</button>`).join('')}
        <input type="date" class="chip-date" value="${sch.date}" data-change="schDateIn"></div>
      <label class="lbl">Comida</label>
      ${UI.chips(TYPES, sch.type, 'schType')}
      <div class="qty-row slim"><span class="lbl">Personas</span>
        <button class="icon-btn" data-act="schPeople" data-d="-1">${ico('minus')}</button><b class="qty-b">${sch.people}</b>
        <button class="icon-btn" data-act="schPeople" data-d="1">${ico('plus')}</button></div>
      ${comp.some(x => !x.ok) ? `<label class="lbl">${ico('leaf')} Restricciones (${comp.filter(x => !x.ok).map(x => esc(x.member)).join(', ')})</label>
        ${UI.chips([['aparte', 'Porción aparte'], ['apto', 'Todo el plato apto'], ['no', 'Sin adaptar']], sch.diet, 'schDiet')}
        <p class="hint">${sch.diet === 'aparte' ? 'Se compra la versión apta solo para quien la necesita.' : sch.diet === 'apto' ? 'Todo el plato se prepara con versiones aptas.' : 'Se usará la receta original.'}</p>` : ''}
      ${r ? `<label class="check-line"><input type="checkbox" id="schSend" ${sch.send ? 'checked' : ''}> Enviar a Mi Lista solo lo que falta</label>` : ''}
      <button class="btn primary block lg" data-act="schSave">${ico('check')} ${sch.id ? 'Guardar cambios' : 'Agendar'}</button>`;
  }
  function openSchedule(data) {
    sch = Object.assign({ id: null, recipeId: null, title: '', date: Money.today(), type: new Date().getHours() < 11 ? 'Almuerzo' : new Date().getHours() < 16 ? 'Almuerzo' : 'Cena', people: people0(), diet: 'aparte', send: true }, data);
    UI.open(sch.id ? 'Editar comida' : 'Agendar comida', schSheet);
  }

  /* ---------- Faltantes / cocinar ---------- */
  function sendMissing(id, noCommit) {
    const m = Store.state.menu.find(x => x.id === id);
    const r = Recipes.get(m.recipeId);
    if (!r) return { added: [], covered: [] };
    const res = Shop.sendMissing(mealNeeds(m), `· para ${m.title} (${UI.fmtDate(m.date, { weekday: 'short' })})`);
    m.sent = Store.now(); m.t = Store.now();
    if (res.added.length) Store.log('shop', `envió ${res.added.length} faltantes de "${m.title}" a la lista`);
    if (!noCommit) Store.commit();
    return res;
  }
  function cook(needs, title) {
    const short = [];
    needs.forEach(n => { const rest = Pantry.take(n.c, n.i, n.v, n.q, n.u); if (rest > 1e-6) short.push(n); });
    Store.log('menu', `cocinó ${title} y descontó ${needs.length} ingredientes de la despensa`);
    return short;
  }

  /* ---------- Aviso previo: dietas, alergias y salud ---------- */
  function guardHtml(r, mode) {
    const is = Recipes.issues(r, mode);
    const tg = t => TAG_NAMES[t] || t;
    return `<div class="guard">
      <div class="guard-h">${ico('alert')}<div><b>Antes de usar "${esc(r.name)}"</b><small>Restricciones y salud de la casa</small></div></div>
      ${is.blocks.map(x => `<div class="gi bad">${ico('x')}<div><b>${esc(x.member)} no puede comer esto</b><small>${esc(x.bad.join(', '))}${x.fixable ? ' (elegiste "Sin adaptar")' : ' — no hay alternativa en el catálogo'}</small></div></div>`).join('')}
      ${is.adapted.map(x => `<div class="gi warn">${ico('leaf')}<div><b>Se adaptará para ${esc(x.member)}</b><small>${esc(x.bad.join(', '))} → versión apta (${mode === 'apto' ? 'todo el plato' : 'porción aparte'})</small></div></div>`).join('')}
      ${is.cautions.map(x => `<div class="gi caution">${ico('info')}<div><b>Precaución para ${esc(x.member)} · ${esc(x.cautions.conds.join(', '))}</b><small>${esc(x.cautions.items.join(', '))} — ${esc(x.cautions.tags.map(tg).join(', '))}. Modera la porción o busca una alternativa.</small></div></div>`).join('')}
    </div>`;
  }
  let guardFn = null;
  function guard(r, mode, proceed) {
    const is = Recipes.issues(r, mode);
    if (!is.blocks.length && !is.adapted.length && !is.cautions.length) { proceed(); return; }
    guardFn = proceed;
    UI.open('Aviso de salud y dietas', () => `${guardHtml(r, mode)}
      <div class="btn-col"><button class="btn primary block lg" data-act="guardOk">${ico('check')} Entendido, continuar</button>
      <button class="btn ghost block" data-act="sheetBack">Volver</button></div>`);
    UI.haptic([12, 50, 12]);
  }
  Actions.guardOk = () => { const f = guardFn; guardFn = null; UI.close(); if (f) f(); };

  /* ---------- Acciones ---------- */
  Actions.menuSub = el => { st.sub = el.dataset.val; App.render(); };
  Actions.menuWeek = el => { st.week += +el.dataset.d; App.render(); };
  Actions.menuSearch = el => { st.q = el.value; const g = $('#recGrid'); const t = document.createElement('div'); t.innerHTML = renderBook(); g.innerHTML = t.querySelector('#recGrid').innerHTML; };
  Actions.menuCat = el => { st.cat = el.dataset.val; App.render(); };
  Actions.menuOnlyOk = () => { st.onlyOk = !st.onlyOk; App.render(); };
  Actions.menuAddDay = el => openSchedule({ date: el.dataset.date || Money.today() });
  Actions.menuWeekMissing = () => {
    let n = 0;
    weekDays().forEach(d => Store.state.menu.filter(m => !m.del && !m.cooked && m.recipeId && m.date === d).forEach(m => { n += sendMissing(m.id, true).added.length; }));
    Store.commit();
    UI.toast(n ? `${n} faltantes agregados a Mi Lista` : 'Tienes todo lo de la semana', { icon: 'cart' });
  };
  Actions.recOpen = el => openRec(el.dataset.id);
  Actions.recPeople = el => { rec.people = Math.max(1, rec.people + (+el.dataset.d)); UI.refresh(); };
  Actions.recDiet = el => { rec.diet = el.dataset.val; UI.refresh(); };
  Actions.recSchedule = () => {
    const r = Recipes.get(rec.id);
    guard(r, rec.diet, () => { sch = null; openSchedule({ recipeId: r.id, title: r.name, people: rec.people, diet: rec.diet, guarded: true }); });
  };
  Actions.recMissing = () => guard(Recipes.get(rec.id), rec.diet, recMissingGo);
  const recMissingGo = () => {
    const r = Recipes.get(rec.id);
    const res = Shop.sendMissing(Recipes.needs(r, rec.people, rec.diet), `· para ${r.name}`);
    Store.log('shop', `envió ${res.added.length} faltantes de "${r.name}" a la lista`);
    Store.commit(); UI.refresh();
    UI.toast(res.added.length ? `${res.added.length} faltantes a Mi Lista` : 'Tienes todo', { icon: 'cart' });
  };
  Actions.recCook = el => UI.confirmTap(el, () => guard(Recipes.get(rec.id), rec.diet, () => {
    const r = Recipes.get(rec.id);
    const short = cook(Recipes.needs(r, rec.people, rec.diet), r.name);
    Store.commit(); UI.refresh();
    UI.toast(short.length ? `Descontado. ${short.length} ingredientes no estaban completos` : 'Ingredientes descontados de la despensa', { icon: 'chef' });
  }), 'Descontar de la despensa');
  Actions.recDelete = el => UI.confirmTap(el, () => {
    const r = Store.state.recipes[rec.id]; r.del = true; r.t = Store.now();
    Store.tomb('r:' + rec.id); delete Store.state.recipes[rec.id];
    Store.commit(); UI.closeAll();
  });

  Actions.schPickRecipe = () => {
    const t = $('#schTitle'); if (t) sch.title = t.value;
    UI.open('Elegir receta', () => `<div class="search-box">${ico('search')}<input type="search" placeholder="Buscar receta" data-input="schRecSearch" autofocus></div>
      <div class="list" id="schRecList">${schRecList('')}</div>`, null, { tall: true });
  };
  function schRecList(q) {
    const nq = Catalog.slug(q).replace(/-/g, ' ');
    return Recipes.all().filter(r => !nq || Catalog.slug(r.name).replace(/-/g, ' ').includes(nq)).map(r =>
      `<button class="row" data-act="schRecPick" data-id="${r.id}"><span class="em">${r.emoji}</span><span class="grow"><b>${esc(r.name)}</b><small>${esc(r.cat)} · ${r.min} min</small></span></button>`).join('');
  }
  Actions.schRecSearch = el => { $('#schRecList').innerHTML = schRecList(el.value); };
  Actions.schRecPick = el => { const r = Recipes.get(el.dataset.id); sch.recipeId = r.id; sch.title = r.name; sch.guarded = false; UI.close(); };
  Actions.schDate = el => { sch.date = el.dataset.val; const t = $('#schTitle'); if (t) sch.title = t.value; UI.refresh(); };
  Actions.schDateIn = el => { if (el.value) { sch.date = el.value; UI.refresh(); } };
  Actions.schType = el => { sch.type = el.dataset.val; const t = $('#schTitle'); if (t) sch.title = t.value; UI.refresh(); };
  Actions.schPeople = el => { sch.people = Math.max(1, sch.people + (+el.dataset.d)); const t = $('#schTitle'); if (t) sch.title = t.value; UI.refresh(); };
  Actions.schDiet = el => { sch.diet = el.dataset.val; sch.guarded = false; UI.refresh(); };
  Actions.schSave = () => {
    const t = $('#schTitle'); if (t) sch.title = t.value.trim();
    const rr = sch.recipeId && Recipes.get(sch.recipeId);
    if (rr && !sch.guarded) { sch.sendChk = ($('#schSend') || {}).checked; guard(rr, sch.diet, () => { sch.guarded = true; Actions.schSave(); }); return; }
    if (!sch.title) { UI.toast('Escribe qué van a comer o elige una receta', { type: 'err' }); return; }
    const send = $('#schSend') ? $('#schSend').checked : !!sch.sendChk;
    let m = sch.id ? Store.state.menu.find(x => x.id === sch.id) : null;
    const data = { type: sch.type, title: sch.title, date: sch.date, recipeId: sch.recipeId, people: sch.people, diet: sch.diet, t: Store.now() };
    if (m) Object.assign(m, data);
    else { m = { id: Store.uid('ev_'), cooked: false, ...data }; Store.state.menu.push(m); }
    Store.log('menu', `${sch.id ? 'editó' : 'agendó'} ${m.title} para el ${UI.fmtDate(m.date)}`);
    let msg = sch.id ? 'Comida actualizada' : 'Agendado en el menú';
    if (send && m.recipeId) { const r = sendMissing(m.id, true); msg += r.added.length ? ` · ${r.added.length} faltantes a la lista` : ' · tienes todo'; }
    Store.commit(); UI.closeAll(); UI.toast(msg, { icon: 'calendar' });
    if (App.tab === 'menu') { st.sub = 'semana'; App.render(); }
  };

  /* ---------- Hoja de una comida agendada ---------- */
  function mealSheet() {
    const m = Store.state.menu.find(x => x.id === mealId);
    if (!m) return '';
    const r = Recipes.get(m.recipeId);
    const needs = r ? mealNeeds(m) : [];
    return `
      <div class="rec-head"><span class="em xl">${r ? r.emoji : '🍽️'}</span><div><small>${esc(m.type)} · ${UI.fmtDate(m.date, { weekday: 'long', day: 'numeric', month: 'long' })}</small><h2>${esc(m.title)}</h2>
        <small>${m.people || people0()} personas${r && m.diet && m.diet !== 'no' ? ' · ' + (m.diet === 'aparte' ? 'porción aparte' : 'todo apto') : ''}</small></div></div>
      ${needs.length ? `<div class="list compact">${needs.map(n => { const s = m.cooked ? { s: 'ok', txt: 'usado' } : ingStatus(n); return `<div class="row ing ${s.s}"><span class="em">${Catalog.item(n.c, n.i).emoji}</span><span class="grow">${esc(Catalog.label(n.c, n.i, n.v))}<small>${s.txt}${n.note ? ' · ' + esc(n.note) : ''}</small></span><b>${Units.fmt(n.q, n.u)}</b></div>`; }).join('')}</div>` : ''}
      <div class="btn-col">
        ${!m.cooked && r ? `<button class="btn primary block lg" data-act="mealCook">${ico('chef')} Cocinado → descontar de la despensa</button>
          <button class="btn ghost block" data-act="mealMissing">${ico('cart')} Enviar faltantes a Mi Lista</button>` : ''}
        ${!m.cooked && !r ? `<button class="btn primary block" data-act="mealDone">${ico('check')} Marcar como listo</button>` : ''}
        ${m.cooked ? `<button class="btn ghost block" data-act="mealUncook">${ico('history')} Marcar como no cocinado</button>` : ''}
        <div class="grid2">
          ${r ? `<button class="btn ghost" data-act="mealRecipe">${ico('book')} Ver receta</button>` : '<span></span>'}
          <button class="btn ghost" data-act="mealEdit">${ico('edit')} Editar</button>
        </div>
        <button class="btn danger ghost block" data-act="mealDelete">${ico('trash')} Quitar del menú</button>
      </div>`;
  }
  const meal = () => Store.state.menu.find(x => x.id === mealId);
  Actions.menuMeal = el => { mealId = el.dataset.id; UI.open('Comida', mealSheet); };
  Actions.mealCook = el => UI.confirmTap(el, () => { const m0 = meal(); guard(Recipes.get(m0.recipeId), m0.diet, () => {
    const m = meal();
    const short = cook(mealNeeds(m), m.title);
    m.cooked = true; m.t = Store.now();
    Store.commit(); UI.closeAll();
    UI.toast(short.length ? `¡Buen provecho! (${short.length} ingredientes no alcanzaban)` : '¡Buen provecho! Despensa actualizada', { icon: 'chef' });
  }); }, 'Toca para descontar');
  Actions.mealDone = () => { const m = meal(); m.cooked = true; m.t = Store.now(); Store.commit(); UI.closeAll(); };
  Actions.mealUncook = () => { const m = meal(); m.cooked = false; m.t = Store.now(); Store.commit(); UI.refresh(); };
  Actions.mealMissing = () => { const r = sendMissing(mealId); UI.refresh(); UI.toast(r.added.length ? `${r.added.length} faltantes a Mi Lista` : 'Tienes todo en la despensa', { icon: 'cart' }); };
  Actions.mealRecipe = () => { const m = meal(); openRec(m.recipeId, m.people, m.diet); };
  Actions.mealEdit = () => { const m = meal(); UI.closeAll(); setTimeout(() => openSchedule({ ...m, send: false, guarded: true }), 50); };
  Actions.mealDelete = el => UI.confirmTap(el, () => {
    const m = meal();
    Store.state.menu = Store.state.menu.filter(x => x.id !== mealId);
    Store.tomb('m:' + mealId);
    Store.log('menu', `quitó ${m.title} del menú`);
    Store.commit(); UI.closeAll();
  });

  /* ---------- Receta personalizada ---------- */
  let nr = null;
  function nrSheet() {
    return `<div class="grid2 r13"><div><label class="lbl">Emoji</label><input id="nrEmoji" value="${esc(nr.emoji)}" maxlength="4" class="center big"></div>
        <div><label class="lbl">Nombre</label><input id="nrName" value="${esc(nr.name)}" placeholder="Ej: Pollo de la abuela"></div></div>
      <div class="grid3">
        <div><label class="lbl">Categoría</label><input id="nrCat" value="${esc(nr.cat)}" list="nrCats"><datalist id="nrCats">${Recipes.cats().map(c => `<option>${esc(c)}</option>`).join('')}</datalist></div>
        <div><label class="lbl">Minutos</label><input id="nrMin" type="number" inputmode="numeric" value="${nr.min}"></div>
        <div><label class="lbl">Porciones</label><input id="nrServes" type="number" inputmode="numeric" value="${nr.serves}"></div>
      </div>
      <label class="lbl">Ingredientes</label>
      <div class="list compact">${nr.ings.map((g, k) => `<div class="row"><span class="em">${Catalog.item(g.c, g.i).emoji}</span><span class="grow">${esc(Catalog.label(g.c, g.i, g.v))}</span><b>${Units.fmt(g.q, g.u)}</b><button class="icon-btn sm" data-act="nrDelIng" data-k="${k}">${ico('x')}</button></div>`).join('') || '<p class="hint">Aún no hay ingredientes.</p>'}</div>
      <button class="btn ghost block" data-act="nrAddIng">${ico('plus')} Agregar ingrediente</button>
      <label class="lbl">Preparación (un paso por línea)</label>
      <textarea id="nrSteps" rows="4" placeholder="Picar la cebolla…">${esc(nr.steps.join('\n'))}</textarea>
      <button class="btn primary block lg" data-act="nrSave">${ico('check')} Guardar receta</button>`;
  }
  function nrRead() {
    nr.emoji = $('#nrEmoji').value || '🍽️'; nr.name = $('#nrName').value; nr.cat = $('#nrCat').value || 'Casera';
    nr.min = +$('#nrMin').value || 30; nr.serves = +$('#nrServes').value || 4;
    nr.steps = $('#nrSteps').value.split('\n').map(s => s.trim()).filter(Boolean);
  }
  Actions.recNew = () => { nr = { emoji: '🍽️', name: '', cat: 'Casera', min: 30, serves: 4, ings: [], steps: [] }; UI.open('Nueva receta', nrSheet, null, { tall: true }); };
  Actions.nrAddIng = () => { nrRead(); Picker.open({ mode: 'recipe', title: 'Ingrediente', onPick: c => { nr.ings.push({ c: c.c, i: c.i, v: c.v, q: c.q, u: c.u }); UI.refresh(); } }); };
  Actions.nrDelIng = el => { nrRead(); nr.ings.splice(+el.dataset.k, 1); UI.refresh(); };
  Actions.nrSave = () => {
    nrRead();
    if (!nr.name.trim() || !nr.ings.length) { UI.toast('Ponle nombre y al menos un ingrediente', { type: 'err' }); return; }
    const id = 'rc_' + Catalog.slug(nr.name) + '_' + Date.now().toString(36).slice(-4);
    Store.state.recipes[id] = { id, ...nr, name: nr.name.trim(), custom: true, t: Store.now() };
    Store.log('menu', `creó la receta ${nr.name.trim()}`);
    Store.commit(); UI.closeAll(); UI.toast('Receta guardada', { icon: 'book' });
    st.sub = 'book'; App.render();
  };

  return { render, sendMissing, openRec, openSchedule, TYPES };
})();
