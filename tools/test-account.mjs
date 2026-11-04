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

console.log(errors.length ? 'ERRORES DE PÁGINA: ' + errors.join(' | ') : 'Sin errores de página');
console.log(`\n${ok} OK, ${bad} fallas`);
await browser.close(); server.close();
process.exit(bad || errors.length ? 1 : 0);
