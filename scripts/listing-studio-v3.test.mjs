import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [root, routeStyles, shared, createRoute, manageRoute, storage, writes, lifecycle, css, gate] =
  await Promise.all([
    readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/route-styles.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/features/listing-studio/listing-studio.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/storage.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/listing-write-rpc.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/listing-lifecycle.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/listing-studio-v3.css", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  ]);

test("V3 stylesheet loads after V2", () => {
  assert.match(routeStyles, /listingStudioV3Css/);
  assert.ok(
    root.indexOf("routeStyleHrefs.listingStudioV3") >
      root.indexOf("routeStyleHrefs.listingStudioV2"),
  );
});

test("shared studio supports guided navigation, trust and readiness", () => {
  assert.match(shared, /maxReachable/);
  assert.match(shared, /onStepChange/);
  assert.match(shared, /export function ListingStudioTrustStrip/);
  assert.match(shared, /export function ListingStudioCompletionCard/);
});

test("create flow is guided without weakening draft and image contracts", () => {
  assert.match(createRoute, /rawaj-listing-studio-v3/);
  assert.match(createRoute, /furthestStep/);
  assert.match(createRoute, /<ListingStudioTrustStrip/);
  assert.match(createRoute, /<ListingStudioCompletionCard/);
  assert.match(createRoute, /createOwnerDraftListing/);
  assert.match(createRoute, /registerStaleUploadCleanup/);
  assert.match(createRoute, /const MAX_IMAGES = 6/);
});

test("manage flow uses the same V3 workspace and preserves permissions", () => {
  assert.match(manageRoute, /rawaj-listing-studio-v3/);
  assert.match(manageRoute, /<ListingStudioTrustStrip/);
  assert.match(manageRoute, /<ListingStudioCompletionCard/);
  assert.match(manageRoute, /listing\?\.status === "draft" \|\| listing\?\.status === "rejected"/);
  assert.match(manageRoute, /submitOwnerListingForReview/);
  assert.match(manageRoute, /deleteOwnerListing/);
});

test("listing media validators reject empty files before storage work", () => {
  assert.match(storage, /file\.size <= 0/);
  assert.match(storage, /ملف الصورة فارغ أو تالف/);
  assert.match(storage, /ملف صورة الحساب فارغ أو تالف/);
  assert.match(storage, /ملف الإيصال فارغ أو تالف/);
  assert.ok(
    storage.indexOf("file.size <= 0") < storage.indexOf("validateImageMimeType(file.type)"),
  );
});

test("owner writes and lifecycle transitions deduplicate concurrent identical requests", () => {
  assert.match(writes, /ownerUpdateRequests/);
  assert.match(writes, /ownerSubmitRequests/);
  assert.match(writes, /const pending = ownerUpdateRequests\.get\(requestKey\)/);
  assert.match(writes, /const pending = ownerSubmitRequests\.get\(requestKey\)/);
  assert.match(writes, /stablePayloadKey\(\s*payload,?\s*\)/);
  assert.match(writes, /\.finally\(\(\) => \{/);
  assert.match(lifecycle, /ownerLifecycleRequests/);
  assert.match(lifecycle, /function runOnce/);
  assert.match(lifecycle, /if \(pending\) return pending/);
  assert.match(lifecycle, /transition:\$\{action\}/);
  assert.match(lifecycle, /expiry:\$\{option\}/);
});

test("V3 remains sticky, mobile-first and motion safe", () => {
  assert.match(css, /position: sticky/);
  assert.match(css, /scroll-snap-type: inline mandatory/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) 20rem/);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("quality gate runs V3 read-only", () => {
  assert.match(gate, /contents: read/);
  assert.match(gate, /Listing Studio V3 contract/);
  assert.doesNotMatch(gate, /contents: write/);
});
