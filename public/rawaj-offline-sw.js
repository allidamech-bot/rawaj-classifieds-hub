/* global self, caches */
// Installed web app only. Separate from /rawaj-push/; no push handlers or API caching.
const PREFIX = "rawaj-offline-";
const CACHE = PREFIX + "v1";
const PAGE = "/rawaj-offline.html";
const ASSETS = [PAGE, "/rawaj-offline.css", "/rawaj-offline.js", "/brand/rawaj-mark-transparent-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && !url.pathname.startsWith("/rawaj-push/")) {
    // Preserve real HTTP responses; fallback only for failed network navigation.
    // Never store account pages, listings, auth responses or API payloads.
    event.respondWith(
      fetch(request).catch(async (error) => {
        const fallback = await (await caches.open(CACHE)).match(PAGE);
        if (fallback) return fallback;
        throw error;
      }),
    );
  } else if (!url.search && ASSETS.includes(url.pathname)) {
    event.respondWith(
      fetch(request).catch(async (error) => {
        const fallback = await (await caches.open(CACHE)).match(url.pathname);
        if (fallback) return fallback;
        throw error;
      }),
    );
  }
});
