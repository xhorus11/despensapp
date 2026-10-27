// despensAPP · Prueba EN VIVO del intermediario de IA (usa cuota real, pocas llamadas).
// Uso: cd tools && node live-ai.mjs [ruta-foto-boleta.jpg]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AI_URL = process.env.AI_URL || 'https://despensapp-ia.viajapp.workers.dev';
const photo = process.argv[2];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8765);   // origen permitido en worker/wrangler.toml

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const page = await browser.newPage();
page.on('pageerror', e => console.log('ERROR página:', e.message));
await page.goto('http://localhost:8765/index.html', { waitUntil: 'networkidle0' });
const img = photo ? fs.readFileSync(photo).toString('base64') : null;
const out = await page.evaluate(async (url, img) => {
  window.DESPENSAPP_AI_URL = url;
  const R = {};
  const run = async (k, fn) => { const t0 = Date.now(); try { const j = await fn(); R[k] = { ok: true, model: j.model, s: ((Date.now() - t0) / 1000).toFixed(1), restantes: j.restantes, check: j.check, data: j.data }; } catch (e) { R[k] = { ok: false, error: e.message }; } };
  await run('lista', () => AI.call('lista', { text: '2 kilos de papas, leche sin lactosa y algo para el asado' }));
  if (img) await run('boleta', () => AI.call('boleta', { image: img, mime: 'image/jpeg' }));
  await run('receta', () => AI.call('receta', { personas: 3, porVencer: ['Zapallo italiano (1 kg)', 'Huevos (6 un)'], disponibles: ['Arroz', 'Cebolla', 'Queso mantecoso'], restricciones: ['Cami: Celíaco / sin gluten', 'Ana: Hipertensión'] }));
  return R;
}, AI_URL, img);
for (const [k, v] of Object.entries(out)) {
  console.log(`\n=== ${k}: ${v.ok ? `OK · ${v.model} · ${v.s} s · restantes ${v.restantes}` : 'FALLÓ · ' + v.error}`);
  if (!v.ok) continue;
  if (k === 'lista') v.data.items.forEach(i => console.log(`  ${i.cant} ${i.unidad} ${i.nombre} [${i.generico}/${i.variante}]${i.sugerido ? ' (sugerido)' : ''}`));
  if (k === 'boleta') { const d = v.data; console.log(`  ${d.proveedor} · ${d.fecha} · N° ${d.nDoc} · total ${d.total} · cuadra: ${v.check.diff === 0 ? 'sí' : 'no (' + v.check.diff + ')'} · ${d.categoria} · "${d.detalle}"`); d.items.forEach(i => console.log(`  ${i.cant} ${i.unidad} ${i.nombre} = ${i.total}  [${i.orig}]${i.despensa ? '' : ' (no despensa)'}`)); }
  if (k === 'receta') { const d = v.data; console.log(`  ${d.emoji} ${d.nombre} (${d.categoria}, ${d.minutos} min, ${d.porciones} p.)`); d.ingredientes.forEach(i => console.log(`  - ${i.cant} ${i.unidad} ${i.nombre}`)); d.pasos.forEach((p, n) => console.log(`  ${n + 1}. ${p}`)); }
}
await browser.close(); server.close();
