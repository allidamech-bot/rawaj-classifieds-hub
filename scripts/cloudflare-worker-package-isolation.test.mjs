import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(
  await readFile(new URL("../cloudflare/worker/package.json", import.meta.url), "utf8"),
);
const lock = JSON.parse(
  await readFile(new URL("../cloudflare/worker/package-lock.json", import.meta.url), "utf8"),
);
const packages = lock.packages ?? {};

const forbiddenPackageEntries = [
  "../..",
  "node_modules/tanstack_start_ts",
  "node_modules/firebase",
  "node_modules/firebase-admin",
  "node_modules/react",
  "node_modules/react-dom",
  "node_modules/@capacitor/core",
  "node_modules/@tanstack/react-start",
];

test("the Cloudflare Worker package does not depend on the frontend application", () => {
  assert.equal(manifest.dependencies, undefined);
  assert.equal(packages[""]?.dependencies, undefined);
  assert.equal(packages[""]?.name, "@rawaj/cloudflare-worker");

  for (const path of forbiddenPackageEntries) {
    assert.equal(packages[path], undefined, `Worker lock contains forbidden package entry: ${path}`);
  }
});

test("the Worker lockfile is generated from the Worker manifest only", () => {
  assert.deepEqual(Object.keys(packages[""]?.devDependencies ?? {}).sort(), ["typescript", "wrangler"]);
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.lockfileVersion, 3);

  const serialized = JSON.stringify(lock);
  assert.doesNotMatch(serialized, /tanstack_start_ts/);
  assert.doesNotMatch(serialized, /file:\.\.\/\.\./);
});
