// despensAPP · Prueba del intermediario de IA (worker/) sin red ni cuota: simula Firebase, Gemini y Workers AI.
// Uso: cd tools && node test-worker.mjs
import worker from '../worker/index.mjs';

const PROJECT = 'despensapp-eb4a7';
const ORIGIN = 'https://despensapp.web.app';
let ok = 0, bad = 0;
const t = (name, cond) => { if (cond) ok++; else bad++; console.log(cond ? '  ✓' : '  ✗', name); };

// --- Token de Firebase firmado con una clave propia, y JWKS simulado ---
const kp = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', kp.publicKey)), kid: 'k1', alg: 'RS256' };
const b64u = buf => Buffer.from(buf).toString('base64url');
async function token(sub = 'user1', aud = PROJECT) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
  const p = b64u(JSON.stringify({ aud, iss: `https://securetoken.google.com/${aud}`, sub, iat: now, exp: now + 3600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', kp.privateKey, new TextEncoder().encode(`${h}.${p}`));
  return `${h}.${p}.${b64u(sig)}`;
}

// --- Respuestas simuladas de Gemini por tarea ---
let geminiPlan = [];   // cola de respuestas: objeto JSON o Error
const BOLETA_OK = { proveedor: 'Lider', fecha: '2026-10-20', nDoc: '00088219', tipoDoc: 'Boleta', medioPago: 'Débito', categoria: 'Supermercado', detalle: 'Compra semanal',
  items: [{ orig: 'LECHE DESC 1L', nombre: 'Leche descremada 1 L', generico: 'Leche', variante: 'Descremada', cant: 2, unidad: 'un', pUnit: 1100, total: 2200, despensa: true },
          { orig: 'BOLSA', nombre: 'Bolsa', generico: 'bolsa', variante: '', cant: 1, unidad: 'un', pUnit: 50, total: 50, despensa: false }],
  propina: 0, total: 2250, legible: true, avisos: [] };
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('securetoken@system')) return new Response(JSON.stringify({ keys: [jwk] }));
  if (String(url).includes('generativelanguage')) {
    const next = geminiPlan.shift();
    if (next instanceof Error) return new Response(JSON.stringify({ error: { message: next.message } }), { status: 429 });
    const body = JSON.parse(opt.body);
    t(`Gemini recibe esquema JSON (${url.split('/models/')[1].split(':')[0]})`, !!body.generationConfig.responseJsonSchema);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(next) }] } }] }));
  }
  throw new Error('fetch inesperado ' + url);
};
const kv = new Map();
let aiCalls = 0;
const env = {
  ALLOWED_ORIGINS: ORIGIN, FIREBASE_PROJECT: PROJECT, LIMIT_PER_USER: '3', LIMIT_TOTAL: '600', GEMINI_API_KEY: 'x',
  LIMITS: { get: async k => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, v); } },
  AI: { run: async () => { aiCalls++; return { response: { items: [{ nombre: 'Papas', generico: 'papa', variante: '', cant: 2, unidad: 'kg' }] } }; } },
};
const call = async (path, body, tok, origin = ORIGIN) => {
  const r = await worker.fetch(new Request('https://w.dev/' + path, { method: 'POST', headers: { origin, authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);
  return { status: r.status, j: await r.json() };
};

console.log('Worker de IA');
const tok = await token();
// Seguridad
t('rechaza sin token', (await call('boleta', { image: 'AAA' }, 'x')).status === 401);
t('rechaza token de otro proyecto', (await call('boleta', { image: 'AAA' }, await token('u', 'otro'))).status === 401);
t('rechaza origen ajeno', (await call('boleta', { image: 'AAA' }, tok, 'https://malo.com')).status === 403);
t('ruta desconocida 404', (await call('nada', {}, tok)).status === 404);

// Boleta que cuadra
geminiPlan = [BOLETA_OK];
let r = await call('boleta', { image: 'AAAA', mime: 'image/jpeg' }, tok);
t('boleta OK', r.status === 200 && r.j.ok && r.j.check.diff === 0);
t('normaliza N° doc sin ceros', r.j.data.nDoc === '88219');
t('genérico en minúscula', r.j.data.items[0].generico === 'leche' && r.j.data.items[0].variante === 'descremada');
t('bolsa no va a la despensa', r.j.data.items[1].despensa === false);
t('informa usos restantes', r.j.restantes === 2);

// Boleta que no cuadra: pide segunda lectura y se queda con la que cuadra
geminiPlan = [{ ...BOLETA_OK, total: 9999 }, BOLETA_OK];
r = await call('boleta', { image: 'AAAA' }, tok);
t('segunda lectura cuando no cuadra', r.j.ok && r.j.check.diff === 0 && r.j.model === 'gemini-flash-lite-latest');

// Gemini falla → Workers AI (lista por texto)
geminiPlan = [new Error('cuota'), new Error('cuota')];
r = await call('lista', { text: '2 kilos de papas' }, await token('user2'));
t('respaldo Workers AI cuando Gemini falla', r.j.ok && r.j.model.startsWith('@cf/') && aiCalls === 1 && r.j.data.items[0].unidad === 'kg');
t('lista vacía se rechaza', (await call('lista', { text: '  ' }, await token('user2'))).status === 400);

// Receta
geminiPlan = [{ nombre: 'Tortilla de verduras', emoji: '🍳', categoria: 'Casera', minutos: 25, porciones: 3,
  ingredientes: [{ nombre: 'Huevos', generico: 'huevo', variante: '', cant: 6, unidad: 'un' }, { nombre: 'Zapallo italiano', generico: 'zapallo italiano', variante: '', cant: 400, unidad: 'g' }],
  pasos: ['Picar', 'Batir', 'Cuajar'], usaPorVencer: ['Zapallo italiano'], nota: 'Se guarda 2 días.' }];
r = await call('receta', { personas: 3, porVencer: ['Zapallo italiano'], disponibles: ['Huevos'], restricciones: ['Cami: sin gluten'] }, await token('user3'));
t('receta normalizada', r.j.ok && r.j.data.ingredientes.length === 2 && r.j.data.pasos.length === 3);

// Límite diario por persona (3 en esta prueba)
geminiPlan = [BOLETA_OK];
await call('boleta', { image: 'AAAA' }, tok);           // 3er uso de user1
r = await call('boleta', { image: 'AAAA' }, tok);       // 4to → bloqueado
t('límite diario por persona', r.status === 429);

console.log(`\n${ok} OK, ${bad} fallas`);
process.exit(bad ? 1 : 0);
