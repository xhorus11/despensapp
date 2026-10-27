/* despensAPP · Service Worker
 * - Archivos propios (HTML/CSS/JS): Network-First → siempre la última versión, con respaldo offline.
 * - Recursos estáticos (vendor/, icons/, CDN): Cache-First.
 */
const VERSION = 'despensapp-v1.3.0';
const CORE = [
  './', './index.html', './manifest.webmanifest', './firebase-config.js', './css/app.css',
  './js/icons.js', './js/catalog.js', './js/core.js', './js/recipes.js', './js/ui.js', './js/photos.js', './js/sync.js', './js/export.js', './js/ai.js',
  './js/views/picker.js', './js/views/home.js', './js/views/pantry.js', './js/views/shop.js', './js/views/menu.js', './js/views/money.js', './js/views/split.js', './js/views/ai.js', './js/views/hogar.js', './js/app.js',
];
const STATIC = [
  './vendor/qrcode.min.js', './vendor/jsQR.js', './vendor/jspdf.umd.min.js', './vendor/jspdf.plugin.autotable.min.js', './vendor/html2canvas.min.js',
  './vendor/firebase-app-compat.js', './vendor/firebase-auth-compat.js', './vendor/firebase-firestore-compat.js',
  './icons/favicon-64.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './img/logo.webp', './img/logo.png', './img/mascot.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll([...CORE, ...STATIC])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Firestore / Auth / APIs de Google: siempre red (el SDK maneja su propio offline)
  if (/googleapis\.com|firebaseio\.com|identitytoolkit|securetoken|workers\.dev/.test(url.hostname)) return;

  const sameOrigin = url.origin === location.origin;
  const isStatic = sameOrigin ? /\/(vendor|icons|img)\//.test(url.pathname) : /cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com|tessdata|unpkg\.com/.test(url.hostname);

  if (isStatic) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
      return res;
    })));
    return;
  }
  if (!sameOrigin) return;

  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(req, cp)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
