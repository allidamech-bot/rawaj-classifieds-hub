import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../supabase/migrations/202607100006_seller_review_reports.sql",
  import.meta.url,
);
const apiPath = new URL("../src/lib/api/review-reports.ts", import.meta.url);
const cardPath = new URL("../src/features/reviews/SellerReviewCard.tsx", import.meta.url);

const [migration, api, card] = await Promise.all([
  readFile(migrationPath, "utf8"),
  readFile(apiPath, "utf8"),
  readFile(cardPath, "utf8"),
]);

test("review reports derive identities and only accept approved reviews", () => {
  assert.match(migration, /v_reporter uuid := auth\.uid\(\)/);
  assert.match(migration, /v_review\.status <> 'approved'/);
  assert.match(migration, /v_review\.reviewer_user_id = v_reporter/);
  assert.match(migration, /reported_reviewer_user_id[\s\S]*v_review\.reviewer_user_id/);
});

test("review reports are idempotent while open and constrain reasons", () => {
  assert.match(migration, /idx_seller_review_reports_open_unique/);
  assert.match(migration, /where status in \('new', 'under_review'\)/);
  assert.match(
    migration,
    /reason in \('abuse', 'spam', 'misleading', 'personal_data', 'prohibited_content', 'other'\)/,
  );
  assert.match(migration, /when unique_violation/);
});

test("review report writes use protected RPCs without direct client mutations", () => {
  assert.match(api, /rpc\("rawaj_create_seller_review_report"/);
  assert.match(api, /rpc\("rawaj_admin_moderate_seller_review_report"/);
  assert.doesNotMatch(api, /\.from\("seller_review_reports"\)[\s\S]*\.insert\(/);
  assert.doesNotMatch(api, /\.from\("seller_review_reports"\)[\s\S]*\.update\(/);
  assert.match(
    migration,
    /revoke all on function public\.rawaj_create_seller_review_report\(uuid, text, text\) from anon/,
  );
});

test("submitting a review report never auto-hides or mutates the target review", () => {
  assert.doesNotMatch(migration, /update public\.seller_reviews/);
  assert.doesNotMatch(migration, /delete from public\.seller_reviews/);
});

test("review report moderation is permission checked, stale safe, and audited", () => {
  assert.match(migration, /not public\.current_user_can_moderate\(\)/);
  assert.match(migration, /seller_review_reports\.updated_at = p_expected_updated_at/);
  assert.match(migration, /stale_seller_review_report/);
  assert.match(migration, /rawaj_insert_audit_log/);
  assert.match(migration, /seller_review_report\.moderated/);
});

test("review reports expose only own-user and moderator select policies", () => {
  assert.match(migration, /seller_review_reports_select_own/);
  assert.match(migration, /reporter_user_id = auth\.uid\(\)/);
  assert.match(migration, /seller_review_reports_admin_select/);
  assert.match(migration, /public\.current_user_can_moderate\(\)/);
});

test("review cards expose governed reporting without allowing self-report UI", () => {
  assert.match(card, /createSellerReviewReport\(review\.id, reportReason, reportDetails\)/);
  assert.match(card, /auth\.profile\?\.id !== review\.reviewerUserId/);
  assert.match(card, /reportReasons/);
  assert.match(card, /maxLength=\{1000\}/);
  assert.match(card, /Report submitted for review without automatically hiding the review/);
});
