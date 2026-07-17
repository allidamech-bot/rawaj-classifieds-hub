import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

const favoritesApi = read("src/lib/api/favorites.ts");
const savedSearchesApi = read("src/lib/api/saved-searches.ts");
const favoritesRoute = read("src/routes/favorites.tsx");
const savedSearchesRoute = read("src/routes/saved-searches.tsx");
const notificationTarget = read("src/lib/api/notification-target-resolution.ts");
const migration = read(
  "supabase/migrations/202607170004_favorites_saved_searches_retention_integrity.sql",
);
const workflow = read(".github/workflows/favorites-saved-searches-retention-integrity.yml");
const qualityGate = read(".github/workflows/quality-gate.yml");
const packageJson = JSON.parse(read("package.json"));
const ledger = read("docs/production-schema/migration-ledger.json");

test("favorite mutations remain actor-derived, idempotent, and public-listing safe", () => {
  assert.match(favoritesApi, /rawaj_set_favorite_v1/);
  assert.doesNotMatch(favoritesApi, /from\("favorites"\)\.insert/);
  assert.match(migration, /v_actor uuid := auth\.uid\(\)/);
  assert.match(migration, /pg_advisory_xact_lock[\s\S]*favorite:/);
  assert.match(migration, /status = 'approved'/);
  assert.match(migration, /expires_at is null or l\.expires_at > now\(\)/);
  assert.match(migration, /on conflict \(user_id, listing_id\) do nothing/);
  assert.match(migration, /delete from public\.favorite_listing_snapshots/);
});

test("saved-search writes converge inside account-safe server contracts", () => {
  assert.match(savedSearchesApi, /rawaj_create_my_saved_search_v2/);
  assert.match(savedSearchesApi, /rawaj_update_my_saved_search_frequency_v2/);
  assert.match(savedSearchesApi, /rawaj_delete_my_saved_search_v2/);
  assert.doesNotMatch(savedSearchesApi, /\.from\("saved_searches"\)\s*\.insert/);
  assert.doesNotMatch(savedSearchesApi, /\.from\("saved_searches"\)\s*\.update/);
  assert.doesNotMatch(savedSearchesApi, /\.from\("saved_searches"\)\s*\.delete/);
  assert.match(migration, /saved-search:[\s\S]*md5\(v_filters::text\)/);
  assert.match(migration, /where s\.user_id = v_actor and s\.filters = v_filters/);
  assert.match(migration, /v_frequency not in \('off', 'daily', 'weekly'\)/g);
});

test("retention reads are bounded and deterministically ordered", () => {
  assert.match(savedSearchesApi, /order\("created_at"[\s\S]*order\("id"/);
  assert.match(savedSearchesApi, /\.limit\(100\)/);
  assert.doesNotMatch(savedSearchesApi, /\.select\("\*"\)/);
  assert.match(favoritesApi, /status", "approved"/);
  assert.match(favoritesApi, /publicListingExpiryFilter/);
});

test("legacy favorites schemas are repaired before retention indexing", () => {
  assert.match(
    migration,
    /alter table public\.favorites[\s\S]*add column if not exists created_at timestamptz not null default now\(\)/,
  );
  assert.ok(
    migration.indexOf("add column if not exists created_at") <
      migration.indexOf("favorites_user_created_id_idx"),
  );
});

test("saved-search alert retention index uses the canonical matched timestamp", () => {
  assert.match(
    migration,
    /saved_search_alert_matches_search_created_idx[\s\S]*saved_search_id, matched_at desc, listing_id/,
  );
  assert.doesNotMatch(
    migration,
    /saved_search_alert_matches_search_created_idx[\s\S]*saved_search_id, created_at desc, listing_id/,
  );
});

test("unavailable favorites and notification deep links cannot expose private listings", () => {
  assert.match(favoritesApi, /availability: listing \? "available" : "unavailable"/);
  assert.match(notificationTarget, /saved_search|listing/);
  assert.doesNotMatch(`${favoritesRoute}\n${savedSearchesRoute}`, /dangerouslySetInnerHTML/);
});

test("Phase 15 database changes are indexed, least-privilege, and repository-only", () => {
  assert.match(migration, /security definer/gi);
  assert.match(migration, /set search_path = public, pg_temp/gi);
  assert.match(migration, /revoke all on function/g);
  assert.match(migration, /grant execute on function/g);
  assert.match(migration, /favorites_user_created_id_idx/);
  assert.match(migration, /saved_searches_user_created_id_idx/);
  assert.match(migration, /saved_search_alert_matches_search_created_idx/);
  assert.match(migration, /Do not apply automatically/);
  assert.match(ledger, /202607170004_favorites_saved_searches_retention_integrity\.sql/);
});

test("permanent workflow is read-only and Quality Gate runs Phase 15", () => {
  assert.equal(
    packageJson.scripts["test:favorites-saved-searches-retention"],
    "node --test scripts/favorites-saved-searches-retention-integrity.test.mjs",
  );
  assert.match(packageJson.scripts.check, /test:favorites-saved-searches-retention/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /npm ci/);
  assert.match(workflow, /npm run test:favorites-saved-searches-retention/);
  assert.match(workflow, /npm run typecheck -- --pretty false/);
  assert.doesNotMatch(workflow, /service_role|supabase db|migration up|deploy|git push/i);
  assert.match(qualityGate, /Favorites, Saved Searches & Retention Integrity contract/);
  assert.match(qualityGate, /npm run test:favorites-saved-searches-retention/);
});
