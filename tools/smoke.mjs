// DespensAPP · Prueba de humo de los flujos principales.  Uso: cd tools && node smoke.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { startMockAI } from './mock-ai.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8792);

const aiSrv = startMockAI(8794);

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
  const $$ = s => [...document.querySelectorAll(s)];
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

  // ---- IA (con intermediario simulado) ----
  window.DESPENSAPP_AI_URL = 'http://localhost:8794';
  Sync.idToken = async () => 'token-de-prueba';
  App.render();
  const fakeFile = async () => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 60; cv.getContext('2d').fillRect(0, 0, 10, 10); const b = await new Promise(r => cv.toBlob(r, 'image/jpeg')); return new File([b], 'boleta.jpg', { type: 'image/jpeg' }); };
  const until = async (fn, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await w(80); } return false; };
  const title = () => ($q('.sheet-head h3') || {}).textContent;
  check('iaVisible', AI.ready() && !!document.querySelector('#view') );
  // Lista por texto
  App.go('shop'); Store.state.shop.mode = false; App.render(); await w(50);
  check('botonListaIA', !!$q('[data-act="aiListOpen"]'));
  click('[data-act="aiListOpen"]'); await w(150);
  $q('#aiText').value = '2 kilos de papas y leche sin lactosa'; $q('#aiText').dispatchEvent(new Event('input', { bubbles: true }));
  click('[data-act="aiListaGo"]');
  check('listaIARevisa', await until(() => title() === 'Revisa tu lista'));
  click('[data-act="aiListBack"]'); await w(150);
  check('listaVolverAEditar', title() === 'Lista con IA' && $q('#aiText').value.includes('2 kilos de papas'));
  click('[data-act="aiListaGo"]');
  await until(() => title() === 'Revisa tu lista');
  click('[data-act="aiListGo"]'); await w(200);
  check('listaIAAgrega', !!Store.state.shop.sel['fruver|papa|blanca'] && Object.keys(Store.state.shop.sel).some(k => k.startsWith('lacteos|leche|sin-lactosa')));
  // Boleta en un gasto
  App.go('money'); await w(50); click('[data-act="moneyNew"]'); await w(150);
  check('botonBoletaIA', !!$q('[for="fxAIIn"]'));
  await Actions.fxAIPhoto({ files: [await fakeFile()], value: '' });
  check('boletaIARevisa', await until(() => title() === 'Revisa tu boleta'));
  check('boletaCuadra', !!$q('.ai-check.ok'));
  click('[data-act="aiUseBoleta"]'); await w(250);
  check('boletaLlenaGasto', $q('#fxAmount') && +$q('#fxAmount').value === 3190 && $q('#fxDesc').value.startsWith('Lider'));
  click('[data-act="fxSave"]'); await w(250);
  const exAI = Store.state.expenses.find(e => e.desc && e.desc.startsWith('Lider Ñuñoa'));
  check('gastoConProductos', !!exAI && exAI.items.length === 2 && exAI.docNum === '88219' && exAI.photos.length === 1);
  // Boleta desde la despensa → despensa + gasto
  const lecheAntes = Pantry.have('lacteos', 'leche', 'descremada', 'un', false).q;
  await Actions.aiBolFile({ files: [await fakeFile()], value: '' });
  check('boletaDespensaRevisa', await until(() => title() === 'Revisa tu boleta'));
  click('[data-act="aiUseBoleta"]'); await w(250);
  check('boletaADespensa', Pantry.have('lacteos', 'leche', 'descremada', 'un', false).q === lecheAntes + 2 && !!Pantry.get('desayuno|pan|marraqueta'));
  check('boletaCreaGasto', Store.state.expenses.filter(e => e.notes === 'Leída con IA').length === 1);
  // Foto del refri
  await Actions.aiFridgeFile({ files: [await fakeFile()], value: '' });
  check('refriRevisa', await until(() => title() === 'Revisa el inventario'));
  click('[data-act="aiListGo"]'); await w(200);
  check('refriADespensa', Pantry.have('lacteos', 'huevo', 'blanco-grande', 'un', false).q >= 12);
  // Cuentas separadas: foto → lectura automática → productos para repartir
  SplitView.openNew(); await w(200);
  await Actions.spPhoto({ files: [await fakeFile()], value: '' });
  check('splitIARevisa', await until(() => title() === 'Revisa tu boleta'));
  click('[data-act="aiUseBoleta"]'); await w(250);
  check('splitConLineas', $$('.sp-line').length === 2 && +($q('[data-input="spAmount"]') || {}).value === 3190);
  UI.closeAll(); await w(150);
  // Boletas digitales (PDF y Word)
  const fixture = async (name, type) => new File([await (await fetch('/tools/fixtures/' + name)).blob()], name, { type });
  const pdfF = await fixture('boleta-lider.pdf', 'application/pdf');
  const docxF = await fixture('boleta-farmacia.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const docxTxt = await Docs.docxText(docxF);
  check('wordTexto', docxTxt.includes('TOTAL $10.529') && docxTxt.split('\n').length >= 10);
  const pdfImg = await Docs.pdfToImage(pdfF, 2, 600);
  check('pdfAImagen', pdfImg && pdfImg.type === 'image/jpeg' && pdfImg.size > 5000);
  App.go('money'); await w(50); click('[data-act="moneyNew"]'); await w(150);
  check('botonArchivo', !!$q('[for="fxDocIn"]'));
  await Actions.fxDoc({ files: [pdfF], value: '' }); await w(150);
  check('pdfAdjunto', !!$q('.doc-card .doc-ico.pdf'));
  click('.doc-card');
  check('visorPdf', await until(() => !!$q('.doc-page'), 8000));
  UI.close(); await w(200);
  click('[data-act="fxAI"]');
  check('pdfLeidoIA', await until(() => title() === 'Revisa tu boleta', 8000));
  click('[data-act="aiUseBoleta"]'); await w(250);
  click('[data-act="fxSave"]'); await w(300);
  const exPdf = Store.state.expenses.find(e => (e.files || []).some(f => f.kind === 'pdf'));
  check('gastoConPdf', !!exPdf && exPdf.files[0].name === 'boleta-lider.pdf' && exPdf.amount === 3190);
  const wordMeta = await Docs.add(docxF);
  const body = await AI.attachBody(wordMeta);
  check('wordSeEnviaComoTexto', !!body.text && !body.image && body.text.includes('LECHE DESC'));
  // Boleta digital muy larga (una sola página de ~1 metro, 120 productos): debe llegar completa
  const { jsPDF } = window.jspdf;
  const largo = new jsPDF({ unit: 'pt', format: [296, 3045] });
  largo.setFont('courier', 'normal'); largo.setFontSize(7);
  for (let i = 0; i < 120; i++) largo.text(`78000000${String(i).padStart(5, '0')} PRODUCTO ${i} ${(1000 + i * 10).toLocaleString('es-CL')}`, 8, 20 + i * 24.5);
  largo.text('TOTAL $ 191.400', 8, 3030);
  const largoMeta = await Docs.add(new File([largo.output('blob')], 'boleta-larga.pdf', { type: 'application/pdf' }));
  const bLargo = await AI.attachBody(largoMeta);
  const lineas = (bLargo.text || '').split('\n');
  check('pdfLargoComoTexto', !bLargo.image && !bLargo.images && lineas.length === 121 && lineas[0].includes('PRODUCTO 0 1.000') && lineas[119].includes('PRODUCTO 119 2.190') && lineas[120].includes('TOTAL'));
  // PDF escaneado (solo imagen, sin texto) y muy largo → partes legibles, no una tira diminuta
  const cvL = document.createElement('canvas'); cvL.width = 300; cvL.height = 3000;
  const cx = cvL.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, 300, 3000); cx.fillStyle = '#000'; cx.font = '14px monospace';
  for (let i = 0; i < 100; i++) cx.fillText(`PRODUCTO ${i}   ${1000 + i}`, 10, 24 + i * 29);
  const escaneado = new jsPDF({ unit: 'pt', format: [296, 2960] });
  escaneado.addImage(cvL.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 296, 2960);
  const bEsc = await AI.attachBody(await Docs.add(new File([escaneado.output('blob')], 'escaneada.pdf', { type: 'application/pdf' })));
  const dimsEsc = await Promise.all((bEsc.images || []).map(async p => { const m = await createImageBitmap(new Blob([Uint8Array.from(atob(p.image), c => c.charCodeAt(0))])); return [m.width, m.height]; }));
  check('pdfEscaneadoEnPartes', dimsEsc.length >= 4 && dimsEsc.length <= 8 && dimsEsc.every(([wd, ht]) => wd >= 900 && ht <= wd * 2.2));
  // Pantallazo largo de una boleta → también en partes
  const bShot = await AI.photoBody(await new Promise(r => cvL.toBlob(r, 'image/png')));
  check('pantallazoLargoEnPartes', (bShot.images || []).length >= 3);
  // Foto normal → una sola imagen, como siempre
  const cvN = document.createElement('canvas'); cvN.width = 900; cvN.height = 1200; cvN.getContext('2d').fillRect(0, 0, 5, 5);
  const bNorm = await AI.photoBody(await new Promise(r => cvN.toBlob(r, 'image/jpeg')));
  check('fotoNormalUnaImagen', !!bNorm.image && !bNorm.images);
  await Actions.aiBolFile({ files: [docxF], value: '' });
  check('wordDesdeDespensa', await until(() => title() === 'Revisa tu boleta', 6000));
  click('[data-act="aiUseBoleta"]'); await w(300);
  check('gastoConWord', Store.state.expenses.some(e => (e.files || []).some(f => f.kind === 'docx') && e.notes === 'Leída con IA'));
  let docErr = '';
  try { await Docs.add(new File(['x'], 'viejo.doc', { type: 'application/msword' })); } catch (e) { docErr = e.message; }
  check('docAntiguoRechazado', docErr.includes('.docx'));

  // Catálogo chileno y reconocimiento: lo que el producto ES, no su ingrediente
  const esM = (it, id, v) => { const m = AI.match(it); return !!m && m.i === id && (!v || m.v === v); };
  check('buscaManjarate', Catalog.search('manjarate').some(r => r.item.id === 'postrelacteo'));
  check('buscaChiquitin', Catalog.search('chiquitin').some(r => r.item.id === 'postrelacteo'));
  check('iaSopaNoEsFideos', esM({ generico: 'fideos', nombre: 'Fideos instantáneos Maruchan pollo', variante: 'pollo' }, 'sopa', 'pollo'));
  check('iaRamenCamaron', esM({ generico: 'fideos instantáneos', nombre: 'Ramen camarón', variante: '' }, 'sopa', 'ramen-camaron'));
  check('iaSopaBoleta', esM({ generico: 'fideos', nombre: 'Sopa Maggi costilla con fideos', orig: 'SOPA MAGGI COSTILLA' }, 'sopa', 'costilla-con-fideos'));
  check('iaFideosSiguenFideos', esM({ generico: 'fideos', nombre: 'Fideos spaghetti 5 Carozzi', variante: 'spaghetti 5' }, 'fideos', 'spaghetti-5'));
  check('iaFideosParaSopa', esM({ generico: 'fideos', nombre: 'Fideos para sopa', variante: '' }, 'fideos', 'para-sopa'));
  check('iaManjarate', esM({ generico: 'postre', nombre: 'Postre Soprole Manjarate 80 g', variante: '' }, 'postrelacteo', 'manjarate'));
  check('iaChiquitin', esM({ generico: 'yogur', nombre: 'Chiquitín frutilla', variante: 'frutilla' }, 'postrelacteo', 'petit-suisse-chiquitin'));
  check('iaCremaSobre', esM({ generico: 'crema', nombre: 'Crema Maggi zapallo 45 g', variante: 'zapallo' }, 'cremasobre', 'zapallo'));
  check('iaCremaLeche', esM({ generico: 'crema', nombre: 'Crema de leche Colun 200 ml', variante: 'de leche' }, 'crema', 'de-leche'));
  check('iaSuper8', esM({ generico: 'galleta', nombre: 'Super 8 232 g', orig: 'GALL SUPER 8' }, 'barrachoc', 'super-8'));
  check('alergiaManjarateSinLactosa', !Catalog.tags('lacteos', 'postrelacteo', 'manjarate-sin-lactosa').includes('lactosa') && Catalog.tags('lacteos', 'postrelacteo', 'manjarate').includes('lactosa'));

  // Chef IA
  App.go('menu'); await w(50); Actions.aiChef(); await w(150);
  click('[data-act="chefGo"]');
  check('chefPropone', await until(() => title() === 'Tortilla de zapallo italiano'));
  click('[data-act="chefSave"]'); await w(400);
  const rIA = Object.values(Store.state.recipes).find(r => r.ai);
  check('chefGuarda', !!rIA && rIA.ings.length === 3 && rIA.ings.every(g => g.c && g.i));
  check('chefAbreReceta', title() === 'Tortilla de zapallo italiano' && !!$q('[data-act="recSchedule"]'));
  UI.closeAll(); await w(150);

  // Exportes
  App.go('money'); await Exporter.pdf(Money.range('mes')); Exporter.csv(Money.range('mes'));
  return R;
});
console.log(results);
const failed = Object.entries(results).filter(([, v]) => v !== true);
console.log(errors.length ? 'ERRORES DE PÁGINA: ' + errors.join(' | ') : 'Sin errores de página');
console.log(failed.length ? 'FALLÓ: ' + failed.map(f => f[0]).join(', ') : 'TODO OK');
await browser.close(); server.close(); aiSrv.close();
process.exit(failed.length || errors.length ? 1 : 0);
