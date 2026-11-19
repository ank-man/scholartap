// Offline shell for ScholarTap Taps: app files cache-first, everything else straight to the network.
const CACHE = "taps-v2";
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

// Tap alerts: pushes carry no payload; the app loads the inbox when opened.
self.addEventListener("push", (e) => {
  e.waitUntil(Promise.all([
    self.registration.showNotification("New tap 👋", { body: "Someone swapped cards with you. Open Taps to see who.", icon: "../assets/icon-192.png", badge: "../assets/icon-192.png", tag: "scholartap-tap", renotify: true }),
    self.navigator?.setAppBadge?.().catch(() => {})
  ]));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL("./?view=taps", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => x.url.startsWith(self.registration.scope));
    return c ? c.navigate(url).then((w) => w?.focus()) : self.clients.openWindow(url);
  }));
});
