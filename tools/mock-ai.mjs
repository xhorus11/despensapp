// despensAPP · Intermediario de IA simulado (mismo contrato que worker/index.mjs, respuestas fijas, sin cuota).
// Lo usan smoke.mjs y shots.mjs.
import http from 'node:http';

export const MOCK = {
  boleta: { proveedor: 'Lider Ñuñoa', fecha: '2026-10-25', nDoc: '88219', tipoDoc: 'Boleta', medioPago: 'Débito', categoria: 'Supermercado', detalle: 'Compra (lácteos, pan)',
    items: [{ orig: 'LECHE DESC 1L', nombre: 'Leche descremada 1 L', generico: 'leche', variante: 'descremada', cant: 2, unidad: 'un', pUnit: 1100, total: 2200, despensa: true },
            { orig: 'MARRAQUETA KG', nombre: 'Marraqueta', generico: 'pan', variante: 'marraqueta', cant: 1, unidad: 'un', pUnit: 990, total: 990, despensa: true }],
    propina: 0, total: 3190, legible: true, avisos: [] },
  despensa: { items: [{ nombre: 'Huevos', generico: 'huevo', variante: '', cant: 12, unidad: 'un', confianza: 'alta' }, { nombre: 'Yogur natural', generico: 'yogur', variante: 'natural', cant: 4, unidad: 'un', confianza: 'media' }], avisos: [] },
  lista: { items: [{ nombre: 'Papas', generico: 'papa', variante: '', cant: 2, unidad: 'kg', sugerido: false }, { nombre: 'Leche sin lactosa', generico: 'leche', variante: 'sin lactosa', cant: 1, unidad: 'un', sugerido: false }] },
  receta: { nombre: 'Tortilla de zapallo italiano', emoji: '🍳', categoria: 'Casera', minutos: 25, porciones: 3,
    ingredientes: [{ nombre: 'Huevos', generico: 'huevo', variante: '', cant: 6, unidad: 'un' }, { nombre: 'Zapallo italiano', generico: 'zapallo italiano', variante: '', cant: 500, unidad: 'g' }, { nombre: 'Sal de mar', generico: 'sal', variante: 'de mar', cant: 5, unidad: 'g' }],
    pasos: ['Rallar el zapallo', 'Batir los huevos', 'Cuajar por ambos lados'], usaPorVencer: ['Zapallo italiano'], nota: 'Se guarda 2 días en el refri.' },
};
export const startMockAI = (port = 8794) => http.createServer((req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
    const task = req.url.replace(/^\//, '');
    res.writeHead(200, { ...cors, 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, task, model: 'simulado', data: MOCK[task], check: { diff: 0 }, restantes: 37 }));
  });
}).listen(port);
