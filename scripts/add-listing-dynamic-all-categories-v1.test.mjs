import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../src/routes/add-listing.tsx", import.meta.url), "utf8");

test("published leaf schemas drive the listing form for every category", () => {
  assert.match(route, /fetchPublishedLeafSchema\(taxonomyNodeId\)/);
  assert.match(route, /dynamicSchema\.leaf\?\.id === taxonomyNodeId/);
  assert.match(route, /displaySurfaces\.includes\("listing_studio"\)/);
  assert.match(route, /<DynamicListingFields/);
  assert.doesNotMatch(route, /categoryFieldKind === "vehicles"[\s\S]{0,300}<DynamicListingFields/);
});

test("legacy category fields remain a non-blocking compatibility fallback", () => {
  assert.match(route, /result\.error\.code !== "schema_missing"/);
  assert.match(route, /dynamicSchemaLoading \? \(/);
  assert.match(route, /dynamicSchemaActive && dynamicSchema \? \(/);
  assert.match(route, /<CategorySpecificFields/);
  assert.match(route, /تم تشغيل النموذج المتوافق مؤقتاً/);
});

test("generic validation and review replace hard-coded category validation", () => {
  assert.match(route, /validateDynamicListingFields\(dynamicSchema, dynamicValues, language\)/);
  assert.match(route, /Object\.assign\(errors\.fields, dynamicErrors\.fields\)/);
  assert.match(route, /dynamicFieldReviewRows\(dynamicSchema, dynamicValues, language\)/);
  assert.match(route, /categoryFieldKind: dynamicSchemaActive \? "general" : categoryFieldKind/);
  assert.match(route, /categoryDetails: dynamicSchemaActive \? \{\} : categoryDetails/);
});

test("autosave writes normalized governed attributes with the latest draft version", () => {
  assert.match(route, /normalizeDynamicAttributesForWrite\(dynamicSchema, dynamicValues\)/);
  assert.match(route, /attributes: dynamicSchemaActive \? normalizedDynamicAttributes : null/);
  assert.match(route, /replaceOwnerListingAttributes\(\s*profileId,\s*persistedDraft\.id,\s*persistedDraft\.updatedAt,\s*normalizedDynamicAttributes/);
  assert.match(route, /updatedAt: attributeResult\.data\.updatedAt/);
  assert.match(route, /!dynamicSchemaLoading &&\s*taxonomySelectionReady/);
});

test("submission persists attributes before the guarded review RPC", () => {
  const submitStart = route.indexOf("async function submitListing");
  const writeIndex = route.indexOf("const attributeResult = await replaceOwnerListingAttributes(", submitStart);
  const reviewIndex = route.indexOf("submitOwnerListingForReview", writeIndex);
  assert.ok(writeIndex > submitStart);
  assert.ok(reviewIndex > writeIndex);
  assert.match(route, /attributeResult\.data\.completeness\.complete/);
  assert.match(route, /missingRequiredFields/);
});

test("governed values are not copied into legacy details JSON", () => {
  assert.match(route, /const details = dynamicSchemaActive\s*\? compatibilityDetails\s*: mergeCategoryDetails/);
  assert.doesNotMatch(route, /mergeCategoryDetails\([^)]*dynamicValues/);
  assert.doesNotMatch(route, /details:\s*normalizedDynamicAttributes/);
});

test("listing condition remains synchronized for every leaf that defines it", () => {
  assert.match(route, /field\.key === "listing_condition"/);
  assert.match(route, /dynamicSchemaUsesListingCondition/);
  assert.match(route, /dynamicListingCondition\(nextValues\.listing_condition\)/);
  assert.match(route, /!dynamicSchemaUsesListingCondition &&\s*condition !== "not_applicable"/);
});

test("schema loading and taxonomy changes reject stale work", () => {
  assert.match(route, /dynamicSchemaRequestIdRef/);
  assert.match(route, /requestId !== dynamicSchemaRequestIdRef\.current/);
  assert.match(route, /setDynamicSchema\(null\)/);
  assert.match(route, /setDynamicValues\(\{\}\)/);
  assert.match(route, /taxonomyNodeIdRef\.current === taxonomyNodeId/);
});
