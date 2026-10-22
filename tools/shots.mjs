// despensAPP · Genera las capturas del manual (manual/img/*.png)
// Uso:  cd tools && npm install && npm run shots
// Requiere Google Chrome instalado (o define CHROME_PATH).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'manual', 'img');
const PORT = 8790;
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find(p => fs.existsSync(p));

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(PORT);

const wait = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });
// Limpia solo las capturas generadas antes (NN-nombre.png/webp)
for (const f of fs.readdirSync(OUT)) if (/^\d{2}-[a-z-]+\.(png|webp)$/.test(f)) fs.unlinkSync(path.join(OUT, f));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--lang=es-CL'] });
const page = await browser.newPage();
await page.emulate({
  viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
});
// Sin Firebase en las capturas
await page.setRequestInterception(true);
page.on('request', r => (/googleapis|gstatic|firebase/.test(r.url()) ? r.abort() : r.continue()));
page.on('pageerror', e => console.error('ERROR en página:', e.message));

const base = `http://localhost:${PORT}/index.html`;
await page.goto(base, { waitUntil: 'networkidle0' });
await page.evaluate(() => { localStorage.clear(); indexedDB.deleteDatabase('despensapp-fotos'); });
await page.goto(base, { waitUntil: 'networkidle0' });
await page.addStyleTag({ content: '#toasts{display:none!important} *{caret-color:transparent!important}' });

let n = 0;
async function shot(name, fn, ms = 450) {
  if (fn) await page.evaluate(fn);
  await wait(ms);
  await page.addStyleTag({ content: '#toasts{display:none!important}' });
  const file = `${String(++n).padStart(2, '0')}-${name}.webp`;
  await page.screenshot({ path: path.join(OUT, file), type: 'webp', quality: 82 });
  console.log('  ✓', file);
}
const go = (tab, extra = '') => new Function(`UI.closeAll(); App.go('${tab}'); window.scrollTo(0,0); ${extra}`);

// ---- Escenarios ----
await shot('bienvenida');
await page.evaluate(() => {
  document.querySelector('#obHome').value = 'Casa Ñuñoa';
  document.querySelector('#obMe').value = 'Ana';
  document.querySelector('#obOthers').value = 'Pablo, Cami';
  document.querySelector('[data-act="obDemo"]').click();
});
await wait(500);
await page.evaluate(() => {
  const h = Store.state.household;
  h.diets.Ana = { tags: ['hipertension'], note: '', items: [] };
  h.diets.Cami = { tags: ['celiaco'], note: 'Sin gluten', items: [] };
  h.t = Store.now();
  // Comidas de ejemplo en la semana actual para que el menú no salga vacío
  const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return Money.iso(x); };
  const wk = Money.range('semana');
  Store.state.menu.forEach((m, k) => { m.date = k === 0 ? Money.today() : (d(1) <= wk.to ? d(1) : wk.from); });
  Store.state.menu.push({ id: Store.uid('ev_'), type: 'Desayuno', title: 'Avena con fruta', date: Money.today(), recipeId: 'avena_fruta', people: 3, diet: 'aparte', cooked: true, t: Store.now() });
  Store.commit();
});
await shot('inicio', go('home'));
await shot('despensa', go('pantry'));
await shot('despensa-editar', go('pantry', `document.querySelector('[data-act="pantryEdit"]').click();`));
await shot('catalogo', go('pantry', `Actions.pantryAdd();`));
await shot('producto', () => { const i = document.querySelector('#pickQ'); i.value = 'aceite'; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#pickRes [data-act="pickItem"]').click(); });
await shot('lista', go('shop', `Store.state.shop.mode = false; App.render();`));
await shot('super', go('shop', `Store.state.shop.mode = true; App.render();`));
await shot('precio', () => {
  const k = Shop.pending()[0].key; document.querySelector(`[data-act="shopToggle"][data-key="${k}"]`).click();
  setTimeout(() => { const p = document.querySelector('#pfPrice'); p.value = '2990'; p.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('[data-act="pfDisc"][data-val="p20"]').click(); }, 200);
}, 700);
await page.evaluate(() => { const p = document.querySelector('#pfPrice'); p.value = '2990'; document.querySelector('[data-act="pfSave"]').click(); });
await shot('comparador', go('shop', `Actions.shopCompare(); setTimeout(() => { const i = [...document.querySelectorAll('[data-input="cmpSet"]')]; const s = (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }; s(i[1], '1990'); s(i[2], '500'); s(i[4], '3490'); s(i[5], '1000'); }, 150);`), 700);
await shot('cerrar-compra', go('shop', `Actions.shopClose();`));
await shot('menu-semana', go('menu', `document.querySelector('[data-act="menuSub"][data-val="semana"]').click();`));
await shot('recetario', go('menu', `document.querySelector('[data-act="menuSub"][data-val="book"]').click();`));
await shot('receta', go('menu', `MenuView.openRec('completos');`));
await shot('aviso-salud', () => document.querySelector('[data-act="recSchedule"]').click());
await shot('agendar', () => document.querySelector('[data-act="guardOk"]').click());
await shot('plata', go('money'));
await shot('gasto', go('money', `Actions.moneyNew();`));
await shot('hogar', go('hogar'));
await shot('integrante', go('hogar', `document.querySelector('[data-act="memOpen"][data-m="Ana"]').click();`));
await shot('instalar', go('hogar', `App.installHelp();`));
await shot('bitacora', go('home', `Actions.hogarLog();`));

await browser.close();
server.close();
console.log(`Listo: ${n} capturas en manual/img`);
