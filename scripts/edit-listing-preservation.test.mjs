import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const [route, fields, workflow, qualityGate, migrations] = await Promise.all([
  readFile(new URL("../src/routes/profile/listings.$id.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/category-fields.ts", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/edit-listing-preservation.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
  readdir(new URL("../supabase/migrations/", import.meta.url)),
]);

test("edit listing hydrates canonical taxonomy with safe legacy fallbacks", () => {
  assert.match(route, /fetchOwnerListingTaxonomyAssignment\(profileId, id\)/);
  assert.match(route, /readDetailString\(loadedListing\.details, "_taxonomy_node_id"\)/);
  assert.match(route, /function resolveHydratedTaxonomyNodeId\(/);
  assert.match(route, /node\.legacyCategoryId === categoryId/);
  assert.match(route, /node\.legacySubcategoryId === subcategoryId/);
  assert.match(route, /node\.isLeaf/);
  assert.match(route, /canonicalTaxonomyNodeId \|\| legacyTaxonomyNodeId/);
  assert.doesNotMatch(route, /else delete details\._taxonomy_node_id/);
  assert.match(route, /Taxonomy could not be loaded; the listing's existing data was preserved\./);
});

test("edit listing reuses explicit field, condition, and location schema helpers", () => {
  assert.match(route, /resolveCategoryFieldKind\(selectedTaxonomyNode, category, listing\)/);
  assert.doesNotMatch(route, /detectCategoryFieldKind/);
  assert.match(route, /categoryUsesGlobalCondition\(categoryFieldKind\)/);
  assert.match(route, /showGlobalCondition && \(/);
  assert.match(route, /categoryRequiresPreciseLocation\(categoryFieldKind\)/);
  assert.match(route, /requiresPreciseLocation && !preciseLocationSelected/);
  assert.match(fields, /export function resolveCategoryFieldKind\(/);
});

test("taxonomy selection commits leaves only and preserves compatible data", () => {
  const handler = route.slice(
    route.indexOf("function handleTaxonomySelection("),
    route.indexOf("function handleLegacyCategorySelection("),
  );
  assert.match(handler, /if \(!isEditable \|\| !node\.isLeaf\) return/);
  assert.match(handler, /resolveTaxonomyListingSearch\(node, path\)/);
  assert.match(handler, /const previousKind = categoryFieldKind/);
  assert.match(handler, /const nextKind = resolveCategoryFieldKind/);
  assert.match(handler, /sanitizeCategoryDetails\(nextKind, current\)/);
  assert.doesNotMatch(handler, /setTitle|setDescription|setPrice|setImages|setContact/);
  assert.match(route, /let details = \{ \.\.\.initial\.details \}/);
});

test("validation requires a canonical leaf only when taxonomy is available", () => {
  assert.match(route, /taxonomyNodes\.length > 0 && !selectedTaxonomyNode\?\.isLeaf/);
  assert.match(route, /taxonomyNodes\.length === 0 && !values\.categoryId/);
  assert.match(route, /Choose a final category\./);
  assert.match(route, /requireComplete: true/);
  assert.match(route, /Complete the required category fields\./);
});

test("changed-fields patch omits unchanged data and represents intentional clears", () => {
  const patchBuilder = route.slice(
    route.indexOf("function buildChangedListingPatch("),
    route.indexOf("function validateEditListing("),
  );
  for (const field of [
    "categoryId",
    "subcategoryId",
    "governorateId",
    "title",
    "description",
    "price",
    "priceType",
    "condition",
    "districtAr",
    "contactName",
    "contactOptions",
    "details",
  ]) {
    assert.match(patchBuilder, new RegExp(`patch\\.${field}`));
  }
  assert.match(patchBuilder, /current\.title !== initial\.title/);
  assert.match(patchBuilder, /patch\.contactName = current\.contactName \|\| null/);
  assert.match(patchBuilder, /delete details\.phone/);
  assert.match(patchBuilder, /delete details\.whatsapp/);
  assert.match(route, /No changes to save\./);
});

test("taxonomy and governed attributes are persisted only when changed", () => {
  const persistence = route.slice(
    route.indexOf("async function persistCapturedChanges("),
    route.indexOf("const handleSave"),
  );
  assert.match(persistence, /const capturedTaxonomyNodeId = captured\.taxonomyNodeId/);
  assert.match(persistence, /taxonomyAssignmentRequiredRef\.current/);
  assert.match(persistence, /capturedTaxonomyNodeId === taxonomyNodeIdRef\.current/);
  assert.match(persistence, /if \(taxonomyChanged\)/);
  assert.match(persistence, /assignOwnerListingTaxonomy\(/);
  assert.match(persistence, /taxonomyResult\.error\.code !== "schema_missing"/);
  assert.match(persistence, /const attributesChanged =/);
  assert.match(persistence, /replaceOwnerListingAttributes\(/);
  assert.match(persistence, /hasChangedFields \|\| taxonomyChanged \|\| attributesChanged/);
});

test("save is non-submitting and resubmit runs save, taxonomy, then review", () => {
  const save = route.slice(route.indexOf("const handleSave"), route.indexOf("const handleResubmit"));
  const resubmit = route.slice(
    route.indexOf("const handleResubmit"),
    route.indexOf("const handleDelete"),
  );
  assert.doesNotMatch(save, /submitOwnerListingForReview\(/);
  assert.match(resubmit, /persistCapturedChanges\(/);
  assert.match(resubmit, /submitOwnerListingForReview\(/);
  assert.ok(
    resubmit.indexOf("persistCapturedChanges(") < resubmit.indexOf("submitOwnerListingForReview("),
  );
  assert.match(route, /const changed = hasChangedFields \|\| taxonomyChanged \|\| attributesChanged/);
});

test("textual persistence leaves image mutation to dedicated image controls", () => {
  const textualPersistence = route.slice(
    route.indexOf("async function persistCapturedChanges("),
    route.indexOf("const handleDelete"),
  );
  assert.doesNotMatch(
    textualPersistence,
    /deleteListingImage\(|reorderListingImages\(|uploadListingImage\(/,
  );
  assert.match(route, /imagesRef\.current = previous/);
  assert.match(route, /MAX_IMAGES - images\.length - current\.length/);
});

test("the permanent read-only contract is wired into the quality gate", () => {
  assert.match(workflow, /name: Edit Listing Preservation Contract/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(workflow, /node --test scripts\/edit-listing-preservation\.test\.mjs/);
  assert.match(qualityGate, /name: Edit Listing Preservation contract/);
  assert.match(qualityGate, /run: node --test scripts\/edit-listing-preservation\.test\.mjs/);
  assert.equal(
    migrations.some((name) => /phase.?6|edit.?listing.?preservation/i.test(name)),
    false,
  );
});
