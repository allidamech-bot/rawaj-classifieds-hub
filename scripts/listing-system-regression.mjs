#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const failures = [];

function requireText(source, needle, label) {
  if (!source.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) failures.push(`${label}: forbidden ${JSON.stringify(needle)}`);
}

const listings = read("src/lib/api/listings.ts");
const lifecycle = read("src/lib/api/listing-lifecycle.ts");
const locationWrite = read("src/lib/api/listing-location-write.ts");
const admin = read("src/lib/api/admin.ts");
const reports = read("src/lib/api/reports.ts");
const addListing = read("src/routes/add-listing.tsx");
const publicBase = read("src/lib/api/listings.ts");
const publicLocation = read("src/lib/api/location-aware-listings.ts");
const publicCanonical = read("src/lib/api/location-aware-listings-v2.ts");
const migration33 = read("supabase/migrations/202607080033_listing_system_reconciliation.sql");
const migration35 = read("supabase/migrations/202607080035_listing_schema_contract_reconciliation.sql");
const migration36 = read("supabase/migrations/202607080036_listing_moderation_trigger_reconciliation.sql");

requireText(locationWrite, '.from("governorates")', "canonical governorate mapping");
requireText(locationWrite, 'rowString(row, "node_type") === "governorate"', "canonical ancestor mapping");
requireText(locationWrite, "resolved.data.districtAr || resolved.data.selectedNameAr", "canonical label fallback");

requireText(lifecycle, 'rpc("rawaj_owner_transition_listing"', "owner lifecycle RPC");
requireText(lifecycle, 'rpc("rawaj_owner_set_listing_expiry"', "owner expiry RPC");
requireText(lifecycle, 'rpc("rawaj_owner_confirm_listing_availability"', "owner availability RPC");
forbidText(lifecycle, '.from("listings")', "no direct owner lifecycle table mutation");

requireText(listings, 'createListingWithStatus(userId, payload, "draft")', "create through draft");
requireText(listings, "return submitOwnerListingForReview(userId, draftResult.data.id);", "create through protected submit");
forbidText(
  listings,
  'return createListingWithStatus(userId, payload, "pending_review");',
  "no direct pending-review creation",
);
requireText(listings, 'rpc("rawaj_submit_listing_for_review"', "protected listing submit RPC");

requireText(admin, 'rpc("rawaj_review_listing_decision"', "protected moderation decision RPC");
requireText(reports, 'rpc("rawaj_review_queue_pending")', "protected pending queue RPC");
requireText(addListing, "submitOwnerListingForReview(", "add-listing protected submit path");

for (const [label, source] of [
  ["base public listings", publicBase],
  ["location-aware public listings", publicLocation],
  ["canonical public listings", publicCanonical],
]) {
  requireText(source, '.eq("status", "approved")', `${label} approved-only`);
  requireText(source, '.is("archived_at", null)', `${label} non-archived`);
}

requireText(migration33, "drop constraint if exists listings_status_allowed", "legacy status constraint removal");
requireText(migration33, "drop constraint if exists listings_status_check", "canonical status constraint replacement");
for (const status of ["expired", "sold", "rented", "unavailable"]) {
  requireText(migration33, `'${status}'`, `canonical status ${status}`);
}
requireText(migration33, "status in ('draft', 'rejected')", "editable owner states");
requireText(migration33, "rawaj_owner_transition_listing", "database lifecycle boundary");
requireText(migration33, "rawaj_review_listing_decision", "database moderation boundary");

for (const column of ["expires_at", "renewed_at", "expiry_days", "location_node_id"]) {
  requireText(migration35, `add column if not exists ${column}`, `schema contract ${column}`);
}

requireText(migration36, "'expires_at'", "approval expiry allowed by moderation protection");
requireText(migration36, "'status_changed_at'", "status timestamp allowed by moderation protection");

if (failures.length > 0) {
  console.error("Listing system regression contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Listing system regression contract passed.");
