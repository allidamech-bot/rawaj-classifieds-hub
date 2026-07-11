import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [seo, publicFields, listings, locationAware, canonicalAware, priceDrops, seller] =
  await Promise.all([
    readFile(new URL("../src/lib/seo.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/public-fields.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/location-aware-listings.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/location-aware-listings-v2.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/price-drops.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/api/seller.ts", import.meta.url), "utf8"),
  ]);

function functionSource(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing function marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing function boundary: ${end}`);
  return source.slice(startIndex, endIndex);
}

test("JSON-LD serialization neutralizes script-breaking characters", () => {
  assert.match(seo, /export function serializeJsonLd/);
  assert.match(seo, /replace\(\/<\/g, "\\\\u003c"\)/);
  assert.match(seo, /replace\(\/>\/g, "\\\\u003e"\)/);
  assert.match(seo, /replace\(\/&\/g, "\\\\u0026"\)/);
  assert.match(seo, /replace\(\/\\u2028\/g, "\\\\u2028"\)/);
  assert.match(seo, /replace\(\/\\u2029\/g, "\\\\u2029"\)/);
  assert.match(seo, /__html: serializeJsonLd\(data\)/);
  assert.doesNotMatch(seo, /__html: JSON\.stringify\(data\)/);
});

test("public listing allowlist excludes moderation-only fields", () => {
  for (const internalField of [
    "reviewed_by",
    "reviewed_at",
    "rejection_reason",
    "status_changed_at",
  ]) {
    assert.doesNotMatch(publicFields, new RegExp(`"${internalField}"`));
  }
  assert.match(publicFields, /publicListingSelect/);
  assert.match(publicFields, /publicSellerReviewSelect/);
  assert.doesNotMatch(publicFields, /"admin_note"/);
});

test("all public listing reads use the explicit allowlist", () => {
  const publicList = functionSource(
    listings,
    "export async function fetchPublicListings(",
    "export async function fetchListingDetail(",
  );
  const publicDetail = functionSource(
    listings,
    "export async function fetchListingDetail(",
    "export async function fetchOwnerListingDetail(",
  );

  for (const source of [publicList, publicDetail, locationAware, canonicalAware, priceDrops]) {
    assert.match(source, /\.select\(publicListingSelect\)/);
  }
  assert.doesNotMatch(publicList, /\.select\("\*"\)/);
  assert.doesNotMatch(publicDetail, /\.select\("\*"\)/);
});

test("public seller page uses listing and review allowlists", () => {
  assert.match(seller, /\.select\(publicListingSelect\)/);
  assert.match(seller, /\.select\(publicSellerReviewSelect\)/);
  assert.doesNotMatch(seller, /\.select\("\*"\)/);
});
