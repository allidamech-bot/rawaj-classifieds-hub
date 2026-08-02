import { buildListingFilters } from "@/features/listings/listings-filters";
import { parseListingAttributeFilters } from "@/features/listings/listing-attribute-filter-state";
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
  resolveTaxonomyFilterScope,
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
  totalCount: number | null;
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
  const taxonomyAvailable = taxonomyResult.ok && taxonomyResult.data.length > 0;
  const references: PublicListingsReferencesData = {
    categories: categoriesResult.ok ? categoriesResult.data : [],
    subcategories: subcategoriesResult.ok ? subcategoriesResult.data : [],
    governorates: governoratesResult.ok ? governoratesResult.data : [],
    taxonomyNodes: taxonomyAvailable ? taxonomyResult.data : [],
    taxonomyAvailable,
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
  const taxonomyFilterScope = selectedTaxonomyNode
    ? resolveTaxonomyFilterScope(taxonomyIndex, selectedTaxonomyNode)
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
  const hasInvalidCategory = Boolean(
    search.category && !selectedCategory && references.categories.length > 0,
  );
  const hasInvalidSubcategory = Boolean(
    search.subcategory && !selectedSubcategory && references.subcategories.length > 0,
  );
  const hasPriceContradiction = Boolean(
    typeof parsedPriceMin === "number" &&
    typeof parsedPriceMax === "number" &&
    parsedPriceMin > parsedPriceMax,
  );

  if (hasInvalidCategory || hasInvalidSubcategory || hasPriceContradiction) {
    return {
      references,
      results: emptyResults(null),
    };
  }

  const filters = buildListingFilters({
    taxonomyFilterScope,
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
    priceType: search.price_type,
    globalCondition: search.condition,
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
    attributeFilters: parseListingAttributeFilters(search.attrs),
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
      totalCount: listingsResult.ok ? (listingsResult.data.totalCount ?? null) : null,
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
    totalCount: null,
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
  // Taxonomy is an optional read model here. Empty or unavailable taxonomy
  // keeps legacy category/subcategory search available without mutation.
  return null;
}
