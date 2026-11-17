import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../public/rawaj-push-sw.js", import.meta.url), "utf8");

test("PWA notification is generic and clicks cannot navigate outside the site", async () => {
  const handlers = new Map();
  const shown = [];
  const opened = [];
  const self = {
    addEventListener: (name, handler) => handlers.set(name, handler),
    location: { origin: "https://rawa-j.com" },
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: { openWindow: async (url) => opened.push(url) },
  };
  runInNewContext(source, { self, URL, encodeURIComponent });
  assert.equal(handlers.has("fetch"), false);
  let pending;
  const waitUntil = (promise) => { pending = promise; };
  const id = "12345678-1234-4123-8123-123456789abc";
  handlers.get("push")({
    data: { json: () => ({ data: { conversation_id: id, event_id: id, body: "private" } }) },
    waitUntil,
  });
  await pending;
  assert.equal(shown[0][1].body, "لديك تحديث جديد.");
  handlers.get("notificationclick")({ notification: { close() {}, data: shown[0][1].data }, waitUntil });
  await pending;
  assert.equal(opened[0], "https://rawa-j.com/chats?conversation=" + id);
  handlers.get("notificationclick")({
    notification: { close() {}, data: { conversation_id: "https://evil.invalid", url: "https://evil.invalid" } },
    waitUntil,
  });
  await pending;
  assert.equal(opened[1], "https://rawa-j.com/notifications");
});
