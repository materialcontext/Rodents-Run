// Offline play: cache the game on first visit, serve from cache after,
// refreshing in the background so a new version arrives on the next launch.
const CACHE = "rodent-v3";
const FILES = [
  "./", "index.html", "style.css", "rodent.wasm", "manifest.webmanifest", "icon.svg",
  "js/main.js", "js/core.js", "js/input.js", "js/render.js", "js/sprites.js", "js/store.js", "js/ui.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    }),
  );
});
