import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [attributesClient, ruleEngine, component, publicApi] = await Promise.all([
  readFile(new URL("../src/lib/api/listing-attributes.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/lib/dynamic-listing-fields.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../src/features/listing-studio/DynamicListingFields.tsx", import.meta.url),
    "utf8",
  ),
  readFile(new URL("../src/lib/classifieds-api.ts", import.meta.url), "utf8"),
]);

test("attribute client uses only governed stale-safe RPCs", () => {
  assert.match(attributesClient, /rawaj_listing_attribute_completeness_v1/);
  assert.match(attributesClient, /rawaj_owner_replace_listing_attributes_v1/);
  assert.match(attributesClient, /p_expected_updated_at: cleanExpectedUpdatedAt/);
  assert.doesNotMatch(attributesClient, /\.from\("listing_attribute_values"\)/);
  assert.match(attributesClient, /stale_owner_update/);
  assert.match(attributesClient, /listing_attributes_incomplete/);
});

test("attribute client parses completeness and missing required metadata", () => {
  for (const name of [
    "MissingListingAttribute",
    "ListingAttributeCompleteness",
    "ListingAttributeWriteResult",
  ]) {
    assert.match(attributesClient, new RegExp(`export interface ${name}`));
  }
  assert.match(attributesClient, /missingRequiredFields: records\(payload\.missingRequiredFields\)/);
  assert.match(attributesClient, /fieldKey/);
  assert.match(attributesClient, /filledRequiredCount/);
});

test("rule engine supports every governed conditional operator and effect", () => {
  for (const operator of [
    "equals",
    "not_equals",
    "in",
    "not_in",
    "is_true",
    "is_false",
    "is_empty",
    "is_not_empty",
  ]) {
    assert.match(ruleEngine, new RegExp(`case "${operator}"`));
  }
  for (const effect of ["show", "hide", "require", "optional", "clear"]) {
    assert.match(ruleEngine, new RegExp(`case "${effect}"`));
  }
});

test("rule engine normalizes typed JSON and never submits hidden or unknown fields", () => {
  assert.match(ruleEngine, /sanitizeDynamicListingValues/);
  assert.match(ruleEngine, /const allowedKeys = new Set\(schema\.fields\.map/);
  assert.match(ruleEngine, /if \(state\?\.clearWhenHidden \|\| state\?\.visible === false\) continue/);
  assert.match(ruleEngine, /case "integer"/);
  assert.match(ruleEngine, /case "numeric"/);
  assert.match(ruleEngine, /case "boolean"/);
  assert.match(ruleEngine, /case "multi_select"/);
  assert.match(ruleEngine, /normalizedAttributes/);
});

test("rule engine validates required, numeric, text, and option constraints", () => {
  assert.match(ruleEngine, /state\.required && isEmptyDynamicValue/);
  assert.match(ruleEngine, /minLength/);
  assert.match(ruleEngine, /maxLength/);
  assert.match(ruleEngine, /minimum/);
  assert.match(ruleEngine, /maximum/);
  assert.match(ruleEngine, /field\.options\.some\(\(option\) => option\.key === textValue\)/);
});

test("dynamic component renders all supported field families", () => {
  assert.match(component, /field\.fieldType === "textarea"/);
  assert.match(component, /\["integer", "numeric", "year"\]/);
  assert.match(component, /field\.fieldType === "boolean"/);
  assert.match(component, /field\.fieldType === "date"/);
  assert.match(component, /field\.fieldType === "location"/);
  assert.match(component, /field\.fieldType === "multi_select"/);
  assert.match(component, /field\.fieldType === "single_select"/);
  assert.match(component, /field\.fieldType === "reference"/);
  assert.match(component, /CanonicalLocationSelector/);
});

test("vehicle fields use controlled dependent metadata and clear descendants", () => {
  assert.match(component, /fetchVehicleMakes/);
  assert.match(component, /fetchVehicleModels\(vehicleMakeId/);
  assert.match(component, /fetchVehicleModelChildren\(vehicleModelId/);
  assert.match(component, /delete next\.vehicle_model/);
  assert.match(component, /delete next\.vehicle_generation/);
  assert.match(component, /delete next\.vehicle_trim/);
  assert.match(component, /vehicle_models_by_make/);
  assert.match(component, /vehicle_generations_by_model/);
  assert.match(component, /vehicle_trims_by_model/);
});

test("dynamic controls expose accessible errors and preserve bilingual labels", () => {
  assert.match(component, /aria-invalid/);
  assert.match(component, /aria-describedby/);
  assert.match(component, /data-first-invalid/);
  assert.match(component, /fieldLabel\(field, language\)/);
  assert.match(component, /option\.labelEn \|\| option\.labelAr/);
});

test("central API exports metadata and governed attribute clients", () => {
  assert.match(publicApi, /export \* from "@\/lib\/api\/listing-attributes"/);
  assert.match(publicApi, /export \* from "@\/lib\/api\/taxonomy-metadata"/);
});
