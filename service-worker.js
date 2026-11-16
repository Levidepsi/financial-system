const CACHE_NAME = "perfi-offline-v14";
const APP_SHELL = ["./", "./index.html", "./pricing.html", "./about.html", "./about.css", "./about.js", "./styles.css", "./category-policy.js", "./app.js", "./perfi-extras.js", "./account.js", "./favicon.svg", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.startsWith("/api/")) return;
  // Let the browser handle video byte ranges; Cache.put rejects partial responses.
  if (event.request.headers.has("range") || event.request.destination === "video") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => {
        const page = ["about.html", "pricing.html"].find(name => requestUrl.pathname.endsWith(`/${name}`));
        return caches.match(page ? `./${page}` : "./index.html");
      }),
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok && response.status !== 206) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, response.clone());
          } catch { /* Cache failures must not discard a successful network response. */ }
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
