import type { ListingsSearch, ListingsSort, ListingsView } from "./listings-search-schema";
import type { CategoryFieldKind } from "@/lib/category-fields";

export interface ListingFilterInputs {
  taxonomyFilterScope?: {
    taxonomyNodeIds: string[];
    legacyScopes: Array<{
      categoryId: string;
      subcategoryId?: string;
      propertyPurpose?: string;
      propertyType?: string;
    }>;
  };
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
  priceType?: "fixed" | "negotiable" | "contact" | "free";
  globalCondition?: string;
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
  withPhotos: boolean;
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
  price_type?: "fixed" | "negotiable" | "contact" | "free";
  condition?: string;
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
  view?: ListingsView;
  with_photos?: boolean;
}

export function buildListingFilters(inputs: ListingFilterInputs) {
  const {
    selectedCategoryId,
    taxonomyFilterScope,
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
    priceType,
    globalCondition,
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
    withPhotos,
    debouncedQ,
    sort,
  } = inputs;
  return {
    taxonomyNodeIds: taxonomyFilterScope?.taxonomyNodeIds,
    taxonomyLegacyScopes: taxonomyFilterScope?.legacyScopes,
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
    priceType,
    condition: globalCondition || undefined,
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
    withPhotos: withPhotos || undefined,
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
  priceType?: "fixed" | "negotiable" | "contact" | "free";
  globalCondition?: string;
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
  withPhotos: boolean;
  debouncedQ: string;
  sort: ListingsSort;
  view: ListingsView;
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
    priceType,
    globalCondition,
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
    withPhotos,
    debouncedQ,
    sort,
    view,
  } = inputs;

  const canonicalLocation = districtAr.startsWith("@") ? districtAr.slice(1) : undefined;

  return {
    taxonomy: selectedTaxonomyNodeId,
    category: selectedCategoryId,
    subcategory:
      !taxonomyListingSearch?.taxonomyLegacySubcategoryId && !subcategoryId
        ? undefined
        : subcategoryId || undefined,
    gov: canonicalLocation ? undefined : govId || undefined,
    location: canonicalLocation,
    district: canonicalLocation ? undefined : districtAr || undefined,
    price_min: parsedPriceMin,
    price_max: parsedPriceMax,
    price_type: priceType,
    condition: globalCondition || undefined,
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
    with_photos: withPhotos || undefined,
    q: debouncedQ || undefined,
    sort: sort === "latest" ? undefined : sort,
    view: view === "grid" ? undefined : view,
  };
}

export interface ListingsCategoryNavigationInputs {
  categoryId?: string;
  govId: string;
  districtAr: string;
  query: string;
  sort: ListingsSort;
  view?: ListingsView;
  withPhotos?: boolean;
}

export function buildListingsCategoryNavigationSearch(
  inputs: ListingsCategoryNavigationInputs,
): ListingsUrlSearch {
  const { categoryId, govId, districtAr, query, sort, view, withPhotos } = inputs;
  const canonicalLocation = districtAr.startsWith("@") ? districtAr.slice(1) : undefined;

  return {
    category: categoryId,
    gov: canonicalLocation ? undefined : govId || undefined,
    location: canonicalLocation,
    district: canonicalLocation ? undefined : districtAr || undefined,
    q: query.trim() || undefined,
    sort: sort === "latest" ? undefined : sort,
    view: view === "grid" ? undefined : view,
    with_photos: withPhotos || undefined,
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
  view: ListingsView;
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
    view,
  } = inputs;

  return {
    taxonomy: selectedTaxonomyNodeId,
    category: searchTaxonomy ? searchCategory : undefined,
    subcategory: searchTaxonomy ? undefined : searchSubcategory,
    property_purpose: taxonomyPropertyPurpose,
    property_type: taxonomyPropertyType,
    sort: sort === "latest" ? undefined : sort,
    view: view === "grid" ? undefined : view,
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
  priceType?: "fixed" | "negotiable" | "contact" | "free";
  globalCondition?: string;
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
  withPhotos: boolean;
  debouncedQ: string;
  sort: ListingsSort;
  view: ListingsView;
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
    priceType,
    globalCondition,
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
    withPhotos,
    debouncedQ,
    sort,
    view,
  } = inputs;
  const preserveTaxonomy = Boolean(searchTaxonomy && draftCategoryId === undefined);
  const explicitAllCategories = draftCategoryId === "";
  const hasConcreteCategory = Boolean(draftCategoryId);
  const canonicalLocation = districtAr.startsWith("@") ? districtAr.slice(1) : undefined;

  return {
    taxonomy: preserveTaxonomy ? searchTaxonomy : undefined,
    category: preserveTaxonomy ? undefined : draftCategoryId || undefined,
    subcategory: preserveTaxonomy || explicitAllCategories ? undefined : subcategoryId || undefined,
    gov: canonicalLocation ? undefined : govId || undefined,
    location: canonicalLocation,
    district: canonicalLocation ? undefined : districtAr || undefined,
    price_min: parsedPriceMin,
    price_max: parsedPriceMax,
    price_type: priceType,
    condition: globalCondition || undefined,
    car_make: hasConcreteCategory && fieldKind === "vehicles" ? carMake || undefined : undefined,
    car_model: hasConcreteCategory && fieldKind === "vehicles" ? carModel || undefined : undefined,
    fuel: hasConcreteCategory && fieldKind === "vehicles" ? fuelType || undefined : undefined,
    transmission:
      hasConcreteCategory && fieldKind === "vehicles" ? transmission || undefined : undefined,
    property_purpose:
      hasConcreteCategory && fieldKind === "real_estate" ? propertyPurpose || undefined : undefined,
    property_type:
      hasConcreteCategory && fieldKind === "real_estate" ? propertyType || undefined : undefined,
    rooms:
      hasConcreteCategory && fieldKind === "real_estate"
        ? rooms.trim()
          ? Number(rooms)
          : undefined
        : undefined,
    rental_duration:
      hasConcreteCategory && fieldKind === "real_estate" ? rentalDuration || undefined : undefined,
    electronics_brand:
      hasConcreteCategory && fieldKind === "electronics"
        ? electronicsBrand || undefined
        : undefined,
    detail_condition:
      hasConcreteCategory && fieldKind === "electronics" ? detailCondition || undefined : undefined,
    employment_type:
      hasConcreteCategory && fieldKind === "jobs" ? employmentType || undefined : undefined,
    salary_type: hasConcreteCategory && fieldKind === "jobs" ? salaryType || undefined : undefined,
    with_photos: withPhotos || undefined,
    q: debouncedQ || undefined,
    sort: sort === "latest" ? undefined : sort,
    view: view === "grid" ? undefined : view,
  };
}
