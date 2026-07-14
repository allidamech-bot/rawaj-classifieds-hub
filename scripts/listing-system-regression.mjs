#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  buildOwnerUpdateRpcArgs,
  buildOwnerUpdateRpcArgsV3,
} from "../src/lib/api/listing-write-contract.ts";

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
const listingWriteRpc = read("src/lib/api/listing-write-rpc.ts");
const lifecycle = read("src/lib/api/listing-lifecycle.ts");
const locationWrite = read("src/lib/api/listing-location-write.ts");
const admin = read("src/lib/api/admin.ts");
const reports = read("src/lib/api/reports.ts");
const seller = read("src/lib/api/seller.ts");
const addListing = read("src/routes/add-listing.tsx");
const editListing = read("src/routes/profile/listings.$id.tsx");
const publicBase = read("src/lib/api/listings.ts");
const publicLocation = read("src/lib/api/location-aware-listings.ts");
const publicCanonical = read("src/lib/api/location-aware-listings-v2.ts");
const migration33 = read("supabase/migrations/202607080033_listing_system_reconciliation.sql");
const migration35 = read(
  "supabase/migrations/202607080035_listing_schema_contract_reconciliation.sql",
);
const migration36 = read(
  "supabase/migrations/202607080036_listing_moderation_trigger_reconciliation.sql",
);
const migration39 = read(
  "supabase/migrations/202607090001_listing_review_lifecycle_self_contained.sql",
);
const ownerUpdateRuntimeMigration = read(
  "supabase/migrations/202607090002_owner_update_rpc_runtime_v2.sql",
);
const staleOwnerUpdateMigration = read(
  "supabase/migrations/202607140001_owner_listing_stale_write_protection.sql",
);

requireText(locationWrite, '.from("governorates")', "canonical governorate mapping");
requireText(
  locationWrite,
  'rowString(row, "node_type") === "governorate"',
  "canonical ancestor mapping",
);
requireText(
  locationWrite,
  "resolved.data.districtAr || resolved.data.selectedNameAr",
  "canonical label fallback",
);

requireText(lifecycle, 'rpc("rawaj_owner_transition_listing"', "owner lifecycle RPC");
requireText(lifecycle, 'rpc("rawaj_owner_set_listing_expiry"', "owner expiry RPC");
requireText(lifecycle, 'rpc("rawaj_owner_confirm_listing_availability"', "owner availability RPC");
forbidText(lifecycle, '.from("listings")', "no direct owner lifecycle table mutation");

requireText(listings, 'createListingWithStatus(userId, payload, "draft")', "create through draft");
requireText(
  listings,
  "return submitCreatedListingForReview(userId, draftResult.data.id);",
  "create through protected submit",
);
forbidText(
  listings,
  'return createListingWithStatus(userId, payload, "pending_review");',
  "no direct pending-review creation",
);
requireText(listings, 'rpc("rawaj_submit_listing_for_review"', "protected listing submit RPC");
forbidText(listings, 'rpc("rawaj_owner_update_listing"', "no compatibility owner-update RPC call");
forbidText(
  listings,
  "export async function submitOwnerListingForReview",
  "single exported listing submit implementation",
);
forbidText(
  listings,
  "export async function updateOwnerListing",
  "single exported owner update implementation",
);

requireText(admin, 'rpc("rawaj_review_listing_decision"', "protected moderation decision RPC");
requireText(reports, 'rpc("rawaj_review_queue_pending")', "protected pending queue RPC");
requireText(addListing, "submitOwnerListingForReview(", "add-listing protected submit path");
requireText(addListing, "updateOwnerListing(", "autosave and submit preparation canonical update");
requireText(editListing, "updateOwnerListing(", "manual edit canonical update");
requireText(
  listingWriteRpc,
  'rpc("rawaj_owner_update_listing_v3"',
  "stale-safe canonical owner-update RPC",
);
requireText(
  listingWriteRpc,
  '"rawaj_owner_update_listing_v2"',
  "temporary owner-update compatibility fallback",
);
requireText(
  listingWriteRpc,
  "buildOwnerUpdateRpcArgsV3(",
  "stale-safe owner-update argument invariant",
);
requireText(
  listingWriteRpc,
  "buildOwnerUpdateRpcArgs(cleanListingId, patch)",
  "compatibility owner-update argument invariant",
);
forbidText(
  listingWriteRpc,
  '.from("listings")\n    .update(',
  "no direct owner listing update fallback",
);

for (const [label, source] of [
  ["base public listings", publicBase],
  ["location-aware public listings", publicLocation],
  ["canonical public listings", publicCanonical],
  ["public seller listings", seller],
]) {
  requireText(source, '.eq("status", "approved")', `${label} approved-only`);
  requireText(source, '.is("archived_at", null)', `${label} non-archived`);
}

requireText(
  migration33,
  "drop constraint if exists listings_status_allowed",
  "legacy status constraint removal",
);
requireText(
  migration33,
  "drop constraint if exists listings_status_check",
  "canonical status constraint replacement",
);
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
requireText(
  migration36,
  "'status_changed_at'",
  "status timestamp allowed by moderation protection",
);

// Migration 039 must make the review lifecycle self-contained so the admin queue and
// moderation work regardless of which intermediate migrations were applied to production.
requireText(migration39, "rawaj_current_user_can_review_listings", "039 review authority helper");
requireText(
  migration39,
  "p.account_status = 'pending_review'",
  "039 skipped staff activation reconciliation",
);
requireText(migration39, "rawaj_owner_update_listing", "039 owner update RPC");
requireText(migration39, "rawaj_submit_listing_for_review", "039 submit RPC");
requireText(migration39, "rawaj_review_queue_pending", "039 review queue RPC");
requireText(migration39, "rawaj_review_listing_decision", "039 decision RPC");
requireText(migration39, '"Review staff read all listings"', "039 review-staff read RLS");
requireText(migration39, '"Review staff moderate listings"', "039 review-staff moderate RLS");
requireText(
  migration39,
  "create trigger listings_protect_moderation_update",
  "039 moderation trigger attached",
);
requireText(migration39, "stale_review", "039 stale-review protection");
requireText(
  ownerUpdateRuntimeMigration,
  "rawaj_owner_update_listing_v2",
  "versioned owner-update database route",
);
requireText(
  ownerUpdateRuntimeMigration,
  "p_patch jsonb default '{}'::jsonb",
  "database empty-patch default",
);
requireText(
  ownerUpdateRuntimeMigration,
  "grant execute on function public.rawaj_owner_update_listing_v2(uuid, jsonb) to authenticated",
  "versioned owner-update authenticated grant",
);
requireText(
  staleOwnerUpdateMigration,
  "rawaj_owner_update_listing_v3",
  "stale-safe owner-update database route",
);
requireText(
  staleOwnerUpdateMigration,
  "p_expected_updated_at timestamptz",
  "stale-safe expected version argument",
);
requireText(staleOwnerUpdateMigration, "for update;", "stale-safe row lock");
requireText(
  staleOwnerUpdateMigration,
  "v_current_updated_at is distinct from p_expected_updated_at",
  "stale-safe version comparison",
);
requireText(
  staleOwnerUpdateMigration,
  "raise exception 'stale_owner_update'",
  "stale-safe conflict signal",
);
requireText(
  listingWriteRpc,
  'status === "pending_review"',
  "submit success requires pending-review status",
);

const emptyPatchArgs = buildOwnerUpdateRpcArgs(" listing-id ", undefined);
if (
  !isDeepStrictEqual(emptyPatchArgs, {
    p_listing_id: "listing-id",
    p_patch: {},
  })
) {
  failures.push("empty owner-update patch is not normalized to explicit {}");
}

const staleSafeArgs = buildOwnerUpdateRpcArgsV3(
  " listing-id ",
  undefined,
  " 2026-07-14T00:00:00.000Z ",
);
if (
  !isDeepStrictEqual(staleSafeArgs, {
    p_listing_id: "listing-id",
    p_patch: {},
    p_expected_updated_at: "2026-07-14T00:00:00.000Z",
  })
) {
  failures.push("stale-safe owner-update arguments are not normalized");
}

let serializedRpcBody = null;
const serializationClient = createClient("https://example.supabase.co", "test-anon-key", {
  global: {
    fetch: async (_input, init) => {
      serializedRpcBody = typeof init?.body === "string" ? init.body : null;
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  },
});
await serializationClient.rpc(
  "rawaj_owner_update_listing_v3",
  buildOwnerUpdateRpcArgsV3(
    "listing-id",
    undefined,
    "2026-07-14T00:00:00.000Z",
  ),
);

const parsedRpcBody = serializedRpcBody ? JSON.parse(serializedRpcBody) : null;
if (
  !isDeepStrictEqual(parsedRpcBody, {
    p_listing_id: "listing-id",
    p_patch: {},
    p_expected_updated_at: "2026-07-14T00:00:00.000Z",
  })
) {
  failures.push(`Supabase serialized unexpected owner-update body: ${serializedRpcBody}`);
}

if (failures.length > 0) {
  console.error("Listing system regression contract failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Listing system regression contract passed.");
