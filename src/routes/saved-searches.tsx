import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bookmark, Search, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { createSavedSearch, deleteSavedSearch, fetchSavedSearches } from "@/lib/classifieds-api";
import type { ClassifiedsError, ListingFilters, SavedSearch } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/saved-searches")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
    category: typeof search.category === "string" ? search.category : "",
    subcategory: typeof search.subcategory === "string" ? search.subcategory : "",
    gov: typeof search.gov === "string" ? search.gov : "",
    district: typeof search.district === "string" ? search.district : "",
    price_min: typeof search.price_min === "string" ? search.price_min : "",
    price_max: typeof search.price_max === "string" ? search.price_max : "",
    car_make: typeof search.car_make === "string" ? search.car_make : "",
    car_model: typeof search.car_model === "string" ? search.car_model : "",
    fuel: typeof search.fuel === "string" ? search.fuel : "",
    transmission: typeof search.transmission === "string" ? search.transmission : "",
    property_purpose: typeof search.property_purpose === "string" ? search.property_purpose : "",
    property_type: typeof search.property_type === "string" ? search.property_type : "",
    rooms: typeof search.rooms === "string" ? search.rooms : "",
    rental_duration: typeof search.rental_duration === "string" ? search.rental_duration : "",
    electronics_brand: typeof search.electronics_brand === "string" ? search.electronics_brand : "",
    detail_condition: typeof search.detail_condition === "string" ? search.detail_condition : "",
    employment_type: typeof search.employment_type === "string" ? search.employment_type : "",
    salary_type: typeof search.salary_type === "string" ? search.salary_type : "",
    sort:
      search.sort === "cheapest" || search.sort === "expensive" || search.sort === "featured"
        ? search.sort
        : "latest",
  }),
  head: () => ({
    meta: [
      { title: "عمليات البحث المحفوظة | رَوَاج" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SavedSearchesPage,
});

type LocalSearch = {
  id: string;
  nameAr: string;
  filters: Record<string, string>;
  createdAt: string;
  frequency: "daily" | "weekly" | "off";
};

function SavedSearchesPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const search = Route.useSearch();
  const [items, setItems] = useState<SavedSearch[]>([]);
  const [localItems, setLocalItems] = useState<LocalSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [frequency, setFrequency] = useState<LocalSearch["frequency"]>("weekly");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (auth.status !== "signedIn") return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchSavedSearches(auth.profile?.id ?? null);
      if (cancelled) return;
      if (result.ok) setItems(result.data);
      else {
        setError(result.error);
        setItems([]);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.profile?.id]);

  function buildListingFilters(): ListingFilters {
    const filters: ListingFilters = {};

    const keywordValue = keyword.trim();
    if (keywordValue) {
      filters.query = keywordValue;
    } else if (search.q) {
      filters.query = search.q;
    }

    if (search.category) filters.categoryId = search.category;
    if (search.subcategory) filters.subcategoryId = search.subcategory;
    if (search.gov) filters.governorateId = search.gov;
    if (search.district) filters.districtAr = search.district;

    if (search.price_min !== "") {
      const parsed = Number(search.price_min);
      if (!Number.isNaN(parsed)) filters.priceMin = parsed;
    }
    if (search.price_max !== "") {
      const parsed = Number(search.price_max);
      if (!Number.isNaN(parsed)) filters.priceMax = parsed;
    }

    if (search.car_make) filters.carMake = search.car_make;
    if (search.car_model) filters.carModel = search.car_model;
    if (search.fuel) filters.fuelType = search.fuel;
    if (search.transmission) filters.transmission = search.transmission;
    if (search.property_purpose) filters.propertyPurpose = search.property_purpose;
    if (search.property_type) filters.propertyType = search.property_type;
    if (search.rooms !== "") {
      const parsed = Number(search.rooms);
      if (!Number.isNaN(parsed)) filters.rooms = parsed;
    }
    if (search.rental_duration) filters.rentalDuration = search.rental_duration;
    if (search.electronics_brand) filters.electronicsBrand = search.electronics_brand;
    if (search.detail_condition) filters.detailCondition = search.detail_condition;
    if (search.employment_type) filters.employmentType = search.employment_type;
    if (search.salary_type) filters.salaryType = search.salary_type;

    if (search.sort !== "latest")
      filters.sort = search.sort as "cheapest" | "expensive" | "featured";

    return filters;
  }

  async function addSavedSearch(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const label = name.trim() || text("بحث محفوظ", "Saved search");
    const filters = buildListingFilters();
    const result = await createSavedSearch(auth.profile?.id ?? null, {
      nameAr: label,
      filters,
    });

    if (result.ok) {
      setItems((current) => [result.data, ...current]);
      setMessage(text("تم حفظ البحث في حسابك.", "Search saved to your account."));
    } else {
      setLocalItems((current) => [
        {
          id: `local-${Date.now()}`,
          nameAr: label,
          filters: toLocalFilters(filters),
          createdAt: new Date().toISOString(),
          frequency,
        },
        ...current,
      ]);
      setMessage(
        text(
          "تعذر حفظ البحث في الحساب، فتم حفظه لهذه الجلسة فقط.",
          "Could not save this search to the account, so it was saved for this session only.",
        ),
      );
      setError(result.error);
    }
    setName("");
    setKeyword("");
  }

  function toLocalFilters(filters: ListingFilters): Record<string, string> {
    const result: Record<string, string> = {};
    if (filters.query) result.q = filters.query;
    if (filters.categoryId) result.category = filters.categoryId;
    if (filters.subcategoryId) result.subcategory = filters.subcategoryId;
    if (filters.governorateId) result.gov = filters.governorateId;
    if (filters.districtAr) result.district = filters.districtAr;
    if (filters.priceMin !== undefined) result.price_min = String(filters.priceMin);
    if (filters.priceMax !== undefined) result.price_max = String(filters.priceMax);
    if (filters.carMake) result.car_make = filters.carMake;
    if (filters.carModel) result.car_model = filters.carModel;
    if (filters.fuelType) result.fuel = filters.fuelType;
    if (filters.transmission) result.transmission = filters.transmission;
    if (filters.propertyPurpose) result.property_purpose = filters.propertyPurpose;
    if (filters.propertyType) result.property_type = filters.propertyType;
    if (filters.rooms !== undefined) result.rooms = String(filters.rooms);
    if (filters.rentalDuration) result.rental_duration = filters.rentalDuration;
    if (filters.electronicsBrand) result.electronics_brand = filters.electronicsBrand;
    if (filters.detailCondition) result.detail_condition = filters.detailCondition;
    if (filters.employmentType) result.employment_type = filters.employmentType;
    if (filters.salaryType) result.salary_type = filters.salaryType;
    if (filters.sort) result.sort = filters.sort;
    return result;
  }

  async function removeSavedSearch(id: string) {
    setMessage("");
    const result = await deleteSavedSearch(auth.profile?.id ?? null, id);
    if (!result.ok) {
      setError(result.error);
      setMessage(result.error.message);
      return;
    }

    setItems((current) => current.filter((item) => item.id !== id));
    setMessage(text("تم حذف البحث المحفوظ.", "Saved search removed."));
  }

  if (auth.status === "loading") {
    return (
      <State
        heading={text("جارٍ التحقق من الجلسة", "Checking session")}
        body={text("نجهّز عمليات البحث الخاصة بك.", "Preparing your saved searches.")}
      />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <State
        heading={text("تسجيل الدخول مطلوب", "Login required")}
        body={text(
          "سجّل الدخول لحفظ عمليات البحث والرجوع إليها بسرعة.",
          "Log in to save searches and return to them quickly.",
        )}
        actionLabel={text("تسجيل الدخول", "Log in")}
        actionTo="/login"
        actionSearch={{ returnTo: "/saved-searches" }}
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <State
        heading={text("البحث المحفوظ مرتبط بالحساب", "Saved search is account based")}
        body={text(
          "استخدم الفلاتر الآن، وعند توفر جلسة الحساب ستظهر عمليات البحث المحفوظة هنا.",
          "Use filters now; when account session is available, saved searches appear here.",
        )}
        actionLabel={text("ابدأ البحث", "Start searching")}
        actionTo="/listings"
      />
    );
  }

  return (
    <>
      <PageHeader title={text("عمليات البحث المحفوظة", "Saved searches")} />
      <main className="container-wide mobile-page-bottom space-y-4 pt-4">
        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">
            {text("احفظ فلاتر البحث المهمة", "Save important search filters")}
          </h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {text(
              "أنشئ بحثاً باسم واضح واضبط تكرار التنبيه كإعداد واجهة، ثم افتحه من هنا عند الحاجة.",
              "Create a clearly named search, set an alert frequency as an interface preference, and reopen it from here when needed.",
            )}
          </p>
        </section>

        <form
          onSubmit={addSavedSearch}
          className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 hairline md:grid-cols-[1fr_1fr_180px_auto]"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={text("اسم البحث", "Search name")}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
          />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={text("كلمة البحث", "Search keyword")}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
          />
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as LocalSearch["frequency"])}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm"
          >
            <option value="daily">{text("تنبيه يومي", "Daily alert")}</option>
            <option value="weekly">{text("تنبيه أسبوعي", "Weekly alert")}</option>
            <option value="off">{text("بدون تنبيه", "No alert")}</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
          >
            {text("حفظ البحث", "Save search")}
          </button>
        </form>

        {message && (
          <p className="rounded-xl bg-muted-surface p-3 text-xs font-semibold text-foreground hairline">
            {message}
          </p>
        )}

        {loading ? (
          <Panel title={text("جارٍ تحميل عمليات البحث", "Loading saved searches")} />
        ) : error && items.length === 0 && localItems.length === 0 ? (
          <Panel
            title={text("تعذر تحميل عمليات البحث", "Could not load saved searches")}
            body={error.message}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        ) : items.length === 0 && localItems.length === 0 ? (
          <Panel
            title={text("لا توجد عمليات بحث محفوظة", "No saved searches")}
            body={text(
              "احفظ بحثك الأول من النموذج أعلاه أو ابدأ من صفحة الإعلانات.",
              "Save your first search from the form above or start from listings.",
            )}
            actionLabel={text("ابدأ البحث", "Start searching")}
            actionTo="/listings"
          />
        ) : (
          <ul className="space-y-2">
            {localItems.map((item) => (
              <SearchRow
                key={item.id}
                id={item.id}
                name={item.nameAr}
                createdAt={item.createdAt}
                filters={item.filters}
                frequency={item.frequency}
                local
                onRemove={() =>
                  setLocalItems((current) => current.filter((entry) => entry.id !== item.id))
                }
              />
            ))}
            {items.map((item) => (
              <SearchRow
                key={item.id}
                id={item.id}
                name={item.nameAr}
                createdAt={item.createdAt}
                filters={item.filters as Record<string, unknown>}
                frequency="weekly"
                onRemove={() => void removeSavedSearch(item.id)}
              />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

function SearchRow({
  id,
  name,
  createdAt,
  filters,
  frequency,
  local = false,
  onRemove,
}: {
  id: string;
  name: string;
  createdAt: string;
  filters: Record<string, unknown>;
  frequency: LocalSearch["frequency"];
  local?: boolean;
  onRemove?: () => void;
}) {
  const { language, text } = useUiPreferences();
  return (
    <li className="rounded-2xl bg-card p-4 hairline">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gold" />
            <span className="truncate text-sm font-bold">{name}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>{formatDate(createdAt, language)}</span>
            <span className="inline-flex items-center gap-1">
              <Bell className="h-3 w-3" />
              {frequencyLabel(frequency, language)}
            </span>
            {local && <span>{text("محفوظ في هذه الجلسة", "Saved in this session")}</span>}
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive"
            aria-label={text("حذف البحث", "Remove search")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3">
        <Link
          to="/listings"
          search={toListingSearch(filters)}
          className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
        >
          {text("فتح البحث", "Open search")}
        </Link>
      </div>
    </li>
  );
}

function toListingSearch(filters: Record<string, unknown>) {
  return {
    q: stringFilter(filters.query) || stringFilter(filters.q) || undefined,
    category: stringFilter(filters.categoryId) || stringFilter(filters.category) || undefined,
    subcategory:
      stringFilter(filters.subcategoryId) || stringFilter(filters.subcategory) || undefined,
    gov: stringFilter(filters.governorateId) || stringFilter(filters.gov) || undefined,
    district: stringFilter(filters.districtAr) || stringFilter(filters.district) || undefined,
    price_min: numberFilter(filters.priceMin) ?? numberFilter(filters.price_min),
    price_max: numberFilter(filters.priceMax) ?? numberFilter(filters.price_max),
    car_make: stringFilter(filters.carMake) || stringFilter(filters.car_make) || undefined,
    car_model: stringFilter(filters.carModel) || stringFilter(filters.car_model) || undefined,
    fuel: stringFilter(filters.fuelType) || stringFilter(filters.fuel) || undefined,
    transmission: stringFilter(filters.transmission) || undefined,
    property_purpose:
      stringFilter(filters.propertyPurpose) || stringFilter(filters.property_purpose) || undefined,
    property_type:
      stringFilter(filters.propertyType) || stringFilter(filters.property_type) || undefined,
    rooms: numberFilter(filters.rooms) ?? numberFilter(filters.rooms),
    rental_duration:
      stringFilter(filters.rentalDuration) || stringFilter(filters.rental_duration) || undefined,
    electronics_brand:
      stringFilter(filters.electronicsBrand) ||
      stringFilter(filters.electronics_brand) ||
      undefined,
    detail_condition:
      stringFilter(filters.detailCondition) || stringFilter(filters.detail_condition) || undefined,
    employment_type:
      stringFilter(filters.employmentType) || stringFilter(filters.employment_type) || undefined,
    salary_type: stringFilter(filters.salaryType) || stringFilter(filters.salary_type) || undefined,
    sort: sortFilter(filters.sort),
  };
}

function stringFilter(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberFilter(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function sortFilter(value: unknown): "latest" | "cheapest" | "expensive" | "featured" | undefined {
  return value === "latest" || value === "cheapest" || value === "expensive" || value === "featured"
    ? value
    : undefined;
}

function State({
  heading,
  body,
  actionLabel,
  actionTo,
  actionSearch,
}: {
  heading: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
  actionSearch?: Record<string, string>;
}) {
  const { text } = useUiPreferences();
  return (
    <>
      <PageHeader title={text("عمليات البحث المحفوظة", "Saved searches")} />
      <main className="container-wide mobile-page-bottom pt-10">
        <Panel
          title={heading}
          body={body}
          actionLabel={actionLabel}
          actionTo={actionTo}
          actionSearch={actionSearch}
        />
      </main>
    </>
  );
}

function Panel({
  title,
  body,
  actionLabel,
  actionTo,
  actionSearch,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
  actionSearch?: Record<string, string>;
}) {
  const { language } = useUiPreferences();
  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <Bookmark className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>}
      {actionLabel && actionTo && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            to={actionTo}
            search={actionSearch}
            className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
          >
            {actionLabel}
          </Link>
          <Link
            to="/categories"
            className="inline-block rounded-xl bg-muted-surface px-5 py-2 text-sm font-bold text-foreground"
          >
            {uiLabel("تصفح الأقسام", language)}
          </Link>
        </div>
      )}
    </div>
  );
}

function frequencyLabel(value: LocalSearch["frequency"], language: Language) {
  if (value === "daily") return language === "ar" ? "تنبيه يومي" : "Daily alert";
  if (value === "weekly") return language === "ar" ? "تنبيه أسبوعي" : "Weekly alert";
  return language === "ar" ? "بدون تنبيه" : "No alert";
}

function formatDate(value: string, language: Language) {
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
