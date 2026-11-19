// Offline shell for ScholarTap Taps: app files cache-first, everything else straight to the network.
const CACHE = "taps-v1";
const SHELL = ["./", "index.html", "taps.css", "app.js", "manifest.webmanifest", "../js/vendor/qrcode.js", "../assets/brand/scholartap-mark.svg", "../assets/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  const shell = SHELL.some((p) => new URL(p, self.registration.scope).pathname === u.pathname) || u.pathname === new URL("./", self.registration.scope).pathname;
  if (!shell) return;
  // network first so updates land, cache when offline
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
