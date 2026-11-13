import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [privacy, legacy, publicListings, publicCore, auth, rateLimit, admin, adminManagement, schema, integration] =
  await Promise.all([
    "cloudflare/worker/src/public-listing-privacy.ts",
    "cloudflare/worker/src/marketplace-private.ts",
    "cloudflare/worker/src/public-listings.ts",
    "cloudflare/worker/src/index.ts",
    "cloudflare/worker/src/auth.ts",
    "cloudflare/worker/src/security.ts",
    "cloudflare/worker/src/admin.ts",
    "cloudflare/worker/src/admin-user-management.ts",
    "cloudflare/d1/migrations/0002_public_marketplace_foundation.sql",
    "cloudflare/worker/test/marketplace.integration.test.mjs",
  ].map(read));

test("legacy and canonical public responses use the same contact-data sanitizer", () => {
  assert.match(privacy, /PRIVATE_DETAIL_KEYS/);
  assert.match(privacy, /contactwhatsapp/);
  assert.match(privacy, /contactphone/);
  assert.match(privacy, /sanitizeValue\(item, depth \+ 1\)/);
  assert.match(legacy, /sanitizePublicListingDetails\(jsonObject\(row\.details\)\)/);
  assert.match(legacy, /listing: ownerView/);
  assert.match(legacy, /publiclyAvailable/);
  assert.match(legacy, /l\.expires_at IS NULL OR l\.expires_at/);
  assert.match(publicListings, /sanitizePublicListingDetails\(details\)/);
  assert.match(publicCore, /sanitizePublicListingDetails\(details\)/);
});

test("frozen accounts and active restrictions are enforced on the server", () => {
  assert.match(auth, /p\.account_status/);
  assert.match(auth, /auth\.accountStatus !== "active"/);
  assert.match(auth, /account_restricted/);
  assert.match(auth, /FROM user_restrictions WHERE user_id/);
  assert.match(auth, /restrictedActionTypes/);
  assert.match(auth, /support-requests/);
});

test("user administration implements three routes with audited role protection", () => {
  for (const route of ["status", "restrictions", "roles"]) {
    assert.ok(adminManagement.includes(`/v1/admin/users/${route}`));
    assert.ok(admin.includes(`/v1/admin/users/${route}`));
  }
  assert.match(adminManagement, /auth\.roles\.includes\("owner"\)/);
  assert.match(adminManagement, /target\.is_owner/);
  assert.match(adminManagement, /WHERE changes\(\) > 0/);
  assert.match(adminManagement, /user\.status_changed/);
  assert.match(adminManagement, /user\.role_assigned/);
  assert.match(adminManagement, /user\.restriction_set/);
  assert.match(admin, /active_restrictions/);
  assert.match(integration, /phase 1: owner-only roles and account freezing/);
});

test("invalid bearer tokens cannot mint fresh rate-limit buckets", () => {
  assert.match(rateLimit, /verifyFirebaseIdToken\(bearer, env\)/);
  assert.match(rateLimit, /identity\.subject/);
  assert.match(rateLimit, /CF-Connecting-IP/);
  assert.doesNotMatch(rateLimit, /auth:\$\{\(await sha256Hex\(bearer\)\)/);
});

test("upload compensation cannot delete another concurrent attempt's object", () => {
  assert.match(schema, /object_key TEXT NOT NULL UNIQUE/);
  assert.match(legacy, /const assetId = crypto\.randomUUID\(\)/);
  assert.match(legacy, /const objectKey = `listings\/\$\{auth\.userId\}\/\$\{listingId\}\/\$\{assetId\}\.\$\{extension\}`/);
  assert.match(legacy, /await env\.MEDIA\.delete\(objectKey\)/);
  assert.match(integration, /phase 1: concurrent duplicate image uploads/);
});
