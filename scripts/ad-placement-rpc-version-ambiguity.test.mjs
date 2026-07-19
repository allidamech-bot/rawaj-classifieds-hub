import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [reconciliationMigration, apiSource, ledgerSource, packageSource] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/202607190010_reconcile_ad_placement_https_version_update.sql",
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

test("latest ad placement owner writes qualify the version column", () => {
  assert.match(
    reconciliationMigration,
    /create or replace function public\.rawaj_owner_upsert_ad_placement/,
  );
  assert.match(
    reconciliationMigration,
    /create or replace function public\.rawaj_owner_set_ad_placement_status/,
  );
  assert.equal(
    (reconciliationMigration.match(/version = a\.version \+ 1/g) ?? []).length,
    2,
  );
  assert.doesNotMatch(reconciliationMigration, /version\s*=\s*version\s*\+\s*1/);
  assert.equal(
    (reconciliationMigration.match(/a\.version = p_expected_version/g) ?? []).length,
    2,
  );
});

test("version repair preserves HTTPS validation and stable RPC signatures", () => {
  assert.match(
    reconciliationMigration,
    /v_safe_https_pattern constant text := '\^https:\/\//,
  );
  assert.match(
    reconciliationMigration,
    /Image and destination URLs must use valid HTTPS URLs\./,
  );
  assert.match(
    reconciliationMigration,
    /grant execute on function public\.rawaj_owner_upsert_ad_placement\([\s\S]*?\) to authenticated/,
  );
  assert.match(
    reconciliationMigration,
    /grant execute on function public\.rawaj_owner_set_ad_placement_status\(uuid, text, bigint, text\)[\s\S]*?to authenticated/,
  );
  assert.match(apiSource, /rpc\("rawaj_owner_set_ad_placement_status", \{/);
  for (const argument of ["p_id", "p_status", "p_expected_version", "p_reason"]) {
    assert.match(apiSource, new RegExp(`${argument}:`));
  }
});

test("latest ad placement RPC repair is registered and permanently gated", () => {
  assert.ok(
    ledger.classifications.reconciliation.includes(
      "202607190010_reconcile_ad_placement_https_version_update.sql",
    ),
  );
  assert.match(
    packageJson.scripts["test:phases-41-50"],
    /ad-placement-rpc-version-ambiguity\.test\.mjs/,
  );
  assert.match(packageJson.scripts.check, /npm run test:phases-41-50/);
});
