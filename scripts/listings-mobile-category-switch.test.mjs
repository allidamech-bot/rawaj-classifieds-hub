import assert from "node:assert/strict";
import test from "node:test";

import { buildListingsMobileApplySearch } from "../src/features/listings/listings-filters.ts";

const baseInputs = {
  searchTaxonomy: undefined,
  draftCategoryId: undefined,
  subcategoryId: "",
  govId: "",
  districtAr: "",
  parsedPriceMin: undefined,
  parsedPriceMax: undefined,
  carMake: "",
  carModel: "",
  fuelType: "",
  transmission: "",
  fieldKind: "general",
  propertyPurpose: "",
  propertyType: "",
  rooms: "",
  rentalDuration: "",
  electronicsBrand: "",
  detailCondition: "",
  employmentType: "",
  salaryType: "",
  debouncedQ: "",
  sort: "latest",
};

test("preserves a deep taxonomy selection when the mobile category choice is untouched", () => {
  const search = buildListingsMobileApplySearch({
    ...baseInputs,
    searchTaxonomy: "taxonomy-apartment-sale",
    govId: "damascus",
  });

  assert.equal(search.taxonomy, "taxonomy-apartment-sale");
  assert.equal(search.category, undefined);
  assert.equal(search.gov, "damascus");
});

test("drops the old taxonomy when the user selects a concrete category in mobile filters", () => {
  const search = buildListingsMobileApplySearch({
    ...baseInputs,
    searchTaxonomy: "taxonomy-apartment-sale",
    draftCategoryId: "vehicles",
    subcategoryId: "cars",
    fieldKind: "vehicles",
    carMake: "Toyota",
    transmission: "automatic",
  });

  assert.equal(search.taxonomy, undefined);
  assert.equal(search.category, "vehicles");
  assert.equal(search.subcategory, "cars");
  assert.equal(search.car_make, "Toyota");
  assert.equal(search.transmission, "automatic");
});

test("keeps category-specific fields scoped to the newly selected category mode", () => {
  const search = buildListingsMobileApplySearch({
    ...baseInputs,
    searchTaxonomy: "taxonomy-apartment-sale",
    draftCategoryId: "real-estate",
    fieldKind: "real_estate",
    propertyPurpose: "rent",
    propertyType: "apartment",
    rooms: "3",
    carMake: "Toyota",
  });

  assert.equal(search.taxonomy, undefined);
  assert.equal(search.category, "real-estate");
  assert.equal(search.property_purpose, "rent");
  assert.equal(search.property_type, "apartment");
  assert.equal(search.rooms, 3);
  assert.equal(search.car_make, undefined);
});
