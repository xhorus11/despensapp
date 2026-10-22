/* despensAPP · Inicio: resumen vivo de los tres pilares */
const HomeView = (() => {
  function greet() {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  }

  function render() {
    const hh = Store.state.household;
    const me = Store.me();
    const r = Money.range(hh.period);
    const spent = Money.spent(r);
    const pct = hh.budget ? Math.min(100, spent / hh.budget * 100) : 0;
    const lvl = hh.budget && spent > hh.budget ? 'bad' : pct > 80 ? 'warn' : 'ok';
    const exp = Pantry.expiring();
    const low = Pantry.lowList();
    const pend = Shop.pending().length, cart = Shop.entries().filter(e => e.done).length;
    const today = Money.today();
    const next = Store.state.menu.filter(m => !m.del && !m.cooked && m.date >= today).sort((a, b) => a.date.localeCompare(b.date) || MenuView.TYPES.indexOf(a.type) - MenuView.TYPES.indexOf(b.type)).slice(0, 3);
    const log = Store.state.log.slice(0, 5);
    const drafts = Money.list().filter(e => e.draft);

    return `
      <section class="hello">
        <small>${greet()}${me ? ', ' + esc(me) : ''}</small>
        <h1>${Store.homes().length > 1 ? `<button class="home-switch" data-act="homeSwitcher">${esc(hh.name)} ${ico('chevD')}</button>` : esc(hh.name)}</h1>
        <p>${UI.fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </section>

      ${App.canInstall() ? `<button class="card install-card" data-act="installApp"><img src="img/mascot.png" alt=""><div class="grow"><b>Instala despensAPP</b><small>Ábrela desde tu pantalla de inicio, a pantalla completa y sin internet.</small></div><span class="btn sm primary">${ico('download')} Instalar</span></button>` : ''}

      <section class="card budget-card ${lvl}" data-act="goTab" data-val="money">
        <div class="row-h"><span class="ring" style="--p:${pct}">${hh.budget ? Math.round(spent / hh.budget * 100) + '%' : ico('wallet')}</span>
          <div class="grow"><small>Gastado ${hh.period === 'semana' ? 'esta semana' : 'este mes'}</small><b class="xl">${Money.fmt(spent)}</b>
            <small>${hh.budget ? (spent > hh.budget ? `Excedido en ${Money.fmt(spent - hh.budget)}` : `Quedan ${Money.fmt(hh.budget - spent)} de ${Money.fmt(hh.budget)}`) : 'Sin presupuesto meta'}</small></div>${ico('chevR', 'muted')}</div>
      </section>

      <div class="tiles">
        <button class="tile" data-act="goTab" data-val="shop"><span class="tile-ico c1">${ico('cart')}</span><b>${pend}</b><small>por comprar${cart ? ` · ${cart} en carro` : ''}</small></button>
        <button class="tile" data-act="goTab" data-val="pantry"><span class="tile-ico c2">${ico('pantry')}</span><b>${Pantry.entries().filter(e => !Pantry.isEmpty(e)).length}</b><small>en despensa</small></button>
        <button class="tile" data-act="homeShopMode"><span class="tile-ico c3">${ico('zap')}</span><b>Súper</b><small>modo compra</small></button>
      </div>

      ${drafts.length ? `<button class="card alert-card warn" data-act="moneyEdit" data-id="${drafts[0].id}">${ico('receipt')}<div class="grow"><b>Gasto en borrador</b><small>${Money.fmt(drafts[0].amount)} · adjunta la boleta y confirma</small></div>${ico('chevR')}</button>` : ''}

      ${exp.length || low.length ? `<section class="card">
        <h4 class="card-title">${ico('bell')} Alertas</h4>
        ${exp.slice(0, 4).map(e => { const d = Pantry.daysTo(e.exp); return `<div class="row slim"><span class="em">${Catalog.item(e.c, e.i).emoji}</span><span class="grow">${esc(Catalog.label(e.c, e.i, e.v))}</span><span class="sem ${Pantry.expState(e)}"><i></i>${d < 0 ? 'vencido' : d === 0 ? 'hoy' : d + ' d'}</span></div>`; }).join('')}
        ${low.length ? `<div class="row slim"><span class="em">📉</span><span class="grow">${low.length} producto${low.length > 1 ? 's' : ''} bajo el mínimo</span><button class="btn sm primary" data-act="pantryLowToList">${ico('cart')} Reponer</button></div>` : ''}
      </section>` : ''}

      <section class="card">
        <h4 class="card-title">${ico('menu')} Próximas comidas <button class="link" data-act="goTab" data-val="menu">Ver menú</button></h4>
        ${next.length ? next.map(m => { const r = Recipes.get(m.recipeId); return `<button class="row slim" data-act="menuMeal" data-id="${m.id}"><span class="em">${r ? r.emoji : '🍽️'}</span><span class="grow"><b>${esc(m.title)}</b><small>${m.date === today ? 'Hoy' : UI.fmtDate(m.date)} · ${esc(m.type)}</small></span>${ico('chevR', 'muted')}</button>`; }).join('')
          : `<p class="hint">Nada agendado. <a data-act="homePlan">Planifica una receta</a> y te digo qué falta comprar.</p>`}
      </section>

      <section class="card">
        <h4 class="card-title">${ico('history')} Bitácora del hogar <button class="link" data-act="hogarLog">Ver todo</button></h4>
        ${log.length ? log.map(l => `<div class="log-row"><span class="avatar sm">${esc((l.who || '?')[0])}</span><span class="grow"><b>${esc(l.who)}</b> ${esc(l.text)}</span><small>${UI.ago(l.t)}</small></div>`).join('') : '<p class="hint">Aquí verás lo que hace cada integrante de la casa.</p>'}
      </section>`;
  }

  Actions.homeShopMode = () => { Store.state.shop.mode = true; Store.save(); App.go('shop'); };
  Actions.homePlan = () => App.go('menu');

  return { render };
})();
