const VERSION = "sapling-global-v2";
const STATIC_CACHE = `${VERSION}-static`;
const NAVIGATION_CACHE = `${VERSION}-navigation`;
const STATIC_ASSETS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sapling-global-") && !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "PURGE_PRIVATE_CACHE") {
    event.waitUntil(caches.delete(NAVIGATION_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/reports/verify/") ||
    url.pathname.startsWith("/consent/") ||
    url.pathname.startsWith("/clarification/") ||
    url.pathname.startsWith("/candidate/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok && url.pathname === "/field-executive") {
            const cache = await caches.open(NAVIGATION_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cached =
            url.pathname === "/field-executive" ? await caches.match(request) : undefined;
          return (
            cached ??
            new Response(
              "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Offline</title><style>body{font:16px system-ui;margin:0;display:grid;min-height:100vh;place-items:center;background:#f5f5f7;color:#18181b}.card{max-width:32rem;padding:2rem;border-radius:1.5rem;background:white;box-shadow:0 12px 40px #0001}p{color:#71717a;line-height:1.6}</style><main class=card><h1>Sapling Global is offline</h1><p>Open the Field Executive workspace once while online to enable its offline app shell. Captured field drafts already stored on this device remain safe.</p></main>",
              { headers: { "content-type": "text/html; charset=utf-8" }, status: 503 },
            )
          );
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/assets/") || STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        });
        return cached ?? network;
      }),
    );
  }
});
