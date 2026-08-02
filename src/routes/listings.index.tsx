import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { FilterBottomSheet } from "@/features/search/FilterBottomSheet";
import { FilterCategoryGrid } from "@/features/search/FilterCategoryGrid";
import { QuickFilterRail } from "@/features/search/QuickFilterRail";
import { SearchEmptyState } from "@/features/search/SearchEmptyState";
import { SearchResultsToolbar } from "@/features/search/SearchResultsToolbar";
import { ListingCardSkeleton } from "@/features/listings/cards";
import { RealListingCard } from "@/features/listings/RealListingCard";
import { DynamicListingFacetFilters } from "@/features/listings/DynamicListingFacetFilters";
import { NearbyDiscoveryControl } from "@/features/listings/NearbyDiscoveryControl";
import { useNearbyDiscovery } from "@/features/listings/use-nearby-discovery";
import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";
import {
  categoryUsesGlobalCondition,
  resolveCategoryFieldKind,
  type CategoryFieldKind,
} from "@/lib/category-fields";
import { categoryName, governorateName } from "@/lib/i18n";
import { fetchLocationPath, type CanonicalLocationNode } from "@/lib/api/location-taxonomy";
import { createSeo } from "@/lib/seo";
import {
  buildTaxonomyIndex,
  findTaxonomyNode,
  getTaxonomyPath,
  resolveTaxonomyFilterScope,
  resolveTaxonomyListingSearch,
  taxonomyNodeName,
  taxonomyPathLabel,
} from "@/lib/taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";
import {
  listingsSearchSchema,
  type ListingsSort,
  type ListingsView,
} from "@/features/listings/listings-search-schema";
import {
  buildListingsCategoryNavigationSearch,
  buildListingsMobileApplySearch,
  buildListingsResetSearch,
  buildListingsSyncSearch,
} from "@/features/listings/listings-filters";
import { useListingsReferences } from "@/features/listings/use-listings-references";
import { useListingsResults } from "@/features/listings/use-listings-results";
import { useListingsPagination } from "@/features/listings/use-listings-pagination";
import { useListingFacets } from "@/features/listings/use-listing-facets";
import {
  countListingAttributeFilters,
  encodeListingAttributeFilters,
  parseListingAttributeFilters,
} from "@/features/listings/listing-attribute-filter-state";
import {
  CategorySpecificFilterFields,
  SellerSearchCard,
  StateCard,
  subcategoryName,
} from "@/features/listings/listings-components";
import {
  readListingBrowsingPreferences,
  writeListingBrowsingPreferences,
} from "@/lib/listing-browsing-preferences";

export const Route = createFileRoute("/listings/")({
  validateSearch: listingsSearchSchema,
  head: () =>
    createSeo({
      title: "تصفح الإعلانات المعتمدة | RAWAJ / رواج",
      description:
        "تصفح الإعلانات المعتمدة على رواج في السعودية، وابحث في العقارات والسيارات والمنتجات والخدمات حسب القسم أو المحافظة.",
      path: "/listings",
    }),
  component: ListingsPage,
});

function ListingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const [sort, setSort] = useState<ListingsSort>(search.sort ?? "latest");
  const [view, setView] = useState<ListingsView>(search.view ?? "grid");
  const [withPhotos, setWithPhotos] = useState(Boolean(search.with_photos));
  const [subcategoryId, setSubcategoryId] = useState(search.subcategory ?? "");
  const [districtAr, setDistrictAr] = useState(search.district ?? "");
  const [locationLabel, setLocationLabel] = useState("");
  const [priceMin, setPriceMin] = useState(search.price_min?.toString() ?? "");
  const [priceType, setPriceType] = useState<"" | "fixed" | "negotiable" | "contact" | "free">(
    search.price_type ?? "",
  );
  const [globalCondition, setGlobalCondition] = useState<
    "" | "new" | "used" | "refurbished" | "not_applicable"
  >(search.condition ?? "");
  const [draftCategoryId, setDraftCategoryId] = useState<string | undefined>(undefined);
  const [priceMax, setPriceMax] = useState(search.price_max?.toString() ?? "");
  const [carMake, setCarMake] = useState(search.car_make ?? "");
  const [carModel, setCarModel] = useState(search.car_model ?? "");
  const [fuelType, setFuelType] = useState(search.fuel ?? "");
  const [transmission, setTransmission] = useState(search.transmission ?? "");
  const [propertyPurpose, setPropertyPurpose] = useState(search.property_purpose ?? "");
  const [propertyType, setPropertyType] = useState(search.property_type ?? "");
  const [rooms, setRooms] = useState(search.rooms?.toString() ?? "");
  const [rentalDuration, setRentalDuration] = useState(search.rental_duration ?? "");
  const [electronicsBrand, setElectronicsBrand] = useState(search.electronics_brand ?? "");
  const [detailCondition, setDetailCondition] = useState(search.detail_condition ?? "");
  const [employmentType, setEmploymentType] = useState(search.employment_type ?? "");
  const [salaryType, setSalaryType] = useState(search.salary_type ?? "");
  const [attributeFilters, setAttributeFilters] = useState(() =>
    parseListingAttributeFilters(search.attrs),
  );
  const [q, setQ] = useState(search.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(search.q ?? "");
  const [filtersOpen, setFiltersOpen] = useState(Boolean(search.open_filters));
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  const references = useListingsReferences(search);
  const {
    categories,
    subcategories,
    governorates,
    taxonomyNodes,
    taxonomyAvailable,
    referencesLoaded,
    setGovId,
    error: referencesError,
    loading: referencesLoading,
  } = references;
  const govId = references.govId;
  const canonicalLocationNodeId = districtAr.startsWith("@") ? districtAr.slice(1) : "";

  const taxonomyIndex = useMemo(() => buildTaxonomyIndex(taxonomyNodes), [taxonomyNodes]);
  const selectedTaxonomyNode = findTaxonomyNode(taxonomyIndex, search.taxonomy);
  const selectedTaxonomyPath = getTaxonomyPath(taxonomyIndex, selectedTaxonomyNode);
  const taxonomyListingSearch = selectedTaxonomyNode
    ? resolveTaxonomyListingSearch(selectedTaxonomyNode, selectedTaxonomyPath)
    : undefined;
  const taxonomyFilterScope = useMemo(
    () =>
      selectedTaxonomyNode
        ? resolveTaxonomyFilterScope(taxonomyIndex, selectedTaxonomyNode)
        : undefined,
    [selectedTaxonomyNode, taxonomyIndex],
  );
  const taxonomyOwnsPropertyPurpose = Boolean(taxonomyListingSearch?.property_purpose);
  const taxonomyOwnsPropertyType = Boolean(taxonomyListingSearch?.property_type);
  const categorySearchValue = taxonomyListingSearch?.category ?? search.category;
  const effectiveSubcategoryId =
    !taxonomyListingSearch?.taxonomyLegacySubcategoryId && !subcategoryId ? "" : subcategoryId;
  const effectivePropertyPurpose = taxonomyOwnsPropertyPurpose
    ? taxonomyListingSearch?.property_purpose
    : propertyPurpose || undefined;
  const effectivePropertyType = taxonomyOwnsPropertyType
    ? taxonomyListingSearch?.property_type
    : propertyType || undefined;
  const filterPropertyPurpose = taxonomyOwnsPropertyPurpose
    ? (taxonomyListingSearch?.property_purpose ?? "")
    : propertyPurpose;
  const filterPropertyType = taxonomyOwnsPropertyType
    ? (taxonomyListingSearch?.property_type ?? "")
    : propertyType;
  const selectedCategory = useMemo(
    () =>
      categorySearchValue
        ? categories.find(
            (category) =>
              category.id === categorySearchValue || category.slug === categorySearchValue,
          )
        : undefined,
    [categories, categorySearchValue],
  );
  const selectedGovernorate = governorates.find((gov) => gov.id === govId);
  const selectedSubcategory = subcategories.find(
    (subcategory) => subcategory.id === effectiveSubcategoryId,
  );
  const hasInvalidCategory = Boolean(search.category) && !selectedCategory && categories.length > 0;
  const hasInvalidSubcategory =
    Boolean(search.subcategory) && !selectedSubcategory && subcategories.length > 0;
  const categoryFieldKind = resolveCategoryFieldKind(selectedTaxonomyNode, selectedCategory);
  const usesGlobalCondition = categoryUsesGlobalCondition(categoryFieldKind);
  const availableSubcategories = useMemo(
    () =>
      selectedCategory
        ? subcategories.filter((subcategory) => subcategory.categoryId === selectedCategory.id)
        : [],
    [selectedCategory, subcategories],
  );
  const availableDistricts = useMemo(
    () => selectedGovernorate?.districtsAr ?? [],
    [selectedGovernorate],
  );
  const parsedPriceMin = priceMin.trim() ? Number(priceMin) : undefined;
  const parsedPriceMax = priceMax.trim() ? Number(priceMax) : undefined;
  const hasPriceContradiction =
    typeof parsedPriceMin === "number" &&
    typeof parsedPriceMax === "number" &&
    parsedPriceMin > parsedPriceMax;
  const encodedAttributeFilters = useMemo(
    () => encodeListingAttributeFilters(attributeFilters),
    [attributeFilters],
  );
  const dynamicFacetCount = countListingAttributeFilters(attributeFilters);
  const listingFacets = useListingFacets({
    enabled: Boolean(taxonomyFilterScope?.taxonomyNodeIds.length),
    taxonomyNodeIds: taxonomyFilterScope?.taxonomyNodeIds,
    attributeFilters,
    governorateId: govId || undefined,
    priceMin: parsedPriceMin,
    priceMax: parsedPriceMax,
    query: debouncedQ,
  });
  const hasActiveFilters = Boolean(
    selectedGovernorate ||
    districtAr ||
    q.trim() ||
    priceMin.trim() ||
    priceMax.trim() ||
    priceType ||
    (usesGlobalCondition && globalCondition) ||
    carMake ||
    carModel ||
    fuelType ||
    transmission ||
    (propertyPurpose && !taxonomyOwnsPropertyPurpose) ||
    (propertyType && !taxonomyOwnsPropertyType) ||
    rooms.trim() ||
    rentalDuration ||
    electronicsBrand ||
    detailCondition ||
    employmentType ||
    salaryType ||
    withPhotos ||
    dynamicFacetCount > 0,
  );

  useEffect(() => {
    if (search.open_filters) setFiltersOpen(true);
    setQ(search.q ?? "");
    setSubcategoryId(search.subcategory ?? "");
    setDistrictAr(search.district ?? "");
    setPriceMin(search.price_min?.toString() ?? "");
    setPriceMax(search.price_max?.toString() ?? "");
    setPriceType(search.price_type ?? "");
    setGlobalCondition(search.condition ?? "");
    setCarMake(search.car_make ?? "");
    setCarModel(search.car_model ?? "");
    setFuelType(search.fuel ?? "");
    setTransmission(search.transmission ?? "");
    setPropertyPurpose(search.property_purpose ?? "");
    setPropertyType(search.property_type ?? "");
    setRooms(search.rooms?.toString() ?? "");
    setRentalDuration(search.rental_duration ?? "");
    setElectronicsBrand(search.electronics_brand ?? "");
    setDetailCondition(search.detail_condition ?? "");
    setEmploymentType(search.employment_type ?? "");
    setSalaryType(search.salary_type ?? "");
    setAttributeFilters(parseListingAttributeFilters(search.attrs));
    const storedPreferences = readListingBrowsingPreferences();
    setSort(search.sort ?? storedPreferences.sort);
    setView(search.view ?? storedPreferences.view);
    setWithPhotos(Boolean(search.with_photos));
  }, [
    search.attrs,
    search.car_make,
    search.car_model,
    search.district,
    search.detail_condition,
    search.electronics_brand,
    search.employment_type,
    search.fuel,
    search.price_max,
    search.price_min,
    search.price_type,
    search.condition,
    search.property_purpose,
    search.property_type,
    search.q,
    search.open_filters,
    search.rental_duration,
    search.rooms,
    search.salary_type,
    search.sort,
    search.subcategory,
    search.transmission,
    search.view,
    search.with_photos,
  ]);

  useEffect(() => {
    const storedPreferences = readListingBrowsingPreferences();
    if (
      sort !== (search.sort ?? storedPreferences.sort) ||
      view !== (search.view ?? storedPreferences.view)
    ) {
      return;
    }
    writeListingBrowsingPreferences({ sort, view });
  }, [search.sort, search.view, sort, view]);

  useEffect(() => {
    if (!canonicalLocationNodeId) {
      setLocationLabel("");
      return;
    }

    let cancelled = false;
    void fetchLocationPath(canonicalLocationNodeId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLocationLabel("");
        return;
      }
      setLocationLabel(
        result.data
          .filter((node) => node.nodeType !== "country")
          .map((node) => (language === "en" ? node.nameEn || node.nameAr : node.nameAr))
          .join(" › "),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [canonicalLocationNodeId, language]);

  useEffect(() => {
    if (filtersOpen) {
      if (search.taxonomy) {
        setDraftCategoryId(undefined);
      } else {
        setDraftCategoryId(search.category ?? undefined);
      }
    }
  }, [filtersOpen, search.category, search.taxonomy]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 400);

    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    if (
      subcategoryId &&
      selectedCategory &&
      !availableSubcategories.some((subcategory) => subcategory.id === subcategoryId)
    ) {
      setSubcategoryId("");
    }
  }, [availableSubcategories, selectedCategory, subcategoryId]);

  useEffect(() => {
    if (
      districtAr &&
      !canonicalLocationNodeId &&
      selectedGovernorate &&
      !availableDistricts.includes(districtAr)
    ) {
      setDistrictAr("");
    }
  }, [availableDistricts, canonicalLocationNodeId, districtAr, selectedGovernorate]);

  useEffect(() => {
    if (!referencesLoaded || filtersOpen) return;
    void navigate({
      to: "/listings",
      search: {
        ...buildListingsSyncSearch({
          selectedTaxonomyNodeId: selectedTaxonomyNode?.id,
          selectedCategoryId: selectedCategory?.id,
          subcategoryId,
          taxonomyListingSearch,
          taxonomyOwnsPropertyPurpose,
          taxonomyOwnsPropertyPurposeValue: taxonomyListingSearch?.property_purpose,
          propertyPurpose,
          taxonomyOwnsPropertyType,
          taxonomyOwnsPropertyTypeValue: taxonomyListingSearch?.property_type,
          propertyType,
          govId,
          districtAr,
          parsedPriceMin,
          parsedPriceMax,
          priceType: priceType || undefined,
          globalCondition: usesGlobalCondition ? globalCondition : undefined,
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
        }),
        attrs: encodedAttributeFilters,
      },
      replace: true,
    });
  }, [
    taxonomyAvailable,
    search.taxonomy,
    selectedTaxonomyNode,
    selectedTaxonomyNode?.id,
    referencesLoaded,
    selectedCategory?.id,
    subcategoryId,
    taxonomyListingSearch?.taxonomyLegacySubcategoryId,
    effectivePropertyPurpose,
    effectivePropertyType,
    taxonomyOwnsPropertyPurpose,
    taxonomyOwnsPropertyType,
    taxonomyListingSearch?.property_purpose,
    taxonomyListingSearch?.property_type,
    govId,
    districtAr,
    parsedPriceMin,
    parsedPriceMax,
    priceType,
    globalCondition,
    usesGlobalCondition,
    carMake,
    carModel,
    fuelType,
    transmission,
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
    encodedAttributeFilters,
    filtersOpen,
    navigate,
  ]);

  const results = useListingsResults({
    taxonomyFilterScope,
    selectedCategoryId: selectedCategory?.id,
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
    priceType: priceType || undefined,
    globalCondition: usesGlobalCondition ? globalCondition : undefined,
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
    attributeFilters,
    referencesLoaded,
    taxonomyAvailable,
    selectedTaxonomyNode,
    searchTaxonomy: search.taxonomy,
    hasInvalidCategory,
    hasInvalidSubcategory,
    hasPriceContradiction,
  });
  const {
    items,
    sellerResults,
    error: resultsError,
    sellerSearchError,
    loading: resultsLoading,
    nextCursor,
    totalCount,
    filterVersionRef,
    setItems,
    setNextCursor,
    setError,
  } = results;

  const nearbyFilters = useMemo(
    () => ({
      categoryId: selectedCategory?.id,
      subcategoryId: effectiveSubcategoryId || undefined,
      governorateId: govId || undefined,
      priceMin: parsedPriceMin,
      priceMax: parsedPriceMax,
      priceType: priceType || undefined,
      condition: usesGlobalCondition ? globalCondition || undefined : undefined,
    }),
    [
      effectiveSubcategoryId,
      globalCondition,
      govId,
      parsedPriceMax,
      parsedPriceMin,
      priceType,
      selectedCategory?.id,
      usesGlobalCondition,
    ],
  );
  const nearby = useNearbyDiscovery(nearbyFilters);
  const visibleItems = nearby.active ? nearby.items.map((entry) => entry.listing) : items;
  const nearbyDistanceById = useMemo(
    () => new Map(nearby.items.map((entry) => [entry.listing.id, entry.distanceKm])),
    [nearby.items],
  );

  const error =
    nearby.error === "request_failed" ? resultsError : (referencesError ?? resultsError);
  const loading = nearby.loading || referencesLoading || (!referencesError && resultsLoading);

  const taxonomyTitle = selectedTaxonomyNode
    ? taxonomyNodeName(selectedTaxonomyNode, language)
    : undefined;
  const title = taxonomyTitle
    ? taxonomyTitle
    : selectedSubcategory
      ? subcategoryName(selectedSubcategory, language)
      : selectedCategory
        ? categoryName(selectedCategory.id, selectedCategory.nameAr, language)
        : text("كل الإعلانات", "All listings");
  const fuelTypeLabels: Record<string, string> = {
    gasoline: text("بنزين", "Gasoline"),
    diesel: text("ديزل", "Diesel"),
    hybrid: text("هجين", "Hybrid"),
    electric: text("كهرباء", "Electric"),
    gas: text("غاز", "Gas"),
    other: text("أخرى", "Other"),
  };
  const transmissionLabels: Record<string, string> = {
    automatic: text("أوتوماتيك", "Automatic"),
    manual: text("يدوي", "Manual"),
    semi_auto: text("نصف أوتوماتيك", "Semi-auto"),
  };
  const propertyPurposeLabels: Record<string, string> = {
    sale: text("بيع", "Sale"),
    rent: text("إيجار", "Rent"),
  };
  const propertyTypeLabels: Record<string, string> = {
    apartment: text("شقة", "Apartment"),
    house: text("منزل", "House"),
    villa: text("فيلا", "Villa"),
    land: text("أرض", "Land"),
    shop: text("محل", "Shop"),
    office: text("مكتب", "Office"),
    warehouse: text("مستودع", "Warehouse"),
  };
  const rentalDurationLabels: Record<string, string> = {
    daily: text("يومي", "Daily"),
    monthly: text("شهري", "Monthly"),
    yearly: text("سنوي", "Yearly"),
    negotiable: text("قابل للاتفاق", "Negotiable"),
  };
  const detailConditionLabels: Record<string, string> = {
    new: text("جديد", "New"),
    used: text("مستعمل", "Used"),
    excellent: text("ممتاز", "Excellent"),
    good: text("جيد", "Good"),
    needs_work: text("يحتاج صيانة", "Needs work"),
  };
  const employmentTypeLabels: Record<string, string> = {
    full_time: text("دوام كامل", "Full-time"),
    part_time: text("دوام جزئي", "Part-time"),
    contract: text("عقد", "Contract"),
    temporary: text("مؤقت", "Temporary"),
    internship: text("تدريب", "Internship"),
  };
  const salaryTypeLabels: Record<string, string> = {
    fixed: text("ثابت", "Fixed"),
    range: text("نطاق", "Range"),
    commission: text("عمولة", "Commission"),
    negotiable: text("قابل للتفاوض", "Negotiable"),
    not_listed: text("غير معلن", "Not listed"),
  };

  const activeFilters = [
    selectedGovernorate && !canonicalLocationNodeId
      ? {
          key: "governorate",
          label: governorateName(selectedGovernorate.id, selectedGovernorate.nameAr, language),
          clear: () => {
            setGovId("");
            setDistrictAr("");
          },
        }
      : null,
    districtAr
      ? {
          key: "district",
          label: canonicalLocationNodeId
            ? locationLabel || text("موقع محدد", "Selected location")
            : districtAr,
          clear: () => {
            setDistrictAr("");
            if (canonicalLocationNodeId) setGovId("");
          },
        }
      : null,
    priceMin.trim()
      ? {
          key: "priceMin",
          label: `${text("من", "From")} ${priceMin}`,
          clear: () => setPriceMin(""),
        }
      : null,
    priceMax.trim()
      ? { key: "priceMax", label: `${text("إلى", "To")} ${priceMax}`, clear: () => setPriceMax("") }
      : null,
    priceType ? { key: "priceType", label: priceType, clear: () => setPriceType("") } : null,
    usesGlobalCondition && globalCondition
      ? {
          key: "globalCondition",
          label: globalCondition,
          clear: () => setGlobalCondition(""),
        }
      : null,
    withPhotos
      ? {
          key: "withPhotos",
          label: text("مع صور", "With photos"),
          clear: () => setWithPhotos(false),
        }
      : null,
    q.trim() ? { key: "query", label: q.trim(), clear: () => setQ("") } : null,
    carMake ? { key: "carMake", label: carMake, clear: () => setCarMake("") } : null,
    carModel ? { key: "carModel", label: carModel, clear: () => setCarModel("") } : null,
    fuelType
      ? { key: "fuel", label: fuelTypeLabels[fuelType] ?? fuelType, clear: () => setFuelType("") }
      : null,
    transmission
      ? {
          key: "transmission",
          label: transmissionLabels[transmission] ?? transmission,
          clear: () => setTransmission(""),
        }
      : null,
    propertyPurpose && !taxonomyOwnsPropertyPurpose
      ? {
          key: "propertyPurpose",
          label: propertyPurposeLabels[propertyPurpose] ?? propertyPurpose,
          clear: () => setPropertyPurpose(""),
        }
      : null,
    propertyType && !taxonomyOwnsPropertyType
      ? {
          key: "propertyType",
          label: propertyTypeLabels[propertyType] ?? propertyType,
          clear: () => setPropertyType(""),
        }
      : null,
    rooms.trim()
      ? { key: "rooms", label: `${text("غرف", "Rooms")} ${rooms}`, clear: () => setRooms("") }
      : null,
    rentalDuration
      ? {
          key: "rentalDuration",
          label: rentalDurationLabels[rentalDuration] ?? rentalDuration,
          clear: () => setRentalDuration(""),
        }
      : null,
    electronicsBrand
      ? { key: "electronicsBrand", label: electronicsBrand, clear: () => setElectronicsBrand("") }
      : null,
    detailCondition
      ? {
          key: "detailCondition",
          label: detailConditionLabels[detailCondition] ?? detailCondition,
          clear: () => setDetailCondition(""),
        }
      : null,
    employmentType
      ? {
          key: "employmentType",
          label: employmentTypeLabels[employmentType] ?? employmentType,
          clear: () => setEmploymentType(""),
        }
      : null,
    salaryType
      ? {
          key: "salaryType",
          label: salaryTypeLabels[salaryType] ?? salaryType,
          clear: () => setSalaryType(""),
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; label: string; clear: () => void }>;
  const dynamicActiveFilters = Object.entries(attributeFilters).map(([fieldKey, value]) => {
    const facet = listingFacets.data.facets.find((item) => item.fieldKey === fieldKey);
    const fieldLabel = facet
      ? language === "en"
        ? facet.labelEn || facet.labelAr
        : facet.labelAr
      : fieldKey;
    return {
      key: `attribute:${fieldKey}`,
      label: `${fieldLabel}: ${formatDynamicFilterValue(value, facet, language, text)}`,
      clear: () =>
        setAttributeFilters((current) => {
          const next = { ...current };
          delete next[fieldKey];
          return next;
        }),
    };
  });
  const allActiveFilters = [...activeFilters, ...dynamicActiveFilters];
  const activeFilterCount = allActiveFilters.length;

  const draftSelectedCategory = draftCategoryId
    ? categories.find(
        (category) => category.id === draftCategoryId || category.slug === draftCategoryId,
      )
    : undefined;
  const mobileAvailableSubcategories = useMemo(
    () =>
      draftSelectedCategory
        ? subcategories.filter((subcategory) => subcategory.categoryId === draftSelectedCategory.id)
        : [],
    [draftSelectedCategory, subcategories],
  );
  const draftCategoryFieldKind = resolveCategoryFieldKind(
    search.taxonomy && draftCategoryId === undefined ? selectedTaxonomyNode : undefined,
    draftSelectedCategory,
  );

  const pagination = useListingsPagination({
    taxonomyFilterScope,
    selectedCategoryId: selectedCategory?.id,
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
    priceType: priceType || undefined,
    globalCondition: usesGlobalCondition ? globalCondition : undefined,
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
    attributeFilters,
    nextCursor,
    hasPriceContradiction,
    filterVersionRef,
    onItems: (next) =>
      setItems((prev) => {
        const known = new Set(prev.map((item) => item.id));
        return [...prev, ...next.filter((item) => !known.has(item.id))];
      }),
    onCursor: (cursor) => setNextCursor(cursor),
    onError: (err) => setError(err),
  });
  const { loadingMore, loadMore } = pagination;

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || !nextCursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "500px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, nextCursor]);

  const prevDraftFieldKindRef = useRef<CategoryFieldKind | undefined>(undefined);
  useEffect(() => {
    const prev = prevDraftFieldKindRef.current;
    const curr = draftCategoryFieldKind;
    if (prev !== curr) {
      if (prev === "vehicles") {
        setCarMake("");
        setCarModel("");
        setFuelType("");
        setTransmission("");
      }
      if (prev === "real_estate") {
        setPropertyPurpose("");
        setPropertyType("");
        setRooms("");
        setRentalDuration("");
      }
      if (prev === "electronics") {
        setElectronicsBrand("");
        setDetailCondition("");
      }
      if (prev === "jobs") {
        setEmploymentType("");
        setSalaryType("");
      }
      if (!categoryUsesGlobalCondition(curr)) setGlobalCondition("");
      prevDraftFieldKindRef.current = curr;
    }
  }, [draftCategoryFieldKind]);

  function handleCanonicalLocationChange(id: string | null, node: CanonicalLocationNode | null) {
    setDistrictAr(id ? `@${id}` : "");
    setLocationLabel(node ? (language === "en" ? node.nameEn || node.nameAr : node.nameAr) : "");
    if (node?.legacyGovernorateId) {
      setGovId(node.legacyGovernorateId);
    } else if (!id) {
      setGovId("");
    }
  }

  function restoreFilterDraftFromSearch() {
    setGovId(search.gov ?? "");
    setDistrictAr(search.district ?? "");
    setPriceMin(search.price_min?.toString() ?? "");
    setPriceMax(search.price_max?.toString() ?? "");
    setPriceType(search.price_type ?? "");
    setGlobalCondition(search.condition ?? "");
    setCarMake(search.car_make ?? "");
    setCarModel(search.car_model ?? "");
    setFuelType(search.fuel ?? "");
    setTransmission(search.transmission ?? "");
    setPropertyPurpose(search.property_purpose ?? "");
    setPropertyType(search.property_type ?? "");
    setRooms(search.rooms?.toString() ?? "");
    setRentalDuration(search.rental_duration ?? "");
    setElectronicsBrand(search.electronics_brand ?? "");
    setDetailCondition(search.detail_condition ?? "");
    setEmploymentType(search.employment_type ?? "");
    setSalaryType(search.salary_type ?? "");
    setAttributeFilters(parseListingAttributeFilters(search.attrs));
    setSubcategoryId(search.subcategory ?? "");
    setDraftCategoryId(search.taxonomy ? undefined : (search.category ?? undefined));
  }

  function handleFilterSheetOpenChange(nextOpen: boolean) {
    if (!nextOpen) restoreFilterDraftFromSearch();
    setFiltersOpen(nextOpen);
  }

  function resetFilters() {
    setGovId("");
    setDistrictAr("");
    setPriceMin("");
    setPriceMax("");
    setPriceType("");
    setGlobalCondition("");
    setCarMake("");
    setCarModel("");
    setFuelType("");
    setTransmission("");
    setRooms("");
    setRentalDuration("");
    setElectronicsBrand("");
    setDetailCondition("");
    setEmploymentType("");
    setSalaryType("");
    setAttributeFilters({});
    setQ("");
    setWithPhotos(false);
    setFiltersOpen(false);
    setDraftCategoryId(undefined);
    const taxonomyPurposeVal = taxonomyListingSearch?.property_purpose;
    const taxonomyTypeVal = taxonomyListingSearch?.property_type;
    setSubcategoryId(search.taxonomy ? "" : (search.subcategory ?? ""));
    setPropertyPurpose(taxonomyPurposeVal ?? "");
    setPropertyType(taxonomyTypeVal ?? "");
    void navigate({
      to: "/listings",
      search: buildListingsResetSearch({
        selectedTaxonomyNodeId: selectedTaxonomyNode?.id,
        searchTaxonomy: search.taxonomy,
        searchCategory: search.category,
        searchSubcategory: search.subcategory,
        taxonomyPropertyPurpose: taxonomyPurposeVal,
        taxonomyPropertyType: taxonomyTypeVal,
        sort,
        view,
      }),
      replace: true,
    });
  }

  const applyFilters = () => {
    setFiltersOpen(false);
    void navigate({
      to: "/listings",
      search: {
        ...buildListingsMobileApplySearch({
          searchTaxonomy: search.taxonomy,
          draftCategoryId,
          subcategoryId,
          govId,
          districtAr,
          parsedPriceMin,
          parsedPriceMax,
          priceType: priceType || undefined,
          globalCondition: categoryUsesGlobalCondition(draftCategoryFieldKind)
            ? globalCondition
            : undefined,
          carMake,
          carModel,
          fuelType,
          transmission,
          fieldKind: draftCategoryFieldKind,
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
        }),
        attrs: encodedAttributeFilters,
      },
      replace: true,
    });
  };

  return (
    <>
      <PageHeader title={title} titleIsPageHeading={false} />
      <main className="rawaj-search-results-v1 container-wide rawaj-content-stack mobile-page-bottom pb-8 pt-3 sm:pt-5">
        <SearchResultsToolbar
          title={title}
          pathLabel={
            selectedTaxonomyPath.length > 1
              ? taxonomyPathLabel(selectedTaxonomyPath, language)
              : undefined
          }
          query={q}
          onQueryChange={setQ}
          resultCount={nearby.active ? nearby.items.length : (totalCount ?? visibleItems.length)}
          loading={loading}
          activeFilterCount={activeFilterCount}
          sort={sort}
          onSortChange={setSort}
          view={view}
          onViewChange={setView}
          onOpenFilters={() => setFiltersOpen(true)}
          text={text}
          savedSearch={{
            taxonomy: selectedTaxonomyNode?.id ?? "",
            q: debouncedQ,
            category: selectedCategory?.id ?? "",
            subcategory: subcategoryId,
            gov: govId,
            district: districtAr,
            price_min: priceMin,
            price_max: priceMax,
            price_type: priceType,
            condition: usesGlobalCondition ? globalCondition : "",
            car_make: carMake,
            car_model: carModel,
            fuel: fuelType,
            transmission,
            property_purpose: effectivePropertyPurpose ?? "",
            property_type: effectivePropertyType ?? "",
            rooms,
            rental_duration: rentalDuration,
            electronics_brand: electronicsBrand,
            detail_condition: detailCondition,
            employment_type: employmentType,
            salary_type: salaryType,
            attrs: encodedAttributeFilters ?? "",
            sort,
          }}
        />

        <NearbyDiscoveryControl
          active={nearby.active}
          loading={nearby.loading}
          error={nearby.error}
          radiusKm={nearby.radiusKm}
          resultCount={nearby.items.length}
          onActivate={() => void nearby.activate()}
          onRadiusChange={nearby.setRadiusKm}
          onClear={nearby.clear}
          text={text}
        />

        <QuickFilterRail
          locationLabel={
            canonicalLocationNodeId
              ? locationLabel || text("الموقع", "Location")
              : selectedGovernorate
                ? governorateName(selectedGovernorate.id, selectedGovernorate.nameAr, language)
                : text("كل السعودية", "All Saudi Arabia")
          }
          priceActive={Boolean(priceMin.trim() || priceMax.trim())}
          categoryLabel={
            selectedCategory
              ? categoryName(selectedCategory.id, selectedCategory.nameAr, language)
              : text("القسم", "Category")
          }
          categoryActive={Boolean(selectedCategory)}
          conditionActive={Boolean(detailCondition)}
          showCondition={categoryFieldKind === "electronics"}
          withPhotos={withPhotos}
          newestActive={sort === "latest"}
          hasActiveFilters={hasActiveFilters}
          onOpenFilters={() => setFiltersOpen(true)}
          onNewest={() => setSort("latest")}
          onTogglePhotos={() => setWithPhotos((value) => !value)}
          onReset={resetFilters}
          fieldKind={categoryFieldKind}
          text={text}
        />

        <aside className="rawaj-search-results-v1__sidebar rawaj-surface hidden rounded-[1.35rem] p-4 lg:block">
          <div className="grid gap-4">
            <div>
              <h2 className="mb-2 text-xs font-extrabold text-muted-foreground">
                {text("الأقسام", "Categories")}
              </h2>
              <div className="no-scrollbar flex gap-2 overflow-x-auto lg:grid lg:grid-cols-1 lg:overflow-visible">
                <Link
                  to="/listings"
                  search={buildListingsCategoryNavigationSearch({
                    categoryId: undefined,
                    govId,
                    districtAr,
                    query: q,
                    sort,
                    view,
                    withPhotos,
                  })}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
                    !selectedCategory
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted-surface text-foreground hover:bg-secondary"
                  }`}
                >
                  {text("كل الأقسام", "All categories")}
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category.id}
                    to="/listings"
                    search={buildListingsCategoryNavigationSearch({
                      categoryId: category.id,
                      govId,
                      districtAr,
                      query: q,
                      sort,
                    })}
                    className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
                      selectedCategory?.id === category.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted-surface text-foreground hover:bg-secondary"
                    }`}
                  >
                    {categoryName(category.id, category.nameAr, language)}
                  </Link>
                ))}
              </div>
              {selectedCategory && availableSubcategories.length > 0 && (
                <div className="mt-3">
                  <h3 className="mb-2 text-[11px] font-bold text-muted-foreground">
                    {text("الأقسام الفرعية", "Subcategories")}
                  </h3>
                  <div className="grid gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSubcategoryId("")}
                      className={`rounded-lg px-3 py-2 text-start text-xs font-bold transition ${
                        !subcategoryId
                          ? "bg-gold text-gold-foreground"
                          : "bg-muted-surface text-foreground hover:bg-secondary"
                      }`}
                    >
                      {text("كل القسم", "All in category")}
                    </button>
                    {availableSubcategories.map((subcategory) => (
                      <button
                        key={subcategory.id}
                        type="button"
                        onClick={() => setSubcategoryId(subcategory.id)}
                        className={`rounded-lg px-3 py-2 text-start text-xs font-bold transition ${
                          subcategoryId === subcategory.id
                            ? "bg-gold text-gold-foreground"
                            : "bg-muted-surface text-foreground hover:bg-secondary"
                        }`}
                      >
                        {subcategoryName(subcategory, language)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-xs font-extrabold text-muted-foreground">
                {text("المكان والسعر", "Location and price")}
              </h2>
              <div className="rounded-xl bg-muted-surface p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {text("الموقع", "Location")}
                  </span>
                  {(districtAr || govId) && (
                    <button
                      type="button"
                      onClick={() => {
                        setGovId("");
                        setDistrictAr("");
                      }}
                      className="text-[11px] font-bold text-primary"
                    >
                      {text("كل السعودية", "All Saudi Arabia")}
                    </button>
                  )}
                </div>
                <div className="mt-2">
                  <CanonicalLocationSelector
                    value={canonicalLocationNodeId || null}
                    onChange={handleCanonicalLocationChange}
                  />
                  {districtAr && !canonicalLocationNodeId ? (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}
                      {districtAr}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      {text("السعر من", "Price from")}
                    </span>
                    <input
                      value={priceMin}
                      onChange={(event) => setPriceMin(event.target.value)}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="input text-xs"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      {text("السعر إلى", "Price to")}
                    </span>
                    <input
                      value={priceMax}
                      onChange={(event) => setPriceMax(event.target.value)}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="input text-xs"
                    />
                  </label>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      {text("نوع السعر", "Price type")}
                    </span>
                    <select
                      value={priceType}
                      onChange={(event) => setPriceType(event.target.value as typeof priceType)}
                      className="input text-xs"
                    >
                      <option value="">{text("الكل", "All")}</option>
                      <option value="fixed">{text("سعر ثابت", "Fixed")}</option>
                      <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
                      <option value="contact">{text("تواصل للسعر", "Contact")}</option>
                      <option value="free">{text("مجاني", "Free")}</option>
                    </select>
                  </label>
                  {usesGlobalCondition ? (
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
                        {text("الحالة", "Condition")}
                      </span>
                      <select
                        value={globalCondition}
                        onChange={(event) =>
                          setGlobalCondition(event.target.value as typeof globalCondition)
                        }
                        className="input text-xs"
                      >
                        <option value="">{text("الكل", "All")}</option>
                        <option value="new">{text("جديد", "New")}</option>
                        <option value="used">{text("مستعمل", "Used")}</option>
                        <option value="refurbished">{text("مجدّد", "Refurbished")}</option>
                      </select>
                    </label>
                  ) : null}
                </div>
                <CategorySpecificFilterFields
                  kind={categoryFieldKind}
                  text={text}
                  values={{
                    carMake,
                    carModel,
                    fuelType,
                    transmission,
                    propertyPurpose: filterPropertyPurpose,
                    propertyType: filterPropertyType,
                    rooms,
                    rentalDuration,
                    electronicsBrand,
                    detailCondition,
                    employmentType,
                    salaryType,
                  }}
                  setters={{
                    setCarMake,
                    setCarModel,
                    setFuelType,
                    setTransmission,
                    setPropertyPurpose,
                    setPropertyType,
                    setRooms,
                    setRentalDuration,
                    setElectronicsBrand,
                    setDetailCondition,
                    setEmploymentType,
                    setSalaryType,
                  }}
                  taxonomyOwnsPurpose={taxonomyOwnsPropertyPurpose}
                  taxonomyOwnsType={taxonomyOwnsPropertyType}
                />
                <div className="mt-4">
                  <DynamicListingFacetFilters
                    facets={listingFacets.data.facets}
                    values={attributeFilters}
                    loading={listingFacets.loading}
                    errorMessage={listingFacets.error?.message}
                    language={language}
                    onChange={setAttributeFilters}
                    text={text}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={resetFilters}
                    disabled={!hasActiveFilters}
                    className="rounded-xl bg-card px-4 py-2 text-xs font-bold text-foreground hairline hover:bg-secondary disabled:opacity-50"
                  >
                    {text("مسح الفلاتر", "Clear filters")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <FilterBottomSheet
          open={filtersOpen}
          onOpenChange={handleFilterSheetOpenChange}
          activeCount={activeFilterCount}
          onReset={resetFilters}
          onApply={applyFilters}
          text={text}
        >
          <section className="rawaj-filter-sheet__section">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("القسم", "Category")}</h3>
            </div>
            <FilterCategoryGrid
              categories={categories}
              selectedCategory={draftSelectedCategory}
              language={language}
              onSelect={(categoryId) => {
                setDraftCategoryId(categoryId);
                setSubcategoryId("");
              }}
              text={text}
            />
          </section>

          {draftSelectedCategory && mobileAvailableSubcategories.length > 0 ? (
            <section className="rawaj-filter-sheet__section">
              <div className="rawaj-filter-sheet__section-heading">
                <h3>{text("الأقسام الفرعية", "Subcategories")}</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setSubcategoryId("")}
                  aria-pressed={!subcategoryId}
                  className={`rounded-xl px-3 py-2 text-start text-xs font-bold ${
                    !subcategoryId
                      ? "bg-gold text-gold-foreground"
                      : "bg-muted-surface text-foreground"
                  }`}
                >
                  {text("كل القسم", "All in category")}
                </button>
                {mobileAvailableSubcategories.map((subcategory) => (
                  <button
                    key={subcategory.id}
                    type="button"
                    onClick={() => setSubcategoryId(subcategory.id)}
                    aria-pressed={subcategoryId === subcategory.id}
                    className={`rounded-xl px-3 py-2 text-start text-xs font-bold ${
                      subcategoryId === subcategory.id
                        ? "bg-gold text-gold-foreground"
                        : "bg-muted-surface text-foreground"
                    }`}
                  >
                    {subcategoryName(subcategory, language)}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rawaj-filter-sheet__section">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("الموقع", "Location")}</h3>
              {districtAr || govId ? (
                <button
                  type="button"
                  onClick={() => {
                    setGovId("");
                    setDistrictAr("");
                  }}
                >
                  {text("كل السعودية", "All Saudi Arabia")}
                </button>
              ) : null}
            </div>
            <CanonicalLocationSelector
              value={canonicalLocationNodeId || null}
              onChange={handleCanonicalLocationChange}
            />
            {districtAr && !canonicalLocationNodeId ? (
              <p className="text-xs text-muted-foreground">
                {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}
                {districtAr}
              </p>
            ) : null}
          </section>

          <section className="rawaj-filter-sheet__section">
            <div className="rawaj-filter-sheet__section-heading">
              <h3>{text("السعر", "Price")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  {text("السعر من", "Price from")}
                </span>
                <input
                  value={priceMin}
                  onChange={(event) => setPriceMin(event.target.value)}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="input text-xs"
                />
              </label>
              <label>
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  {text("السعر إلى", "Price to")}
                </span>
                <input
                  value={priceMax}
                  onChange={(event) => setPriceMax(event.target.value)}
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="input text-xs"
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1 block text-xs font-bold text-muted-foreground">
                  {text("نوع السعر", "Price type")}
                </span>
                <select
                  value={priceType}
                  onChange={(event) => setPriceType(event.target.value as typeof priceType)}
                  className="input text-xs"
                >
                  <option value="">{text("الكل", "All")}</option>
                  <option value="fixed">{text("سعر ثابت", "Fixed")}</option>
                  <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
                  <option value="contact">{text("تواصل للسعر", "Contact")}</option>
                  <option value="free">{text("مجاني", "Free")}</option>
                </select>
              </label>
              {categoryUsesGlobalCondition(draftCategoryFieldKind) ? (
                <label>
                  <span className="mb-1 block text-xs font-bold text-muted-foreground">
                    {text("الحالة", "Condition")}
                  </span>
                  <select
                    value={globalCondition}
                    onChange={(event) =>
                      setGlobalCondition(event.target.value as typeof globalCondition)
                    }
                    className="input text-xs"
                  >
                    <option value="">{text("الكل", "All")}</option>
                    <option value="new">{text("جديد", "New")}</option>
                    <option value="used">{text("مستعمل", "Used")}</option>
                    <option value="refurbished">{text("مجدّد", "Refurbished")}</option>
                  </select>
                </label>
              ) : null}
            </div>
          </section>

          {draftCategoryFieldKind !== "general" ? (
            <section className="rawaj-filter-sheet__section">
              <div className="rawaj-filter-sheet__section-heading">
                <h3>{text("خيارات القسم", "Category options")}</h3>
              </div>
              <CategorySpecificFilterFields
                kind={draftCategoryFieldKind}
                text={text}
                values={{
                  carMake,
                  carModel,
                  fuelType,
                  transmission,
                  propertyPurpose: filterPropertyPurpose,
                  propertyType: filterPropertyType,
                  rooms,
                  rentalDuration,
                  electronicsBrand,
                  detailCondition,
                  employmentType,
                  salaryType,
                }}
                setters={{
                  setCarMake,
                  setCarModel,
                  setFuelType,
                  setTransmission,
                  setPropertyPurpose,
                  setPropertyType,
                  setRooms,
                  setRentalDuration,
                  setElectronicsBrand,
                  setDetailCondition,
                  setEmploymentType,
                  setSalaryType,
                }}
                taxonomyOwnsPurpose={taxonomyOwnsPropertyPurpose}
                taxonomyOwnsType={taxonomyOwnsPropertyType}
              />
            </section>
          ) : null}

          {listingFacets.data.facets.length > 0 ? (
            <section className="rawaj-filter-sheet__section">
              <div className="rawaj-filter-sheet__section-heading">
                <h3>{text("تفاصيل القسم", "Category details")}</h3>
              </div>
              <DynamicListingFacetFilters
                facets={listingFacets.data.facets}
                values={attributeFilters}
                loading={listingFacets.loading}
                errorMessage={listingFacets.error?.message}
                language={language}
                onChange={setAttributeFilters}
                text={text}
              />
            </section>
          ) : null}
        </FilterBottomSheet>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {loading
              ? text("جاري تحميل الإعلانات...", "Loading listings...")
              : text(
                  totalCount === null
                    ? `${visibleItems.length} نتيجة محملة حاليًا`
                    : `${totalCount} نتيجة، تم تحميل ${visibleItems.length}`,
                  totalCount === null
                    ? `${visibleItems.length} currently loaded results`
                    : `${totalCount} results, ${visibleItems.length} loaded`,
                )}
          </span>
          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} className="font-semibold text-primary">
              {text("مسح الفلاتر", "Clear filters")}
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            to="/categories"
            className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground hairline transition active:scale-[0.98]"
          >
            {text("تصفح الأقسام", "Browse categories")}
          </Link>
          {allActiveFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={filter.clear}
              className="inline-flex items-center gap-1 rounded-full bg-muted-surface px-3 py-1.5 text-xs font-bold text-foreground hairline transition active:scale-[0.98]"
            >
              {filter.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>

        {!loading && (sellerResults.length > 0 || sellerSearchError) && (
          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-extrabold">
                {text("نتائج معلنين عامة", "Public advertiser results")}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {text("نتائج عامة آمنة", "Safe public results")}
              </span>
            </div>
            {sellerSearchError ? (
              <p className="rounded-xl bg-muted-surface p-3 text-xs text-muted-foreground">
                {text(
                  "تعذر تحميل نتائج البائعين الآن.",
                  "Seller results could not be loaded right now.",
                )}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {sellerResults.map((seller) => (
                  <SellerSearchCard key={seller.id} seller={seller} />
                ))}
              </div>
            )}
          </section>
        )}

        {taxonomyAvailable && search.taxonomy && !selectedTaxonomyNode ? (
          <StateCard
            title={text("تصنيف غير صالح", "Invalid taxonomy")}
            body={text(
              "التصنيف المحدد في الرابط غير موجود أو غير متاح.",
              "The taxonomy specified in the link does not exist or is not available.",
            )}
            actionLabel={text("العودة للرئيسية", "Back to home")}
            actionTo="/"
          />
        ) : hasInvalidCategory ? (
          <StateCard
            title={text("قسم غير صالح", "Invalid category")}
            body={text(
              "القسم المحدد في الرابط غير موجود أو غير متاح.",
              "The category specified in the link does not exist or is not available.",
            )}
            actionLabel={text("تصفح الأقسام", "Browse categories")}
            actionTo="/categories"
          />
        ) : hasInvalidSubcategory ? (
          <StateCard
            title={text("قسم فرعي غير صالح", "Invalid subcategory")}
            body={text(
              "القسم الفرعي المحدد في الرابط غير موجود أو غير متاح.",
              "The subcategory specified in the link does not exist or is not available.",
            )}
            actionLabel={text("تصفح الأقسام", "Browse categories")}
            actionTo="/categories"
          />
        ) : hasPriceContradiction ? (
          <StateCard
            title={text("نطاق السعر غير صالح", "Invalid price range")}
            body={text(
              "لا يمكن أن يكون السعر الأدنى أكبر من السعر الأعلى.",
              "Minimum price cannot be greater than maximum price.",
            )}
            actionLabel={text("مسح الفلاتر", "Clear filters")}
            actionTo="/listings"
          />
        ) : loading ? (
          <div
            className="rawaj-results-grid listing-card-grid mt-3"
            data-view={view}
            aria-label={text("جاري تحميل الإعلانات", "Loading listings")}
          >
            {Array.from({ length: 6 }, (_, index) => (
              <ListingCardSkeleton
                key={index}
                variant={
                  categoryFieldKind === "vehicles"
                    ? "vehicle"
                    : categoryFieldKind === "real_estate"
                      ? "property"
                      : "product"
                }
              />
            ))}
          </div>
        ) : error ? (
          <StateCard
            title={text("تعذر تحميل الإعلانات", "Could not load listings")}
            body={text(
              "تعذر تحميل البيانات الآن. يمكنك تحديث الصفحة أو المحاولة مرة أخرى.",
              "Could not load data right now. Refresh the page or try again.",
            )}
            actionLabel={text("العودة للرئيسية", "Back to home")}
            actionTo="/"
          />
        ) : visibleItems.length === 0 ? (
          <SearchEmptyState
            hasActiveFilters={hasActiveFilters}
            onReset={resetFilters}
            text={text}
          />
        ) : (
          <>
            <div className="rawaj-results-grid listing-card-grid mt-3" data-view={view}>
              {visibleItems.map((listing) => {
                const distanceKm = nearbyDistanceById.get(listing.id);
                return (
                  <RealListingCard
                    key={listing.id}
                    listing={listing}
                    action={
                      distanceKm !== undefined ? (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-extrabold text-primary">
                          {distanceKm} {text("كم تقريبًا", "km away")}
                        </span>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
            {!nearby.active && nextCursor && (
              <div ref={loadMoreSentinelRef} className="mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl bg-card px-6 py-2.5 text-xs font-bold hairline transition hover:bg-secondary disabled:opacity-50"
                >
                  {loadingMore
                    ? text("جارٍ التحميل...", "Loading...")
                    : text("عرض المزيد", "Load more")}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}

function formatDynamicFilterValue(
  value: string | boolean | string[] | { min?: number; max?: number },
  facet:
    { options: Array<{ valueKey: string; labelAr: string; labelEn: string | null }> } | undefined,
  language: "ar" | "en",
  text: (ar: string, en: string) => string,
) {
  if (typeof value === "boolean") return value ? text("نعم", "Yes") : text("لا", "No");
  if (Array.isArray(value)) {
    return value
      .map((item) => dynamicOptionLabel(item, facet, language))
      .join(language === "ar" ? "، " : ", ");
  }
  if (value && typeof value === "object") {
    const minimum = value.min === undefined ? "…" : String(value.min);
    const maximum = value.max === undefined ? "…" : String(value.max);
    return `${minimum} – ${maximum}`;
  }
  return dynamicOptionLabel(value, facet, language);
}

function dynamicOptionLabel(
  value: string,
  facet:
    { options: Array<{ valueKey: string; labelAr: string; labelEn: string | null }> } | undefined,
  language: "ar" | "en",
) {
  const option = facet?.options.find((item) => item.valueKey === value);
  if (!option) return value;
  return language === "en" ? option.labelEn || option.labelAr : option.labelAr;
}
