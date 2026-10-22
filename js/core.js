/* despensAPP · Núcleo: unidades, estado, despensa, lista y finanzas */

/* ================= Unidades ================= */
const Units = {
  list: ['un', 'g', 'kg', 'ml', 'L'],
  grp(u) { return u === 'g' || u === 'kg' ? 'm' : u === 'ml' || u === 'L' ? 'v' : 'c'; },
  factor(u) { return u === 'kg' || u === 'L' ? 1000 : 1; },
  // Convierte q (en u) a base del grupo para un ítem del catálogo
  base(item, q, u) {
    if (u === 'un' && item && item.size) return { grp: Units.grp(item.size.u), v: q * item.size.q * Units.factor(item.size.u) };
    return { grp: Units.grp(u), v: q * Units.factor(u) };
  },
  // Convierte un valor base de grupo a unidad u (si se puede)
  fromBase(item, v, grp, u) {
    if (u === 'un' && item && item.size && Units.grp(item.size.u) === grp) return v / (item.size.q * Units.factor(item.size.u));
    if (Units.grp(u) === grp) return v / Units.factor(u);
    return null;
  },
  convert(item, q, from, to) {
    if (from === to) return q;
    const b = Units.base(item, q, from);
    return Units.fromBase(item, b.v, b.grp, to);
  },
  num(n, d = 2) {
    const r = Math.round(n * 10 ** d) / 10 ** d;
    return r.toLocaleString('es-CL', { maximumFractionDigits: d });
  },
  fmt(q, u) {
    if (q == null || isNaN(q)) return '';
    if (u === 'g' && q >= 1000) return Units.num(q / 1000) + ' kg';
    if (u === 'ml' && q >= 1000) return Units.num(q / 1000) + ' L';
    if (u === 'kg' && q < 1) return Units.num(q * 1000, 0) + ' g';
    if (u === 'L' && q < 1) return Units.num(q * 1000, 0) + ' ml';
    return Units.num(q) + ' ' + u;
  },
  fmtA(a) {
    const parts = Object.entries(a || {}).filter(([, q]) => q > 0).map(([u, q]) => Units.fmt(q, u));
    return parts.length ? parts.join(' + ') : '0';
  },
  round(q, u) {
    if (u === 'un') return Math.max(0.5, Math.ceil(q * 2 - 1e-9) / 2);
    if (u === 'kg' || u === 'L') return Math.ceil(q * 100 - 1e-9) / 100;
    return Math.ceil(q - 1e-9);
  },
  step(u) { return u === 'kg' || u === 'L' ? 0.5 : u === 'g' || u === 'ml' ? 100 : 1; },
};

/* ================= Store ================= */
const Store = (() => {
  // Varios hogares: registro en 'despensapp-homes'. El hogar original (h1) conserva las claves antiguas.
  const REG = 'despensapp-homes';
  const DEV = 'despensapp-dev';
  const keyOf = id => id === 'h1' ? 'despensapp-v1' : 'despensapp-v1:' + id;
  const meOf = id => id === 'h1' ? 'despensapp-me' : 'despensapp-me:' + id;
  let reg = null;
  function readReg() {
    try { reg = JSON.parse(localStorage.getItem(REG) || 'null'); } catch { reg = null; }
    if (!reg || !Array.isArray(reg.homes) || !reg.homes.length) {
      let code = '';
      try { code = localStorage.getItem('despensapp-hogar') || ''; } catch {}
      reg = { active: 'h1', homes: [{ id: 'h1', name: 'Mi Hogar', code }] };
      writeReg();
    }
    if (!reg.homes.some(h => h.id === reg.active)) reg.active = reg.homes[0].id;
    return reg;
  }
  function writeReg() { try { localStorage.setItem(REG, JSON.stringify(reg)); } catch {} }
  const KEY_ACTIVE = () => keyOf(readRegCached().active);
  function readRegCached() { return reg || readReg(); }
  const listeners = [];
  let saveTimer = null;

  function uid(p = '') { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function now() { return Date.now(); }

  function defaults() {
    return {
      v: 1,
      household: {
        name: 'Mi Hogar', currency: 'CLP', budget: 150000, period: 'mes', shopBudget: 80000,
        members: [], diets: {}, t: 0,
      },
      pantry: { items: {} },
      shop: { sel: {}, custom: {}, extraVar: {}, mode: false },
      expenses: [],
      menu: [],
      recipes: {},
      log: [],
      tomb: {},
    };
  }

  function migrate(s) {
    const d = defaults();
    const out = Object.assign(d, s || {});
    out.household = Object.assign(defaults().household, out.household || {});
    out.pantry = Object.assign({ items: {} }, out.pantry || {});
    out.shop = Object.assign({ sel: {}, custom: {}, extraVar: {} }, out.shop || {});
    ['expenses', 'menu', 'log'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
    out.recipes = out.recipes || {};
    out.tomb = out.tomb || {};
    return out;
  }

  const S = {
    state: null,
    uid, now,
    dev: (() => { let d = null; try { d = localStorage.getItem(DEV); if (!d) { d = uid('d'); localStorage.setItem(DEV, d); } } catch { d = uid('d'); } return d; })(),

    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(KEY_ACTIVE()) || 'null'); } catch { raw = null; }
      S.state = migrate(raw);
      return S.state;
    },
    saveNow() {
      try { localStorage.setItem(KEY_ACTIVE(), JSON.stringify(S.state)); } catch (e) { console.warn('save', e); }
      S.syncHomeName();
    },
    save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(S.saveNow, 150);
    },
    replace(newState, opts = {}) {
      S.state = migrate(newState);
      S.saveNow();
      S.emit(opts);
    },
    on(fn) { listeners.push(fn); },
    emit(opts = {}) { listeners.forEach(fn => { try { fn(opts); } catch (e) { console.error(e); } }); },
    // Toda mutación pasa por aquí: guarda, notifica y sincroniza
    commit(opts = {}) {
      S.save();
      S.emit(opts);
      if (!opts.remote && typeof Sync !== 'undefined') Sync.schedule();
    },
    me() { try { return localStorage.getItem(meOf(readRegCached().active)) || ''; } catch { return ''; } },
    setMe(n) { try { localStorage.setItem(meOf(readRegCached().active), n); } catch {} },

    /* ---- Hogares ---- */
    homes() { return readRegCached().homes; },
    activeHome() { const r = readRegCached(); return r.homes.find(h => h.id === r.active); },
    setHomeCode(code) { const h = S.activeHome(); h.code = code || ''; writeReg(); },
    syncHomeName() { const h = S.activeHome(); if (h && S.state && h.name !== S.state.household.name) { h.name = S.state.household.name; writeReg(); } },
    switchHome(id) {
      clearTimeout(saveTimer); S.saveNow();
      readRegCached().active = id; writeReg();
      S.load(); S.emit({ home: true });
    },
    createHome(name) {
      clearTimeout(saveTimer); S.saveNow();
      const id = uid('h');
      readRegCached().homes.push({ id, name: name || 'Nuevo hogar', code: '' });
      reg.active = id; writeReg();
      S.state = migrate(null); S.state.household.name = name || 'Nuevo hogar'; S.state.household.t = now();
      S.saveNow(); S.emit({ home: true });
      return id;
    },
    deleteHome(id) {
      const r = readRegCached();
      if (r.homes.length < 2) return false;
      r.homes = r.homes.filter(h => h.id !== id);
      try { localStorage.removeItem(keyOf(id)); localStorage.removeItem(meOf(id)); } catch {}
      if (r.active === id) { r.active = r.homes[0].id; writeReg(); S.load(); S.emit({ home: true }); } else writeReg();
      return true;
    },
    // Mudanza de URL: recibe todas las claves 'despensapp*' del dominio anterior
    importMove(keys) {
      const emptyState = raw => { try { const s = JSON.parse(raw || 'null'); return !s || (!(s.household && s.household.members && s.household.members.length) && !Object.keys((s.pantry || {}).items || {}).length && !(s.expenses || []).length); } catch { return true; } };
      let inReg = null;
      try { inReg = JSON.parse(keys[REG] || 'null'); } catch {}
      if (!inReg || !Array.isArray(inReg.homes)) inReg = { active: 'h1', homes: [{ id: 'h1', name: 'Mi Hogar', code: keys['despensapp-hogar'] || '' }] };
      const r = readRegCached();
      const localEmpty = r.homes.every(h => emptyState(localStorage.getItem(keyOf(h.id))));
      if (localEmpty) {
        Object.entries(keys).forEach(([k, v]) => { if (k !== DEV) localStorage.setItem(k, v); });
        reg = null; readReg();
        return inReg.homes.length;
      }
      // Ya hay datos aquí: se agregan como hogares nuevos (o se combinan si comparten código)
      inReg.homes.forEach(ih => {
        const raw = keys[keyOf(ih.id)];
        if (!raw || emptyState(raw)) return;
        const same = ih.code && r.homes.find(h => h.code === ih.code);
        if (same) {
          const cur = migrate(JSON.parse(localStorage.getItem(keyOf(same.id)) || 'null'));
          const merged = Merge.state(cur, migrate(JSON.parse(raw)));
          localStorage.setItem(keyOf(same.id), JSON.stringify(merged));
        } else {
          const id = uid('h');
          r.homes.push({ id, name: ih.name, code: ih.code || '' });
          localStorage.setItem(keyOf(id), raw);
          const me = keys[meOf(ih.id)]; if (me) localStorage.setItem(meOf(id), me);
        }
      });
      writeReg();
      return inReg.homes.length;
    },
    isEmptyHome() { const s = S.state; return !s.household.members.length && !Object.keys(s.pantry.items).length && !s.expenses.length; },
    who() { return S.me() || 'Alguien'; },
    log(k, text) {
      S.state.log.unshift({ id: uid('l'), t: now(), who: S.who(), dev: S.dev, k, text });
      if (S.state.log.length > 300) S.state.log.length = 300;
    },
    tomb(key) { S.state.tomb[key] = now(); },
    touchHousehold() { S.state.household.t = now(); },
    reset() { S.state = defaults(); S.saveNow(); S.emit({}); },
    defaults,
  };
  return S;
})();

/* ================= Despensa ================= */
const Pantry = {
  key(c, i, v) { return `${c}|${i}|${v || ''}`; },
  split(key) { const [c, i, v] = key.split('|'); return { c, i, v }; },
  get(key) { return Store.state.pantry.items[key]; },
  entries() {
    return Object.entries(Store.state.pantry.items).filter(([, e]) => e && !e.del).map(([k, e]) => ({ key: k, ...e }));
  },
  total(e, grp) {
    const it = Catalog.item(e.c, e.i);
    let s = 0;
    Object.entries(e.a || {}).forEach(([u, q]) => { const b = Units.base(it, q, u); if (b.grp === grp) s += b.v; });
    return s;
  },
  isEmpty(e) { return !Object.values(e.a || {}).some(q => q > 0); },
  // Cantidad disponible expresada en unidad u. Considera variantes equivalentes (mismas etiquetas).
  have(c, i, v, u, flex = true) {
    const it = Catalog.item(c, i);
    const want = Units.base(it, 1, u).grp;
    const tg = Catalog.tags(c, i, v).slice().sort().join(',');
    let sum = 0, approx = false, exact = 0;
    Pantry.entries().forEach(e => {
      if (e.c !== c || e.i !== i) return;
      const same = (e.v || '') === (v || '');
      if (!same && (!flex || Catalog.tags(e.c, e.i, e.v).slice().sort().join(',') !== tg)) return;
      const tot = Pantry.total(e, want);
      if (tot > 0) { sum += tot; if (same) exact += tot; }
      else if (!Pantry.isEmpty(e)) approx = true; // hay stock pero en unidad no convertible
    });
    const q = Units.fromBase(it, sum, want, u);
    return { q: q || 0, approx: approx && !sum, exact: Units.fromBase(it, exact, want, u) || 0 };
  },
  add(c, i, v, q, u, opts = {}) {
    const key = Pantry.key(c, i, v);
    const items = Store.state.pantry.items;
    const e = items[key] && !items[key].del ? items[key] : { c, i, v: v || '', a: {}, exp: '', minStock: 0 };
    e.a = Object.assign({}, e.a);
    e.a[u] = Math.round(((e.a[u] || 0) + q) * 1000) / 1000;
    if (opts.exp) e.exp = opts.exp;
    if (opts.minStock != null) e.minStock = opts.minStock;
    delete e.del;
    e.t = Store.now();
    items[key] = e;
    return e;
  },
  // Descuenta q (en u) del ítem, primero variante exacta y luego equivalentes
  take(c, i, v, q, u) {
    const it = Catalog.item(c, i);
    const need = Units.base(it, q, u);
    let rest = need.v;
    const tg = Catalog.tags(c, i, v).slice().sort().join(',');
    const cands = Pantry.entries().filter(e => e.c === c && e.i === i &&
      ((e.v || '') === (v || '') || Catalog.tags(e.c, e.i, e.v).slice().sort().join(',') === tg))
      .sort((a, b) => ((a.v || '') === (v || '') ? -1 : 0) - ((b.v || '') === (v || '') ? -1 : 0));
    let unconv = false;
    cands.forEach(e => {
      if (rest <= 0) return;
      const real = Store.state.pantry.items[e.key];
      const tot = Pantry.total(real, need.grp);
      if (tot <= 0) { if (!Pantry.isEmpty(real)) unconv = true; return; }
      const use = Math.min(tot, rest);
      rest -= use;
      Pantry.setTotal(real, need.grp, tot - use);
    });
    // Sin conversión posible: descontamos 1 unidad nativa como aproximación
    if (rest > 0 && unconv && rest === need.v) {
      const e = Store.state.pantry.items[cands[0].key];
      const [uu] = Object.keys(e.a).filter(k => e.a[k] > 0);
      if (uu) { e.a[uu] = Math.max(0, e.a[uu] - (uu === 'un' ? 1 : Units.step(uu))); e.t = Store.now(); }
    }
    return rest;
  },
  // Re-expresa el total de un grupo en la unidad preferida del ítem
  setTotal(e, grp, val) {
    const it = Catalog.item(e.c, e.i);
    const a = Object.assign({}, e.a);
    const units = Object.keys(a).filter(u => Units.base(it, 1, u).grp === grp);
    const pref = units.includes('un') ? 'un' : units.includes('kg') ? 'kg' : units.includes('L') ? 'L' : units[0] || (grp === 'm' ? 'g' : grp === 'v' ? 'ml' : 'un');
    units.forEach(u => delete a[u]);
    const q = Units.fromBase(it, Math.max(0, val), grp, pref);
    a[pref] = Math.round((q || 0) * 1000) / 1000;
    e.a = a;
    e.t = Store.now();
  },
  remove(key) {
    const e = Store.state.pantry.items[key];
    if (!e) return;
    delete Store.state.pantry.items[key];
    Store.tomb('p:' + key);
  },
  daysTo(exp) {
    if (!exp) return null;
    const d = new Date(exp + 'T00:00:00');
    const t = new Date(); t.setHours(0, 0, 0, 0);
    return Math.round((d - t) / 86400000);
  },
  expState(e) {
    const d = Pantry.daysTo(e.exp);
    if (d == null) return 'none';
    if (d < 0) return 'bad';
    if (d < 5) return 'warn';
    return 'ok';
  },
  isLow(e) {
    if (!e.minStock) return false;
    const it = Catalog.item(e.c, e.i);
    const u = it.u;
    const grp = Units.base(it, 1, u).grp;
    const tot = Pantry.total(e, grp);
    const min = Units.base(it, e.minStock, u).v;
    if (tot === 0 && !Pantry.isEmpty(e)) return false;
    return tot < min;
  },
  lowList() { return Pantry.entries().filter(Pantry.isLow); },
  expiring() {
    return Pantry.entries().filter(e => ['bad', 'warn'].includes(Pantry.expState(e)) && !Pantry.isEmpty(e))
      .sort((a, b) => Pantry.daysTo(a.exp) - Pantry.daysTo(b.exp));
  },
};

/* ================= Lista de compras ================= */
const Shop = {
  key: Pantry.key,
  entries() {
    return Object.entries(Store.state.shop.sel).filter(([, e]) => e && !e.del).map(([k, e]) => ({ key: k, ...e }));
  },
  add(c, i, v, q, u, src) {
    const key = Shop.key(c, i, v);
    const sel = Store.state.shop.sel;
    const it = Catalog.item(c, i);
    let e = sel[key] && !sel[key].del ? sel[key] : null;
    if (e && !e.done) {
      const conv = Units.convert(it, q, u, e.u);
      if (conv != null) e.q = Units.round(e.q + conv, e.u);
      else { e.q = Units.round(e.q + 1, e.u); }
      if (src && !(e.src || []).includes(src)) e.src = [...(e.src || []), src];
      e.t = Store.now();
    } else {
      e = { c, i, v: v || '', q: Units.round(q, u), u, done: false, price: null, src: src ? [src] : [], t: Store.now() };
      sel[key] = e;
    }
    return e;
  },
  // Cuánto de este ítem ya está pedido en la lista (en unidad u)
  onList(c, i, v, u) {
    const e = Store.state.shop.sel[Shop.key(c, i, v)];
    if (!e || e.del || e.done) return 0;
    return Units.convert(Catalog.item(c, i), e.q, e.u, u) || 0;
  },
  // Calcula y agrega SOLO lo faltante para una lista de necesidades [{c,i,v,q,u}]
  sendMissing(needs, src) {
    const res = { added: [], covered: [] };
    needs.forEach(n => {
      const have = Pantry.have(n.c, n.i, n.v, n.u);
      const on = Shop.onList(n.c, n.i, n.v, n.u);
      if (have.approx) { res.covered.push(n); return; }
      const miss = n.q - have.q - on;
      if (miss > 0.0001) {
        // Productos que se compran por unidad (leche, aceite, ajo): redondeamos a envases enteros
        const it = Catalog.item(n.c, n.i);
        let q = Units.round(miss, n.u), u = n.u;
        if (it.u === 'un' && n.u !== 'un') {
          const cv = Units.convert(it, miss, n.u, 'un');
          if (cv != null) { q = Math.ceil(cv - 1e-9); u = 'un'; }
        }
        Shop.add(n.c, n.i, n.v, q, u, src);
        res.added.push({ ...n, q, u });
      } else res.covered.push(n);
    });
    return res;
  },
  remove(key) {
    delete Store.state.shop.sel[key];
    Store.tomb('s:' + key);
  },
  cartTotal() { return Shop.entries().filter(e => e.done).reduce((s, e) => s + (+e.price || 0), 0); },
  pending() { return Shop.entries().filter(e => !e.done); },
  // Cierra la compra: ítems comprados → despensa, devuelve borrador de gasto
  close() {
    const done = Shop.entries().filter(e => e.done);
    const items = [];
    done.forEach(e => {
      Pantry.add(e.c, e.i, e.v, e.q, e.u);
      items.push({ n: Catalog.label(e.c, e.i, e.v), q: e.q, u: e.u, price: +e.price || 0 });
      Shop.remove(e.key);
    });
    const total = items.reduce((s, x) => s + x.price, 0);
    return { items, total };
  },
};

/* ================= Finanzas ================= */
const Money = {
  fmt(n, cur) {
    cur = cur || (Store.state && Store.state.household.currency) || 'CLP';
    const dec = ['CLP', 'PYG', 'COP', 'JPY'].includes(cur) ? 0 : 2;
    try {
      return new Intl.NumberFormat('es-CL', { style: 'currency', currency: cur, maximumFractionDigits: dec, minimumFractionDigits: 0 }).format(n || 0);
    } catch { return '$' + Math.round(n || 0).toLocaleString('es-CL'); }
  },
  today() { const d = new Date(); return Money.iso(d); },
  iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; },
  range(period, offset = 0) {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    if (period === 'semana') {
      const day = (d.getDay() + 6) % 7; // lunes = 0
      const from = new Date(d); from.setDate(d.getDate() - day + offset * 7);
      const to = new Date(from); to.setDate(from.getDate() + 6);
      return { from: Money.iso(from), to: Money.iso(to), label: `Semana del ${from.getDate()}/${from.getMonth() + 1}` };
    }
    if (period === 'todo') return { from: '0000-01-01', to: '9999-12-31', label: 'Todo el historial' };
    const from = new Date(d.getFullYear(), d.getMonth() + offset, 1);
    const to = new Date(d.getFullYear(), d.getMonth() + offset + 1, 0);
    const label = from.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
    return { from: Money.iso(from), to: Money.iso(to), label: label.charAt(0).toUpperCase() + label.slice(1) };
  },
  list() { return Store.state.expenses.filter(e => !e.del); },
  inRange(r) { return Money.list().filter(e => e.date >= r.from && e.date <= r.to); },
  spent(r, opts = {}) {
    return Money.inRange(r).filter(e => opts.all || e.cat !== 'Ajuste').reduce((s, e) => s + (+e.amount || 0), 0);
  },
  byCat(list) {
    const m = {};
    list.filter(e => e.cat !== 'Ajuste').forEach(e => { m[e.cat] = (m[e.cat] || 0) + (+e.amount || 0); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  },
  // Balance por integrante: positivo = le deben, negativo = debe
  balances(list) {
    const b = {};
    Store.state.household.members.forEach(m => { b[m] = { paid: 0, share: 0 }; });
    list.forEach(e => {
      const amt = +e.amount || 0;
      const among = (e.among && e.among.length ? e.among : Store.state.household.members).filter(Boolean);
      if (!e.payer || !among.length) return;
      if (!b[e.payer]) b[e.payer] = { paid: 0, share: 0 };
      b[e.payer].paid += amt;
      const each = amt / among.length;
      among.forEach(m => { if (!b[m]) b[m] = { paid: 0, share: 0 }; b[m].share += each; });
    });
    return Object.entries(b).map(([m, x]) => ({ member: m, paid: x.paid, share: x.share, net: x.paid - x.share }));
  },
  settle(bal) {
    const debt = bal.filter(x => x.net < -0.5).map(x => ({ m: x.member, v: -x.net })).sort((a, b) => b.v - a.v);
    const cred = bal.filter(x => x.net > 0.5).map(x => ({ m: x.member, v: x.net })).sort((a, b) => b.v - a.v);
    const out = [];
    let i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      const v = Math.min(debt[i].v, cred[j].v);
      out.push({ from: debt[i].m, to: cred[j].m, amount: Math.round(v) });
      debt[i].v -= v; cred[j].v -= v;
      if (debt[i].v < 0.5) i++;
      if (cred[j].v < 0.5) j++;
    }
    return out;
  },
  CATS: [
    ['Supermercado', '🛒'], ['Almacén de barrio', '🏪'], ['Verdulería', '🥬'], ['Feria', '🧺'], ['Carnicería', '🥩'],
    ['Panadería', '🥖'], ['Farmacia', '💊'], ['Aseo', '🧽'], ['Mascotas', '🐾'], ['Delivery', '🛵'],
    ['Gas y agua', '🔥'], ['Otros', '📦'], ['Ajuste', '🤝'],
  ],
  METHODS: ['Débito', 'Crédito', 'Efectivo', 'Transferencia', 'Junaeb / Sodexo', 'Otro'],
  DOCS: ['Boleta', 'Factura', 'Ticket', 'Sin documento'],
  catEmoji(c) { const f = Money.CATS.find(x => x[0] === c); return f ? f[1] : '📦'; },
};

if (typeof module !== 'undefined') module.exports = { Units, Store, Pantry, Shop, Money };
