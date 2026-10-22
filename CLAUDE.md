# despensAPP — reglas del proyecto

PWA vanilla (HTML + CSS + JS, sin build). Publicada en https://despensapp.web.app (Firebase Hosting + Firestore).

Hosting tiene dos sitios (ver `firebase.json` / `.firebaserc`): target `app` → `despensapp` (principal) y target `legacy` → `despensapp-eb4a7` (dirección antigua: misma app, pero `js/app.js` muestra el aviso de mudanza y traslada los datos con `#mudanza=`; `/manual` redirige). Un `deploy --only hosting` publica ambos.

## Cada vez que se cambie la app
1. Subir la versión en **dos lugares**: `VERSION` en `sw.js` (`despensapp-vX.Y.Z`) y en `js/app.js`.
2. **Actualizar el manual** (`manual/index.html`):
   - Regenerar capturas: `cd tools && npm install && npm run shots` (genera `manual/img/NN-nombre.webp` con Chrome; si agregas pantallas, agrega escenarios en `tools/shots.mjs`).
   - Ajustar el texto de las secciones afectadas, la versión y fecha del encabezado/pie, y agregar una entrada en **Novedades**.
3. Validar sintaxis: `node --check` sobre `js/*.js`, `js/views/*.js` y `sw.js`.
4. Desplegar: `npx -y firebase-tools@13 deploy --only "hosting,firestore:rules" --project despensapp-eb4a7 --non-interactive` (PowerShell; la sesión de Firebase ya está iniciada).

## Convenciones
- UI con íconos SVG de `js/icons.js`; los emojis son solo contenido (productos, categorías, recetas).
- Catálogo en `js/catalog.js` (formato `id|Nombre|emoji|unidad[/tamaño]|tags|Variantes`); las variantes se separan con coma, así que no usar comas decimales en nombres (usar `1.6 L`).
- `firebase-config.js` debe quedar como `window.FIREBASE_CONFIG = {...}` (nunca el snippet con `import`).
- Toda mutación de estado pasa por `Store.commit()`; las entidades llevan `t` (timestamp) para el merge de sincronización.
