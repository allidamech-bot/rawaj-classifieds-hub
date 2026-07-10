import assert from "node:assert/strict";
import test from "node:test";

import {
  buildListingFilters,
  buildListingsMobileApplySearch,
  buildListingsSyncSearch,
} from "../src/features/listings/listings-filters.ts";

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

const listingFilterInputs = {
  selectedCategoryId: undefined,
  effectiveSubcategoryId: "",
  taxonomyListingSearch: undefined,
  taxonomyOwnsPropertyPurpose: false,
  taxonomyOwnsPropertyType: false,
  propertyPurpose: "",
  propertyType: "",
  govId: "",
  districtAr: "",
  parsedPriceMin: undefined,
  parsedPriceMax: undefined,
  carMake: "",
  carModel: "",
  fuelType: "",
  transmission: "",
  rooms: "",
  rentalDuration: "",
  electronicsBrand: "",
  detailCondition: "",
  employmentType: "",
  salaryType: "",
  debouncedQ: "",
  sort: "latest",
};

const syncSearchInputs = {
  selectedTaxonomyNodeId: undefined,
  selectedCategoryId: undefined,
  subcategoryId: "",
  taxonomyListingSearch: undefined,
  taxonomyOwnsPropertyPurpose: false,
  taxonomyOwnsPropertyPurposeValue: undefined,
  propertyPurpose: "",
  taxonomyOwnsPropertyType: false,
  taxonomyOwnsPropertyTypeValue: undefined,
  propertyType: "",
  govId: "",
  districtAr: "",
  parsedPriceMin: undefined,
  parsedPriceMax: undefined,
  carMake: "",
  carModel: "",
  fuelType: "",
  transmission: "",
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

test("clears deep taxonomy and stale category state when all categories is explicit", () => {
  const search = buildListingsMobileApplySearch({
    ...baseInputs,
    searchTaxonomy: "taxonomy-apartment-sale",
    draftCategoryId: "",
    subcategoryId: "stale-subcategory",
    fieldKind: "vehicles",
    carMake: "Toyota",
  });

  assert.equal(search.taxonomy, undefined);
  assert.equal(search.category, undefined);
  assert.equal(search.subcategory, undefined);
  assert.equal(search.car_make, undefined);
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

test("canonical location suppresses a stale governorate in listing fetch filters", () => {
  const filters = buildListingFilters({
    ...listingFilterInputs,
    govId: "old-governorate",
    districtAr: "@123e4567-e89b-12d3-a456-426614174000",
  });

  assert.equal(filters.governorateId, undefined);
  assert.equal(filters.districtAr, "@123e4567-e89b-12d3-a456-426614174000");
});

test("canonical location removes stale governorate from synchronized URL search", () => {
  const search = buildListingsSyncSearch({
    ...syncSearchInputs,
    govId: "old-governorate",
    districtAr: "@123e4567-e89b-12d3-a456-426614174000",
  });

  assert.equal(search.gov, undefined);
  assert.equal(search.location, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(search.district, undefined);
});

test("mobile apply keeps canonical location authoritative over a stale governorate", () => {
  const search = buildListingsMobileApplySearch({
    ...baseInputs,
    govId: "old-governorate",
    districtAr: "@123e4567-e89b-12d3-a456-426614174000",
  });

  assert.equal(search.gov, undefined);
  assert.equal(search.location, "123e4567-e89b-12d3-a456-426614174000");
  assert.equal(search.district, undefined);
});

test("legacy district filters continue to retain their governorate", () => {
  const search = buildListingsMobileApplySearch({
    ...baseInputs,
    govId: "damascus",
    districtAr: "المزة",
  });

  assert.equal(search.gov, "damascus");
  assert.equal(search.location, undefined);
  assert.equal(search.district, "المزة");
});
