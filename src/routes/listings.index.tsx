import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, Filter, Search, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListingCardSkeleton } from "@/features/listings/cards";
import { RealListingCard } from "@/features/listings/RealListingCard";
import { CanonicalLocationSelector } from "@/features/locations/CanonicalLocationSelector";
import { detectCategoryFieldKind, type CategoryFieldKind } from "@/lib/category-fields";
import { categoryName, governorateName } from "@/lib/i18n";
import { fetchLocationPath, type CanonicalLocationNode } from "@/lib/api/location-taxonomy";
import { createSeo } from "@/lib/seo";
import {
  buildTaxonomyIndex,
  findTaxonomyNode,
  getTaxonomyPath,
  resolveTaxonomyListingSearch,
  taxonomyNodeName,
  taxonomyPathLabel,
} from "@/lib/taxonomy";
import { useUiPreferences } from "@/lib/ui-preferences";
import {
  listingsSearchSchema,
  type ListingsSort,
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
import {
  CategorySpecificFilterFields,
  GovernorateChip,
  SellerSearchCard,
  StateCard,
  subcategoryName,
} from "@/features/listings/listings-components";

export const Route = createFileRoute("/listings/")({
  validateSearch: listingsSearchSchema,
  head: () =>
    createSeo({
      title: "تصفح الإعلانات المعتمدة | RAWAJ / رواج",
      description:
        "تصفح الإعلانات المعتمدة على رواج في سوريا، وابحث في العقارات والسيارات والمنتجات والخدمات حسب القسم أو المحافظة.",
      path: "/listings",
    }),
  component: ListingsPage,
});

function ListingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { language, text } = useUiPreferences();
  const [sort, setSort] = useState<ListingsSort>(search.sort ?? "latest");
  const [subcategoryId, setSubcategoryId] = useState(search.subcategory ?? "");
  const [districtAr, setDistrictAr] = useState(search.district ?? "");
  const [locationLabel, setLocationLabel] = useState("");
  const [priceMin, setPriceMin] = useState(search.price_min?.toString() ?? "");
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
  const [q, setQ] = useState(search.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(search.q ?? "");
  const [open, setOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(Boolean(search.open_filters));
  const [sortOpen, setSortOpen] = useState(false);
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
  const hasInvalidCategory =
    (Boolean(search.category) || Boolean(search.taxonomy)) &&
    !selectedCategory &&
    categories.length > 0;
  const hasInvalidSubcategory =
    Boolean(search.subcategory) && !selectedSubcategory && subcategories.length > 0;
  const categoryFieldKind = detectCategoryFieldKind(selectedCategory);
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
  const hasActiveFilters = Boolean(
    selectedGovernorate ||
    districtAr ||
    q.trim() ||
    priceMin.trim() ||
    priceMax.trim() ||
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
    salaryType,
  );

  useEffect(() => {
    if (search.open_filters) setFiltersOpen(true);
    setQ(search.q ?? "");
    setSubcategoryId(search.subcategory ?? "");
    setDistrictAr(search.district ?? "");
    setPriceMin(search.price_min?.toString() ?? "");
    setPriceMax(search.price_max?.toString() ?? "");
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
    setSort(search.sort ?? "latest");
  }, [
    search.car_make,
    search.car_model,
    search.district,
    search.detail_condition,
    search.electronics_brand,
    search.employment_type,
    search.fuel,
    search.price_max,
    search.price_min,
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
  ]);

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
    if (!referencesLoaded) return;
    if (taxonomyAvailable && search.taxonomy && !selectedTaxonomyNode) return;

    void navigate({
      to: "/listings",
      search: buildListingsSyncSearch({
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
      }),
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
    debouncedQ,
    sort,
    navigate,
  ]);

  const results = useListingsResults({
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
    filterVersionRef,
    setItems,
    setNextCursor,
    setError,
  } = results;

  const error = referencesError ?? resultsError;
  const loading = referencesLoading || (!referencesError && resultsLoading);

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
  const sortChips = [
    { id: "latest", label: text("الأحدث", "Latest") },
    { id: "cheapest", label: text("الأرخص", "Lowest price") },
    { id: "expensive", label: text("الأعلى سعرا", "Highest price") },
    { id: "featured", label: text("المميز", "Featured") },
  ] as const;
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
  const activeFilterCount = activeFilters.length;

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
  const draftCategoryFieldKind = detectCategoryFieldKind(draftSelectedCategory);

  const pagination = useListingsPagination({
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

  function resetFilters() {
    setGovId("");
    setDistrictAr("");
    setPriceMin("");
    setPriceMax("");
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
    setQ("");
    setSortOpen(false);
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
      }),
      replace: true,
    });
  }

  const applyFilters = () => {
    setFiltersOpen(false);
    void navigate({
      to: "/listings",
      search: buildListingsMobileApplySearch({
        searchTaxonomy: search.taxonomy,
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
        fieldKind: draftCategoryFieldKind,
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
      }),
      replace: true,
    });
  };

  return (
    <>
      <PageHeader title={title} />
      <main className="container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">
        <section className="rawaj-hero-surface rounded-[1.55rem] p-4 sm:rounded-[1.8rem] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="rawaj-eyebrow">
                {selectedCategory
                  ? text("نتائج ضمن قسم", "Results in category")
                  : text("نتائج السوق", "Marketplace results")}
              </p>
              <h1 className="mt-1 truncate text-lg font-bold leading-tight text-primary sm:text-[1.35rem]">
                {title}
              </h1>
              {selectedTaxonomyPath.length > 1 ? (
                <p className="mt-1.5 truncate text-[10px] font-medium text-muted-foreground">
                  {taxonomyPathLabel(selectedTaxonomyPath, language)}
                </p>
              ) : null}
            </div>
            <span className="rawaj-chip shrink-0 border-primary/10 bg-card/75 px-2.5 py-1 text-primary shadow-soft">
              {loading
                ? text("جارٍ التحميل", "Loading")
                : text(`${items.length} نتيجة`, `${items.length} results`)}
            </span>
          </div>

          <div className="mt-3 flex items-stretch gap-2">
            <label className="flex min-h-13 min-w-0 flex-1 items-center gap-2.5 rounded-[1.05rem] border border-border/85 bg-card/88 px-3.5 shadow-[0_7px_22px_rgba(16,43,70,0.05)] transition focus-within:border-brand-orange/60 focus-within:bg-card focus-within:ring-[3px] focus-within:ring-brand-orange/12">
              <Search className="h-4.5 w-4.5 shrink-0 text-primary" strokeWidth={1.9} />
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder={text("ابحث ضمن النتائج...", "Search within results...")}
                aria-label={text("بحث في الإعلانات", "Search listings")}
                className="w-full bg-transparent text-sm font-medium outline-none placeholder:font-normal"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setSortOpen(false);
                setFiltersOpen(true);
              }}
              aria-label={text("الفلاتر", "Filters")}
              className="rawaj-button-primary relative grid min-h-13 w-13 shrink-0 place-items-center rounded-[1.05rem] p-0"
            >
              <Filter className="h-4.5 w-4.5" strokeWidth={2} />
              {activeFilterCount > 0 ? (
                <span className="absolute -end-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand-orange px-1 text-[9px] font-extrabold text-white ring-2 ring-card">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => {
                setFiltersOpen(false);
                setSortOpen((value) => !value);
              }}
              aria-expanded={sortOpen}
              aria-label={text("الترتيب", "Sort")}
              className="rawaj-icon-button min-h-13 w-13 shrink-0 rounded-[1.05rem]"
            >
              <ArrowUpDown className="h-4.5 w-4.5" strokeWidth={1.9} />
            </button>
          </div>

          <div className="no-scrollbar mt-2.5 flex gap-2 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={`rawaj-chip shrink-0 px-3 py-1.5 transition ${
                districtAr || govId
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card/72 text-muted-foreground"
              }`}
            >
              {canonicalLocationNodeId
                ? locationLabel || text("الموقع", "Location")
                : selectedGovernorate
                  ? governorateName(selectedGovernorate.id, selectedGovernorate.nameAr, language)
                  : text("كل سوريا", "All Syria")}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={`rawaj-chip shrink-0 px-3 py-1.5 transition ${
                priceMin.trim() || priceMax.trim()
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card/72 text-muted-foreground"
              }`}
            >
              {priceMin.trim() || priceMax.trim()
                ? text("السعر محدد", "Price set")
                : text("السعر", "Price")}
            </button>
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={`rawaj-chip shrink-0 px-3 py-1.5 transition ${
                selectedCategory
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card/72 text-muted-foreground"
              }`}
            >
              {selectedCategory
                ? categoryName(selectedCategory.id, selectedCategory.nameAr, language)
                : text("القسم", "Category")}
            </button>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="rawaj-chip shrink-0 border-brand-orange/20 bg-brand-orange/8 px-3 py-1.5 font-semibold text-brand-orange"
              >
                {text("مسح الكل", "Clear all")}
              </button>
            ) : null}
          </div>

          {sortOpen ? (
            <div className="rawaj-surface mt-3 grid grid-cols-2 gap-2 rounded-[1.15rem] p-2 sm:grid-cols-4">
              {sortChips.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setSort(chip.id);
                    setSortOpen(false);
                  }}
                  className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                    sort === chip.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground hairline"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rawaj-surface mt-4 hidden rounded-[1.35rem] p-4 lg:block">
          <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
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
                      {text("كل سوريا", "All Syria")}
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
        </section>

        {filtersOpen && (
          <div className="fixed inset-0 z-50 flex items-end bg-primary/32 p-0 backdrop-blur-[3px] lg:hidden">
            <div className="mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] border border-b-0 border-border/80 bg-card shadow-premium">
              <div className="relative flex items-center justify-between border-b border-border/70 px-4 pb-3 pt-5 before:absolute before:left-1/2 before:top-2 before:h-1 before:w-10 before:-translate-x-1/2 before:rounded-full before:bg-border">
                <h2 className="text-sm font-extrabold">
                  {text("فلترة الإعلانات", "Filter listings")}
                </h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rawaj-icon-button h-9 w-9"
                  aria-label={text("إغلاق الفلاتر", "Close filters")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-5 overflow-y-auto px-4 pb-5 pt-4">
                <div>
                  <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                    {text("القسم", "Category")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftCategoryId("");
                        setSubcategoryId("");
                      }}
                      aria-pressed={!draftSelectedCategory}
                      className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                        !draftSelectedCategory
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-surface text-foreground"
                      }`}
                    >
                      {text("كل الأقسام", "All categories")}
                    </button>
                    {categories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => {
                          setDraftCategoryId(category.id);
                          setSubcategoryId("");
                        }}
                        aria-pressed={draftSelectedCategory?.id === category.id}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                          draftSelectedCategory?.id === category.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-surface text-foreground"
                        }`}
                      >
                        {categoryName(category.id, category.nameAr, language)}
                      </button>
                    ))}
                  </div>
                </div>

                {draftSelectedCategory && mobileAvailableSubcategories.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                      {text("الأقسام الفرعية", "Subcategories")}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
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
                  </div>
                )}

                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold text-muted-foreground">
                      {text("الموقع", "Location")}
                    </h3>
                    {(districtAr || govId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setGovId("");
                          setDistrictAr("");
                        }}
                        className="text-xs font-bold text-primary"
                      >
                        {text("كل سوريا", "All Syria")}
                      </button>
                    )}
                  </div>
                  <CanonicalLocationSelector
                    value={canonicalLocationNodeId || null}
                    onChange={handleCanonicalLocationChange}
                  />
                  {districtAr && !canonicalLocationNodeId ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {text("الموقع القديم المحفوظ: ", "Saved legacy location: ")}
                      {districtAr}
                    </p>
                  ) : null}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                    {text("السعر", "Price")}
                  </h3>
                  <div className="mb-3 grid grid-cols-2 gap-3">
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
                </div>

                {draftCategoryFieldKind !== "general" && (
                  <div>
                    <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                      {text("خيارات متقدمة", "Advanced options")}
                    </h3>
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
                  </div>
                )}
              </div>
              <div className="sticky bottom-0 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-border/70 bg-card/94 p-4 shadow-[0_-10px_30px_rgba(16,43,70,0.06)] backdrop-blur-xl">
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="min-h-12 rounded-2xl bg-background px-4 py-2.5 text-xs font-bold text-muted-foreground disabled:opacity-50"
                >
                  {text("مسح الفلاتر", "Clear filters")}
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="rawaj-button-primary min-h-12 rounded-2xl px-4 py-2.5"
                >
                  {text("عرض النتائج", "Show results")}
                </button>
              </div>
            </div>
          </div>
        )}

        {open && (
          <div className="mt-2 rounded-xl bg-card p-2 shadow-premium hairline">
            <div className="flex flex-wrap gap-2">
              <GovernorateChip
                active={!govId}
                label={text("كل سوريا", "All Syria")}
                onClick={() => {
                  setGovId("");
                  setOpen(false);
                }}
              />
              {governorates.map((governorate) => (
                <GovernorateChip
                  key={governorate.id}
                  active={govId === governorate.id}
                  label={governorateName(governorate.id, governorate.nameAr, language)}
                  onClick={() => {
                    setGovId(governorate.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {loading
              ? text("جاري تحميل الإعلانات...", "Loading listings...")
              : text(
                  `${items.length} نتيجة محملة حاليًا`,
                  `${items.length} currently loaded results`,
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
          {activeFilters.map((filter) => (
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
                {sellerSearchError.message}
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
            className="listing-card-grid mt-3"
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
            body={
              error.code === "schema_missing" || error.code === "supabase_unconfigured"
                ? text(
                    "تعذر تحميل البيانات الآن. يمكنك تحديث الصفحة أو المحاولة مرة أخرى.",
                    "Could not load data right now. Refresh the page or try again.",
                  )
                : error.message
            }
            actionLabel={text("العودة للرئيسية", "Back to home")}
            actionTo="/"
          />
        ) : items.length === 0 ? (
          <StateCard
            title={text("لا توجد إعلانات مطابقة الآن", "No matching listings now")}
            body={text(
              "تظهر هنا الإعلانات المعتمدة فقط بعد المراجعة.",
              "Only approved listings appear here after review.",
            )}
            actionLabel={text("أضف إعلانك", "Post your listing")}
            actionTo="/add-listing"
          />
        ) : (
          <>
            <div className="listing-card-grid mt-3">
              {items.map((listing) => (
                <RealListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            {nextCursor && (
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
