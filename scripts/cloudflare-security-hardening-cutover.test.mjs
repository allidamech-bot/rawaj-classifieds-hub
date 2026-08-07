#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [entry, security, cors, wrangler] = await Promise.all([
  read("cloudflare/worker/src/entry.ts"),
  read("cloudflare/worker/src/security.ts"),
  read("cloudflare/worker/src/cors.ts"),
  read("cloudflare/worker/wrangler.base.jsonc"),
]);

const config = JSON.parse(wrangler);

test("Syria Worker rate limiting is configured with isolated namespaces", () => {
  const limits = config.ratelimits ?? [];
  const names = limits.map((item) => item.name);
  assert.deepEqual(names, [
    "RATE_LIMIT_PUBLIC",
    "RATE_LIMIT_WRITE",
    "RATE_LIMIT_ABUSE",
    "RATE_LIMIT_UPLOAD",
    "RATE_LIMIT_ADMIN",
  ]);
  assert.equal(new Set(limits.map((item) => item.namespace_id)).size, limits.length);
  for (const limit of limits) {
    assert.match(limit.namespace_id, /^\d+$/);
    assert.equal(limit.simple.period, 60);
    assert.ok(limit.simple.limit > 0);
  }
});

test("rate limiting executes before route dispatch and emits safe 429 responses", () => {
  assert.match(entry, /await enforceRequestSecurity\(request, env, requestId\)/);
  assert.ok(
    entry.indexOf("await enforceRequestSecurity(request, env, requestId)") <
      entry.indexOf("await routeRequest(securedRequest, env)"),
  );
  assert.match(security, /code: "rate_limited"/);
  assert.match(security, /status,\s*headers/);
  assert.match(security, /response\.headers\.set\("Retry-After", "60"\)/);
  assert.match(security, /event: "worker_rate_limited"/);
});

test("high-abuse routes receive stricter limiter classes", () => {
  assert.match(security, /RATE_LIMIT_ADMIN/);
  assert.match(security, /RATE_LIMIT_UPLOAD/);
  assert.match(security, /RATE_LIMIT_ABUSE/);
  assert.match(security, /conversations/);
  assert.match(security, /support-requests/);
  assert.match(security, /reports/);
  assert.match(security, /profile\/media/);
  assert.match(security, /listings\\\/\[\^\/\]\+\\\/images/);
});

test("marketplace image uploads have an early request-size guard", () => {
  assert.match(security, /MAX_MARKETPLACE_IMAGE_REQUEST_BYTES = 9 \* 1024 \* 1024/);
  assert.match(security, /Content-Length/);
  assert.match(security, /code: "payload_too_large"/);
  assert.match(security, /413/);
});

test("CORS remains allowlist-only and ignores wildcard or malformed configured origins", () => {
  assert.match(cors, /https:\/\/rawa-j\.com/);
  assert.match(cors, /https:\/\/www\.rawa-j\.com/);
  assert.match(cors, /candidate === "\*"/);
  assert.match(cors, /candidate === "null"/);
  assert.doesNotMatch(cors, /Access-Control-Allow-Origin["']?\s*[:,]\s*["']\*["']/);
  assert.match(cors, /parsed\.pathname !== "\/"/);
});

test("API responses include baseline hardening headers", () => {
  for (const header of [
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Content-Security-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
  ]) {
    assert.match(entry, new RegExp(header));
  }
  assert.match(entry, /frame-ancestors 'none'/);
});

test("security configuration remains Syria-only", () => {
  assert.equal(config.name, "rawaj-classifieds-hub");
  assert.equal(config.vars.API_ALLOWED_ORIGINS, "https://rawa-j.com,https://www.rawa-j.com");
  assert.doesNotMatch(wrangler, /saudi|sa\.rawa-j\.com/i);
  assert.doesNotMatch(security, /saudi|sa\.rawa-j\.com/i);
});
