import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getLocationLevelOptionLabel,
  getLocationLevelPrompt,
  getLocationNodeOptionLabel,
  getLocationNodeTypeLabel,
} from "../src/lib/location-node-display.ts";
import {
  getLocationNodeSourceSortOrder,
  sortLocationNodesForDisplay,
} from "../src/lib/location-node-order.ts";

const generatorSource = readFileSync(
  new URL("./prepare-syria-ocha-geojson-locations-v2.mjs", import.meta.url),
  "utf8",
);
const selectorSource = readFileSync(
  new URL("../src/features/locations/CanonicalLocationSelector.tsx", import.meta.url),
  "utf8",
);
const locationWriteSource = readFileSync(
  new URL("../src/lib/api/listing-location-write.ts", import.meta.url),
  "utf8",
);
const sortOrderMigration = readFileSync(
  new URL(
    "../supabase/migrations/202607100005_backfill_syria_location_type_sort_order.sql",
    import.meta.url,
  ),
  "utf8",
);

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

test("guides customers through known administrative hierarchy levels", () => {
  assert.equal(getLocationLevelPrompt([{ nodeType: "governorate" }], "ar"), "اختر المحافظة");
  assert.equal(getLocationLevelPrompt([{ nodeType: "district" }], "ar"), "اختر المنطقة");
  assert.equal(getLocationLevelPrompt([{ nodeType: "subdistrict" }], "ar"), "اختر الناحية");
  assert.equal(getLocationLevelPrompt([{ nodeType: "neighborhood" }], "ar"), "اختر الحي");
});

test("uses concise names when a location level has one clear node type", () => {
  const governorates = [
    { nodeType: "governorate", nameAr: "دمشق", nameEn: "Damascus" },
    { nodeType: "governorate", nameAr: "حلب", nameEn: "Aleppo" },
  ];
  const localities = [
    { nodeType: "locality", nameAr: "تل الذهب", nameEn: "Tal Dahab" },
    { nodeType: "locality", nameAr: "عين النور", nameEn: "Ain Al Nour" },
  ];

  assert.equal(getLocationLevelOptionLabel(governorates[0], governorates, "ar"), "دمشق");
  assert.equal(getLocationLevelOptionLabel(localities[0], localities, "ar"), "تل الذهب");
  assert.equal(getLocationLevelOptionLabel(governorates[1], governorates, "en"), "Aleppo");
});

test("keeps type labels when a location level mixes real node types", () => {
  const mixed = [
    { nodeType: "city", nameAr: "مثال المدينة", nameEn: "Example City" },
    { nodeType: "town", nameAr: "مثال البلدة", nameEn: "Example Town" },
  ];

  assert.equal(getLocationLevelOptionLabel(mixed[0], mixed, "ar"), "مثال المدينة — مدينة");
  assert.equal(getLocationLevelOptionLabel(mixed[1], mixed, "en"), "Example Town — Town");
});

test("uses an honest mixed populated-place prompt without inventing classifications", () => {
  const nodes = [
    { nodeType: "city" },
    { nodeType: "town" },
    { nodeType: "village" },
    { nodeType: "locality" },
  ];

  assert.equal(getLocationLevelPrompt(nodes, "ar"), "اختر المدينة أو البلدة أو القرية أو التجمّع");
  assert.equal(getLocationLevelPrompt(nodes, "en"), "Choose city, town, village, or community");
});

test("guards cascading location levels against stale child responses", () => {
  assert.match(selectorSource, /childRequestSequenceRef = useRef\(0\)/);
  assert.match(selectorSource, /requestSequence !== childRequestSequenceRef\.current/);
  assert.match(selectorSource, /childRequestSequenceRef\.current \+= 1/);
});

test("rejects malformed canonical ancestry and legacy districts without a governorate", () => {
  assert.match(locationWriteSource, /if \(visited\.has\(currentId\)\)/);
  assert.match(locationWriteSource, /تسلسل الموقع المحدد غير صالح/);
  assert.match(locationWriteSource, /if \(currentId\)/);
  assert.match(locationWriteSource, /أعمق من الحد المسموح/);
  assert.match(locationWriteSource, /if \(!selectedId \|\| !selectedNameAr\)/);
  assert.match(locationWriteSource, /if \(value && !governorateId\)/);
  assert.match(locationWriteSource, /اختر المحافظة قبل تحديد المنطقة/);
});

test("uses stable type-aware sort weights for source data", () => {
  assert.equal(getLocationNodeSourceSortOrder("country"), 0);
  assert.equal(getLocationNodeSourceSortOrder("governorate"), 100);
  assert.equal(getLocationNodeSourceSortOrder("district"), 200);
  assert.equal(getLocationNodeSourceSortOrder("subdistrict"), 300);
  assert.equal(getLocationNodeSourceSortOrder("city"), 400);
  assert.equal(getLocationNodeSourceSortOrder("town"), 500);
  assert.equal(getLocationNodeSourceSortOrder("village"), 600);
  assert.equal(getLocationNodeSourceSortOrder("neighborhood"), 700);
  assert.equal(getLocationNodeSourceSortOrder("locality"), 800);
});

test("keeps generator and production backfill wired to type-aware ordering", () => {
  assert.match(generatorSource, /sort_order: getLocationNodeSourceSortOrder\(type\)/);
  assert.match(sortOrderMigration, /when 'governorate' then 100/);
  assert.match(sortOrderMigration, /when 'neighborhood' then 700/);
  assert.match(sortOrderMigration, /when 'locality' then 800/);
  assert.match(sortOrderMigration, /and sort_order = 0/);
});

test("respects curated sort order before type and Arabic name fallback", () => {
  const nodes = [
    { id: "village", sortOrder: 0, nodeType: "village", nameAr: "ب" },
    { id: "town", sortOrder: 0, nodeType: "town", nameAr: "ج" },
    { id: "featured", sortOrder: -10, nodeType: "locality", nameAr: "ز" },
    { id: "town-alpha", sortOrder: 0, nodeType: "town", nameAr: "أ" },
  ];

  assert.deepEqual(
    sortLocationNodesForDisplay(nodes).map((node) => node.id),
    ["featured", "town-alpha", "town", "village"],
  );
});
