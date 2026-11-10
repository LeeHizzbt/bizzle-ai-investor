/* Ai Investor v4.20 service worker. CACHE changes every build (scripts/bump-version.sh). Market data and AI calls always go to the network. */
var CACHE = 'ai-investor-2026-11-10.1846';
var V = '?v=2026-11-10.1846';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'css/app.css' + V].concat(['config', 'store', 'ai', 'ui', 'engine', 'samples', 'data', 'agents', 'bizzy', 'app'].map(function (f) { return 'js/' + f + '.js' + V; }));
self.addEventListener('install', function (e) { e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k.indexOf('ai-investor-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || /\.apk$/.test(url.pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(function (r) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put('index.html', cp); }); return r; }).catch(function () { return caches.match('index.html'); }));
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) { return hit || fetch(req).then(function (r) { if (r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { c.put(req, cp); }); } return r; }); }));
});
