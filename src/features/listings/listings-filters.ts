import type { ListingsSearch, ListingsSort } from "./listings-search-schema";
import type { CategoryFieldKind } from "@/lib/category-fields";

export interface ListingFilterInputs {
  selectedCategoryId?: string;
  effectiveSubcategoryId: string;
  taxonomyListingSearch?: {
    taxonomyLegacySubcategoryId?: string;
    property_purpose?: string;
    property_type?: string;
  } | null;
  taxonomyOwnsPropertyPurpose: boolean;
  taxonomyOwnsPropertyType: boolean;
  propertyPurpose: string;
  propertyType: string;
  govId: string;
  districtAr: string;
  parsedPriceMin?: number;
  parsedPriceMax?: number;
  carMake: string;
  carModel: string;
  fuelType: string;
  transmission: string;
  rooms: string;
  rentalDuration: string;
  electronicsBrand: string;
  detailCondition: string;
  employmentType: string;
  salaryType: string;
  debouncedQ: string;
  sort: ListingsSort;
}

export interface ListingsUrlSearch {
  taxonomy?: string;
  category?: string;
  subcategory?: string;
  gov?: string;
  district?: string;
  location?: string;
  price_min?: number;
  price_max?: number;
  car_make?: string;
  car_model?: string;
  fuel?: string;
  transmission?: string;
  property_purpose?: string;
  property_type?: string;
  rooms?: number;
  rental_duration?: string;
  electronics_brand?: string;
  detail_condition?: string;
  employment_type?: string;
  salary_type?: string;
  q?: string;
  sort?: ListingsSort;
}

export function buildListingFilters(inputs: ListingFilterInputs) {
  const {
    selectedCategoryId,
    effectiveSubcategoryId,
    taxonomyListingSearch,
    taxonomyOwnsPropertyPurpose,
    taxonomyOwnsPropertyType,
    propertyPurpose,
    propertyType,
    govId,
    districtAr,
    parsedPriceMin,
    parsedPriceMax,
    carMake,
    carModel,
    fuelType,
    transmission,
    rooms,
    rentalDuration,
    electronicsBrand,
    detailCondition,
    employmentType,
    salaryType,
    debouncedQ,
    sort,
  } = inputs;

  return {
    categoryId: selectedCategoryId,
    subcategoryId: effectiveSubcategoryId || undefined,
    taxonomyLegacySubcategoryId: taxonomyListingSearch?.taxonomyLegacySubcategoryId,
    taxonomyPropertyPurpose: taxonomyOwnsPropertyPurpose
      ? taxonomyListingSearch?.property_purpose
      : undefined,
    taxonomyPropertyType: taxonomyOwnsPropertyType
      ? taxonomyListingSearch?.property_type
      : undefined,
    governorateId: govId || undefined,
    districtAr: districtAr || undefined,
    priceMin: Number.isFinite(parsedPriceMin) ? parsedPriceMin : undefined,
    priceMax: Number.isFinite(parsedPriceMax) ? parsedPriceMax : undefined,
    carMake: carMake || undefined,
    carModel: carModel || undefined,
    fuelType: fuelType || undefined,
    transmission: transmission || undefined,
    propertyPurpose: taxonomyOwnsPropertyPurpose ? undefined : propertyPurpose || undefined,
    propertyType: taxonomyOwnsPropertyType ? undefined : propertyType || undefined,
    rooms: rooms.trim() ? Number(rooms) : undefined,
    rentalDuration: rentalDuration || undefined,
    electronicsBrand: electronicsBrand || undefined,
    detailCondition: detailCondition || undefined,
    employmentType: employmentType || undefined,
    salaryType: salaryType || undefined,
    query: debouncedQ,
    sort,
  };
}

export interface ListingsSyncSearchInputs {
  selectedTaxonomyNodeId?: string;
  selectedCategoryId?: string;
  subcategoryId: string;
  taxonomyListingSearch?: {
    taxonomyLegacySubcategoryId?: string;
    property_purpose?: string;
    property_type?: string;
  } | null;
  taxonomyOwnsPropertyPurpose: boolean;
  taxonomyOwnsPropertyPurposeValue?: string;
  propertyPurpose: string;
  taxonomyOwnsPropertyType: boolean;
  taxonomyOwnsPropertyTypeValue?: string;
  propertyType: string;
  govId: string;
  districtAr: string;
  parsedPriceMin?: number;
  parsedPriceMax?: number;
  carMake: string;
  carModel: string;
  fuelType: string;
  transmission: string;
  rooms: string;
  rentalDuration: string;
  electronicsBrand: string;
  detailCondition: string;
  employmentType: string;
  salaryType: string;
  debouncedQ: string;
  sort: ListingsSort;
}

export function buildListingsSyncSearch(inputs: ListingsSyncSearchInputs): ListingsUrlSearch {
  const {
    selectedTaxonomyNodeId,
    selectedCategoryId,
    subcategoryId,
    taxonomyListingSearch,
    taxonomyOwnsPropertyPurpose,
    taxonomyOwnsPropertyPurposeValue,
    propertyPurpose,
    taxonomyOwnsPropertyType,
    taxonomyOwnsPropertyTypeValue,
    propertyType,
    govId,
    districtAr,
    parsedPriceMin,
    parsedPriceMax,
    carMake,
    carModel,
    fuelType,
    transmission,
    rooms,
    rentalDuration,
    electronicsBrand,
    detailCondition,
    employmentType,
    salaryType,
    debouncedQ,
    sort,
  } = inputs;

  const canonicalLocation = districtAr.startsWith("@") ? districtAr.slice(1) : undefined;

  return {
    taxonomy: selectedTaxonomyNodeId,
    category: selectedCategoryId,
    subcategory:
      !taxonomyListingSearch?.taxonomyLegacySubcategoryId && !subcategoryId
        ? undefined
        : subcategoryId || undefined,
    gov: govId || undefined,
    location: canonicalLocation,
    district: canonicalLocation ? undefined : districtAr || undefined,
    price_min: parsedPriceMin,
    price_max: parsedPriceMax,
    car_make: carMake || undefined,
    car_model: carModel || undefined,
    fuel: fuelType || undefined,
    transmission: transmission || undefined,
    property_purpose: taxonomyOwnsPropertyPurpose
      ? taxonomyOwnsPropertyPurposeValue
      : propertyPurpose || undefined,
    property_type: taxonomyOwnsPropertyType
      ? taxonomyOwnsPropertyTypeValue
      : propertyType || undefined,
    rooms: rooms.trim() ? Number(rooms) : undefined,
    rental_duration: rentalDuration || undefined,
    electronics_brand: electronicsBrand || undefined,
    detail_condition: detailCondition || undefined,
    employment_type: employmentType || undefined,
    salary_type: salaryType || undefined,
    q: debouncedQ || undefined,
    sort: sort === "latest" ? undefined : sort,
  };
}

export interface ListingsResetSearchInputs {
  selectedTaxonomyNodeId?: string;
  searchTaxonomy?: string;
  searchCategory?: string;
  searchSubcategory?: string;
  taxonomyPropertyPurpose?: string;
  taxonomyPropertyType?: string;
  sort: ListingsSort;
}

export function buildListingsResetSearch(inputs: ListingsResetSearchInputs): ListingsUrlSearch {
  const {
    selectedTaxonomyNodeId,
    searchTaxonomy,
    searchCategory,
    searchSubcategory,
    taxonomyPropertyPurpose,
    taxonomyPropertyType,
    sort,
  } = inputs;

  return {
    taxonomy: selectedTaxonomyNodeId,
    category: searchTaxonomy ? searchCategory : undefined,
    subcategory: searchTaxonomy ? undefined : searchSubcategory,
    property_purpose: taxonomyPropertyPurpose,
    property_type: taxonomyPropertyType,
    sort: sort === "latest" ? undefined : sort,
  };
}

export interface ListingsMobileApplyInputs {
  searchTaxonomy?: string;
  draftCategoryId?: string;
  subcategoryId: string;
  govId: string;
  districtAr: string;
  parsedPriceMin?: number;
  parsedPriceMax?: number;
  carMake: string;
  carModel: string;
  fuelType: string;
  transmission: string;
  fieldKind: CategoryFieldKind;
  propertyPurpose: string;
  propertyType: string;
  rooms: string;
  rentalDuration: string;
  electronicsBrand: string;
  detailCondition: string;
  employmentType: string;
  salaryType: string;
  debouncedQ: string;
  sort: ListingsSort;
}

export function buildListingsMobileApplySearch(
  inputs: ListingsMobileApplyInputs,
): ListingsUrlSearch {
  const {
    searchTaxonomy,
    draftCategoryId,
    subcategoryId,
    govId,
    districtAr,
    parsedPriceMin,
    parsedPriceMax,
    carMake,
    carModel,
    fuelType,
    transmission,
    fieldKind,
    propertyPurpose,
    propertyType,
    rooms,
    rentalDuration,
    electronicsBrand,
    detailCondition,
    employmentType,
    salaryType,
    debouncedQ,
    sort,
  } = inputs;
  const isTaxonomy = Boolean(searchTaxonomy);
  const canonicalLocation = districtAr.startsWith("@") ? districtAr.slice(1) : undefined;

  return {
    taxonomy: searchTaxonomy,
    category: isTaxonomy ? undefined : draftCategoryId || undefined,
    subcategory: isTaxonomy ? undefined : subcategoryId || undefined,
    gov: govId || undefined,
    location: canonicalLocation,
    district: canonicalLocation ? undefined : districtAr || undefined,
    price_min: parsedPriceMin,
    price_max: parsedPriceMax,
    car_make: !isTaxonomy && fieldKind === "vehicles" ? carMake || undefined : undefined,
    car_model: !isTaxonomy && fieldKind === "vehicles" ? carModel || undefined : undefined,
    fuel: !isTaxonomy && fieldKind === "vehicles" ? fuelType || undefined : undefined,
    transmission: !isTaxonomy && fieldKind === "vehicles" ? transmission || undefined : undefined,
    property_purpose:
      !isTaxonomy && fieldKind === "real_estate" ? propertyPurpose || undefined : undefined,
    property_type:
      !isTaxonomy && fieldKind === "real_estate" ? propertyType || undefined : undefined,
    rooms:
      !isTaxonomy && fieldKind === "real_estate"
        ? rooms.trim()
          ? Number(rooms)
          : undefined
        : undefined,
    rental_duration:
      !isTaxonomy && fieldKind === "real_estate" ? rentalDuration || undefined : undefined,
    electronics_brand:
      !isTaxonomy && fieldKind === "electronics" ? electronicsBrand || undefined : undefined,
    detail_condition:
      !isTaxonomy && fieldKind === "electronics" ? detailCondition || undefined : undefined,
    employment_type: !isTaxonomy && fieldKind === "jobs" ? employmentType || undefined : undefined,
    salary_type: !isTaxonomy && fieldKind === "jobs" ? salaryType || undefined : undefined,
    q: debouncedQ || undefined,
    sort: sort === "latest" ? undefined : sort,
  };
}
