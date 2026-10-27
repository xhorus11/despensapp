/* despensAPP · Instrucciones y formatos de respuesta de cada tarea de IA.
   Las usa el Worker (index.mjs) y la prueba tools/test-worker.mjs.
   La IA solo LEE o PROPONE; la app revisa, calcula y la persona confirma antes de guardar. */

// Categorías de gasto de la app (js/core.js → Money.CATS, sin "Ajuste")
export const CATS = ['Supermercado', 'Almacén de barrio', 'Verdulería', 'Feria', 'Carnicería', 'Panadería', 'Farmacia', 'Aseo', 'Mascotas', 'Delivery', 'Gas y agua', 'Otros'];
export const REC_CATS = ['Rápida', 'Casera', 'Chilena', 'Saludable', 'Vegetariana', 'Internacional', 'Sopas', 'Ensaladas', 'Desayuno', 'Repostería'];

const PRODUCT_RULES = `- "nombre": nombre claro en español para una persona común (ej. "CHAMPINON BDJA 20" -> "Champiñón bandeja 200 g"; "LECHE DESC SOPROLE 1L" -> "Leche descremada Soprole 1 L").
- "generico": el producto base, en singular y sin marca ni tamaño, como se busca en un supermercado chileno (ej. "leche", "champiñón", "papel higiénico", "pechuga de pollo" -> "pollo", "marraqueta" -> "pan").
- "variante": el tipo, sabor o formato que distingue al producto, sin marca (ej. "descremada", "sin lactosa", "bandeja", "doble hoja", "pechuga deshuesada"); "" si no aplica.`;

/* ---------- Boleta ---------- */
export const BOLETA_PROMPT = `Eres un lector de boletas y facturas chilenas (supermercados, almacenes, ferias, farmacias, delivery).
Lee la imagen y devuelve SOLO el JSON pedido. Reglas:
- Montos en pesos chilenos como números enteros, sin puntos ni signo $ (ej. "$54.884" -> 54884).
- "items": cada producto o servicio cobrado, en el orden de la boleta. No incluyas líneas de neto, IVA, total, vuelto, medio de pago ni textos del timbre electrónico.
  - "orig": el texto tal como aparece impreso (abreviado o cortado).
${PRODUCT_RULES}
  - "cant": cantidad comprada (unidades, o kilos/litros con decimales si se vende a granel, ej. "0,852 x 1 KG" -> 0.852 con unidad "kg").
  - "unidad": "un" para todo lo que se cuenta por unidad o envase (botellas, cajas, bolsas, bandejas), aunque el nombre diga "1 L" o "1 kg". Usa "kg", "g", "l" o "ml" solo si se vende a granel y la cantidad es un peso o volumen.
  - "pUnit": precio por unidad (o por kg) si aparece o se puede calcular; si no, total/cant redondeado.
  - "total": valor de la línea. Si una cantidad y precio unitario vienen en una línea aparte (ej. "2 x 1 UN $2190 c/u"), únelos al producto de arriba.
  - "despensa": true si es algo que se guarda en la casa (alimentos, bebidas, aseo, higiene, mascotas); false para bolsas, servicios, propinas, recargas o comida para consumir en el local.
  - Descuentos u ofertas que restan: un item aparte con "total" negativo, nombre "Descuento ..." y "despensa": false.
- "total": el TOTAL a pagar. "propina" si aparece (si no, 0).
- "proveedor": nombre comercial corto (ej. "Lider Ñuñoa", "Unimarc", "Farmacias Ahumada").
- "fecha" en formato AAAA-MM-DD. "nDoc": número de boleta/factura (solo dígitos, sin ceros a la izquierda). "tipoDoc": "Boleta", "Factura" o "Ticket".
- "medioPago": "Efectivo", "Débito", "Crédito" o "Transferencia" si se ve; si no, "".
- "categoria": una de ${CATS.join(', ')}.
- "detalle": resumen de 2 a 6 palabras (ej. "Compra semanal (verduras, lácteos)").
- "legible": false si la foto está tan borrosa o cortada que no se puede leer con confianza; "avisos": problemas concretos (ej. "No se lee el precio de la línea 4").`;

const num = { type: 'number' }, str = { type: 'string' }, bool = { type: 'boolean' };
const UNIT = { type: 'string', enum: ['un', 'kg', 'g', 'l', 'ml'] };

export const BOLETA_SCHEMA = {
  type: 'object',
  properties: {
    proveedor: str, fecha: str, nDoc: str, tipoDoc: str, medioPago: str,
    categoria: { type: 'string', enum: CATS }, detalle: str,
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { orig: str, nombre: str, generico: str, variante: str, cant: num, unidad: UNIT, pUnit: num, total: num, despensa: bool },
        required: ['orig', 'nombre', 'generico', 'cant', 'unidad', 'pUnit', 'total', 'despensa'],
      },
    },
    propina: num, total: num, legible: bool, avisos: { type: 'array', items: str },
  },
  required: ['proveedor', 'fecha', 'nDoc', 'tipoDoc', 'categoria', 'detalle', 'items', 'total', 'legible'],
};

/* ---------- Foto de refrigerador o despensa ---------- */
export const DESPENSA_PROMPT = `Eres un asistente de inventario del hogar en Chile. La imagen muestra un refrigerador, una despensa, una alacena o productos sobre una mesa.
Devuelve SOLO el JSON pedido con los productos que se VEN con claridad. Reglas:
- No inventes productos que no se vean. Si algo es dudoso, inclúyelo con "confianza": "baja".
${PRODUCT_RULES}
- "cant": cuántas unidades o envases se ven (estima si están apilados). Para frutas y verduras sueltas, cuenta las unidades.
- "unidad": "un" casi siempre; "kg" o "g" solo si se ve una bolsa o bandeja a granel con el peso escrito.
- "confianza": "alta", "media" o "baja".
- "avisos": observaciones útiles (ej. "Hay productos tapados al fondo", "La leche parece abierta").`;

export const DESPENSA_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: str, generico: str, variante: str, cant: num, unidad: UNIT, confianza: { type: 'string', enum: ['alta', 'media', 'baja'] } },
        required: ['nombre', 'generico', 'cant', 'unidad', 'confianza'],
      },
    },
    avisos: { type: 'array', items: str },
  },
  required: ['items'],
};

/* ---------- Lista escrita o dictada ---------- */
export const LISTA_PROMPT = `Eres un asistente de compras en Chile. Convierte lo que escribió o dictó la persona en una lista de supermercado.
Devuelve SOLO el JSON pedido. Reglas:
${PRODUCT_RULES}
- "cant" y "unidad": usa lo que diga la persona ("2 kilos de papas" -> 2 "kg"; "media docena de huevos" -> 6 "un"; "un litro de leche" -> 1 "un" con variante del tamaño si sirve). Si no dice cantidad, usa 1 "un".
- Si pide algo general (ej. "algo para el asado", "cosas para once"), propone hasta 6 productos típicos chilenos para eso y márcalos con "sugerido": true.
- Ignora saludos, relleno o texto que no sea un producto. No repitas productos.`;

export const LISTA_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: str, generico: str, variante: str, cant: num, unidad: UNIT, sugerido: bool },
        required: ['nombre', 'generico', 'cant', 'unidad'],
      },
    },
  },
  required: ['items'],
};

/* ---------- Chef IA: receta con lo que hay ---------- */
export const RECETA_PROMPT = `Eres un cocinero chileno práctico que ayuda a una familia a no botar comida.
Con los datos que recibes (productos disponibles en casa, los que están por vencer, número de personas, restricciones y lo que se le antoja a la persona) propone UNA receta casera realista.
Devuelve SOLO el JSON pedido. Reglas:
- Prioriza usar los productos por vencer y luego los disponibles; puedes agregar pocos ingredientes básicos que falten.
- Respeta estrictamente las restricciones (alergias, dietas, condiciones de salud): no uses ingredientes prohibidos y, si alguien tiene hipertensión o colesterol, prefiere preparaciones bajas en sal y grasas.
- Cantidades para el número de personas indicado, en "g", "ml" o "un" (huevos, cebollas, dientes de ajo no: usa g para el ajo).
${PRODUCT_RULES}
- "categoria": una de ${REC_CATS.join(', ')}. "emoji": un solo emoji de comida. "minutos": tiempo total.
- "pasos": de 3 a 7 pasos cortos y claros. "usaPorVencer": los nombres de los productos por vencer que usa.
- "nota": una frase útil (ej. cómo guardar las sobras o una variación).`;

export const RECETA_SCHEMA = {
  type: 'object',
  properties: {
    nombre: str, emoji: str, categoria: { type: 'string', enum: REC_CATS }, minutos: num, porciones: num,
    ingredientes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { nombre: str, generico: str, variante: str, cant: num, unidad: { type: 'string', enum: ['g', 'ml', 'un'] } },
        required: ['nombre', 'generico', 'cant', 'unidad'],
      },
    },
    pasos: { type: 'array', items: str }, usaPorVencer: { type: 'array', items: str }, nota: str,
  },
  required: ['nombre', 'emoji', 'categoria', 'minutos', 'porciones', 'ingredientes', 'pasos'],
};

export const TASKS = {
  boleta: { prompt: BOLETA_PROMPT, schema: BOLETA_SCHEMA, image: true, ask: 'Lee esta boleta.' },
  despensa: { prompt: DESPENSA_PROMPT, schema: DESPENSA_SCHEMA, image: true, ask: 'Haz el inventario de esta foto.' },
  lista: { prompt: LISTA_PROMPT, schema: LISTA_SCHEMA, image: false },
  receta: { prompt: RECETA_PROMPT, schema: RECETA_SCHEMA, image: false },
};

/* ---------- Normalización: formato seguro y predecible para la app ---------- */
const n = v => { const x = typeof v === 'string' ? +v.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.') : +v; return isFinite(x) ? x : 0; };
const s = (v, max = 120) => String(v == null ? '' : v).slice(0, max).trim();
const unit = (u, ok) => (ok.includes(u) ? u : ok[0]);
const prod = it => ({ nombre: s(it.nombre) || s(it.orig), generico: s(it.generico, 60).toLowerCase(), variante: s(it.variante, 60).toLowerCase() });

export function normalize(task, d) {
  d = d || {};
  if (task === 'boleta') {
    const items = (Array.isArray(d.items) ? d.items : []).slice(0, 150).map(it => {
      const cant = n(it.cant) || 1, total = Math.round(n(it.total));
      return { orig: s(it.orig, 160), ...prod(it), cant, unidad: unit(it.unidad, ['un', 'kg', 'g', 'l', 'ml']), pUnit: Math.round(n(it.pUnit)) || Math.round(total / cant), total, despensa: it.despensa !== false && total > 0 };
    });
    return {
      proveedor: s(d.proveedor, 80), fecha: /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) ? d.fecha : '',
      nDoc: s(d.nDoc, 30).replace(/\D/g, '').replace(/^0+(?=\d)/, ''), tipoDoc: ['Boleta', 'Factura', 'Ticket'].includes(d.tipoDoc) ? d.tipoDoc : 'Boleta',
      medioPago: ['Efectivo', 'Débito', 'Crédito', 'Transferencia'].includes(d.medioPago) ? d.medioPago : '',
      categoria: CATS.includes(d.categoria) ? d.categoria : 'Supermercado', detalle: s(d.detalle, 80),
      items, propina: Math.round(n(d.propina)), total: Math.round(n(d.total)),
      legible: d.legible !== false, avisos: (Array.isArray(d.avisos) ? d.avisos : []).slice(0, 8).map(x => s(x, 160)),
    };
  }
  if (task === 'despensa' || task === 'lista') {
    const seen = new Set();
    const items = (Array.isArray(d.items) ? d.items : []).slice(0, 80).map(it => ({
      ...prod(it), cant: Math.max(0, n(it.cant)) || 1, unidad: unit(it.unidad, ['un', 'kg', 'g', 'l', 'ml']),
      ...(task === 'despensa' ? { confianza: ['alta', 'media', 'baja'].includes(it.confianza) ? it.confianza : 'media' } : { sugerido: !!it.sugerido }),
    })).filter(it => it.nombre && !seen.has(it.nombre.toLowerCase()) && seen.add(it.nombre.toLowerCase()));
    return { items, avisos: (Array.isArray(d.avisos) ? d.avisos : []).slice(0, 6).map(x => s(x, 160)) };
  }
  if (task === 'receta') {
    return {
      nombre: s(d.nombre, 80) || 'Receta sugerida', emoji: s(d.emoji, 8) || '🍽️', categoria: REC_CATS.includes(d.categoria) ? d.categoria : 'Casera',
      minutos: Math.min(600, Math.max(5, Math.round(n(d.minutos)) || 30)), porciones: Math.min(20, Math.max(1, Math.round(n(d.porciones)) || 4)),
      ingredientes: (Array.isArray(d.ingredientes) ? d.ingredientes : []).slice(0, 25).map(it => ({ ...prod(it), cant: Math.max(0, n(it.cant)) || 1, unidad: unit(it.unidad, ['g', 'ml', 'un']) })).filter(x => x.nombre),
      pasos: (Array.isArray(d.pasos) ? d.pasos : []).slice(0, 10).map(x => s(x, 300)).filter(Boolean),
      usaPorVencer: (Array.isArray(d.usaPorVencer) ? d.usaPorVencer : []).slice(0, 12).map(x => s(x, 60)),
      nota: s(d.nota, 240),
    };
  }
  return d;
}

/* Se considera vacía una respuesta sin contenido útil (para pasar al siguiente modelo) */
export function isEmpty(task, d) {
  if (task === 'boleta') return !d.items.length && !d.total;
  if (task === 'receta') return !d.ingredientes.length || !d.pasos.length;
  return false; // despensa/lista pueden venir vacías legítimamente
}

/* Revisión de boletas: ¿la suma de las líneas cuadra con el total? */
export function check(r) {
  const sum = (r.items || []).reduce((a, it) => a + (+it.total || 0), 0) + (+r.propina || 0);
  return { sum, diff: Math.round((+r.total || 0) - sum) };
}

/* Texto de entrada para las tareas sin imagen */
export function userText(task, body) {
  if (task === 'lista') return `Texto de la persona:\n"""${s(body.text, 1500)}"""`;
  if (task === 'receta') {
    const list = (a, max) => (Array.isArray(a) ? a : []).slice(0, max).map(x => s(x, 80)).filter(Boolean);
    return [
      `Personas: ${Math.min(20, Math.max(1, Math.round(n(body.personas)) || 2))}`,
      `Por vencer: ${list(body.porVencer, 30).join('; ') || 'nada'}`,
      `Disponibles en casa: ${list(body.disponibles, 80).join('; ') || 'pocos productos'}`,
      `Restricciones: ${list(body.restricciones, 20).join('; ') || 'ninguna'}`,
      `Tiempo máximo: ${s(body.tiempo, 30) || 'sin límite'}`,
      `Se le antoja: ${s(body.pedido, 300) || 'cualquier cosa rica y casera'}`,
      `Evita repetir: ${list(body.evitar, 10).join('; ') || '—'}`,
    ].join('\n');
  }
  return '';
}

/* Llamada a Gemini (API REST de Google AI Studio) con salida JSON según el esquema de la tarea */
export async function callGemini({ key, model, task, b64, mime, text }) {
  const T = TASKS[task];
  const parts = [];
  if (b64) parts.push({ inline_data: { mime_type: mime || 'image/jpeg', data: b64 } });
  parts.push({ text: T.prompt + (text ? '\n\n' + text : '') });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const body = { contents: [{ role: 'user', parts }], generationConfig: { responseMimeType: 'application/json', responseJsonSchema: T.schema, temperature: task === 'receta' ? 0.7 : 0 } };
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error((j.error && j.error.message) || 'Error de Gemini'), { status: res.status });
  const out = (((j.candidates || [])[0] || {}).content || { parts: [] }).parts.map(p => p.text || '').join('');
  return JSON.parse(out);
}
