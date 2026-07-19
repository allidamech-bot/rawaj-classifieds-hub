import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, api, facade, route, ledger] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/202607180002_owner_delete_ad_placement.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/lib/api/ad-placements.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/admin.ad-placements.tsx", import.meta.url), "utf8"),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
]);

test("delete ad placement RPC is owner-only and accepts the required arguments", () => {
  assert.match(migration, /create or replace function public\.rawaj_owner_delete_ad_placement/);
  for (const argument of ["p_id", "p_expected_version", "p_reason"]) {
    assert.match(migration, new RegExp(`${argument}\\s+(uuid|bigint|text)`));
  }
  assert.match(migration, /current_user_has_role\('owner'\)/);
  assert.match(migration, /rawaj_insert_audit_log\(/);
  assert.match(migration, /'ad_placement\.deleted'/);
  assert.match(migration, /rawaj_ad_placement_storage_path/);
});

test("delete ad placement RPC rejects stale versions with an Arabic-aware guard", () => {
  assert.match(migration, /raise exception 'stale_ad_placement'/);
  assert.match(migration, /if exists \(select 1 from public\.ad_placements a where a\.id = p_id\)/);
  assert.match(migration, /char_length\(v_reason\) < 3/);
});

test("delete ad placement RPC is granted only to authenticated (owner) role", () => {
  assert.match(
    migration,
    /grant execute on function public\.rawaj_owner_delete_ad_placement\(uuid, bigint, text\) to authenticated/,
  );
  assert.match(
    migration,
    /revoke all on function public\.rawaj_owner_delete_ad_placement\(uuid, bigint, text\) from anon/,
  );
  assert.doesNotMatch(migration, /to anon/);
});

test("client API deletes and best-effort removes orphaned storage image", () => {
  assert.match(api, /export async function ownerDeleteAdPlacement/);
  for (const argument of ["p_id", "p_expected_version", "p_reason"]) {
    assert.match(api, new RegExp(`${argument}:`));
  }
  assert.match(api, /stale_ad_placement/);
  assert.match(api, /removeOrphanedAdPlacementImage/);
  assert.match(api, /from\("ad_placements"\)\s*\n\s*\.select\("id"\)\s*\n\s*\.eq\("image_url"/);
  assert.match(api, /\.from\(adPlacementMediaBucket\)\.remove\(\[storagePath\]\)/);
});

test("facade invalidates the public ad placement cache after deletion", () => {
  assert.match(facade, /export async function ownerDeleteAdPlacement\(/);
  assert.match(facade, /const result = await ownerDeleteAdPlacementBase\(\.\.\.args\)/);
  assert.match(facade, /if \(result\.ok\) invalidateActiveAdPlacementCache\(\)/);
  assert.match(facade, /return result/);
});

test("admin UI exposes a delete button with a confirmation dialog and reason", () => {
  assert.match(route, /{text\("حذف", "Delete"\)}/);
  assert.match(route, /setPendingDelete\(placement\)/);
  assert.match(route, /role="dialog"/);
  assert.match(route, /{text\("سبب الحذف \(لأغراض التدقيق\)"/);
  assert.match(route, /async function confirmDelete\(\)/);
  assert.match(route, /ownerDeleteAdPlacement\(canManage/);
});

test("delete ad placement migration is registered in the canonical ledger", () => {
  assert.ok(ledger.includes("202607180002_owner_delete_ad_placement.sql"));
});
