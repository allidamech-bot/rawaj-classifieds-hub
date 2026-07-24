import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  seo,
  publicFields,
  listings,
  locationAware,
  canonicalAware,
  priceDrops,
  seller,
  moderationAudit,
] = await Promise.all([
  readFile(new URL("../src/lib/seo.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/public-fields.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/location-aware-listings.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/location-aware-listings-v2.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/price-drops.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/seller.ts", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/202607160002_require_listing_moderation_audit.sql",
      import.meta.url,
    ),
    "utf8",
  ),
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
  assert.ok(seo.includes('.replace(/</g, "\\\\u003c")'));
  assert.ok(seo.includes('.replace(/>/g, "\\\\u003e")'));
  assert.ok(seo.includes('.replace(/&/g, "\\\\u0026")'));
  assert.ok(seo.includes('.replace(/\\u2028/g, "\\\\u2028")'));
  assert.ok(seo.includes('.replace(/\\u2029/g, "\\\\u2029")'));
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

test("all public listing reads use explicit allowlists", () => {
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

  assert.ok(publicList.includes("const listingSelect = filters.withPhotos"));
  assert.ok(publicList.includes("`${publicListingSelect},listing_images!inner(id)`"));
  assert.ok(publicList.includes(".select(listingSelect)"));

  for (const source of [publicDetail, locationAware, priceDrops]) {
    assert.match(source, /\.select\(publicListingSelect\)/);
  }
  assert.match(canonicalAware, /fetchCloudflareListings\(filters, cursor, pageSize\)/);
  assert.match(canonicalAware, /isCloudflarePublicDataProvider\(\)/);
  assert.match(canonicalAware, /there is deliberately no silent cross-provider fallback/i);

  assert.doesNotMatch(publicList, /listing_images!inner\(\*\)/);
  assert.doesNotMatch(publicList, /\.select\("\*"\)/);
  assert.doesNotMatch(publicDetail, /\.select\("\*"\)/);
});

test("public seller page uses listing and review allowlists", () => {
  assert.match(seller, /\.select\(publicListingSelect, \{ count: "exact" \}\)/);
  assert.match(seller, /\.select\(publicSellerReviewSelect, \{ count: "exact" \}\)/);
  assert.match(seller, /sanitizePublicListing\(mapListing/);
  assert.doesNotMatch(seller, /\.select\("\*"\)/);
});

test("listing review decisions require moderation history and audit records", () => {
  const moderationInsertIndex = moderationAudit.indexOf(
    "insert into public.listing_moderation_actions",
  );
  const auditInsertIndex = moderationAudit.indexOf("perform public.rawaj_insert_audit_log");
  const notificationIndex = moderationAudit.indexOf("perform public.rawaj_create_notification");
  const exceptionBlockIndex = moderationAudit.indexOf("\n  exception\n");

  assert.ok(moderationInsertIndex > -1);
  assert.ok(auditInsertIndex > moderationInsertIndex);
  assert.ok(notificationIndex > auditInsertIndex);
  assert.ok(exceptionBlockIndex > auditInsertIndex);
});

test("only owner notification delivery remains best effort", () => {
  const exceptionMatches = moderationAudit.match(/exception\s+when others then\s+null;/g) ?? [];

  assert.equal(exceptionMatches.length, 1);
  assert.match(moderationAudit, /Best-effort only: notification delivery/);
  assert.match(moderationAudit, /raise exception 'stale_review'/);
  assert.match(moderationAudit, /rawaj_current_user_can_review_listings\(\)/);
});
