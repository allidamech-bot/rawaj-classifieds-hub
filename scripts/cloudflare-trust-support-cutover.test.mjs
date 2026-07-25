import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [worker, entry, migration, support, reports, reviews, reviewReports, publicSellers] =
  await Promise.all([
    read("cloudflare/worker/src/trust-support.ts"),
    read("cloudflare/worker/src/entry.ts"),
    read("cloudflare/d1/migrations/0012_trust_support_and_reviews.sql"),
    read("src/lib/api/support.ts"),
    read("src/lib/api/reports.ts"),
    read("src/lib/api/reviews.ts"),
    read("src/lib/api/review-reports.ts"),
    read("cloudflare/worker/src/public-sellers.ts"),
  ]);

test("trust and support clients are Cloudflare-only", () => {
  for (const source of [support, reports, reviews, reviewReports]) {
    assert.doesNotMatch(source, /@supabase\/supabase-js|\bgetClient\b|\.rpc\(|\.from\(["\'\']|\.storage\b/);
  }
  assert.match(support, /\/v1\/account\/support-requests/);
  assert.match(reports, /\/v1\/admin\/listing-reports/);
  assert.match(reviews, /review-eligibility/);
  assert.match(reviewReports, /seller-review-reports/);
});

test("support and listing reports derive identity and enforce ownership on the Worker", () => {
  assert.match(worker, /requireMutationAuth/);
  assert.match(worker, /WHERE id = \? AND user_id = \?/);
  assert.match(worker, /listing\.owner_id === auth\.userId/);
  assert.match(worker, /reporter_id = \?/);
  assert.doesNotMatch(worker, /body\.data\.(?:userId|reporterId|reviewerId)/);
});

test("review eligibility requires bidirectional conversation messages", () => {
  assert.match(worker, /buyer_message\.sender_id = \?/);
  assert.match(worker, /seller_message\.sender_id = \?/);
  assert.match(worker, /buyer_message\.deleted_at IS NULL/);
  assert.match(worker, /seller_message\.deleted_at IS NULL/);
  assert.match(worker, /status IN \('pending', 'approved'\)/);
});

test("moderation is role gated, stale safe, and audited", () => {
  assert.match(worker, /canModerate\(auth\.roles\)/g);
  assert.match(worker, /updated_at = \?/g);
  assert.match(worker, /changedRows\(result\)/g);
  assert.match(worker, /listing_report\.moderated/);
  assert.match(worker, /seller_review\.moderated/);
  assert.match(worker, /seller_review_report\.moderated/);
});

test("D1 stores governed support and review metadata", () => {
  assert.match(migration, /ALTER TABLE support_requests ADD COLUMN type/);
  assert.match(migration, /ALTER TABLE listing_reports ADD COLUMN report_type/);
  assert.match(migration, /ALTER TABLE seller_reviews ADD COLUMN traits/);
  assert.match(migration, /CREATE TABLE seller_review_reports/);
  assert.match(migration, /idx_seller_review_reports_open_unique/);
});

test("public seller reviews expose traits and seller responses without reviewer identity", () => {
  assert.match(publicSellers, /traits, seller_response, seller_response_updated_at/);
  assert.match(publicSellers, /traits: jsonStringArray/);
  assert.doesNotMatch(publicSellers, /reviewer_id/);
});

test("entry owns trust routes before public seller and the final 404", () => {
  const trust = entry.indexOf("handleTrustSupport(request, env)");
  const sellers = entry.indexOf("handlePublicSellers(request, env)");
  const finalNotFound = entry.lastIndexOf('code: "not_found"');
  assert.ok(trust >= 0 && sellers > trust && finalNotFound > sellers);
  assert.doesNotMatch(entry, /baseWorker\.fetch/);
});
