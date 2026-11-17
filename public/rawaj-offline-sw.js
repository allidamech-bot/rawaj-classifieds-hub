/* global self, caches, fetch, Response, URL */
const PREFIX = "rawaj-offline-shell-";
const CACHE = PREFIX + "v1";
const PAGE = "/rawaj-offline.html";
const ASSETS = [
  PAGE,
  "/rawaj-offline.css",
  "/rawaj-offline.js",
  "/brand/rawaj-mark-transparent-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) =>
    cache.addAll(ASSETS.map((path) => new Request(path, { cache: "reload" })))
  ));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== CACHE)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Authentication, API, push and mutation requests retain their real network behavior.
  if (/^\/(auth|api|v1|rawaj-push|__api)(\/|$)/.test(url.pathname)) return;

  if (!url.search && ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(url.pathname)) || fetch(request);
    })());
    return;
  }

  if (request.mode !== "navigate") return;
  // Do not cache route responses, private data, credentials or HTTP failures.
  // Only a rejected network fetch receives the local document.
  event.respondWith(fetch(request).catch(async () => {
    const cache = await caches.open(CACHE);
    return (await cache.match(PAGE)) || Response.error();
  }));
});
