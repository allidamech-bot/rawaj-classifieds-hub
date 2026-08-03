import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const config = JSON.parse(fs.readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
const rewrites = Array.isArray(config.rewrites) ? config.rewrites : [];

const expected = new Map([
  [
    "/v1/:path*",
    "https://rawaj-classifieds-hub.allidamech.workers.dev/v1/:path*",
  ],
  [
    "/api/:path*",
    "https://rawaj-classifieds-hub.allidamech.workers.dev/api/:path*",
  ],
]);

test("all automatic Vercel Git deployments stay disabled", () => {
  assert.equal(config.git?.deploymentEnabled, false);
});

test("Syrian Vercel domain proxies Cloudflare API namespaces", () => {
  for (const [source, destination] of expected) {
    const matches = rewrites.filter((rewrite) => rewrite?.source === source);
    assert.equal(matches.length, 1, `${source} must have exactly one rewrite`);
    assert.equal(matches[0].destination, destination);
  }
});

test("API rewrites are explicit and do not capture HTML routes", () => {
  assert.equal(rewrites.length, expected.size);
  assert.ok(rewrites.every((rewrite) => expected.has(rewrite.source)));
});
