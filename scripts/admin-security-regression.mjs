#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const files = await Promise.all([
  read("cloudflare/worker/src/auth.ts"),
  read("cloudflare/worker/src/admin.ts"),
  read("cloudflare/worker/src/admin-campaigns.ts"),
  read("cloudflare/worker/src/admin-safety.ts"),
  read("cloudflare/worker/src/admin-taxonomy-review.ts"),
  read("cloudflare/worker/src/admin-data-quality.ts"),
  read("cloudflare/worker/src/trust-support.ts"),
  read("cloudflare/worker/src/verification.ts"),
  read("cloudflare/d1/migrations/0014_admin_governance_workspace.sql"),
]);

const [auth, admin, campaigns, safety, taxonomyReview, dataQuality, trustSupport, verification, governanceMigration] = files;

const mutationModules = [admin, campaigns, safety, taxonomyReview, dataQuality, trustSupport, verification];
const auditedModules = [admin, campaigns, safety, taxonomyReview, dataQuality, trustSupport];

const hasAnyRoleGuard = (source) =>
  /roles\.includes\("(?:owner|admin|moderator)"\)|requireAdminRole\(|isAdminLike\(|canModerate\(|canManage\(/.test(source);

test("authenticated identity and roles are derived by the Worker", () => {
  assert.match(auth, /export async function authenticate/);
  assert.match(auth, /SELECT role FROM user_roles WHERE user_id = \?/);
  assert.match(auth, /export async function requireMutationAuth/);
  assert.doesNotMatch(auth, /service_role|SUPABASE|supabase/i);
});

test("all administrative mutation modules require authenticated mutation access", () => {
  for (const source of mutationModules) {
    assert.match(source, /requireMutationAuth\(/);
    assert.ok(hasAnyRoleGuard(source));
    assert.match(source, /permission_denied|forbidden\(/);
  }
});

test("owner-only operations are enforced for the most sensitive workspaces", () => {
  assert.match(campaigns, /roles\.includes\("owner"\)|hasOwnerRole/);
  assert.match(taxonomyReview, /roles\.includes\("owner"\)/);
  assert.match(dataQuality, /roles\.includes\("owner"\)/);
  assert.match(admin, /requireAdminRole\(auth, "owner"\)/);
});

test("administrative mutations produce audit records", () => {
  for (const source of auditedModules) {
    assert.match(source, /INSERT INTO audit_logs/);
  }
  assert.match(governanceMigration, /CREATE TABLE(?: IF NOT EXISTS)? safety_cases/);
  assert.match(governanceMigration, /CREATE TABLE(?: IF NOT EXISTS)? taxonomy_mapping_queue/);
  assert.match(governanceMigration, /CREATE TABLE(?: IF NOT EXISTS)? listing_data_quality_issues/);
});

test("verification documents remain private and admin-scoped", () => {
  assert.match(verification, /\/v1\/admin\/verifications/);
  assert.match(verification, /canManage\(auth\.roles\)/);
  assert.match(verification, /document_asset_id/);
  assert.doesNotMatch(verification, /getPublicUrl|createSignedUrl|supabase/i);
});
