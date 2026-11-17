import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/rawaj-offline-sw.js", import.meta.url), "utf8");
const origin = "https://rawa-j.com";
const offline = { kind: "static-offline-page" };

function worker(fetch) {
  const handlers = {};
  const cached = [];
  const removed = [];
  let claimed = false;
  vm.runInNewContext(source, {
    URL,
    self: {
      location: { origin },
      clients: { claim: async () => { claimed = true; } },
      addEventListener: (name, handler) => { handlers[name] = handler; },
    },
    caches: {
      open: async () => ({
        match: async (path) => path === "/rawaj-offline.html" ? offline : undefined,
        addAll: async (paths) => { cached.push(...paths); },
      }),
      keys: async () => ["rawaj-offline-v0", "rawaj-offline-v1", "firebase-push"],
      delete: async (key) => { removed.push(key); },
    },
    fetch,
  });
  return {
    cached,
    removed,
    get claimed() { return claimed; },
    run(name, request) {
      let result;
      handlers[name]({
        request,
        respondWith: (value) => { result = value; },
        waitUntil: (value) => { result = value; },
      });
      return result;
    },
  };
}

test("offline worker caches only public static fallback assets", async () => {
  const instance = worker(async () => {});
  await instance.run("install");
  await instance.run("activate");
  assert.deepEqual(instance.cached, [
    "/rawaj-offline.html", "/rawaj-offline.css", "/rawaj-offline.js", "/brand/rawaj-mark-transparent-192.png",
  ]);
  assert.deepEqual(instance.removed, ["rawaj-offline-v0"]);
  assert.equal(instance.claimed, true);
});

test("network failure displays fallback, HTTP errors are not fabricated", async () => {
  const request = { url: origin + "/listings", method: "GET", mode: "navigate" };
  assert.equal(await worker(async () => { throw new Error("network"); }).run("fetch", request), offline);
  for (const status of [401, 403, 503]) {
    const response = { status };
    assert.equal(await worker(async () => response).run("fetch", request), response);
  }
});

test("API, mutations, remote requests and scoped push requests are untouched", () => {
  const instance = worker(async () => { throw new Error("must not fetch"); });
  for (const request of [
    { url: origin + "/api/listings", method: "GET", mode: "cors" },
    { url: origin + "/api/listings", method: "GET", mode: "navigate" },
    { url: origin + "/v1/listings", method: "GET", mode: "navigate" },
    { url: origin + "/auth/callback", method: "GET", mode: "navigate" },
    { url: origin + "/rawaj-push", method: "GET", mode: "navigate" },
    { url: origin + "/listings", method: "POST", mode: "navigate" },
    { url: "https://other.example/", method: "GET", mode: "navigate" },
    { url: origin + "/rawaj-push/test", method: "GET", mode: "navigate" },
  ]) assert.equal(instance.run("fetch", request), undefined);
});

test("registration is standalone-only and keeps dedicated push registration", async () => {
  const registration = await readFile(new URL("../src/lib/pwa-offline.ts", import.meta.url), "utf8");
  const push = await readFile(new URL("../src/lib/web-push.ts", import.meta.url), "utf8");
  assert.match(registration, /Capacitor\.isNativePlatform\(\)/);
  assert.match(registration, /display-mode: standalone/);
  assert.match(registration, /worker\.scriptURL !== scriptUrl/);
  assert.match(push, /const SCOPE = "\/rawaj-push\/"/);
  assert.doesNotMatch(source, /addEventListener\("push"/);
});
