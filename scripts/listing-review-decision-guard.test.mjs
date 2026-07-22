import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL(
    "../supabase/migrations/202607220006_fix_listing_review_generated_column_guard.sql",
    import.meta.url,
  ),
  "utf8",
);

test("listing review writes ignore the stored generated search column", () => {
  assert.match(
    migration,
    /create or replace function public\.rawaj_protect_listing_moderation_update\(\)/,
  );
  assert.match(
    migration,
    /'expires_at', 'search_text_normalized'[\s\S]*is not distinct from[\s\S]*'expires_at', 'search_text_normalized'/,
  );
  assert.match(migration, /rawaj_current_user_can_review_listings\(\)/);
  assert.match(
    migration,
    /Review staff can only change moderation-safe fields on listings\./,
  );
});

test("all governed listing write comparisons exclude search_text_normalized", () => {
  assert.match(
    migration,
    /array\['price', 'updated_at', 'search_text_normalized'\]/,
  );
  assert.match(
    migration,
    /array\['reserved_at', 'updated_at', 'search_text_normalized'\]/,
  );
  assert.match(migration, /rawaj\.promotion_moderation_write/);
  assert.match(
    migration,
    /'is_featured', 'featured_until', 'updated_at', 'search_text_normalized'/,
  );
});

test("migration verifies the live generated-column contract", () => {
  assert.match(migration, /c\.is_generated/);
  assert.match(migration, /v_generated is distinct from 'ALWAYS'/);
  assert.match(migration, /v_search_reference_count < 8/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});
