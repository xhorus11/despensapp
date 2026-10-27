// despensAPP · Prueba de humo de los flujos principales.  Uso: cd tools && node smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8792);

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.setRequestInterception(true);
page.on('request', r => (/googleapis|gstatic/.test(r.url()) ? r.abort() : r.continue()));
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto('http://localhost:8792/index.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());
await page.goto('http://localhost:8792/index.html', { waitUntil: 'networkidle0' });

const results = await page.evaluate(async () => {
  const w = ms => new Promise(r => setTimeout(r, ms));
  const $q = s => document.querySelector(s);
  const click = s => { const e = $q(s); if (!e) throw new Error('falta ' + s); e.click(); };
  const R = {};
  const check = (k, v) => { R[k] = v; };
  $q('#obMe').value = 'Ana'; $q('#obOthers').value = 'Pablo, Cami'; click('[data-act="obDemo"]'); await w(300);
  const h = Store.state.household;
  h.diets.Ana = { tags: ['hipertension'], items: ['cilantro'] }; Store.commit();
  check('tabs', ['home', 'pantry', 'shop', 'menu', 'money', 'hogar'].every(t => { App.go(t); return $q('#view').innerText.length > 50; }));
  // Picker → despensa
  App.go('pantry'); await w(50); click('.fab'); await w(150);
  const q = $q('#pickQ'); q.value = 'harina tostada'; q.dispatchEvent(new Event('input', { bubbles: true }));
  click('#pickRes [data-act="pickItem"]'); await w(150); click('[data-act="pickAdd"]'); await w(150); UI.closeAll(); await w(150);
  check('nuevoProductoEnDespensa', !!Pantry.get('fideos|harinatostada|trigo'));
  // Súper: precio + cierre
  App.go('shop'); Store.state.shop.mode = true; App.render(); await w(50);
  const k = Shop.pending()[0].key; $q(`[data-act="shopToggle"][data-key="${k}"]`).click(); await w(150);
  $q('#pfPrice').value = '1000'; click('[data-act="pfSave"]'); await w(200);
  check('carro', Shop.cartTotal() === 1000);
  click('.sticky-cart [data-act="shopClose"]'); await w(150); click('[data-act="shopCloseGo"]'); await w(700);
  check('borradorGasto', Store.state.expenses.some(e => e.draft)); UI.closeAll(); await w(150);
  // Receta con aviso
  MenuView.openRec('ensalada_chilena'); await w(150);
  click('[data-act="recSchedule"]'); await w(150);
  check('avisoReceta', ($q('.sheet-head h3') || {}).textContent === 'Aviso de salud y dietas');
  check('avisoMencionaCilantro', $q('.guard').innerText.includes('Cilantro'));
  click('[data-act="guardOk"]'); await w(150);
  check('agendarTrasAviso', ($q('.sheet-head h3') || {}).textContent === 'Agendar comida');
  click('[data-act="schSave"]'); await w(300);
  check('comidaAgendada', Store.state.menu.some(m => m.recipeId === 'ensalada_chilena'));
  // Cocinar comida
  const m = Store.state.menu.find(x => x.recipeId === 'pastas_bolognesa');
  App.go('menu'); MenuView.openRec('pastas_bolognesa'); UI.closeAll(); await w(100);
  Actions.menuMeal({ dataset: { id: m.id } }); await w(150);
  const b = $q('[data-act="mealCook"]'); b.click(); await w(50); b.click(); await w(200);
  if ($q('[data-act="guardOk"]')) { click('[data-act="guardOk"]'); await w(200); }
  check('cocinado', m.cooked === true);
  // Varios hogares
  const nameA = Store.state.household.name;
  await Sync.switchTo(() => Store.createHome('Casa Playa')); App.render(); UI.closeAll(); await w(150);
  check('hogarNuevoVacio', Store.state.household.name === 'Casa Playa' && Pantry.entries().length === 0);
  check('dosHogares', Store.homes().length === 2);
  await Sync.switchTo(() => Store.switchHome('h1')); await w(100);
  check('volverHogarOriginal', Store.state.household.name === nameA && Pantry.entries().length > 5);
  // Cuentas separadas
  App.go('money'); await w(50);
  click('[data-act="moneySplit"]'); await w(150);
  click('[data-act="splitNew"]'); await w(200);
  const setIn = (sel, v) => { const e = $q(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
  setIn('[data-input="spAmount"]', '30000');
  setIn('[data-input="spDesc"]', 'Prueba división');
  click('[data-act="spAddPerson"][data-p=""]'); await w(100);
  const pin = [...document.querySelectorAll('.sp-person input')].pop(); pin.value = 'Visita'; pin.dispatchEvent(new Event('change', { bubbles: true })); await w(100);
  click('[data-act="spAddLine"]'); await w(100);
  setIn('[data-input="spLineN"][data-k="0"]', 'Vino'); setIn('[data-input="spLineP"][data-k="0"]', '9000');
  click('[data-act="spLineWho"][data-k="0"][data-p="Visita"]'); await w(100);
  click('[data-act="spAddContrib"]'); await w(100);
  const sel = $q('[data-change="spContribWho"][data-k="1"]'); sel.value = 'Visita'; sel.dispatchEvent(new Event('change', { bubbles: true }));
  setIn('[data-input="spContribAmt"][data-k="1"]', '5000');
  setIn('[data-input="spContribAmt"][data-k="0"]', '25000'); await w(50);
  click('[data-act="spSave"]'); await w(300);
  const ex = Store.state.expenses.find(e => e.desc === 'Prueba división');
  check('divisionGuardada', !!(ex && ex.split && ex.split.people.includes('Visita')));
  const rows = ex ? Money.splitCalc(ex).rows : [];
  const vis = rows.find(r => r.name === 'Visita') || {};
  const n = ex ? ex.split.people.length : 0;
  // Visita: vino 9000 + parte igual del resto (21000/n); aportó 5000
  check('calculoVisita', Math.abs(vis.cons - (9000 + 21000 / n)) < 1 && vis.paid === 5000);
  check('cuentasClarasIncluyeVisita', Money.balances(Money.list()).some(b => b.member === 'Visita' && b.net < 0));

  // Exportes
  App.go('money'); await Exporter.pdf(Money.range('mes')); Exporter.csv(Money.range('mes'));
  return R;
});
console.log(results);
const failed = Object.entries(results).filter(([, v]) => v !== true);
console.log(errors.length ? 'ERRORES DE PÁGINA: ' + errors.join(' | ') : 'Sin errores de página');
console.log(failed.length ? 'FALLÓ: ' + failed.map(f => f[0]).join(', ') : 'TODO OK');
await browser.close(); server.close();
process.exit(failed.length || errors.length ? 1 : 0);
