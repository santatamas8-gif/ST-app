/* Minimal service worker for PWA installability and offline detection. */
const CACHE_NAME = "st-ams-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  /* Network-first: no caching for now; app requires live data. */
  event.respondWith(fetch(event.request).catch(() => new Response("Offline", { status: 503 })));
});
