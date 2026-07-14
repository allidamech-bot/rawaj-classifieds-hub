import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, promotionRoute] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/202607110016_promotion_status_notifications.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/routes/promotion.tsx", import.meta.url), "utf8"),
]);

test("promotion moderation remains permission and stale-write protected", () => {
  assert.match(migration, /current_user_can_moderate\(\)/);
  assert.match(migration, /status = 'pending_review'/);
  assert.match(migration, /updated_at = p_expected_updated_at/);
  assert.match(migration, /stale_promotion_request/);
});

test("approved and rejected promotion decisions notify the requester", () => {
  assert.match(migration, /promotion\.approved/);
  assert.match(migration, /promotion\.rejected/);
  assert.match(migration, /rawaj_create_notification/);
  assert.match(migration, /v_requester_user_id/);
  assert.match(migration, /'listing_promotion_request'/);
});

test("notification metadata and moderation audit remain attached", () => {
  assert.match(migration, /'listing_id', v_listing_id/);
  assert.match(migration, /'promotion_type', v_promotion_type/);
  assert.match(migration, /'status', p_status/);
  assert.match(migration, /rawaj_insert_audit_log/);
});

test("promotion listings and request history recover independently in place", () => {
  assert.match(promotionRoute, /const \[listingsError, setListingsError\]/);
  assert.match(promotionRoute, /const \[requestsError, setRequestsError\]/);
  assert.match(promotionRoute, /const loadListings = useCallback/);
  assert.match(promotionRoute, /const loadRequests = useCallback/);
  assert.match(promotionRoute, /onAction=\{\(\) => void loadListings\(\)\}/);
  assert.match(promotionRoute, /onAction=\{\(\) => void loadRequests\(\)\}/);
  assert.match(promotionRoute, /actionLabel=\{text\("إعادة المحاولة", "Try again"\)\}/);
  assert.doesNotMatch(promotionRoute, /window\.location\.reload\(\)/);
});

test("promotion load responses cannot overwrite a newer account or retry", () => {
  assert.match(promotionRoute, /const listingsRequestIdRef = useRef\(0\)/);
  assert.match(promotionRoute, /const requestsRequestIdRef = useRef\(0\)/);
  assert.match(
    promotionRoute,
    /if \(requestId !== listingsRequestIdRef\.current\) return;/,
  );
  assert.match(
    promotionRoute,
    /if \(requestId !== requestsRequestIdRef\.current\) return;/,
  );
  assert.match(
    promotionRoute,
    /return \(\) => \{[\s\S]*listingsRequestIdRef\.current \+= 1;[\s\S]*requestsRequestIdRef\.current \+= 1;/,
  );
});

test("a failed refresh preserves the last successful promotion snapshot", () => {
  assert.match(promotionRoute, /const \[hasLoadedListings, setHasLoadedListings\]/);
  assert.match(promotionRoute, /const \[hasLoadedRequests, setHasLoadedRequests\]/);
  assert.match(promotionRoute, /listingsError && !hasLoadedListings/);
  assert.match(promotionRoute, /requestsError && !hasLoadedRequests/);
  assert.match(promotionRoute, /listingsError \? \(/);
  assert.match(promotionRoute, /requestsError \? \(/);
  assert.doesNotMatch(promotionRoute, /Promise\.all\(\[\s*fetchCurrentUserListings/);
});
