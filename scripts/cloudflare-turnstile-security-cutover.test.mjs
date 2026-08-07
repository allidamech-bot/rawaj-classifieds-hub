#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  workerTurnstile,
  workerSecurity,
  workerBaseConfig,
  workerRenderConfig,
  clientTurnstile,
  supportApi,
  listingReportsApi,
  reviewReportsApi,
  server,
] = await Promise.all([
  read("cloudflare/worker/src/turnstile.ts"),
  read("cloudflare/worker/src/security.ts"),
  read("cloudflare/worker/wrangler.base.jsonc"),
  read("cloudflare/worker/scripts/render-config.mjs"),
  read("src/lib/turnstile-client.ts"),
  read("src/lib/api/support.ts"),
  read("src/lib/api/reports.ts"),
  read("src/lib/api/review-reports.ts"),
  read("src/server.ts"),
]);

const workerConfig = JSON.parse(workerBaseConfig);

test("Turnstile is disabled by default and hostnames remain Syria-only", () => {
  assert.equal(workerConfig.vars.TURNSTILE_ENFORCEMENT, "off");
  assert.equal(
    workerConfig.vars.TURNSTILE_ALLOWED_HOSTNAMES,
    "rawa-j.com,www.rawa-j.com",
  );
  assert.doesNotMatch(workerBaseConfig, /TURNSTILE_SECRET_KEY/);
  assert.doesNotMatch(workerBaseConfig, /saudi|sa\.rawa-j\.com/i);
});

test("production render only accepts explicit off or enforce and preserves Syria hostnames", () => {
  assert.match(workerRenderConfig, /RAWAJ_TURNSTILE_ENFORCEMENT/);
  assert.match(workerRenderConfig, /new Set\(\["off", "enforce"\]\)/);
  assert.match(workerRenderConfig, /EXPECTED_TURNSTILE_HOSTNAMES = "rawa-j\.com,www\.rawa-j\.com"/);
  assert.match(workerRenderConfig, /Turnstile hostnames are not Syria-scoped/);
  assert.doesNotMatch(workerRenderConfig, /TURNSTILE_SECRET_KEY/);
});

test("Worker verifies Turnstile server-side with action and hostname binding", () => {
  assert.match(workerTurnstile, /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
  assert.match(workerTurnstile, /TURNSTILE_SECRET_KEY/);
  assert.match(workerTurnstile, /remoteip/);
  assert.match(workerTurnstile, /idempotency_key/);
  assert.match(workerTurnstile, /result\?\.action === expectedAction/);
  assert.match(workerTurnstile, /allowedHostnames\.has\(result\.hostname\)/);
  assert.match(workerTurnstile, /MAX_TOKEN_LENGTH = 2048/);
  assert.match(workerTurnstile, /VERIFY_TIMEOUT_MS = 8_000/);
  assert.match(workerTurnstile, /request\.clone\(\)\.json/);
});

test("rate limiting happens before Turnstile verification", () => {
  const limiterIndex = workerSecurity.indexOf("await decision.binding.limit({ key })");
  const turnstileIndex = workerSecurity.indexOf("requireTurnstile(request, env, requestId, turnstileAction)");
  assert.ok(limiterIndex >= 0, "rate limiter call must exist");
  assert.ok(turnstileIndex > limiterIndex, "Turnstile must run after rate limiting");
});

test("only low-frequency abuse mutations are Turnstile protected", () => {
  assert.match(workerSecurity, /support_request/);
  assert.match(workerSecurity, /listing_report/);
  assert.match(workerSecurity, /review_report/);
  assert.doesNotMatch(workerSecurity, /return "chat_message"/);
  assert.doesNotMatch(workerSecurity, /return "conversation"/);
});

test("all protected client mutations request matching action tokens", () => {
  assert.match(supportApi, /getTurnstileToken\("support_request"\)/);
  assert.match(supportApi, /turnstileToken/);
  assert.match(listingReportsApi, /challengeToken\("listing_report"\)/);
  assert.match(listingReportsApi, /turnstileToken/);
  assert.match(reviewReportsApi, /challengeToken\("review_report"\)/);
  assert.match(reviewReportsApi, /turnstileToken/);
});

test("client exposes only the public Site Key and never embeds the Turnstile secret", () => {
  assert.match(clientTurnstile, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(clientTurnstile, /appearance: "interaction-only"/);
  assert.match(clientTurnstile, /execution: "execute"/);
  assert.doesNotMatch(clientTurnstile, /TURNSTILE_SECRET_KEY/);
  assert.doesNotMatch(clientTurnstile, /siteverify/);
});

test("application CSP narrowly permits the Cloudflare Turnstile origin", () => {
  const challengeOriginMatches = server.match(/https:\/\/challenges\.cloudflare\.com/g) ?? [];
  assert.ok(challengeOriginMatches.length >= 4);
  assert.match(server, /script-src[^\n]+https:\/\/challenges\.cloudflare\.com/);
  assert.match(server, /frame-src[^\n]+https:\/\/challenges\.cloudflare\.com/);
  assert.doesNotMatch(server, /script-src[^\n]+https:\/\/\*/);
  assert.doesNotMatch(server, /frame-src[^\n]+https:\/\/\*/);
});
