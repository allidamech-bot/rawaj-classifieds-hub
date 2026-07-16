import { buildListingFilters } from "@/features/listings/listings-filters";
import type { ListingsSearch } from "@/features/listings/listings-search-schema";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicListings,
  fetchPublicSubcategories,
  fetchPublicTaxonomyNodes,
  searchPublicSellers,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedSubcategory,
  ListingCursor,
  PublicSellerSearchResult,
  TaxonomyNode,
} from "@/lib/classifieds-types";
import {
  buildTaxonomyIndex,
  findTaxonomyNode,
  getTaxonomyPath,
  resolveTaxonomyListingSearch,
} from "@/lib/taxonomy";

export interface PublicListingsReferencesData {
  categories: ClassifiedCategory[];
  subcategories: ClassifiedSubcategory[];
  governorates: ClassifiedGovernorate[];
  taxonomyNodes: TaxonomyNode[];
  taxonomyAvailable: boolean;
  error: ClassifiedsError | null;
}

export interface PublicListingsResultsData {
  items: ClassifiedListing[];
  sellerResults: PublicSellerSearchResult[];
  nextCursor: ListingCursor | null;
  error: ClassifiedsError | null;
  sellerSearchError: ClassifiedsError | null;
  filterKey: string | null;
}

export interface PublicListingsPageData {
  references: PublicListingsReferencesData;
  results: PublicListingsResultsData;
}

export async function loadPublicListingsPageData(
  search: ListingsSearch,
): Promise<PublicListingsPageData> {
  const [categoriesResult, subcategoriesResult, governoratesResult, taxonomyResult] =
    await Promise.all([
      fetchPublicCategories(),
      fetchPublicSubcategories(),
      fetchPublicGovernorates(),
      fetchPublicTaxonomyNodes(),
    ]);

  const referenceError = firstReferenceError(
    categoriesResult,
    subcategoriesResult,
    governoratesResult,
    taxonomyResult,
  );
  const references: PublicListingsReferencesData = {
    categories: categoriesResult.ok ? categoriesResult.data : [],
    subcategories: subcategoriesResult.ok ? subcategoriesResult.data : [],
    governorates: governoratesResult.ok ? governoratesResult.data : [],
    taxonomyNodes: taxonomyResult.ok ? taxonomyResult.data : [],
    taxonomyAvailable: taxonomyResult.ok,
    error: referenceError,
  };

  if (referenceError) {
    return {
      references,
      results: emptyResults(referenceError),
    };
  }

  const taxonomyIndex = buildTaxonomyIndex(references.taxonomyNodes);
  const selectedTaxonomyNode = findTaxonomyNode(taxonomyIndex, search.taxonomy);
  const selectedTaxonomyPath = getTaxonomyPath(taxonomyIndex, selectedTaxonomyNode);
  const taxonomyListingSearch = selectedTaxonomyNode
    ? resolveTaxonomyListingSearch(selectedTaxonomyNode, selectedTaxonomyPath)
    : undefined;
  const categorySearchValue = taxonomyListingSearch?.category ?? search.category;
  const selectedCategory = categorySearchValue
    ? references.categories.find(
        (category) => category.id === categorySearchValue || category.slug === categorySearchValue,
      )
    : undefined;
  const selectedGovernorate = search.gov
    ? references.governorates.find(
        (governorate) => governorate.id === search.gov || governorate.slug === search.gov,
      )
    : undefined;
  const effectiveSubcategoryId =
    !taxonomyListingSearch?.taxonomyLegacySubcategoryId && !search.subcategory
      ? ""
      : (search.subcategory ?? "");
  const selectedSubcategory = references.subcategories.find(
    (subcategory) => subcategory.id === effectiveSubcategoryId,
  );
  const taxonomyOwnsPropertyPurpose = Boolean(taxonomyListingSearch?.property_purpose);
  const taxonomyOwnsPropertyType = Boolean(taxonomyListingSearch?.property_type);
  const parsedPriceMin = search.price_min;
  const parsedPriceMax = search.price_max;
  const hasInvalidTaxonomy = Boolean(
    references.taxonomyAvailable && search.taxonomy && !selectedTaxonomyNode,
  );
  const hasInvalidCategory = Boolean(
    (search.category || search.taxonomy) && !selectedCategory && references.categories.length > 0,
  );
  const hasInvalidSubcategory = Boolean(
    search.subcategory && !selectedSubcategory && references.subcategories.length > 0,
  );
  const hasPriceContradiction = Boolean(
    typeof parsedPriceMin === "number" &&
    typeof parsedPriceMax === "number" &&
    parsedPriceMin > parsedPriceMax,
  );

  if (hasInvalidTaxonomy || hasInvalidCategory || hasInvalidSubcategory || hasPriceContradiction) {
    return {
      references,
      results: emptyResults(null),
    };
  }

  const filters = buildListingFilters({
    selectedCategoryId: selectedCategory?.id,
    effectiveSubcategoryId,
    taxonomyListingSearch,
    taxonomyOwnsPropertyPurpose,
    taxonomyOwnsPropertyType,
    propertyPurpose: search.property_purpose ?? "",
    propertyType: search.property_type ?? "",
    govId: selectedGovernorate?.id ?? "",
    districtAr: search.district ?? "",
    parsedPriceMin,
    parsedPriceMax,
    carMake: search.car_make ?? "",
    carModel: search.car_model ?? "",
    fuelType: search.fuel ?? "",
    transmission: search.transmission ?? "",
    rooms: search.rooms?.toString() ?? "",
    rentalDuration: search.rental_duration ?? "",
    electronicsBrand: search.electronics_brand ?? "",
    detailCondition: search.detail_condition ?? "",
    employmentType: search.employment_type ?? "",
    salaryType: search.salary_type ?? "",
    withPhotos: Boolean(search.with_photos),
    debouncedQ: search.q?.trim() ?? "",
    sort: search.sort ?? "latest",
  });
  const filterKey = JSON.stringify(filters);
  const [listingsResult, sellerResult] = await Promise.all([
    fetchPublicListings(filters, null, 30),
    searchPublicSellers(search.q?.trim() ?? ""),
  ]);

  return {
    references,
    results: {
      items: listingsResult.ok ? listingsResult.data.items : [],
      sellerResults: sellerResult.ok ? sellerResult.data : [],
      nextCursor: listingsResult.ok ? listingsResult.data.nextCursor : null,
      error: listingsResult.ok ? null : listingsResult.error,
      sellerSearchError: sellerResult.ok ? null : sellerResult.error,
      filterKey,
    },
  };
}

function emptyResults(error: ClassifiedsError | null): PublicListingsResultsData {
  return {
    items: [],
    sellerResults: [],
    nextCursor: null,
    error,
    sellerSearchError: null,
    filterKey: null,
  };
}

function firstReferenceError(
  categoriesResult: Awaited<ReturnType<typeof fetchPublicCategories>>,
  subcategoriesResult: Awaited<ReturnType<typeof fetchPublicSubcategories>>,
  governoratesResult: Awaited<ReturnType<typeof fetchPublicGovernorates>>,
  taxonomyResult: Awaited<ReturnType<typeof fetchPublicTaxonomyNodes>>,
): ClassifiedsError | null {
  if (!categoriesResult.ok) return categoriesResult.error;
  if (!subcategoriesResult.ok) return subcategoriesResult.error;
  if (!governoratesResult.ok) return governoratesResult.error;
  if (!taxonomyResult.ok && taxonomyResult.error.code !== "schema_missing") {
    return taxonomyResult.error;
  }
  return null;
}
