import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Clock, Filter, MapPin, Search, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  carMakeOptions,
  detectCategoryFieldKind,
  type CategoryFieldKind,
} from "@/lib/category-fields";
import {
  fetchPublicCategories,
  fetchPublicGovernorates,
  fetchPublicListings,
  fetchPublicSubcategories,
  searchPublicSellers,
} from "@/lib/classifieds-api";
import type {
  ClassifiedCategory,
  ClassifiedGovernorate,
  ClassifiedListing,
  ClassifiedSubcategory,
  ClassifiedsError,
  PublicSellerSearchResult,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

const searchSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  gov: z.string().optional(),
  district: z.string().optional(),
  price_min: z.coerce.number().nonnegative().optional(),
  price_max: z.coerce.number().nonnegative().optional(),
  car_make: z.string().optional(),
  car_model: z.string().optional(),
  fuel: z.string().optional(),
  transmission: z.string().optional(),
  property_purpose: z.string().optional(),
  property_type: z.string().optional(),
  rooms: z.coerce.number().nonnegative().optional(),
  rental_duration: z.string().optional(),
  electronics_brand: z.string().optional(),
  detail_condition: z.string().optional(),
  employment_type: z.string().optional(),
  salary_type: z.string().optional(),
  q: z.string().optional(),
  sort: z.enum(["latest", "cheapest", "expensive", "featured"]).optional(),
});

export const Route = createFileRoute("/listings/")({
  validateSearch: searchSchema,
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
  const [sort, setSort] = useState<"latest" | "cheapest" | "expensive" | "featured">(
    search.sort ?? "latest",
  );
  const [govId, setGovId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState(search.subcategory ?? "");
  const [districtAr, setDistrictAr] = useState(search.district ?? "");
  const [priceMin, setPriceMin] = useState(search.price_min?.toString() ?? "");
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categories, setCategories] = useState<ClassifiedCategory[]>([]);
  const [subcategories, setSubcategories] = useState<ClassifiedSubcategory[]>([]);
  const [governorates, setGovernorates] = useState<ClassifiedGovernorate[]>([]);
  const [items, setItems] = useState<ClassifiedListing[]>([]);
  const [sellerResults, setSellerResults] = useState<PublicSellerSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [sellerSearchError, setSellerSearchError] = useState<ClassifiedsError | null>(null);

  const selectedCategory = useMemo(
    () =>
      search.category
        ? categories.find(
            (category) => category.id === search.category || category.slug === search.category,
          )
        : undefined,
    [categories, search.category],
  );
  const selectedGovernorate = governorates.find((gov) => gov.id === govId);
  const selectedSubcategory = subcategories.find((subcategory) => subcategory.id === subcategoryId);
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
  const hasActiveFilters = Boolean(
    selectedCategory ||
    selectedSubcategory ||
    selectedGovernorate ||
    districtAr ||
    q.trim() ||
    priceMin.trim() ||
    priceMax.trim() ||
    carMake ||
    carModel ||
    fuelType ||
    transmission ||
    propertyPurpose ||
    propertyType ||
    rooms.trim() ||
    rentalDuration ||
    electronicsBrand ||
    detailCondition ||
    employmentType ||
    salaryType ||
    sort !== "latest",
  );

  useEffect(() => {
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
    search.rental_duration,
    search.rooms,
    search.salary_type,
    search.sort,
    search.subcategory,
    search.transmission,
  ]);

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
    if (districtAr && selectedGovernorate && !availableDistricts.includes(districtAr)) {
      setDistrictAr("");
    }
  }, [availableDistricts, districtAr, selectedGovernorate]);

  useEffect(() => {
    void navigate({
      to: "/listings",
      search: {
        category: selectedCategory?.id,
        subcategory: subcategoryId || undefined,
        gov: govId || undefined,
        district: districtAr || undefined,
        price_min: parsedPriceMin,
        price_max: parsedPriceMax,
        car_make: carMake || undefined,
        car_model: carModel || undefined,
        fuel: fuelType || undefined,
        transmission: transmission || undefined,
        property_purpose: propertyPurpose || undefined,
        property_type: propertyType || undefined,
        rooms: rooms.trim() ? Number(rooms) : undefined,
        rental_duration: rentalDuration || undefined,
        electronics_brand: electronicsBrand || undefined,
        detail_condition: detailCondition || undefined,
        employment_type: employmentType || undefined,
        salary_type: salaryType || undefined,
        q: debouncedQ || undefined,
        sort: sort === "latest" ? undefined : sort,
      },
      replace: true,
    });
  }, [
    selectedCategory?.id,
    subcategoryId,
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

  useEffect(() => {
    let cancelled = false;

    async function loadReferences() {
      setLoading(true);
      setError(null);

      const [categoriesResult, subcategoriesResult, governoratesResult] = await Promise.all([
        fetchPublicCategories(),
        fetchPublicSubcategories(),
        fetchPublicGovernorates(),
      ]);

      if (cancelled) return;

      if (!categoriesResult.ok) {
        setError(categoriesResult.error);
        setLoading(false);
        return;
      }

      if (!subcategoriesResult.ok) {
        setError(subcategoriesResult.error);
        setLoading(false);
        return;
      }

      if (!governoratesResult.ok) {
        setError(governoratesResult.error);
        setLoading(false);
        return;
      }

      setCategories(categoriesResult.data);
      setSubcategories(subcategoriesResult.data);
      setGovernorates(governoratesResult.data);
      const initialGov = search.gov
        ? governoratesResult.data.find((gov) => gov.id === search.gov || gov.slug === search.gov)
        : undefined;
      setGovId(initialGov?.id ?? "");
    }

    void loadReferences();

    return () => {
      cancelled = true;
    };
  }, [search.gov]);

  useEffect(() => {
    if (categories.length === 0 && governorates.length === 0) return;

    let cancelled = false;

    async function loadListings() {
      setLoading(true);
      setError(null);

      const [result, sellerResult] = await Promise.all([
        fetchPublicListings({
          categoryId: selectedCategory?.id,
          subcategoryId: subcategoryId || undefined,
          governorateId: govId || undefined,
          districtAr: districtAr || undefined,
          priceMin: Number.isFinite(parsedPriceMin) ? parsedPriceMin : undefined,
          priceMax: Number.isFinite(parsedPriceMax) ? parsedPriceMax : undefined,
          carMake: carMake || undefined,
          carModel: carModel || undefined,
          fuelType: fuelType || undefined,
          transmission: transmission || undefined,
          propertyPurpose: propertyPurpose || undefined,
          propertyType: propertyType || undefined,
          rooms: rooms.trim() ? Number(rooms) : undefined,
          rentalDuration: rentalDuration || undefined,
          electronicsBrand: electronicsBrand || undefined,
          detailCondition: detailCondition || undefined,
          employmentType: employmentType || undefined,
          salaryType: salaryType || undefined,
          query: debouncedQ,
          sort,
        }),
        searchPublicSellers(debouncedQ),
      ]);

      if (cancelled) return;

      if (!result.ok) {
        setError(result.error);
        setItems([]);
      } else {
        setItems(result.data);
      }

      if (sellerResult.ok) {
        setSellerResults(sellerResult.data);
        setSellerSearchError(null);
      } else {
        setSellerResults([]);
        setSellerSearchError(sellerResult.error);
      }

      setLoading(false);
    }

    void loadListings();

    return () => {
      cancelled = true;
    };
  }, [
    categories.length,
    governorates.length,
    selectedCategory?.id,
    subcategoryId,
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
  ]);

  const title = selectedCategory
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
    selectedCategory
      ? {
          key: "category",
          label: categoryName(selectedCategory.id, selectedCategory.nameAr, language),
          clear: () => {
            setSubcategoryId("");
            void navigate({
              to: "/listings",
              search: {
                gov: govId || undefined,
                district: districtAr || undefined,
                price_min: parsedPriceMin,
                price_max: parsedPriceMax,
                q: q.trim() || undefined,
                sort,
              },
            });
          },
        }
      : null,
    selectedSubcategory
      ? { key: "subcategory", label: selectedSubcategory.nameAr, clear: () => setSubcategoryId("") }
      : null,
    selectedGovernorate
      ? {
          key: "governorate",
          label: governorateName(selectedGovernorate.id, selectedGovernorate.nameAr, language),
          clear: () => {
            setGovId("");
            setDistrictAr("");
          },
        }
      : null,
    districtAr ? { key: "district", label: districtAr, clear: () => setDistrictAr("") } : null,
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
    sort !== "latest"
      ? {
          key: "sort",
          label: sortChips.find((chip) => chip.id === sort)?.label ?? sort,
          clear: () => setSort("latest"),
        }
      : null,
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
    propertyPurpose
      ? {
          key: "propertyPurpose",
          label: propertyPurposeLabels[propertyPurpose] ?? propertyPurpose,
          clear: () => setPropertyPurpose(""),
        }
      : null,
    propertyType
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

  function resetFilters() {
    setSubcategoryId("");
    setGovId("");
    setDistrictAr("");
    setPriceMin("");
    setPriceMax("");
    setCarMake("");
    setCarModel("");
    setFuelType("");
    setTransmission("");
    setPropertyPurpose("");
    setPropertyType("");
    setRooms("");
    setRentalDuration("");
    setElectronicsBrand("");
    setDetailCondition("");
    setEmploymentType("");
    setSalaryType("");
    setQ("");
    setSort("latest");
    setFiltersOpen(false);
    void navigate({ to: "/listings", search: {} });
  }

  return (
    <>
      <PageHeader title={title} />
      <main className="container-wide pt-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <div className="flex items-center gap-2 rounded-xl bg-card px-3 py-2.5 hairline">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder={text("ابحث ضمن الإعلانات المعتمدة...", "Search approved listings...")}
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground lg:hidden"
          >
            <MapPin className="h-4 w-4 text-gold" />{" "}
            {selectedGovernorate
              ? governorateName(selectedGovernorate.id, selectedGovernorate.nameAr, language)
              : text("كل سوريا", "All Syria")}
          </button>
        </div>

        <section className="mt-3 hidden rounded-2xl bg-card p-3 shadow-soft hairline lg:block">
          <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
            <div>
              <h2 className="mb-2 text-xs font-extrabold text-muted-foreground">
                {text("الأقسام", "Categories")}
              </h2>
              <div className="no-scrollbar flex gap-2 overflow-x-auto lg:grid lg:grid-cols-1 lg:overflow-visible">
                <Link
                  to="/listings"
                  search={{ gov: govId || undefined, q: q.trim() || undefined, sort }}
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
                    search={{
                      category: category.id,
                      gov: govId || undefined,
                      q: q.trim() || undefined,
                      sort,
                    }}
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
                        {subcategory.nameAr}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <h2 className="mb-2 text-xs font-extrabold text-muted-foreground">
                {text("الترتيب والمكان", "Sort and location")}
              </h2>
              <div className="rounded-xl bg-muted-surface p-2">
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {sortChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setSort(chip.id)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                        sort === chip.id
                          ? "bg-gold text-gold-foreground"
                          : "bg-card text-foreground hairline hover:bg-secondary"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
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
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-bold text-muted-foreground">
                      {text("المنطقة", "District")}
                    </span>
                    <select
                      value={districtAr}
                      onChange={(event) => setDistrictAr(event.target.value)}
                      disabled={!selectedGovernorate}
                      className="input text-xs disabled:opacity-60"
                    >
                      <option value="">{text("كل المناطق", "All districts")}</option>
                      {availableDistricts.map((district) => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                  </label>
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
                    propertyPurpose,
                    propertyType,
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
          <div className="fixed inset-0 z-50 bg-primary/45 p-3 lg:hidden">
            <div className="ms-auto flex h-full max-w-sm flex-col overflow-hidden rounded-2xl bg-card shadow-premium hairline">
              <div className="flex items-center justify-between border-b border-border p-4">
                <h2 className="text-sm font-extrabold">
                  {text("فلترة الإعلانات", "Filter listings")}
                </h2>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-foreground"
                  aria-label={text("إغلاق الفلاتر", "Close filters")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 overflow-y-auto p-4">
                <div>
                  <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                    {text("الأقسام", "Categories")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/listings"
                      search={{ gov: govId || undefined, q: q.trim() || undefined, sort }}
                      onClick={() => {
                        setSubcategoryId("");
                        setFiltersOpen(false);
                      }}
                      className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                        !selectedCategory
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted-surface text-foreground"
                      }`}
                    >
                      {text("كل الأقسام", "All categories")}
                    </Link>
                    {categories.map((category) => (
                      <Link
                        key={category.id}
                        to="/listings"
                        search={{
                          category: category.id,
                          gov: govId || undefined,
                          q: q.trim() || undefined,
                          sort,
                        }}
                        onClick={() => {
                          setSubcategoryId("");
                          setFiltersOpen(false);
                        }}
                        className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                          selectedCategory?.id === category.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-surface text-foreground"
                        }`}
                      >
                        {categoryName(category.id, category.nameAr, language)}
                      </Link>
                    ))}
                  </div>
                </div>

                {selectedCategory && availableSubcategories.length > 0 && (
                  <div>
                    <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                      {text("الأقسام الفرعية", "Subcategories")}
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSubcategoryId("")}
                        className={`rounded-xl px-3 py-2 text-start text-xs font-bold ${
                          !subcategoryId
                            ? "bg-gold text-gold-foreground"
                            : "bg-muted-surface text-foreground"
                        }`}
                      >
                        {text("كل القسم", "All in category")}
                      </button>
                      {availableSubcategories.map((subcategory) => (
                        <button
                          key={subcategory.id}
                          type="button"
                          onClick={() => setSubcategoryId(subcategory.id)}
                          className={`rounded-xl px-3 py-2 text-start text-xs font-bold ${
                            subcategoryId === subcategory.id
                              ? "bg-gold text-gold-foreground"
                              : "bg-muted-surface text-foreground"
                          }`}
                        >
                          {subcategory.nameAr}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                    {text("الموقع", "Location")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGovId("");
                        setDistrictAr("");
                      }}
                      className={`rounded-xl px-3 py-2 text-start text-xs font-bold ${
                        !govId ? "bg-primary text-primary-foreground" : "bg-muted-surface"
                      }`}
                    >
                      {text("كل سوريا", "All Syria")}
                    </button>
                    {governorates.map((governorate) => (
                      <button
                        key={governorate.id}
                        type="button"
                        onClick={() => {
                          setGovId(governorate.id);
                          setDistrictAr("");
                        }}
                        className={`rounded-xl px-3 py-2 text-start text-xs font-bold ${
                          govId === governorate.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted-surface"
                        }`}
                      >
                        {governorateName(governorate.id, governorate.nameAr, language)}
                      </button>
                    ))}
                  </div>
                  <select
                    value={districtAr}
                    onChange={(event) => setDistrictAr(event.target.value)}
                    disabled={!selectedGovernorate}
                    className="input mt-3 text-xs disabled:opacity-60"
                  >
                    <option value="">{text("كل المناطق", "All districts")}</option>
                    {availableDistricts.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
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

                <CategorySpecificFilterFields
                  kind={categoryFieldKind}
                  text={text}
                  values={{
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
                />

                <div>
                  <h3 className="mb-2 text-xs font-extrabold text-muted-foreground">
                    {text("الترتيب", "Sort")}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {sortChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => setSort(chip.id)}
                        className={`rounded-xl px-3 py-2 text-xs font-bold ${
                          sort === chip.id
                            ? "bg-gold text-gold-foreground"
                            : "bg-muted-surface text-foreground"
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={!hasActiveFilters}
                  className="rounded-xl bg-card px-4 py-2.5 text-xs font-bold hairline disabled:opacity-50"
                >
                  {text("مسح الفلاتر", "Clear filters")}
                </button>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
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

        <div className="no-scrollbar mt-3 hidden gap-2 overflow-x-auto pb-1">
          {sortChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setSort(chip.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                sort === chip.id
                  ? "bg-gold text-gold-foreground"
                  : "bg-card text-foreground hairline hover:bg-muted-surface"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {loading
              ? text("جاري تحميل الإعلانات...", "Loading listings...")
              : text(`${items.length} إعلان معتمد`, `${items.length} approved listings`)}
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
            className="rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground hairline"
          >
            {text("تصفح الأقسام", "Browse categories")}
          </Link>
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={filter.clear}
              className="inline-flex items-center gap-1 rounded-full bg-muted-surface px-3 py-1.5 text-xs font-bold text-foreground hairline"
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

        {loading ? (
          <StateCard
            title={text("جاري تحميل الإعلانات", "Loading listings")}
            body={text(
              "نبحث عن الإعلانات المعتمدة المتاحة للتصفح داخل سوريا.",
              "Looking for approved listings available across Syria.",
            )}
          />
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
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((listing) => (
              <RealListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function CategorySpecificFilterFields({
  kind,
  text,
  values,
  setters,
}: {
  kind: CategoryFieldKind;
  text: (ar: string, en: string) => string;
  values: {
    carMake: string;
    carModel: string;
    fuelType: string;
    transmission: string;
    propertyPurpose: string;
    propertyType: string;
    rooms: string;
    rentalDuration: string;
    electronicsBrand: string;
    detailCondition: string;
    employmentType: string;
    salaryType: string;
  };
  setters: {
    setCarMake: (value: string) => void;
    setCarModel: (value: string) => void;
    setFuelType: (value: string) => void;
    setTransmission: (value: string) => void;
    setPropertyPurpose: (value: string) => void;
    setPropertyType: (value: string) => void;
    setRooms: (value: string) => void;
    setRentalDuration: (value: string) => void;
    setElectronicsBrand: (value: string) => void;
    setDetailCondition: (value: string) => void;
    setEmploymentType: (value: string) => void;
    setSalaryType: (value: string) => void;
  };
}) {
  if (kind === "vehicles") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterSelect
          label={text("الشركة", "Make")}
          value={values.carMake}
          onChange={setters.setCarMake}
        >
          <option value="">{text("كل الشركات", "All makes")}</option>
          {carMakeOptions.map((make) => (
            <option key={make} value={make}>
              {make === "Other" ? text("أخرى", "Other") : make}
            </option>
          ))}
        </FilterSelect>
        <FilterInput
          label={text("الطراز", "Model")}
          value={values.carModel}
          onChange={setters.setCarModel}
        />
        <FilterSelect
          label={text("الوقود", "Fuel")}
          value={values.fuelType}
          onChange={setters.setFuelType}
        >
          <option value="">{text("كل الأنواع", "All fuel types")}</option>
          <option value="gasoline">{text("بنزين", "Gasoline")}</option>
          <option value="diesel">{text("ديزل", "Diesel")}</option>
          <option value="hybrid">{text("هجين", "Hybrid")}</option>
          <option value="electric">{text("كهرباء", "Electric")}</option>
          <option value="gas">{text("غاز", "Gas")}</option>
          <option value="other">{text("أخرى", "Other")}</option>
        </FilterSelect>
        <FilterSelect
          label={text("ناقل الحركة", "Transmission")}
          value={values.transmission}
          onChange={setters.setTransmission}
        >
          <option value="">{text("كل الأنواع", "All")}</option>
          <option value="automatic">{text("أوتوماتيك", "Automatic")}</option>
          <option value="manual">{text("يدوي", "Manual")}</option>
          <option value="semi_auto">{text("نصف أوتوماتيك", "Semi-auto")}</option>
        </FilterSelect>
      </div>
    );
  }

  if (kind === "real_estate") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterSelect
          label={text("الغرض", "Purpose")}
          value={values.propertyPurpose}
          onChange={setters.setPropertyPurpose}
        >
          <option value="">{text("بيع أو إيجار", "Sale or rent")}</option>
          <option value="sale">{text("بيع", "Sale")}</option>
          <option value="rent">{text("إيجار", "Rent")}</option>
        </FilterSelect>
        <FilterSelect
          label={text("نوع العقار", "Property type")}
          value={values.propertyType}
          onChange={setters.setPropertyType}
        >
          <option value="">{text("كل الأنواع", "All types")}</option>
          <option value="apartment">{text("شقة", "Apartment")}</option>
          <option value="house">{text("منزل", "House")}</option>
          <option value="villa">{text("فيلا", "Villa")}</option>
          <option value="land">{text("أرض", "Land")}</option>
          <option value="shop">{text("محل", "Shop")}</option>
          <option value="office">{text("مكتب", "Office")}</option>
          <option value="warehouse">{text("مستودع", "Warehouse")}</option>
        </FilterSelect>
        <FilterInput
          label={text("عدد الغرف", "Rooms")}
          value={values.rooms}
          onChange={setters.setRooms}
          inputMode="numeric"
        />
        <FilterSelect
          label={text("مدة الإيجار", "Rental duration")}
          value={values.rentalDuration}
          onChange={setters.setRentalDuration}
        >
          <option value="">{text("كل المدد", "All durations")}</option>
          <option value="daily">{text("يومي", "Daily")}</option>
          <option value="monthly">{text("شهري", "Monthly")}</option>
          <option value="yearly">{text("سنوي", "Yearly")}</option>
          <option value="negotiable">{text("قابل للاتفاق", "Negotiable")}</option>
        </FilterSelect>
      </div>
    );
  }

  if (kind === "electronics") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterInput
          label={text("الشركة", "Brand")}
          value={values.electronicsBrand}
          onChange={setters.setElectronicsBrand}
        />
        <FilterSelect
          label={text("الحالة", "Condition")}
          value={values.detailCondition}
          onChange={setters.setDetailCondition}
        >
          <option value="">{text("كل الحالات", "All conditions")}</option>
          <option value="new">{text("جديد", "New")}</option>
          <option value="used">{text("مستعمل", "Used")}</option>
          <option value="excellent">{text("ممتاز", "Excellent")}</option>
          <option value="good">{text("جيد", "Good")}</option>
          <option value="needs_work">{text("يحتاج صيانة", "Needs work")}</option>
        </FilterSelect>
      </div>
    );
  }

  if (kind === "jobs") {
    return (
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <FilterSelect
          label={text("نمط العمل", "Employment type")}
          value={values.employmentType}
          onChange={setters.setEmploymentType}
        >
          <option value="">{text("كل الأنماط", "All types")}</option>
          <option value="full_time">{text("دوام كامل", "Full-time")}</option>
          <option value="part_time">{text("دوام جزئي", "Part-time")}</option>
          <option value="contract">{text("عقد", "Contract")}</option>
          <option value="temporary">{text("مؤقت", "Temporary")}</option>
          <option value="internship">{text("تدريب", "Internship")}</option>
        </FilterSelect>
        <FilterSelect
          label={text("نوع الراتب", "Salary type")}
          value={values.salaryType}
          onChange={setters.setSalaryType}
        >
          <option value="">{text("كل الأنواع", "All salary types")}</option>
          <option value="fixed">{text("ثابت", "Fixed")}</option>
          <option value="range">{text("نطاق", "Range")}</option>
          <option value="commission">{text("عمولة", "Commission")}</option>
          <option value="negotiable">{text("قابل للتفاوض", "Negotiable")}</option>
          <option value="not_listed">{text("غير معلن", "Not listed")}</option>
        </FilterSelect>
      </div>
    );
  }

  return null;
}

function FilterInput({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        className="input text-xs"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input text-xs"
      >
        {children}
      </select>
    </label>
  );
}

function GovernorateChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-muted-surface text-foreground hover:bg-secondary"
      }`}
    >
      {label}
    </button>
  );
}

function RealListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-2xl bg-card hairline shadow-soft transition-shadow hover:shadow-premium"
    >
      <div className="relative">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <div className="absolute top-2 start-2 flex flex-wrap gap-1">
          {listing.isFeatured && (
            <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
              {text("مميز", "Featured")}
            </span>
          )}
          <span className="rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
            {text("معتمد", "Approved")}
          </span>
        </div>
        <span className="absolute bottom-2 end-2 rounded-md bg-primary/85 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-lg font-extrabold text-foreground">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language)}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" />{" "}
            {governorateName(
              listing.governorateId,
              listing.governorateNameAr ?? undefined,
              language,
            )}
            {listing.districtAr ? ` · ${listing.districtAr}` : ""}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {formatDate(listing.createdAt, language)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function SellerSearchCard({ seller }: { seller: PublicSellerSearchResult }) {
  const { text } = useUiPreferences();
  const title = seller.businessName || seller.displayName;

  return (
    <Link
      to="/seller/$id"
      params={{ id: seller.id }}
      className="flex items-center gap-3 rounded-2xl bg-card p-3 transition hairline hover:bg-muted-surface"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-muted-surface text-sm font-bold text-primary">
        {seller.avatarUrl ? (
          <img
            src={seller.avatarUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          title.slice(0, 1)
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-extrabold">{title}</span>
        {seller.businessName && seller.displayName !== seller.businessName && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {seller.displayName}
          </span>
        )}
        <span className="mt-1 block truncate text-[11px] text-muted-foreground">
          {[
            seller.governorate,
            text(`${seller.approvedListingCount} إعلان`, `${seller.approvedListingCount} listings`),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}

function StateCard({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="mt-10 rounded-2xl bg-card p-10 text-center hairline">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function formatDate(value: string, language: "ar" | "en") {
  if (!value) return language === "ar" ? "تاريخ غير محدد" : "Date unavailable";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
