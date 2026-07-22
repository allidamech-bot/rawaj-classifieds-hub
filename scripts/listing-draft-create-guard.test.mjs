import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [
  guardedSource,
  flowSource,
  rpcSource,
  ownerWriteSource,
  apiBarrelSource,
  migration,
  typeRepairMigration,
  serverSource,
] = await Promise.all([
  readFile(new URL("../src/lib/api/listing-draft-create-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-draft-creation-flow.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-draft-create-rpc.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/api/listing-owner-write-guarded.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(
    new URL(
      "../supabase/migrations/202607140002_idempotent_owner_draft_creation.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../supabase/migrations/202607220004_fix_owner_draft_text_identifiers.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
]);

test("owner draft creation reuses one in-flight request for an identical payload", () => {
  assert.match(guardedSource, /ownerDraftCreationRequests = new Map/);
  assert.match(guardedSource, /const existing = ownerDraftCreationRequests\.get\(requestKey\)/);
  assert.match(guardedSource, /existing\.expiresAt === null/);
  assert.match(guardedSource, /return existing\.promise/);
  assert.match(guardedSource, /stablePayloadKey\(payload\)/);
});

test("successful draft creation starts a bounded duplicate-click reuse window", () => {
  assert.match(guardedSource, /SUCCESS_REUSE_WINDOW_MS = 30_000/);
  assert.match(guardedSource, /record\.expiresAt = Date\.now\(\) \+ SUCCESS_REUSE_WINDOW_MS/);
  assert.match(guardedSource, /const record = \{ expiresAt: null \} as DraftCreationRequest/);
  assert.match(guardedSource, /record\.promise = request/);
  assert.match(
    guardedSource,
    /if \(!result\.ok\) \{\s*ownerDraftCreationRequests\.delete\(requestKey\)/,
  );
});

test("one add-listing URL flow keeps a durable UUID across reloads", () => {
  assert.match(flowSource, /FLOW_QUERY_PARAM = "draftFlow"/);
  assert.match(flowSource, /window\.sessionStorage/);
  assert.match(flowSource, /window\.history\.replaceState/);
  assert.match(flowSource, /FLOW_MAX_AGE_MS = 7 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(flowSource, /crypto\.randomUUID/);
  assert.match(flowSource, /UUID_PATTERN/);
  assert.match(flowSource, /flowStorageKey\(userId, requestId\)/);
});

test("guarded draft creation sends the flow UUID and remembers its listing", () => {
  assert.match(guardedSource, /readOrCreateOwnerDraftCreationRequestId\(userId\)/);
  assert.match(
    guardedSource,
    /createOwnerDraftListingIdempotent\(userId, payload, creationRequestId\)/,
  );
  assert.match(
    guardedSource,
    /rememberOwnerDraftCreationListing\(userId, creationRequestId, result\.data\.id\)/,
  );
});

test("database draft creation is unique per owner and flow request", () => {
  assert.match(migration, /add column if not exists creation_request_id uuid/);
  assert.match(migration, /listings_owner_creation_request_uidx/);
  assert.match(migration, /\(owner_id, creation_request_id\)/);
  assert.match(migration, /where creation_request_id is not null/);
  assert.match(migration, /rawaj_create_owner_draft_v2/);
  assert.match(
    migration,
    /where l\.owner_id = v_actor[\s\S]*l\.creation_request_id = p_creation_request_id/,
  );
  assert.match(migration, /for update;/);
  assert.match(migration, /when unique_violation/);
  assert.match(migration, /rawaj_owner_update_listing\(v_listing\.id, v_patch\)/);
  assert.match(migration, /grant execute[\s\S]*to authenticated/);
});

test("idempotent RPC keeps authorization and patch boundaries", () => {
  assert.match(migration, /Authentication required/);
  assert.match(migration, /account_status in \('frozen', 'disabled'\)/);
  assert.match(migration, /restriction_type = 'posting'/);
  assert.match(migration, /v_allowed_keys text\[\]/);
  assert.match(migration, /Unsupported listing creation fields/);
  assert.match(migration, /creation_request_completed/);
});

test("latest owner draft RPC preserves text category, subcategory, and governorate identifiers", () => {
  assert.match(typeRepairMigration, /create or replace function public\.rawaj_create_owner_draft_v2/);
  assert.match(
    typeRepairMigration,
    /nullif\(btrim\(v_patch->>'category_id'\), ''\),/,
  );
  assert.match(
    typeRepairMigration,
    /nullif\(btrim\(v_patch->>'subcategory_id'\), ''\),/,
  );
  assert.match(
    typeRepairMigration,
    /nullif\(btrim\(v_patch->>'governorate_id'\), ''\),/,
  );
  assert.doesNotMatch(typeRepairMigration, /v_patch->>'category_id'[^,\n]*::uuid/);
  assert.doesNotMatch(typeRepairMigration, /v_patch->>'subcategory_id'[^,\n]*::uuid/);
  assert.doesNotMatch(typeRepairMigration, /v_patch->>'governorate_id'[^,\n]*::uuid/);
  assert.match(
    typeRepairMigration,
    /nullif\(btrim\(v_patch->>'location_node_id'\), ''\)::uuid/,
  );
});

test("migration audits current create, update, and submit RPCs for text-id UUID casts", () => {
  assert.match(typeRepairMigration, /rawaj_owner_update_listing/);
  assert.match(typeRepairMigration, /rawaj_owner_update_listing_v2/);
  assert.match(typeRepairMigration, /rawaj_owner_update_listing_v3/);
  assert.match(typeRepairMigration, /rawaj_submit_listing_for_review/);
  assert.match(typeRepairMigration, /\(category_id\|subcategory_id\|governorate_id\)/);
  assert.match(typeRepairMigration, /function_line\.line ~\* '::uuid'/);
  assert.match(typeRepairMigration, /Listing text identifier contract violated/);
});

test("server CSP allows blob image previews without wildcard expansion", () => {
  assert.match(serverSource, /"img-src 'self' data: blob: https:"/);
  assert.doesNotMatch(serverSource, /img-src \*/);
  assert.doesNotMatch(serverSource, /default-src \*/);
});

test("client uses v2 with a temporary pre-migration fallback", () => {
  assert.match(rpcSource, /rpc\("rawaj_create_owner_draft_v2"/);
  assert.match(rpcSource, /p_creation_request_id: cleanRequestId/);
  assert.match(rpcSource, /p_patch: patch/);
  assert.match(rpcSource, /isMissingOwnerDraftCreateV2/);
  assert.match(rpcSource, /createOwnerDraftListingLegacy\(userId, payload\)/);
});

test("successful review submission completes only the matching creation flow", () => {
  assert.match(flowSource, /current\.listingId !== cleanListingId/);
  assert.match(flowSource, /removeFlowRequestIdFromUrl\(requestId\)/);
  assert.match(ownerWriteSource, /completeOwnerDraftCreationFlow\(userId, result\.data\.id\)/);
  assert.ok(
    ownerWriteSource.indexOf("if (result.ok)") <
      ownerWriteSource.indexOf("completeOwnerDraftCreationFlow(userId, result.data.id)"),
  );
});

test("public classifieds API exposes guarded creation and flow completion", () => {
  assert.match(
    apiBarrelSource,
    /export \{ createOwnerDraftListing \} from "@\/lib\/api\/listing-draft-create-guarded"/,
  );
  assert.match(
    apiBarrelSource,
    /export \{ completeOwnerDraftCreationFlow \} from "@\/lib\/api\/listing-draft-creation-flow"/,
  );
});
