import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, apiSource, ledgerSource, packageSource] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/202607160001_fix_ad_placement_version_ambiguity.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/lib/api/ad-placements.ts", import.meta.url), "utf8"),
  readFile(new URL("../docs/production-schema/migration-ledger.json", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

const ledger = JSON.parse(ledgerSource);
const packageJson = JSON.parse(packageSource);

test("ad placement owner writes qualify the version column", () => {
  assert.match(migration, /create or replace function public\.rawaj_owner_upsert_ad_placement/);
  assert.match(migration, /create or replace function public\.rawaj_owner_set_ad_placement_status/);
  assert.equal((migration.match(/version = ad_placements\.version \+ 1/g) ?? []).length, 2);
  assert.doesNotMatch(migration, /version\s*=\s*version\s*\+\s*1/);
  assert.equal((migration.match(/ad_placements\.version = p_expected_version/g) ?? []).length, 2);
});

test("ad placement RPC signatures and grants remain stable", () => {
  assert.match(
    migration,
    /grant execute on function public\.rawaj_owner_upsert_ad_placement\(uuid, text, text, text, text, timestamptz, timestamptz, text, integer, boolean, boolean, bigint\) to authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.rawaj_owner_set_ad_placement_status\(uuid, text, bigint, text\) to authenticated/,
  );
  assert.match(apiSource, /rpc\("rawaj_owner_set_ad_placement_status", \{/);
  for (const argument of ["p_id", "p_status", "p_expected_version", "p_reason"]) {
    assert.match(apiSource, new RegExp(`${argument}:`));
  }
});

test("ad placement RPC repair is registered and permanently gated", () => {
  assert.ok(
    ledger.classifications.reconciliation.includes(
      "202607160001_fix_ad_placement_version_ambiguity.sql",
    ),
  );
  assert.match(
    packageJson.scripts["test:phases-41-50"],
    /ad-placement-rpc-version-ambiguity\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:phases-41-50/);
});
