const CACHE_NAME = "ledgerentries-v3";
const API_CACHE = "ledgerentries-api-v3";

const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png"
];

// ── Install: cache app shell ──────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: smart caching strategy ────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle GET for API — POST/PUT/DELETE go straight through (handled by offline-context)
  if (url.pathname.startsWith("/api/")) {
    if (event.request.method !== "GET") {
      event.respondWith(
        fetch(event.request).catch(() =>
          new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
        )
      );
      return;
    }

    // API GET → Network first, fallback to cache (shows last known data when offline)
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(event.request, { cacheName: API_CACHE });
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: "Offline — no cached data available." }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        })
    );
    return;
  }

  // App shell & static assets → Cache first, update in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
