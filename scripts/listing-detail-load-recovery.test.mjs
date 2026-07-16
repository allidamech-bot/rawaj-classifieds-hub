import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  PublicListingDetailLoadError,
  guardPublicListingDetailResult,
  isUnavailableListingDetailError,
} from "../src/lib/api/listing-detail-load-guard.ts";

const [barrelSource, routeSource, pageDataSource, rootSource, packageSource] = await Promise.all([
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listing-detail/public-listing-detail-page-data.ts", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/routes/__root.tsx", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

const baseError = {
  message: "Temporary listing read failure",
};

test("only genuine unavailable listing outcomes remain eligible for the 404 recovery path", () => {
  assert.equal(isUnavailableListingDetailError({ ...baseError, code: "not_found" }), true);
  assert.equal(isUnavailableListingDetailError({ ...baseError, code: "validation_error" }), true);
  assert.equal(isUnavailableListingDetailError({ ...baseError, code: "unknown" }), false);
  assert.equal(isUnavailableListingDetailError({ ...baseError, code: "schema_missing" }), false);
  assert.equal(
    isUnavailableListingDetailError({ ...baseError, code: "supabase_unconfigured" }),
    false,
  );
});

test("transient listing detail failures escape to the retryable route error boundary", () => {
  const retryableError = {
    code: "unknown",
    message: "Network request failed",
    operation: "public_listing_detail_read",
  };

  assert.throws(
    () => guardPublicListingDetailResult({ ok: false, error: retryableError }),
    (error) => {
      assert.ok(error instanceof PublicListingDetailLoadError);
      assert.equal(error.code, retryableError.code);
      assert.equal(error.operation, retryableError.operation);
      assert.equal(error.message, retryableError.message);
      return true;
    },
  );
});

test("not-found results still reach the existing unavailable-listing recovery component", () => {
  const result = {
    ok: false,
    error: { code: "not_found", message: "Listing unavailable" },
  };

  assert.equal(guardPublicListingDetailResult(result), result);
  assert.match(pageDataSource, /if \(!listingResult\.ok\) return null/);
  assert.match(routeSource, /if \(!pageData\) throw notFound\(\)/);
  assert.match(routeSource, /notFoundComponent: UnavailableListingRecovery/);
});

test("the public classifieds barrel overrides the raw detail read with the guarded boundary", () => {
  assert.match(
    barrelSource,
    /export \{ fetchListingDetailGuarded as fetchListingDetail \} from "@\/lib\/api\/listing-detail-read-guarded"/,
  );
  assert.match(pageDataSource, /fetchListingDetail,/);
  assert.match(pageDataSource, /await fetchListingDetail\(listingId\)/);
});

test("retryable loader failures inherit the root invalidate-and-reset recovery action", () => {
  assert.match(rootSource, /function ErrorComponent\(\{ error, reset \}/);
  assert.match(rootSource, /router\.invalidate\(\)/);
  assert.match(rootSource, /reset\(\)/);
  assert.match(rootSource, /إعادة المحاولة/);
});

test("listing detail load recovery is part of the permanent detail Quality Gate", () => {
  const packageJson = JSON.parse(packageSource);
  assert.match(
    packageJson.scripts["test:listing-detail-v3"],
    /listing-detail-load-recovery\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:listing-detail-v3/);
});
