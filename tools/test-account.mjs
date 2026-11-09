// DespensAPP · Prueba del respaldo/restauración de la cuenta de Google (sin Google real).
// Simula varios teléfonos (contextos de navegador separados) y verifica que nunca se pierdan datos.
// Uso: cd tools && node test-account.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8799);
const URL0 = 'http://localhost:8799/index.html';
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const errors = [];
async function phone() {
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  await p.setRequestInterception(true);
  p.on('request', r => (r.url().startsWith('http://localhost') ? r.continue() : r.abort()));
  p.on('pageerror', e => errors.push(e.message));
  await p.evaluateOnNewDocument(() => { Object.defineProperty(window, 'DESPENSAPP_GOOGLE', { get: () => true, set: () => {} }); });
  await p.goto(URL0, { waitUntil: 'networkidle0' });
  return p;
}
let ok = 0, bad = 0;
const t = (name, cond) => { if (cond) ok++; else bad++; console.log(cond ? '  ✓' : '  ✗', name); };

// Teléfono A: dos hogares con datos (uno compartido con código)
const A = await phone();
const backup = await A.evaluate(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#obMe').value = 'Ana'; document.querySelector('#obOthers').value = 'Pablo';
  document.querySelector('[data-act="obDemo"]').click(); await w(300);
  Store.state.household.name = 'Casa Ñuñoa'; Store.touchHousehold(); Store.commit(); Store.saveNow();
  await Sync.switchTo(() => Store.createHome('Casa Playa'));
  Store.state.household.members = ['Ana']; Pantry.add('fruver', 'palta', 'hass', 3, 'un'); Store.commit(); Store.saveNow();
  Store.setHomeCode('ABC234');
  return Store.homes().map(h => Store.exportHome(h.id));
});
t('exporta los 2 hogares con id global', backup.length === 2 && backup.every(b => b.gid && b.data.length > 100));

// Teléfono B: recién instalado (vacío) → recupera todo y no queda un hogar vacío sobrante
const B = await phone();
const rB = await B.evaluate(async list => {
  const r = Store.restoreHomes(list);
  return { r, homes: Store.homes().map(h => h.name), pantry: Pantry.entries().length, code: Store.homes().find(h => h.name === 'Casa Playa').code };
}, backup);
t('teléfono nuevo: recupera los 2 hogares', rB.r.added === 2 && rB.homes.length === 2);
t('teléfono nuevo: no deja hogar vacío sobrante', !rB.homes.includes('Mi Hogar'));
t('teléfono nuevo: conserva el código compartido', rB.code === 'ABC234');

// Teléfono C: ya tiene su propio hogar con datos → se suman, no se reemplaza nada
const C = await phone();
const rC = await C.evaluate(async list => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  document.querySelector('#obHome').value = 'Depto Centro'; document.querySelector('#obMe').value = 'Zoe';
  document.querySelector('[data-act="obGo"]').click(); await w(200);
  Pantry.add('lacteos', 'leche', 'entera', 2, 'un'); Store.commit(); Store.saveNow();
  const r1 = Store.restoreHomes(list);
  const names = Store.homes().map(h => h.name);
  const r2 = Store.restoreHomes(list);          // restaurar otra vez no duplica
  const lecheOk = (() => { const h = Store.homes().find(x => x.name === 'Depto Centro'); const s = JSON.parse(localStorage.getItem(h.id === 'h1' ? 'despensapp-v1' : 'despensapp-v1:' + h.id)); return !!s.pantry.items['lacteos|leche|entera']; })();
  return { r1, r2, names, n2: Store.homes().length, lecheOk };
}, backup);
t('teléfono con datos: mantiene su hogar y suma los 2', rC.r1.added === 2 && rC.names.includes('Depto Centro') && rC.names.length === 3);
t('teléfono con datos: sus productos siguen ahí', rC.lecheOk);
t('restaurar dos veces no duplica (combina)', rC.r2.added === 0 && rC.r2.merged === 2 && rC.n2 === 3);

// Teléfono A sigue editando después del respaldo: restaurar un respaldo viejo no borra lo nuevo
const rA = await A.evaluate(async list => {
  Pantry.add('fruver', 'tomate', 'cherry', 1, 'kg'); Store.commit(); Store.saveNow();
  const r = Store.restoreHomes(list);
  return { r, tomate: !!Pantry.get('fruver|tomate|cherry'), palta: !!Pantry.get('fruver|palta|hass'), homes: Store.homes().length };
}, backup);
t('respaldo antiguo no borra cambios nuevos', rA.tomate && rA.palta && rA.homes === 2 && rA.r.merged === 2);

// Interfaz: la tarjeta de cuenta aparece en Hogar para quien no ha conectado Google
const ui = await B.evaluate(async () => { App.go('hogar'); await new Promise(r => setTimeout(r, 100)); return { btn: !!document.querySelector('[data-act="accSignIn"]'), txt: document.querySelector('#view').innerText.includes('Todo lo que ya tienes se mantiene') }; });
t('Hogar muestra "Continuar con Google" y el aviso de que nada se pierde', ui.btn && ui.txt);
const onb = await (await phone()).evaluate(() => !!document.querySelector('[data-act="obGoogle"]'));
t('la bienvenida ofrece entrar con Google', onb);

// Sincronizar con la misma cuenta en dos dispositivos (nube simulada, compartida entre los teléfonos)
const nube = new Map();
async function conectado() {
  const p = await phone();
  await p.exposeFunction('nubePut', (g, d) => { nube.set(g, d); });
  await p.exposeFunction('nubeGet', g => nube.get(g) || null);
  await p.exposeFunction('nubeList', () => [...nube].map(([gid, d]) => ({ gid, ...d })));
  await p.evaluate(() => {
    const u = { uid: 'u1', isAnonymous: false, displayName: 'Ana', email: '', providerData: [{ providerId: 'google.com' }] };
    window.firebase = { apps: [1], auth: () => ({ currentUser: u }) };
    Account.cloud.put = (_, g, d) => nubePut(g, d);
    Account.cloud.get = (_, g) => nubeGet(g);
    Account.cloud.list = () => nubeList();
    Account.cloud.profile = async () => {};
  });
  return p;
}
const P1 = await conectado(), P2 = await conectado();
await P1.evaluate(async () => {
  document.querySelector('#obHome').value = 'Casa Sync'; document.querySelector('#obMe').value = 'Ana';
  document.querySelector('[data-act="obGo"]').click(); await new Promise(r => setTimeout(r, 200));
  Pantry.add('lacteos', 'leche', 'entera', 2, 'un'); Store.commit(); Store.saveNow();
  await Account.syncNow();
});
const s2 = await P2.evaluate(async () => { const r = await Account.syncNow(); return { added: r.added, homes: Store.homes().map(h => h.name), leche: !!Pantry.get('lacteos|leche|entera') }; });
t('sincronizar: el segundo dispositivo recibe el hogar y sus datos', s2.added === 1 && s2.homes.length === 1 && s2.homes[0] === 'Casa Sync' && s2.leche);
// Ambos cambian sin sincronizar; el respaldo de uno no debe borrar lo del otro
await P2.evaluate(async () => { Pantry.add('fruver', 'palta', 'hass', 3, 'un'); Store.commit(); Store.saveNow(); await Account.backupHome(Store.activeHome().id); });
await P1.evaluate(async () => { Pantry.add('fruver', 'tomate', 'cherry', 1, 'kg'); Store.commit(); Store.saveNow(); await Account.backupHome(Store.activeHome().id); });
const enNube = JSON.parse([...nube.values()][0].data).pantry.items;
t('respaldo automático combina: la nube conserva lo de ambos', !!enNube['fruver|palta|hass'] && !!enNube['fruver|tomate|cherry']);
const items = () => ({ palta: !!Pantry.get('fruver|palta|hass'), tomate: !!Pantry.get('fruver|tomate|cherry') });
await P1.evaluate(() => Account.syncNow()); await P2.evaluate(() => Account.syncNow());
const [i1, i2] = [await P1.evaluate(items), await P2.evaluate(items)];
t('tras sincronizar ambos quedan iguales', i1.palta && i1.tomate && i2.palta && i2.tomate);
// Lo eliminado en un dispositivo se elimina en el otro al sincronizar
await P1.evaluate(async () => { delete Store.state.pantry.items['fruver|tomate|cherry']; Store.tomb('p:fruver|tomate|cherry'); Store.commit(); Store.saveNow(); await Account.syncNow(); });
t('un producto borrado no reaparece', await P2.evaluate(async () => { await Account.syncNow(); return !Pantry.get('fruver|tomate|cherry'); }) && await P1.evaluate(() => !Pantry.get('fruver|tomate|cherry')));
// Hogar eliminado de un teléfono: Sincronizar no lo trae de vuelta, pero sigue en la cuenta
const del = await P2.evaluate(async () => {
  await Sync.switchTo(() => Store.createHome('Otro')); Store.state.household.members = ['Ana']; Store.commit(); Store.saveNow();
  const casa = Store.homes().find(h => h.name === 'Casa Sync').id;
  await Sync.switchTo(() => Store.deleteHome(casa));
  await Account.syncNow();
  return Store.homes().map(h => h.name);
});
t('hogar eliminado de este teléfono no vuelve al sincronizar', del.length === 1 && del[0] === 'Otro');
t('y sigue respaldado en la cuenta', [...nube.values()].some(d => d.name === 'Casa Sync'));
const boton = await P1.evaluate(async () => { App.go('hogar'); await new Promise(r => setTimeout(r, 100)); const b = document.querySelector('[data-act="accSync"]'); if (!b) return false; b.click(); await new Promise(r => setTimeout(r, 300)); return /Sincronizado/.test(document.body.innerText); });
t('el botón Sincronizar ahora funciona y avisa', boton);

// En vivo: lo que cambia en un dispositivo llega al otro sin tocar nada, y al abrirse se pone al día
const nubeV = new Map(); let escrituras = 0; const vivos = [];
async function enVivo() {
  const p = await phone();
  const yo = vivos.length;
  await p.exposeFunction('vPut', async (g, d) => {
    nubeV.set(g, d); escrituras++;
    for (let i = 0; i < vivos.length; i++) if (i !== yo) await vivos[i].evaluate(l => { if (window.__cb) window.__cb(l, false); }, [{ gid: g, ...d }]).catch(() => {});
  });
  await p.exposeFunction('vGet', g => nubeV.get(g) || null);
  await p.exposeFunction('vList', () => [...nubeV].map(([gid, d]) => ({ gid, ...d })));
  await p.evaluate(() => {
    const u = { uid: 'u2', isAnonymous: false, displayName: 'Ana', email: '', providerData: [{ providerId: 'google.com' }] };
    window.firebase = { apps: [1], auth: () => ({ currentUser: u }) };
    Account.cloud.put = (_, g, d) => vPut(g, d);
    Account.cloud.get = (_, g) => vGet(g);
    Account.cloud.list = () => vList();
    Account.cloud.profile = async () => {};
    Account.cloud.watch = (_, cb) => { window.__cb = cb; vList().then(l => cb(l, false)); return () => { window.__cb = null; }; };
  });
  vivos.push(p);
  return p;
}
const espera = ms => new Promise(r => setTimeout(r, ms));
const hasta = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await espera(120); } return false; };
const D1 = await enVivo();
await D1.evaluate(async () => {
  document.querySelector('#obHome').value = 'Casa Vivo'; document.querySelector('#obMe').value = 'Ana';
  document.querySelector('[data-act="obGo"]').click(); await new Promise(r => setTimeout(r, 200));
  Pantry.add('lacteos', 'leche', 'entera', 2, 'un'); Store.commit(); Store.saveNow();
  Account.goLive();
});
await hasta(() => nubeV.size === 1);
const D2 = await enVivo();
await D2.evaluate(() => Account.goLive());
t('al abrirse trae el hogar de la cuenta', await hasta(() => D2.evaluate(() => Store.homes().some(h => h.name === 'Casa Vivo') && Store.activeHome().name === 'Casa Vivo' && !!Pantry.get('lacteos|leche|entera'))));
await D2.evaluate(() => { Store.log('despensa', 'agregó palta'); Pantry.add('fruver', 'palta', 'hass', 3, 'un'); Store.commit(); });
t('un cambio llega solo al otro dispositivo', await hasta(() => D1.evaluate(() => !!Pantry.get('fruver|palta|hass')), 5000));
t('la pantalla del otro dispositivo se actualiza sola', await D1.evaluate(async () => { App.go('pantry'); await new Promise(r => setTimeout(r, 100)); return /Palta/.test(document.querySelector('#view').innerText); }));
await D1.evaluate(() => { delete Store.state.pantry.items['fruver|palta|hass']; Store.tomb('p:fruver|palta|hass'); Store.commit(); });
t('un borrado llega solo al otro dispositivo', await hasta(() => D2.evaluate(() => !Pantry.get('fruver|palta|hass')), 5000));
// Cambios a la vez en los dos
await Promise.all([D1.evaluate(() => { Pantry.add('fruver', 'tomate', 'cherry', 1, 'kg'); Store.commit(); }), D2.evaluate(() => { Pantry.add('fruver', 'papa', 'blanca', 2, 'kg'); Store.commit(); })]);
const ambos = () => ({ tomate: !!Pantry.get('fruver|tomate|cherry'), papa: !!Pantry.get('fruver|papa|blanca') });
t('cambios simultáneos: ambos quedan con todo', await hasta(async () => { const [a, b] = [await D1.evaluate(ambos), await D2.evaluate(ambos)]; return a.tomate && a.papa && b.tomate && b.papa; }, 8000));
await espera(3500);
const antes = escrituras; await espera(4000);
t('sin cambios no se escribe (no hay bucle entre dispositivos)', escrituras === antes);
// Hogar nuevo en un dispositivo → aparece en el otro
await D1.evaluate(async () => { await Sync.switchTo(() => Store.createHome('Casa Playa')); Store.state.household.members = ['Ana']; Store.touchHousehold(); Store.commit(); });
t('un hogar nuevo aparece en el otro dispositivo', await hasta(() => D2.evaluate(() => Store.homes().some(h => h.name === 'Casa Playa')), 6000));
t('sin cambiar el hogar que se está usando', await D2.evaluate(() => Store.activeHome().name === 'Casa Vivo'));
// Cambio en un hogar que el otro dispositivo no tiene abierto
await D1.evaluate(() => { Pantry.add('aseo', 'cloro', 'gel', 1, 'un'); Store.commit(); });
t('cambio en un hogar no abierto se guarda', await hasta(() => D2.evaluate(() => { const h = Store.homes().find(x => x.name === 'Casa Playa'); return !!JSON.parse(Store.exportHome(h.id).data).pantry.items['aseo|cloro|gel']; }), 6000));
// Un dispositivo que abre con datos propios: sube lo suyo y recibe lo de la cuenta
const D3 = await enVivo();
await D3.evaluate(async () => {
  document.querySelector('#obHome').value = 'Otra casa'; document.querySelector('#obMe').value = 'Ana';
  document.querySelector('[data-act="obGo"]').click(); await new Promise(r => setTimeout(r, 200));
  Pantry.add('fruver', 'pera', 'packham', 1, 'kg'); Store.commit(); Store.saveNow();
  Account.goLive();
});
t('al abrirse sube el hogar que solo estaba en este dispositivo', await hasta(() => [...nubeV.values()].some(d => d.name === 'Otra casa'), 6000));
t('y recibe los de la cuenta', await hasta(() => D3.evaluate(() => Store.homes().some(h => h.name === 'Casa Vivo') && Store.homes().some(h => h.name === 'Casa Playa')), 6000));
t('los datos del hogar propio siguen ahí', await D3.evaluate(() => Store.activeHome().name === 'Otra casa' && !!Pantry.get('fruver|pera|packham')));
// Hogar eliminado de un dispositivo no vuelve en vivo
const noVuelve = await D3.evaluate(async () => {
  const id = Store.homes().find(h => h.name === 'Casa Playa').id; Store.deleteHome(id);
  const raw = await vList(); await window.__cb(raw, false); await new Promise(r => setTimeout(r, 300));
  return !Store.homes().some(h => h.name === 'Casa Playa');
});
t('un hogar eliminado de este dispositivo no vuelve en vivo', noVuelve);

console.log(errors.length ? 'ERRORES DE PÁGINA: ' + errors.join(' | ') : 'Sin errores de página');
console.log(`\n${ok} OK, ${bad} fallas`);
await browser.close(); server.close();
process.exit(bad || errors.length ? 1 : 0);
