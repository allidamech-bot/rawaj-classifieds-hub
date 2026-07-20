import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(
  new URL("../src/routes/admin.data-quality.tsx", import.meta.url),
  "utf8",
);
const contextClient = await readFile(
  new URL("../src/lib/api/listing-data-quality-context.ts", import.meta.url),
  "utf8",
);
const adminLayout = await readFile(new URL("../src/routes/admin.tsx", import.meta.url), "utf8");
const migration = await readFile(
  new URL(
    "../supabase/migrations/202607190038_listing_data_quality_context_v1.sql",
    import.meta.url,
  ),
  "utf8",
);

test("admin workspace defaults to all categories rather than vehicles", () => {
  assert.match(route, /createFileRoute\("\/admin\/data-quality"\)/);
  assert.match(route, /const \[categoryId, setCategoryId\] = useState\("all"\)/);
  assert.match(route, /كل الأقسام/);
  assert.match(route, /All categories/);
  assert.match(route, /يفحص التصنيف والحقول والقيم والبيانات القديمة عبر الأقسام الفعالة كلها/);
  assert.match(route, /السيارات مسار متخصص واحد داخل النظام/);
  assert.doesNotMatch(route, /useState\("vehicles"\)/);
});

test("workspace covers generic taxonomy, field, value, and legacy issue classes", () => {
  for (const issueType of [
    "taxonomy",
    "required_field",
    "unexpected_field",
    "invalid_value",
    "legacy_payload",
    "specialized_reference",
  ]) {
    assert.match(route, new RegExp(`"${issueType}"`));
  }
  for (const code of [
    "taxonomy_unresolved",
    "required_field_missing",
    "field_not_allowed_for_leaf",
    "controlled_option_invalid",
    "numeric_value_out_of_range",
    "text_value_too_long",
    "legacy_details_require_mapping",
  ]) {
    assert.match(route, new RegExp(`${code}`));
  }
});

test("workspace has governed review actions and owner-only full scanning", () => {
  assert.match(route, /auth\.profile\?\.roles\.includes\("owner"\)/);
  assert.match(route, /refreshListingDataQualityIssues/);
  assert.match(route, /reviewListingDataQualityIssue/);
  for (const decision of ["needs_review", "seller_action", "resolve", "dismiss", "reopen"]) {
    assert.match(route, new RegExp(`"${decision}"`));
  }
  assert.match(route, /expectedUpdatedAt: issue\.updatedAt/);
});

test("context RPC exposes every active category and both governed version states", () => {
  assert.match(migration, /rawaj_admin_fetch_data_quality_context_v1/);
  assert.match(migration, /from public\.categories category_row/);
  assert.match(migration, /where category_row\.is_active/);
  assert.match(migration, /where version_row\.status in \('draft', 'published'\)/);
  assert.match(migration, /not public\.current_user_is_admin_like\(\)/);
  assert.match(migration, /revoke all on function public\.rawaj_admin_fetch_data_quality_context_v1\(\)/);
});

test("context client parses versions, categories, and marketplace-wide summary", () => {
  for (const typeName of [
    "DataQualityTaxonomyVersion",
    "DataQualityCategory",
    "DataQualitySummary",
    "ListingDataQualityContext",
  ]) {
    assert.match(contextClient, new RegExp(`export interface ${typeName}`));
  }
  assert.match(contextClient, /rawaj_admin_fetch_data_quality_context_v1/);
  assert.match(contextClient, /categories: array\(payload\.categories\)/);
  assert.match(contextClient, /versions: array\(payload\.versions\)/);
  assert.doesNotMatch(contextClient, /\.from\("categories"/);
});

test("admin navigation exposes the general data quality workspace", () => {
  assert.match(adminLayout, /to: "\/admin\/data-quality"/);
  assert.match(adminLayout, /labelAr: "جودة البيانات"/);
  assert.match(adminLayout, /permission: "canModerateListings"/);
});
