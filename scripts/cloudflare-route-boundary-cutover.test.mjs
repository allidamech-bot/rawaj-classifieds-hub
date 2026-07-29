import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("entry routes every specialized Cloudflare boundary before generic admin/public handlers", async () => {
  const source = await read("cloudflare/worker/src/entry.ts");

  assert.match(source, /path === "\/v1\/admin\/system-controls"/);
  assert.match(source, /\/v1\\\/listings\\\/\[\^\/\]\+\\\/attributes/);
  assert.match(source, /\/v1\\\/vehicles/);
  assert.match(source, /\/v1\\\/listings\\\/\[\^\/\]\+\\\/taxonomy/);
  assert.match(source, /\/v1\\\/admin\\\/ad-placements/);
  assert.match(source, /path === "\/v1\/ad-placements"/);

  assert.ok(
    source.indexOf('path === "/v1/admin/system-controls"') < source.indexOf('/^\\/v1\\/admin\\b/'),
    "system controls must be routed before the generic admin handler",
  );
  assert.ok(
    source.indexOf('/^\\/v1\\/admin\\/ad-placements') < source.indexOf('/^\\/v1\\/admin\\b/'),
    "admin ad placements must be routed before the generic admin handler",
  );
  assert.doesNotMatch(source, /baseWorker\.fetch|env as never/);
});

test("public ad placements remain on the explicit public core route", async () => {
  const [entry, publicCore] = await Promise.all([
    read("cloudflare/worker/src/entry.ts"),
    read("cloudflare/worker/src/index.ts"),
  ]);
  assert.match(entry, /path === "\/v1\/ad-placements"/);
  assert.match(publicCore, /url\.pathname === `\/\$\{API_VERSION\}\/ad-placements`/);
  assert.match(publicCore, /pathname === `\/\$\{API_VERSION\}\/ad-placements`/);
});

test("system controls are persisted with fixed keys and optimistic versions", async () => {
  const migration = await read("cloudflare/d1/migrations/0016_system_controls.sql");
  const handler = await read("cloudflare/worker/src/system-controls.ts");

  assert.match(migration, /CREATE TABLE system_controls/);
  for (const key of [
    "freeze_new_listings",
    "freeze_new_messages",
    "freeze_promotions",
    "freeze_verifications",
    "maintenance_mode",
    "emergency_read_only",
  ]) {
    assert.match(migration, new RegExp(`'${key}'`));
  }
  assert.match(handler, /WHERE key = \? AND version = \?/);
  assert.match(handler, /system_control\.changed/);
  assert.match(handler, /stale_write/);
  assert.match(handler, /auth\.roles\.includes\("owner"\)/);
});

test("mutation authorization fails closed and enforces global and scoped controls", async () => {
  const auth = await read("cloudflare/worker/src/auth.ts");

  assert.match(auth, /FROM system_controls[\s\S]*WHERE enabled = 1/);
  assert.match(auth, /rawaj_system_control_lookup_failed/);
  assert.match(auth, /system_control_active/);
  assert.match(auth, /Retry-After/);
  assert.match(auth, /"emergency_read_only", "maintenance_mode"/);
  assert.match(auth, /path === "\/v1\/admin\/system-controls"/);
  assert.match(auth, /path === "\/v1\/listings"/);
  assert.match(auth, /path === "\/v1\/conversations"/);
  assert.match(auth, /\(\?:messages\|attachments\)/);
  assert.match(auth, /path === "\/v1\/account\/promotions"/);
  assert.match(auth, /path === "\/v1\/account\/verifications"/);
});

test("system-control mutation remains reachable while global controls are enabled", async () => {
  const auth = await read("cloudflare/worker/src/auth.ts");
  const exemption = auth.indexOf('if (path === "/v1/admin/system-controls") return auth;');
  const lookup = auth.indexOf("blockedMutationControl(request, env)");
  assert.ok(exemption >= 0 && lookup >= 0 && exemption < lookup);
});
