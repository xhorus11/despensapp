# despensAPP — reglas del proyecto

PWA vanilla (HTML + CSS + JS, sin build). Publicada en https://despensapp.web.app (Firebase Hosting + Firestore).

Hosting tiene dos sitios (ver `firebase.json` / `.firebaserc`): target `app` → `despensapp` (principal) y target `legacy` → `despensapp-eb4a7` (dirección antigua: misma app, pero `js/app.js` muestra el aviso de mudanza y traslada los datos con `#mudanza=`; `/manual` redirige). Un `deploy --only hosting` publica ambos.

## Cada vez que se cambie la app
1. Subir la versión en **dos lugares**: `VERSION` en `sw.js` (`despensapp-vX.Y.Z`) y en `js/app.js`.
2. **Actualizar el manual** (`manual/index.html`):
   - Regenerar capturas: `cd tools && npm install && npm run shots` (genera `manual/img/NN-nombre.webp` con Chrome; si agregas pantallas, agrega escenarios en `tools/shots.mjs`).
   - Ajustar el texto de las secciones afectadas, la versión y fecha del encabezado/pie, y agregar una entrada en **Novedades**.
3. Validar: `node --check` sobre `js/*.js`, `js/views/*.js` y `sw.js`; `cd tools && node smoke.mjs` (y `node test-worker.mjs` si cambió `worker/`).
4. Desplegar: `npx -y firebase-tools@13 deploy --only "hosting,firestore:rules" --project despensapp-eb4a7 --non-interactive` (PowerShell; la sesión de Firebase ya está iniciada).
5. Subir a GitHub (repo público https://github.com/xhorus11/despensapp, rama `main`): commit con autor `Matías Gajardo <xhorus11@users.noreply.github.com>` (ya configurado en el repo) y `git push`. GitHub CLI en `C:\Program Files\GitHub CLI\gh.exe`, sesión iniciada como xhorus11.

## IA
- La IA solo lee y propone (boletas, foto de despensa, lista por texto/voz, Chef IA); siempre hay pantalla de revisión y los cálculos los hace la app.
- Intermediario en `worker/` (Cloudflare Worker `despensapp-ia`): verifica el token de Firebase, KV `LIMITS` para 40 usos/persona/día y 600 en total, Gemini (`gemini-3.5-flash-lite` → `gemini-flash-lite-latest`) con respaldo `@cf/meta/llama-4-scout-17b-16e-instruct`. Mismo patrón que `worker/` de ViajAPP.
- Publicar el worker: `cd worker; npx wrangler@4 deploy`. La clave `GEMINI_API_KEY` es secreta: la pone el usuario con `npx wrangler@4 secret put GEMINI_API_KEY` (nunca en archivos, chat ni GitHub).
- URL del worker en `window.DESPENSAPP_AI_URL` (`firebase-config.js`); vacía = botones de IA ocultos.
- Pruebas sin cuota: `cd tools && node test-worker.mjs` (worker con mocks) y `node smoke.mjs` (app con `mock-ai.mjs`).

## Convenciones
- UI con íconos SVG de `js/icons.js`; los emojis son solo contenido (productos, categorías, recetas).
- Catálogo en `js/catalog.js` (formato `id|Nombre|emoji|unidad[/tamaño]|tags|Variantes`); las variantes se separan con coma, así que no usar comas decimales en nombres (usar `1.6 L`).
- `firebase-config.js` debe quedar como `window.FIREBASE_CONFIG = {...}` (nunca el snippet con `import`).
- Toda mutación de estado pasa por `Store.commit()`; las entidades llevan `t` (timestamp) para el merge de sincronización.
