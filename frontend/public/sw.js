const VERSION = "sapling-global-v4";
const STATIC_CACHE = `${VERSION}-static`;
const STATIC_ASSETS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
];

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
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys.filter((key) => key.endsWith("-navigation")).map((key) => caches.delete(key)),
          ),
        ),
    );
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
      fetch(request).catch(async () => {
        const shell = await caches.match("/offline.html");
        return shell ?? Response.error();
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
