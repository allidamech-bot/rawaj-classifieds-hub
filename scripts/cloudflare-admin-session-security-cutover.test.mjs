#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [adminSecurity, security, wrangler, renderConfig, migration] = await Promise.all([
  read("cloudflare/worker/src/admin-security.ts"),
  read("cloudflare/worker/src/security.ts"),
  read("cloudflare/worker/wrangler.base.jsonc"),
  read("cloudflare/worker/scripts/render-config.mjs"),
  read("cloudflare/d1/migrations/0003_full_backend_core.sql"),
]);

const config = JSON.parse(wrangler);

test("admin session security is non-breaking by default", () => {
  assert.equal(config.vars.ADMIN_SECURITY_ENFORCEMENT, "off");
  assert.equal(config.vars.ADMIN_MAX_AUTH_AGE_SECONDS, "1800");
  assert.doesNotMatch(wrangler, /ADMIN.*SECRET|MFA.*SECRET/i);
});

test("admin perimeter executes after rate limiting and before route dispatch", () => {
  const limiterIndex = security.indexOf("await decision.binding.limit({ key })");
  const perimeterIndex = security.indexOf(
    "await enforceAdminSecurityPerimeter(request, env, requestId, path)",
  );
  assert.ok(limiterIndex >= 0);
  assert.ok(perimeterIndex > limiterIndex);
  assert.match(adminSecurity, /\/\^\\\/v1\\\/admin/);
});

test("admin perimeter denies anonymous and non-staff identities before handlers", () => {
  assert.match(adminSecurity, /admin_auth_required/);
  assert.match(adminSecurity, /admin_role_denied/);
  assert.match(adminSecurity, /STAFF_ROLES = new Set\(\["moderator", "admin", "owner"\]\)/);
  assert.match(adminSecurity, /Authentication required/);
  assert.match(adminSecurity, /Administrative access required/);
});

test("enforced admin posture requires MFA and recent authentication", () => {
  assert.match(adminSecurity, /sign_in_second_factor/);
  assert.match(adminSecurity, /payload\.auth_time/);
  assert.match(adminSecurity, /admin_mfa_required/);
  assert.match(adminSecurity, /admin_recent_auth_required/);
  assert.match(adminSecurity, /X-Rawaj-Reauthentication-Required/);
  assert.match(adminSecurity, /DEFAULT_MAX_AUTH_AGE_SECONDS = 30 \* 60/);
});

test("admin denials are auditable without storing raw network identifiers", () => {
  assert.match(migration, /ip_hash TEXT/);
  assert.match(migration, /user_agent_hash TEXT/);
  assert.match(adminSecurity, /entity_type, entity_id, metadata, ip_hash, user_agent_hash/);
  assert.match(adminSecurity, /await sha256Hex\(ip\)/);
  assert.match(adminSecurity, /await sha256Hex\(userAgent\)/);

  const metadataStart = adminSecurity.indexOf("const metadata = JSON.stringify({");
  const metadataEnd = adminSecurity.indexOf("const result = await env.DB.prepare(", metadataStart);
  assert.ok(metadataStart >= 0 && metadataEnd > metadataStart);
  const metadataBlock = adminSecurity.slice(metadataStart, metadataEnd);
  assert.doesNotMatch(metadataBlock, /userAgent|User-Agent|CF-Connecting-IP|\bip\b/);
});

test("production render only accepts bounded explicit admin posture configuration", () => {
  assert.match(renderConfig, /RAWAJ_ADMIN_SECURITY_ENFORCEMENT/);
  assert.match(renderConfig, /new Set\(\["off", "enforce"\]\)\.has\(adminSecurityEnforcement\)/);
  assert.match(renderConfig, /RAWAJ_ADMIN_MAX_AUTH_AGE_SECONDS/);
  assert.match(renderConfig, /MIN_ADMIN_MAX_AUTH_AGE_SECONDS = 300/);
  assert.match(renderConfig, /MAX_ADMIN_MAX_AUTH_AGE_SECONDS = 43200/);
});

test("admin security configuration remains Syria-scoped and contains no Saudi runtime", () => {
  assert.equal(config.name, "rawaj-classifieds-hub");
  assert.equal(config.vars.API_ALLOWED_ORIGINS, "https://rawa-j.com,https://www.rawa-j.com");
  assert.doesNotMatch(adminSecurity, /saudi|sa\.rawa-j\.com/i);
  assert.doesNotMatch(renderConfig, /saudi|sa\.rawa-j\.com/i);
});
