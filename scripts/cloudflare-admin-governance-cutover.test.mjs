import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  campaignsWorker,
  safetyWorker,
  taxonomyWorker,
  qualityWorker,
  entry,
  migration,
  campaigns,
  safetyCases,
  safetyDetails,
  taxonomyQueues,
  quality,
  qualityContext,
] = await Promise.all([
  read("cloudflare/worker/src/admin-campaigns.ts"),
  read("cloudflare/worker/src/admin-safety.ts"),
  read("cloudflare/worker/src/admin-taxonomy-review.ts"),
  read("cloudflare/worker/src/admin-data-quality.ts"),
  read("cloudflare/worker/src/entry.ts"),
  read("cloudflare/d1/migrations/0014_admin_governance_workspace.sql"),
  read("src/lib/api/campaigns.ts"),
  read("src/lib/api/safety-cases.ts"),
  read("src/lib/api/safety-case-details.ts"),
  read("src/lib/api/taxonomy-review-queues.ts"),
  read("src/lib/api/listing-data-quality.ts"),
  read("src/lib/api/listing-data-quality-context.ts"),
]);

const clients = [campaigns, safetyCases, safetyDetails, taxonomyQueues, quality, qualityContext];

test("remaining admin governance clients are Cloudflare-only", () => {
  for (const source of clients) {
    assert.doesNotMatch(source, /@supabase\/supabase-js|\bgetClient\b|\.rpc\(|\.from\(["']|\.storage\b/);
    assert.match(source, /cloudflareApiRequest/);
  }
});

test("D1 governance migration owns all final admin domains", () => {
  for (const table of [
    "ad_campaigns",
    "ad_campaign_creatives",
    "ad_campaign_events",
    "safety_cases",
    "safety_case_notes",
    "safety_case_links",
    "taxonomy_versions",
    "taxonomy_mapping_queue",
    "vehicle_reference_review_queue",
    "listing_data_quality_issues",
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE ${table}\\b`));
  }
  assert.match(migration, /CHECK \(status IN \('draft', 'active', 'paused', 'ended'\)\)/);
  assert.match(migration, /UNIQUE \(case_id, link_type, link_id\)/);
  assert.match(migration, /issue_key TEXT NOT NULL UNIQUE/);
});

test("campaign mutations are owner-only, version constrained, and audited", () => {
  assert.match(campaignsWorker, /hasOwnerRole\(auth\.roles\)/g);
  assert.match(campaignsWorker, /WHERE id = \? AND version = \?/g);
  assert.match(campaignsWorker, /status_mismatch/);
  assert.match(campaignsWorker, /campaign\.created/);
  assert.match(campaignsWorker, /campaign\.status_changed/);
  assert.match(campaignsWorker, /campaign\.creative_updated/);
});

test("safety cases derive authority on the Worker and preserve stale safety", () => {
  assert.match(safetyWorker, /isAdminLike\(auth\.roles\)/g);
  assert.match(safetyWorker, /WHERE id = \? AND version = \?/g);
  assert.match(safetyWorker, /escalated_to_owner = 1/);
  assert.match(safetyWorker, /safety_case\.note_added/);
  assert.match(safetyWorker, /safety_case\.link_added/);
  assert.doesNotMatch(safetyWorker, /body\.data\.(?:actorId|createdBy|updatedBy|authorId)/);
});

test("taxonomy and vehicle reference application requires governed review snapshots", () => {
  assert.match(taxonomyWorker, /auth\.roles\.includes\("owner"\)/g);
  assert.match(taxonomyWorker, /reviewed_listing_updated_at/);
  assert.match(taxonomyWorker, /version_status !== "published"/);
  assert.match(taxonomyWorker, /listing_taxonomy_assignments/);
  assert.match(taxonomyWorker, /status = 'applied'/g);
  assert.match(taxonomyWorker, /vehicle_reference\.created/);
});

test("data quality refresh is owner-run and review is optimistic-concurrency safe", () => {
  assert.match(qualityWorker, /auth\.roles\.includes\("owner"\)/);
  assert.match(qualityWorker, /taxonomy_assignment_missing/);
  assert.match(qualityWorker, /required_/);
  assert.match(qualityWorker, /ON CONFLICT\(issue_key\) DO UPDATE/);
  assert.match(qualityWorker, /WHERE id = \? AND updated_at = \?/);
  assert.match(qualityWorker, /listing_data_quality\.reviewed/);
});

test("entry routes governance handlers before generic admin and the final 404", () => {
  const campaign = entry.indexOf("handleAdminCampaigns(request, env)");
  const safety = entry.indexOf("handleAdminSafety(request, env)");
  const taxonomy = entry.indexOf("handleAdminTaxonomyReview(request, env)");
  const quality = entry.indexOf("handleAdminDataQuality(request, env)");
  const admin = entry.indexOf("handleAdmin(request, env)");
  const finalNotFound = entry.lastIndexOf('code: "not_found"');
  assert.ok(campaign >= 0 && safety > campaign && taxonomy > safety && quality > taxonomy);
  assert.ok(admin > quality && finalNotFound > admin);
  assert.doesNotMatch(entry, /baseWorker\.fetch/);
});
