/* despensAPP · intermediario de IA (Cloudflare Worker).
   Rutas (POST, sesión de Firebase en "Authorization: Bearer <idToken>"):
     /boleta   { image, mime }  → lee una boleta (local, fecha, N°, total, propina, productos)
     /despensa { image, mime }  → inventario sugerido desde una foto del refri o la despensa
     /lista    { text }         → lista de compras desde texto o voz
     /receta   { personas, porVencer, disponibles, restricciones, pedido, tiempo, evitar } → una receta
   Solo atiende a la app (CORS + token de Firebase) y limita usos por persona y por día.
   Usa Gemini (clave secreta GEMINI_API_KEY) y, si falla o se acaba la cuota, Workers AI.
   Las claves nunca llegan al celular. */
import { TASKS, normalize, isEmpty, check, userText, callGemini } from './tasks.mjs';

const GEMINI = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest'];
// Respaldo en Cloudflare (Llama 4 Scout ve imágenes y respeta el JSON; Mistral como segundo respaldo)
const CF_MODELS = ['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct'];
const MAX_B64 = 7_000_000;   // ~5 MB de imagen
const LIMIT_MSG = {
  boleta: 'boletas', despensa: 'fotos de despensa', lista: 'listas', receta: 'recetas',
};

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
    const cors = {
      'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0] || '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-max-age': '86400',
      vary: 'origin',
    };
    const out = (status, body) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json; charset=utf-8' } });
    const url = new URL(req.url);
    const task = url.pathname.replace(/^\/+/, '');

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method === 'GET' && url.pathname === '/') return out(200, { ok: true, servicio: 'despensapp-ia', tareas: Object.keys(TASKS) });
    if (req.method !== 'POST' || !TASKS[task]) return out(404, { ok: false, error: 'No encontrado' });
    if (origin && !allowed.includes(origin)) return out(403, { ok: false, error: 'Origen no permitido' });

    // 1) ¿Quién pide? Sesión de Firebase (anónima) válida del proyecto
    let uid;
    try { uid = await verifyFirebase((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT); }
    catch (e) { return out(401, { ok: false, error: 'Sesión no válida. Abre la app con internet e intenta de nuevo.' }); }

    // 2) Límite diario por persona (y uno general para cuidar la cuota gratis)
    const day = new Date().toISOString().slice(0, 10);
    const per = +(env.LIMIT_PER_USER || 40), all = +(env.LIMIT_TOTAL || 600);
    const kU = `u:${uid}:${day}`, kT = `t:${day}`;
    const [nU, nT] = await Promise.all([env.LIMITS.get(kU), env.LIMITS.get(kT)]).then(v => v.map(x => +x || 0));
    if (nU >= per) return out(429, { ok: false, error: `Llegaste al máximo de ${per} usos de IA por hoy. Mañana puedes seguir.` });
    if (nT >= all) return out(429, { ok: false, error: 'Se alcanzó el máximo de usos de IA de hoy. Intenta mañana.' });

    // 3) Entrada
    let body;
    try { body = await req.json(); } catch (e) { return out(400, { ok: false, error: 'Solicitud no válida' }); }
    const T = TASKS[task];
    let b64 = '', mime = 'image/jpeg', text = '';
    if (T.image) {
      b64 = String(body.image || '').replace(/^data:[^,]+,/, '');
      mime = /^image\/(jpeg|png|webp)$/.test(body.mime) ? body.mime : 'image/jpeg';
      if (!b64 || b64.length > MAX_B64) return out(413, { ok: false, error: 'La foto es muy grande o no llegó. Intenta con otra foto.' });
    } else {
      text = userText(task, body);
      if (task === 'lista' && !String(body.text || '').trim()) return out(400, { ok: false, error: 'Escribe o dicta qué necesitas.' });
    }

    // 4) Modelos: Gemini → Gemini 2 → Workers AI (o el que se pida en "via", para pruebas)
    const order = body.via === 'cf' ? CF_MODELS.map(m => ['cf', m])
      : CF_MODELS.includes(body.via) ? [['cf', body.via]]
      : GEMINI.includes(body.via) ? [['g', body.via]]
      : GEMINI.map(m => ['g', m]).concat([['cf', CF_MODELS[0]]]);
    const fails = [], t0 = Date.now();
    let best = null;
    for (const [kind, model] of order) {
      try {
        const raw = kind === 'g'
          ? await callGemini({ key: env.GEMINI_API_KEY, model, task, b64, mime, text })
          : await callWorkersAI(env, model, task, b64, mime, text);
        const data = normalize(task, raw);
        if (isEmpty(task, data)) throw new Error('Respuesta vacía');
        if (task !== 'boleta') { best = { model, data }; break; }
        // Boletas: si la suma no cuadra con el total se intenta con el siguiente modelo;
        // se devuelve la primera que cuadre o la de menor diferencia
        const c = check(data);
        if (!best || Math.abs(c.diff) < Math.abs(best.check.diff)) best = { model, data, check: c };
        if (c.diff === 0) break;
        fails.push(`${model}: no cuadra por ${c.diff}`);
      } catch (e) {
        fails.push(`${model}: ${String(e.message || e).slice(0, 120)}`);
      }
    }
    if (best) {
      await Promise.all([env.LIMITS.put(kU, String(nU + 1), { expirationTtl: 172800 }), env.LIMITS.put(kT, String(nT + 1), { expirationTtl: 172800 })]);
      return out(200, { ok: true, task, model: best.model, ms: Date.now() - t0, data: best.data, check: best.check, intentos: fails, restantes: per - nU - 1 });
    }
    console.log('Fallaron todos', task, fails);
    return out(502, { ok: false, error: `No se pudo procesar ahora (${LIMIT_MSG[task]}). Intenta en un rato o hazlo a mano.`, detalle: fails });
  },
};

/* Workers AI (respaldo): mensajes con imagen opcional + salida JSON según el mismo esquema */
async function callWorkersAI(env, model, task, b64, mime, text) {
  const T = TASKS[task];
  const user = b64
    ? [{ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } }, { type: 'text', text: T.ask || 'Procesa la imagen.' }]
    : text;
  const r = await env.AI.run(model, {
    messages: [{ role: 'system', content: T.prompt + '\nResponde únicamente con el JSON.' }, { role: 'user', content: user }],
    response_format: { type: 'json_schema', json_schema: T.schema },
    max_tokens: 4096, temperature: task === 'receta' ? 0.6 : 0,
  });
  const res = r && r.response !== undefined ? r.response : r;
  if (res && typeof res === 'object') return res;
  const str = String(res || ''), i = str.indexOf('{'), j = str.lastIndexOf('}');
  return JSON.parse(str.slice(i, j + 1));
}

/* Verificación del token de Firebase (RS256) con las claves públicas de Google, sin librerías */
let JWKS = null, JWKS_EXP = 0;
export async function verifyFirebase(token, project) {
  const [h, p, sig] = String(token).split('.');
  if (!sig) throw new Error('token');
  const dec = x => JSON.parse(new TextDecoder().decode(b64url(x)));
  const head = dec(h), pay = dec(p), now = Date.now() / 1000;
  if (head.alg !== 'RS256' || pay.aud !== project || pay.iss !== `https://securetoken.google.com/${project}` || !pay.sub || pay.exp < now || pay.iat > now + 300) throw new Error('claims');
  if (!JWKS || Date.now() > JWKS_EXP) {
    const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
    JWKS = (await r.json()).keys; JWKS_EXP = Date.now() + 3600e3;
  }
  const jwk = JWKS.find(k => k.kid === head.kid);
  if (!jwk) throw new Error('kid');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
  if (!ok) throw new Error('firma');
  return pay.sub;
}
function b64url(x) {
  const b = atob(x.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((x.length + 3) % 4));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}
