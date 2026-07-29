import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  router,
  monitoring,
  reporting,
  budget,
  server,
  qualityGate,
  unreadActivity,
  liveChatWorkspace,
  publicAdSlot,
  messagingGuarded,
  publicListings,
  publicListingDetail,
  listingImages,
  classifiedsApi,
] = await Promise.all([
  readFile(new URL("../src/router.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/client-error-monitoring.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/lovable-error-reporting.ts", import.meta.url), "utf8"),
  readFile(new URL("./performance-budget.mjs", import.meta.url), "utf8"),
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/unread-activity.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/communication/useLiveChatWorkspace.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/components/PublicAdPlacementSlot.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/messaging-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/location-aware-listings-v2.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-detail-read-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-images-read-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
]);

test("phase 54 enforces production JavaScript, stylesheet, font and image budgets", () => {
  assert.match(budget, /minimumJavaScriptChunks/);
  assert.match(budget, /maximumJavaScriptChunks/);
  assert.match(budget, /maximumSingleJavaScriptBytes/);
  assert.match(budget, /maximumTotalCssBytes/);
  assert.match(budget, /maximumSingleFontBytes/);
  assert.match(budget, /maximumImageAssets/);
  assert.match(budget, /maximumSingleImageBytes/);
  assert.match(budget, /maximumTotalImageBytes/);
  assert.match(budget, /performance-budget-report\.json/);
  assert.match(budget, /RAWAJ_PERFORMANCE_REPORT=/);
  assert.match(qualityGate, /Production build[\s\S]*Performance budget/);
});

test("phase 55 keeps performance budgets executable and evidence-based after the build", () => {
  assert.match(qualityGate, /npm run performance:budget/);
  assert.match(qualityGate, /Upload performance budget report/);
  assert.match(budget, /No client build output found/);
  assert.match(budget, /largestAssets/);
  assert.match(budget, /summarizeLargest/);
  assert.match(budget, /user-accepted 2026-07-19 production baseline/);
  assert.match(budget, /maximumTotalCssBytes: 540 \* KIB/);
});

test("phase 56 captures global client and hydration failures without raw page content", () => {
  assert.match(router, /installClientErrorMonitoring/);
  assert.match(monitoring, /unhandledrejection/);
  assert.match(monitoring, /window\.addEventListener\("error"/);
  assert.match(monitoring, /React hydration mismatch detected/);
  assert.match(monitoring, /boundary: "react_hydration_warning"/);
  assert.doesNotMatch(monitoring, /reportLovableError\([\s\S]*args,/);
  assert.match(reporting, /\[redacted-email\]/);
  assert.match(reporting, /Bearer \[redacted\]/);
  assert.match(reporting, /rawaj-build-commit/);
});

test("SSR observability records build identity, duration and pathname only", () => {
  assert.match(server, /server-timing/);
  assert.match(server, /x-rawaj-build-commit/);
  assert.match(server, /slow_public_render/);
  assert.match(server, /ssr_request_failed/);
  assert.match(server, /pathname: url\.pathname/);
  assert.match(server, /\[redacted-jwt\]/);
  assert.doesNotMatch(
    server,
    /searchParams|request\.headers|get\("authorization"\)|request\.text\(/,
  );
});

test("launch traffic safeguards bound Cloudflare polling and remove it from public surfaces", () => {
  assert.doesNotMatch(unreadActivity, /UNREAD_ACTIVITY_POLL_MS/);
  assert.match(unreadActivity, /if \(isCloudflarePublicDataProvider\(\)\)/);
  assert.match(unreadActivity, /window\.setInterval\(refreshWhenVisible, 30_000\)/);
  assert.match(unreadActivity, /document\.visibilityState === "visible"/);
  assert.match(unreadActivity, /navigator\.onLine !== false/);
  assert.match(unreadActivity, /window\.clearInterval\(interval\)/);
  assert.match(unreadActivity, /table: "notifications"/);
  assert.match(unreadActivity, /table: "conversation_messages"/);
  assert.match(unreadActivity, /table: "conversations"/);

  assert.doesNotMatch(liveChatWorkspace, /LIVE_CHAT_FALLBACK_POLL_MS|window\.setInterval\(/);
  assert.match(liveChatWorkspace, /invalidateConversationMessagesCache/);
  assert.match(liveChatWorkspace, /const nextProfileId = signedIn \? profileId : null/);
  assert.match(liveChatWorkspace, /invalidateConversationMessagesCache\(\);/);

  assert.doesNotMatch(publicAdSlot, /AD_PLACEMENT_SCHEDULE_REFRESH_MS|window\.setInterval\(/);
  assert.match(publicAdSlot, /AD_PLACEMENT_RETRY_LIMIT = 3/);
  assert.match(publicAdSlot, /AD_PLACEMENT_FRESHNESS_REFRESH_MS = 5 \* 60_000/);
  assert.match(publicAdSlot, /refreshActiveAdPlacements\(page, activeDevice\)/);
});

test("launch traffic safeguards dedupe Signed URL reads without stale public listing caches", () => {
  assert.match(messagingGuarded, /CONVERSATION_MESSAGE_CACHE_TTL_MS = 60_000/);
  assert.match(messagingGuarded, /conversationMessageRequests = new Map/);
  assert.match(messagingGuarded, /if \(pending\) return pending/);

  assert.match(publicListings, /pendingPublicListingReads = new Map/);
  assert.match(publicListings, /if \(pending\) return pending/);
  assert.doesNotMatch(publicListings, /expiresAt|CACHE_TTL/);

  assert.match(publicListingDetail, /pendingPublicListingDetailReads = new Map/);
  assert.match(publicListingDetail, /if \(pending\) return pending/);
  assert.doesNotMatch(publicListingDetail, /expiresAt|CACHE_TTL/);

  assert.match(listingImages, /pendingListingImageReads = new Map/);
  assert.match(listingImages, /if \(pending\) return pending/);
  assert.match(listingImages, /pendingListingImageReads\.delete\(cleanListingId\)/);
  assert.doesNotMatch(listingImages, /expiresAt|CACHE_TTL/);
  assert.match(
    classifiedsApi,
    /export \{ fetchListingImages \} from "@\/lib\/api\/listing-images-read-guarded"/,
  );
});
