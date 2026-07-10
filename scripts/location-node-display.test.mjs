import assert from "node:assert/strict";
import test from "node:test";

import {
  getLocationNodeOptionLabel,
  getLocationNodeTypeLabel,
} from "../src/lib/location-node-display.ts";

test("labels every canonical location level in Arabic and English", () => {
  assert.equal(getLocationNodeTypeLabel("governorate", "ar"), "محافظة");
  assert.equal(getLocationNodeTypeLabel("district", "ar"), "منطقة");
  assert.equal(getLocationNodeTypeLabel("subdistrict", "ar"), "ناحية");
  assert.equal(getLocationNodeTypeLabel("city", "ar"), "مدينة");
  assert.equal(getLocationNodeTypeLabel("town", "ar"), "بلدة");
  assert.equal(getLocationNodeTypeLabel("village", "ar"), "قرية");
  assert.equal(getLocationNodeTypeLabel("neighborhood", "ar"), "حي");
  assert.equal(getLocationNodeTypeLabel("locality", "ar"), "تجمّع سكاني");
  assert.equal(getLocationNodeTypeLabel("locality", "en"), "Community");
});

test("does not present an unclassified locality as a proven city or village", () => {
  const node = {
    nodeType: "locality",
    nameAr: "تل الذهب",
    nameEn: "Tal Dahab",
  };

  assert.equal(getLocationNodeOptionLabel(node, "ar"), "تل الذهب — تجمّع سكاني");
  assert.equal(getLocationNodeOptionLabel(node, "en"), "Tal Dahab — Community");
});
