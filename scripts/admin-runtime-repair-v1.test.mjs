import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [ownerMigration, capabilityMigration, supabaseClient, server] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/202607200001_fix_owner_system_control_version_ambiguity.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(
    new URL(
      "../supabase/migrations/202607200002_admin_runtime_capability_gate_v1.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/lib/supabase.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/server.ts", import.meta.url), "utf8"),
]);

test("owner system-control updates qualify the version column", () => {
  assert.match(ownerMigration, /update public\.owner_system_controls as control_row/i);
  assert.match(ownerMigration, /version = control_row\.version \+ 1/i);
  assert.doesNotMatch(ownerMigration, /version = version \+ 1/i);
  assert.match(ownerMigration, /set search_path = public, pg_temp/i);
});

test("data-quality calls are gated by an authenticated runtime capability", () => {
  assert.match(capabilityMigration, /rawaj_admin_runtime_capabilities_v1/i);
  assert.match(capabilityMigration, /dataQualityReady/);
  assert.match(capabilityMigration, /to_regprocedure\('public\.rawaj_admin_fetch_data_quality_context_v1\(\)'\)/);
  assert.match(capabilityMigration, /grant execute[\s\S]*to authenticated/i);
  assert.match(supabaseClient, /rawaj_admin_runtime_capabilities_v1/);
  assert.match(supabaseClient, /RAWAJ_FEATURE_UNAVAILABLE/);
  assert.match(supabaseClient, /dataQualityCapabilityTtlMs = 30_000/);
});

test("Vercel tooling is allowed only for preview builds", () => {
  assert.match(server, /rawajBuildInfo\.provider === "vercel"/);
  assert.match(server, /rawajBuildInfo\.environment === "preview"/);
  assert.match(server, /scriptSources\.push\("https:\/\/vercel\.live"\)/);
  assert.match(server, /manifestSources\.push\("https:\/\/vercel\.com"\)/);
  assert.match(server, /buildContentSecurityPolicy\(isSecureRequest, isVercelPreviewBuild\(\)\)/);
});
