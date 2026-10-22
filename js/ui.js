/* despensAPP · Utilidades de interfaz: sheets, toasts, confirmTap, delegación de eventos */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Registro de acciones: elementos con data-act="nombre" invocan Actions.nombre(el, ev) */
const Actions = {};

const UI = (() => {
  const stack = [];
  let wrap, body, sheetEl, pendingPop = false;

  function haptic(p = 8) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }

  function toast(msg, opts = {}) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast ' + (opts.type || '');
    t.innerHTML = `${ico(opts.icon || (opts.type === 'err' ? 'alert' : opts.type === 'live' ? 'bell' : 'check'))}<span>${msg}</span>` +
      (opts.action ? `<button class="toast-act">${esc(opts.action.label)}</button>` : '');
    if (opts.action) t.querySelector('.toast-act').onclick = () => { opts.action.fn(); dismiss(); };
    box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('in'));
    const dismiss = () => { t.classList.remove('in'); setTimeout(() => t.remove(), 300); };
    setTimeout(dismiss, opts.ms || (opts.action ? 5000 : 2600));
    t.addEventListener('click', e => { if (!e.target.closest('.toast-act')) dismiss(); });
    if (opts.type === 'live') haptic([10, 40, 10]);
  }

  function renderTop() {
    const top = stack[stack.length - 1];
    if (!top) return;
    const back = stack.length > 1;
    body.innerHTML = `<div class="sheet-head">
        ${back ? `<button class="icon-btn" data-act="sheetBack" aria-label="Volver">${ico('chevL')}</button>` : '<span class="sp"></span>'}
        <h3>${top.title || ''}</h3>
        <button class="icon-btn" data-act="sheetClose" aria-label="Cerrar">${ico('x')}</button>
      </div><div class="sheet-content">${top.render()}</div>`;
    if (top.after) top.after(body);
    const af = body.querySelector('[autofocus]');
    if (af && !matchMedia('(pointer:coarse)').matches) setTimeout(() => af.focus(), 250);
  }

  function open(title, render, after, opts = {}) {
    stack.push({ title, render, after, opts });
    wrap.classList.add('open');
    document.body.classList.add('noscroll');
    sheetEl.classList.toggle('tall', !!opts.tall);
    renderTop();
    body.scrollTop = 0;
    if (stack.length === 1) ensureGuard();
    haptic(6);
  }

  function replace(title, render, after, opts = {}) {
    stack[stack.length - 1] = { title, render, after, opts };
    sheetEl.classList.toggle('tall', !!opts.tall);
    renderTop();
  }

  function refresh() { const sc = body.querySelector('.sheet-content'); const y = sc ? sc.scrollTop : 0; renderTop(); const sc2 = body.querySelector('.sheet-content'); if (sc2) sc2.scrollTop = y; }

  function popInternal() {
    const top = stack.pop();
    if (top && top.opts.onClose) top.opts.onClose();
    if (!stack.length) {
      wrap.classList.remove('open');
      document.body.classList.remove('noscroll');
      setTimeout(() => { if (!stack.length) body.innerHTML = ''; }, 320);
    } else {
      sheetEl.classList.toggle('tall', !!stack[stack.length - 1].opts.tall);
      renderTop();
    }
  }

  // Historial: una sola entrada "guardia" mientras haya hojas abiertas, para que el botón atrás cierre la hoja.
  // Nunca se retrocede si la entrada actual no es nuestra (así no se sale de la app).
  const onGuard = () => !!(history.state && history.state.sheet);
  function ensureGuard() { if (!pendingPop && !onGuard()) { try { history.pushState({ sheet: 1 }, ''); } catch {} } }
  function leaveHistory() {
    if (pendingPop || !onGuard()) return;
    pendingPop = true;
    try { history.back(); } catch { pendingPop = false; }
  }
  function close() {
    if (!stack.length) return;
    popInternal();
    if (!stack.length) leaveHistory();
  }
  function closeAll() {
    if (!stack.length) return;
    while (stack.length) popInternal();
    leaveHistory();
  }

  function isOpen() { return stack.length > 0; }

  function init() {
    wrap = $('#sheetWrap'); body = $('#sheetBody'); sheetEl = $('#sheet');
    $('#sheetBackdrop').addEventListener('click', close);
    // Botón atrás del teléfono: cierra un nivel de sheet
    window.addEventListener('popstate', () => {
      if (pendingPop) { pendingPop = false; if (stack.length) ensureGuard(); return; }
      if (stack.length) {
        popInternal();
        if (stack.length) ensureGuard();
      }
    });
    // Arrastrar hacia abajo para cerrar
    let y0 = null, dy = 0;
    sheetEl.addEventListener('touchstart', e => {
      const onHead = e.target.closest('.grab, .sheet-head');
      const content = body.querySelector('.sheet-content');
      if (!onHead && content && content.scrollTop > 0) return;
      if (!onHead) return;
      y0 = e.touches[0].clientY; dy = 0; sheetEl.style.transition = 'none';
    }, { passive: true });
    sheetEl.addEventListener('touchmove', e => {
      if (y0 == null) return;
      dy = Math.max(0, e.touches[0].clientY - y0);
      sheetEl.style.transform = `translateY(${dy}px)`;
    }, { passive: true });
    sheetEl.addEventListener('touchend', () => {
      if (y0 == null) return;
      sheetEl.style.transition = ''; sheetEl.style.transform = '';
      if (dy > 110) closeAll();
      y0 = null;
    });

    document.addEventListener('click', ev => {
      const el = ev.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = Actions[el.dataset.act];
      if (fn) { ev.preventDefault(); fn(el, ev); }
    });
    document.addEventListener('change', ev => {
      const el = ev.target.closest('[data-change]');
      if (el && Actions[el.dataset.change]) Actions[el.dataset.change](el, ev);
    });
    document.addEventListener('input', ev => {
      const el = ev.target.closest('[data-input]');
      if (el && Actions[el.dataset.input]) Actions[el.dataset.input](el, ev);
    });
  }

  // Botón de confirmación en dos toques
  function confirmTap(el, fn, label = 'Toca otra vez') {
    if (el.dataset.armed) { delete el.dataset.armed; clearTimeout(+el.dataset.tmr); haptic(20); fn(); return; }
    el.dataset.armed = '1';
    el.dataset.orig = el.innerHTML;
    el.classList.add('armed');
    el.innerHTML = `${ico('alert')}<span>${label}</span>`;
    haptic(12);
    el.dataset.tmr = setTimeout(() => {
      if (!el.isConnected) return;
      el.innerHTML = el.dataset.orig; el.classList.remove('armed'); delete el.dataset.armed;
    }, 2800);
  }

  function chips(opts, selected, act, extra = '') {
    const sel = Array.isArray(selected) ? selected : [selected];
    return `<div class="chips">${opts.map(o => {
      const [val, label] = Array.isArray(o) ? o : [o, o];
      return `<button type="button" class="chip ${sel.includes(val) ? 'on' : ''}" data-act="${act}" data-val="${esc(val)}" ${extra}>${label}</button>`;
    }).join('')}</div>`;
  }

  function empty(icon, title, text, btn = '') {
    return `<div class="empty">${ico(icon, 'big')}<h4>${title}</h4><p>${text}</p>${btn}</div>`;
  }

  function fmtDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
    if (!iso) return '';
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-CL', opts);
  }
  function ago(t) {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'recién';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return new Date(t).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }

  async function share(text, title = 'despensAPP') {
    if (navigator.share) {
      try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    copy(text);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado al portapapeles', { icon: 'copy' }); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copiado', { icon: 'copy' }); } catch {}
      ta.remove();
    }
  }
  function whatsapp(text) { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank'); }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  return { init, haptic, toast, open, replace, refresh, close, closeAll, isOpen, confirmTap, chips, empty, fmtDate, ago, share, copy, whatsapp, download };
})();

Actions.sheetClose = () => UI.closeAll();
Actions.sheetBack = () => UI.close();
