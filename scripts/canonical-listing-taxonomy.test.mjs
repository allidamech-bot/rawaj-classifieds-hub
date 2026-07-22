import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, ambiguityRepairMigration, api, editRoute, workflow, migrationStatus] =
  await Promise.all([
    readFile(
      new URL(
        "../supabase/migrations/202607130001_canonical_listing_taxonomy_assignments.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../supabase/migrations/202607220005_fix_listing_taxonomy_assignment_ambiguity.sql",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(new URL("../src/lib/api/listing-taxonomy.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/canonical-listing-taxonomy.yml", import.meta.url), "utf8"),
    readFile(new URL("../docs/database-migration-status.md", import.meta.url), "utf8"),
  ]);

test("canonical taxonomy relation preserves legacy listing compatibility", () => {
  assert.match(migration, /create table if not exists public\.listing_taxonomy_assignments/);
  assert.match(migration, /listing_id uuid primary key references public\.listings\(id\)/);
  assert.match(migration, /taxonomy_node_id text not null references public\.taxonomy_nodes\(id\)/);
  assert.match(migration, /assignment_source in \('legacy_derived', 'explicit'\)/);
  assert.match(migration, /rawaj_resolve_legacy_taxonomy_node/);
  assert.match(migration, /after insert or update of category_id, subcategory_id/);
  assert.match(migration, /on conflict \(listing_id\) do nothing/);
});

test("explicit taxonomy writes are owner-only, editable-only and leaf-only", () => {
  assert.match(migration, /if auth\.uid\(\) is null/);
  assert.match(migration, /target_listing\.owner_id <> auth\.uid\(\)/);
  assert.match(migration, /target_listing\.status not in \('draft', 'rejected'\)/);
  assert.match(migration, /target_node\.is_leaf is not true/);
  assert.match(migration, /with recursive lineage as/);
  assert.match(migration, /Taxonomy node does not match the listing category/);
  assert.match(migration, /Taxonomy node does not match the listing subcategory/);
  assert.match(migration, /grant execute on function public\.rawaj_assign_listing_taxonomy/);
});

test("explicit taxonomy upsert uses an unambiguous constraint target", () => {
  assert.match(
    ambiguityRepairMigration,
    /create or replace function public\.rawaj_assign_listing_taxonomy/,
  );
  assert.match(
    ambiguityRepairMigration,
    /on conflict on constraint listing_taxonomy_assignments_pkey do update/,
  );
  assert.doesNotMatch(
    ambiguityRepairMigration,
    /on conflict\s*\(\s*listing_id\s*\)\s*do update/i,
  );
  assert.match(ambiguityRepairMigration, /assignment\.listing_id/);
  assert.match(ambiguityRepairMigration, /Taxonomy assignment ambiguity contract violated/);
});

test("taxonomy assignments expose only public, owner or admin-safe reads", () => {
  assert.match(
    migration,
    /alter table public\.listing_taxonomy_assignments enable row level security/,
  );
  assert.match(migration, /listing\.status = 'approved'/);
  assert.match(migration, /listing\.archived_at is null/);
  assert.match(migration, /listing\.expires_at is null or listing\.expires_at > now\(\)/);
  assert.match(migration, /listing\.owner_id = auth\.uid\(\)/);
  assert.match(migration, /public\.current_user_is_admin_like\(\)/);
});

test("owner edit flow dual-reads and dual-writes canonical taxonomy", () => {
  assert.match(api, /from\("listing_taxonomy_assignments"\)/);
  assert.match(api, /rpc\("rawaj_assign_listing_taxonomy"/);
  assert.match(editRoute, /fetchOwnerListingTaxonomyAssignment/);
  assert.match(editRoute, /assignOwnerListingTaxonomy/);
  assert.match(editRoute, /_taxonomy_node_id/);
  assert.match(
    editRoute,
    /taxonomyAssignmentResult\.data\?\.taxonomyNodeId \?\? fallbackTaxonomyNodeId/,
  );
});

test("permanent workflow and migration ledger record Phase 4 truth", () => {
  assert.match(workflow, /Canonical Listing Taxonomy Contract/);
  assert.match(workflow, /node --test scripts\/canonical-listing-taxonomy\.test\.mjs/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(migrationStatus, /202607130001_canonical_listing_taxonomy_assignments\.sql/);
  assert.match(migrationStatus, /live-unverified/);
});