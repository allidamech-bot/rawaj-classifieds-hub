#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [observability, security, turnstile, adminSecurity, summary, wrangler] = await Promise.all([
  read("cloudflare/worker/src/security-observability.ts"),
  read("cloudflare/worker/src/security.ts"),
  read("cloudflare/worker/src/turnstile.ts"),
  read("cloudflare/worker/src/admin-security.ts"),
  read("cloudflare/worker/src/security-summary.ts"),
  read("cloudflare/worker/wrangler.base.jsonc"),
]);

const config = JSON.parse(wrangler);

test("Worker observability remains enabled for Syria security telemetry", () => {
  assert.equal(config.observability?.enabled, true);
  assert.equal(config.name, "rawaj-classifieds-hub");
});

test("security telemetry uses an allowlisted structured envelope", () => {
  assert.match(observability, /category: "security"/);
  assert.match(observability, /severity/);
  assert.match(observability, /requestId/);
  assert.match(observability, /pathname/);
  assert.match(observability, /value\.split\("\?", 1\)/);
  assert.doesNotMatch(observability, /Authorization|CF-Connecting-IP|User-Agent|turnstileToken/);
});

test("rate limiting uploads Turnstile and admin denials emit structured events", () => {
  assert.match(security, /logSecurityEvent\(/);
  assert.match(security, /worker_rate_limited/);
  assert.match(security, /upload_request_rejected/);
  assert.match(turnstile, /turnstile_validation_failed/);
  assert.match(turnstile, /turnstile_siteverify_unavailable/);
  assert.match(adminSecurity, /admin_security_audit_write_failed/);
  assert.match(adminSecurity, /logSecurityEvent\(/);
});

test("admin security summary is rate-limited perimeter-protected and admin-only", () => {
  const perimeterIndex = security.indexOf("await enforceAdminSecurityPerimeter(request, env, requestId, path)");
  const summaryIndex = security.indexOf('path === "/v1/admin/security-summary"');
  assert.ok(perimeterIndex >= 0 && summaryIndex > perimeterIndex);
  assert.match(summary, /role === "admin" \|\| role === "owner"/);
  assert.match(summary, /entity_type = 'admin_security'/);
  assert.match(summary, /julianday\(created_at\)/);
  assert.match(summary, /LIMIT 20/);
});

test("security summary never exposes raw or hashed network identifiers", () => {
  assert.doesNotMatch(summary, /CF-Connecting-IP|User-Agent|Authorization|turnstileToken/);
  assert.doesNotMatch(summary, /ipHash|userAgentHash|ip_hash:\s|user_agent_hash:\s/);
  assert.match(summary, /uniqueNetworkFingerprints24h/);
  assert.match(summary, /safeMetadata/);
});
