import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const supportApi = read("src/lib/api/support.ts");
const supportGuard = read("src/lib/api/support-guarded.ts");
const supportRoute = read("src/routes/support.tsx");
const supportTimeline = read("src/features/trust/TrustSupportExperience.tsx");
const reportApi = read("src/lib/api/reports.ts");
const reportGuard = read("src/lib/api/reports-guarded.ts");
const listingRoute = read("src/routes/listings.$id.tsx");
const messagingApi = read("src/lib/api/messaging.ts");
const reviewApi = read("src/lib/api/review-reports.ts");
const listingAdmin = read("src/routes/admin.reports.tsx");
const messageAdmin = read("src/routes/admin.message-reports.tsx");
const reviewAdmin = read("src/features/reviews/SellerReviewReportsAdminPanel.tsx");
const contract = read("src/lib/moderation-contract.ts");
const errorMap = read("src/lib/api/moderation-errors.ts");
const migration = read("supabase/migrations/202607170003_support_reports_moderation_integrity.sql");
const workflow = read(".github/workflows/support-reports-moderation-integrity.yml");
const qualityGate = read(".github/workflows/quality-gate.yml");
const packageJson = JSON.parse(read("package.json"));

test("browser support APIs are actor-free, bounded, owner-scoped, and private-note safe", () => {
  assert.match(supportApi, /createMySupportRequest\(\s*payload:/);
  assert.doesNotMatch(supportApi, /createSupportRequest\(\s*(userId|profileId|ownerId|accountId)/);
  assert.match(supportApi, /fetchMySupportRequests\(\)/);
  assert.match(supportApi, /resolveAuthenticatedAccountId/);
  assert.match(supportApi, /accountSessionStillMatches/);
  assert.match(supportApi, /p_limit: 50/);
  assert.match(supportApi, /order\("created_at"[\s\S]*order\("id"/);
  assert.match(supportApi, /ownerSupportRequestSelect/);
  assert.doesNotMatch(supportApi, /\.select\("\*"\)/);
  assert.doesNotMatch(
    supportApi.match(/function mapOwnerSupportRequest[\s\S]*$/)?.[0] ?? "",
    /admin_note|reviewed_by/,
  );
  assert.match(supportApi, /normalizeModerationSubject[\s\S]*normalizeModerationText/);
  assert.match(supportApi, /isSupportRequestType/);
  assert.match(supportGuard, /resolveAuthenticatedAccountId/);
  assert.doesNotMatch(supportRoute, /create(?:My)?SupportRequest\(\s*(?:auth\.|profile|userId)/);
});

test("support UI is bilingual, account-switch safe, plain-text, and uses public replies only", () => {
  assert.match(supportRoute, /requestsRequestIdRef/);
  assert.match(supportRoute, /profileIdRef/);
  assert.match(supportRoute, /setRequests\(\[\]\)/);
  assert.match(supportRoute, /text\(/);
  assert.match(supportRoute, /rawaj-support-/);
  assert.match(supportTimeline, /request\.publicResponse/);
  assert.doesNotMatch(supportTimeline, /request\.adminNote/);
  assert.doesNotMatch(`${supportRoute}\n${supportTimeline}`, /dangerouslySetInnerHTML/);
});

test("listing reports derive the reporter, reauthorize public targets, and converge server-side", () => {
  assert.match(reportApi, /createListingReport\(\s*listingId:/);
  assert.doesNotMatch(reportApi, /createListingReport\(\s*(reporterId|userId|profileId)/);
  assert.match(reportApi, /rawaj_create_listing_report_v2/);
  assert.match(reportApi, /resolveAuthenticatedAccountId/);
  assert.match(reportApi, /accountSessionStillMatches/);
  assert.match(reportApi, /isListingReportType/);
  assert.match(reportGuard, /resolveAuthenticatedAccountId/);
  assert.doesNotMatch(listingRoute, /createListingReport\(\s*(?:profile|auth|accountId)/);
  assert.match(migration, /where id = p_listing_id and status = 'approved'/);
  assert.match(migration, /listing_report_self_report_denied/);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*listing-report:/);
  assert.match(migration, /listing_report_rate_limit/);
});

test("message and review report targets are server-authorized and evidence preserving", () => {
  assert.match(messagingApi, /rawaj_create_message_report/);
  assert.match(messagingApi, /isMessageReportReason/);
  assert.match(reviewApi, /rawaj_create_seller_review_report/);
  assert.match(
    migration,
    /v_actor not in \(v_conversation\.buyer_user_id, v_conversation\.seller_user_id\)/,
  );
  assert.match(migration, /message_report_self_report_denied/);
  assert.match(migration, /seller_review_report_review_unavailable/);
  assert.match(migration, /message_body_snapshot/);
  assert.match(migration, /review_body_snapshot/);
  assert.match(migration, /listing_title_snapshot/);
  assert.match(migration, /on delete set null/gi);
  assert.doesNotMatch(`${messagingApi}\n${reviewApi}`, /\.select\("\*"\)/);
});

test("admin queues and decisions rely on server authority rather than React booleans", () => {
  assert.match(reportApi, /adminFetchReports\(\)/);
  assert.match(messagingApi, /adminFetchMessageReports\(\)/);
  assert.match(reviewApi, /adminFetchSellerReviewReports\(\)/);
  assert.doesNotMatch(reportApi, /adminModerateReport\(\s*canUseAdminAccess/);
  assert.doesNotMatch(messagingApi, /adminModerateMessageReport\(\s*canUseAdminAccess/);
  assert.doesNotMatch(reviewApi, /adminModerateSellerReviewReport\(\s*canUseAdminAccess/);
  assert.match(migration, /current_user_can_moderate\(\)/g);
  assert.match(migration, /security definer/gi);
  assert.match(migration, /set search_path = public/gi);
  assert.match(
    migration,
    /revoke select, insert, update on table public\.listing_reports from authenticated/,
  );
  assert.match(
    migration,
    /revoke select, insert, update on table public\.support_requests from authenticated/,
  );
});

test("moderation uses allowlisted transitions, stale checks, and idempotent repeat decisions", () => {
  assert.match(contract, /isAllowedModerationTransition/);
  assert.match(contract, /if \(current === next\) return true/);
  assert.match(migration, /stale_support_request/);
  assert.match(migration, /stale_listing_report/);
  assert.match(migration, /stale_message_report/);
  assert.match(migration, /stale_seller_review_report/);
  assert.match(migration, /status = p_status and[\s\S]*return query select/g);
  assert.match(migration, /invalid_transition/g);
  assert.match(migration, /for update/g);
  assert.doesNotMatch(
    `${reportApi}\n${messagingApi}\n${reviewApi}`,
    /assignedTo: auth|resolvedAt: new Date/,
  );
});

test("reporter privacy, notifications, audit payloads, and owner DTOs exclude private content", () => {
  assert.match(migration, /public_response/);
  assert.match(migration, /jsonb_build_object\('status', p_status\)/g);
  assert.doesNotMatch(
    migration.match(/jsonb_build_object\('status', p_status\)/g)?.join("\n") ?? "",
    /reporter_id|admin_note|reason|message_body/,
  );
  assert.match(migration, /'تمت مراجعة البلاغ الذي أرسلته\.'/);
  assert.doesNotMatch(
    migration.match(/rawaj_insert_audit_log\([\s\S]*?\);/g)?.join("\n") ?? "",
    /v_note|v_reason|v_details|message_body_snapshot/,
  );
  assert.doesNotMatch(supportTimeline, /reviewedBy|reviewedAt|adminNote/);
});

test("blocking derives both sides on the server and is idempotent", () => {
  assert.match(messagingApi, /rawaj_block_conversation_participant/);
  assert.doesNotMatch(messagingApi, /from\("user_blocks"\)\.insert/);
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /v_target := case/);
  assert.match(migration, /conversation_block_self_denied/);
  assert.match(migration, /conversation-block:/);
  assert.match(migration, /if v_id is null then/);
});

test("account switching and stale completions cannot repopulate support or admin queues", () => {
  assert.match(supportRoute, /profileIdRef/);
  assert.match(supportRoute, /requestsRequestIdRef/);
  for (const source of [listingAdmin, messageAdmin, reviewAdmin]) {
    assert.match(source, /accountId/);
    assert.match(source, /requestIdRef|generationRef/);
  }
  assert.match(listingAdmin, /setReports\(\[\]\)/);
  assert.match(messageAdmin, /setReports\(\[\]\)/);
  assert.match(reviewAdmin, /setReports\(\[\]\)/);
});

test("errors are sanitized and do not expose raw database details", () => {
  assert.match(errorMap, /fallbackMessage/);
  assert.match(errorMap, /rate_limited/);
  assert.match(errorMap, /stale_review/);
  assert.doesNotMatch(errorMap, /details:\s*error\.message/);
});

test("Phase 14 migration is ledgered, repository-only, and introduces no production mutation path", () => {
  const ledger = read("docs/production-schema/migration-ledger.json");
  assert.match(ledger, /202607170003_support_reports_moderation_integrity\.sql/);
  assert.match(migration, /Repository-only, additive migration/);
  assert.doesNotMatch(workflow, /service_role|supabase db|migration up|deploy|git push/i);
  assert.doesNotMatch(migration, /geolocation|radius/i);
});

test("permanent workflow is read-only and Quality Gate runs the focused contract", () => {
  assert.equal(
    packageJson.scripts["test:support-reports-moderation"],
    "node --test scripts/support-reports-moderation-integrity.test.mjs",
  );
  assert.match(packageJson.scripts.check, /test:support-reports-moderation/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run test:support-reports-moderation/);
  assert.match(workflow, /npm run typecheck -- --pretty false/);
  assert.match(qualityGate, /Support, Reports & Moderation Integrity contract/);
  assert.match(qualityGate, /npm run test:support-reports-moderation/);
});
