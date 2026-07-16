import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [route, fields, workflow, qualityGate] = await Promise.all([
  readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/category-fields.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../.github/workflows/add-listing-taxonomy-architecture.yml", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../.github/workflows/quality-gate.yml", import.meta.url), "utf8"),
]);

test("taxonomy field schemas resolve explicitly before the legacy detector", () => {
  assert.match(fields, /export function resolveCategoryFieldKind\(/);
  const resolver = fields.slice(
    fields.indexOf("export function resolveCategoryFieldKind("),
    fields.indexOf("export function categoryUsesGlobalCondition("),
  );
  const filterSchema = resolver.indexOf("taxonomyNode?.filterSchemaKey");
  const classification = resolver.indexOf("taxonomyNode?.classificationKey");
  const legacyCategory = resolver.indexOf("taxonomyNode?.legacyCategoryId");
  const legacyDetector = resolver.indexOf("return detectCategoryFieldKind(category, listing)");
  assert.ok(filterSchema >= 0);
  assert.ok(classification > filterSchema);
  assert.ok(legacyCategory > classification);
  assert.ok(legacyDetector > legacyCategory);
  for (const alias of [
    "realestate",
    "property",
    "properties",
    "vehicle",
    "automotive",
    "car",
    "cars",
    "job",
    "employment",
    "service",
    "electronic",
    "phones",
    "mobiles",
  ]) {
    assert.match(fields, new RegExp(`\\b${alias}:`));
  }
});

test("add listing derives its form from the selected canonical taxonomy node", () => {
  assert.match(route, /resolveCategoryFieldKind\(selectedTaxonomyNode, category\)/);
  assert.match(route, /handleTaxonomySelection\(node: TaxonomyNode, path: TaxonomyNode\[\]\)/);
  assert.match(route, /setCategoryId\(nextCategoryId\)/);
  assert.match(route, /setSubcategoryId\(search\.taxonomyLegacySubcategoryId \?\? ""\)/);
  assert.match(route, /sanitizeCategoryDetails\(nextKind, current\)/);
});

test("the fourth step is a dedicated, fully validated review step", () => {
  assert.match(route, /text\("مراجعة وإرسال", "Review and submit"\)/);
  assert.match(route, /step === 3 && \(/);
  assert.match(route, /"راجع الإعلان قبل الإرسال", "Review before submitting"/);
  assert.doesNotMatch(route, /"مراجعة سريعة", "Quick review"/);
  assert.match(route, /const canSubmit = step === 3/);
  assert.match(route, /step !== 3 \|\| !validateCurrentStep\(3\)/);
  assert.match(route, /nextStep === 3 \? 3 : step/);
  assert.match(route, /if \(nextStep > step\)/);
});

test("canonical taxonomy validation requires a selected leaf when the schema is available", () => {
  assert.match(route, /if \(taxonomyNodesLength > 0\)/);
  assert.match(route, /if \(!taxonomyNodeId\)/);
  assert.match(route, /else if \(!selectedTaxonomyNodeIsLeaf\)/);
  assert.match(route, /taxonomySelectionReady/);
  assert.match(route, /taxonomyNodes\.length > 0 \? Boolean\(selectedTaxonomyNode\?\.isLeaf\)/);
});

test("condition and precise location rules are category-aware", () => {
  assert.match(fields, /export function categoryUsesGlobalCondition\(/);
  assert.match(fields, /kind === "vehicles" \|\| kind === "electronics" \|\| kind === "general"/);
  assert.match(fields, /export function categoryRequiresPreciseLocation\(/);
  assert.match(fields, /kind !== "jobs" && kind !== "services"/);
  assert.match(route, /showGlobalCondition && \(/);
  assert.match(route, /setCondition\("not_applicable"\)/);
  assert.match(route, /categoryRequiresPreciseLocation\(categoryFieldKind\)/);
  assert.match(route, /!preciseLocationSelected/);
});

test("success actions stay on the owner listing surface", () => {
  assert.match(route, /to: "\/profile\/listings\/\$id"/);
  assert.match(route, /text\("إدارة الإعلان", "Manage listing"\)/);
  assert.doesNotMatch(
    route,
    /navigate\(\{\s*to: "\/listings\/\$id",\s*params: \{ id: createdListingId \}/,
  );
});

test("autosave and final submission persist and assign the same taxonomy context", () => {
  assert.ok((route.match(/_taxonomy_node_id/g) ?? []).length >= 2);
  const submitStart = route.indexOf("async function submitListing()");
  const autosave = route.slice(0, submitStart);
  const submission = route.slice(submitStart);
  assert.match(autosave, /assignOwnerListingTaxonomy\(/);
  assert.match(submission, /assignOwnerListingTaxonomy\(/);
  assert.match(autosave, /taxonomyNodeIdRef\.current === taxonomyNodeId/);
  assert.match(submission, /canonicalTaxonomyNodeId/);
});

test("permanent workflows run the read-only architecture contract", async () => {
  assert.match(workflow, /name: Add Listing Taxonomy Architecture Contract/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:/);
  assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /contents: write/);
  assert.match(workflow, /node --test scripts\/add-listing-taxonomy-architecture\.test\.mjs/);
  assert.match(qualityGate, /name: Add Listing Taxonomy Architecture contract/);
  assert.match(
    qualityGate,
    /run: node --test scripts\/add-listing-taxonomy-architecture\.test\.mjs/,
  );
  await assert.rejects(access(new URL("../.github/workflows/phase5-apply.yml", import.meta.url)));
});
