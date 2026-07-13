import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [harness, workflow, packageSource, qualityGate] = await Promise.all([
  readFile(new URL("./supabase-authorization-matrix.mjs", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/supabase-authorization-matrix.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("matrix covers every supported actor and sensitive data family", () => {
  for (const actor of ["anon", "owner", "other", "staff", "blocked"]) {
    assert.match(harness, new RegExp(`\\b${actor}\\b`));
  }
  for (const surface of [
    "listings",
    "listing-images",
    "profiles",
    "notifications",
    "notification_preferences",
    "support_requests",
    "conversations",
    "conversation_messages",
    "saved_searches",
    "listing_reports",
    "message_reports",
    "user_blocks",
    "seller_reviews",
    "rawaj_review_queue_pending",
    "rawaj_admin_fetch_users",
    "rawaj_fetch_message_reports_for_admin",
    "rawaj_owner_update_listing_v2",
    "rawaj_submit_listing_for_review",
    "rawaj_review_listing_decision",
  ]) {
    assert.ok(harness.includes(surface), `Missing authorization surface ${surface}`);
  }
});

test("mutations are staging-only and use disposable self-cleaning fixtures", () => {
  assert.match(harness, /mode === "staging-mutation" && fixtures\.environment !== "staging"/);
  assert.match(harness, /_rawaj_test: \{ marker, disposable: true \}/);
  assert.match(harness, /finally \{/);
  assert.match(harness, /storage\.from\("listing-images"\)\.remove/);
  assert.match(harness, /from\("listings"\)\.delete/);
  assert.doesNotMatch(harness, /SERVICE_ROLE/);
});

test("manual workflow uses protected dedicated accounts and Quality Gate preserves the contract", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /environment: authorization-matrix-staging/);
  assert.match(workflow, /secrets\.RAWAJ_AUTH_MATRIX_ACCOUNTS/);
  assert.match(workflow, /secrets\.RAWAJ_AUTH_MATRIX_FIXTURES/);
  assert.doesNotMatch(workflow, /service.?role/i);
  assert.match(packageSource, /test:supabase-authorization-matrix/);
  assert.match(packageSource, /test:supabase-authorization-contract/);
  assert.match(qualityGate, /Supabase authorization matrix contract/);
});
