import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Bookmark, Search, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  createSavedSearch,
  deleteSavedSearch,
  fetchSavedSearches,
  scanDueSavedSearchAlerts,
  updateSavedSearchAlertFrequency,
} from "@/lib/classifieds-api";
import type {
  ClassifiedsError,
  ListingFilters,
  SavedSearch,
  SavedSearchAlertFrequency,
} from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/saved-searches")({
  validateSearch: (search: Record<string, unknown>) => ({
    taxonomy: typeof search.taxonomy === "string" ? search.taxonomy || undefined : undefined,
    q: typeof search.q === "string" ? search.q || undefined : undefined,
    category: typeof search.category === "string" ? search.category || undefined : undefined,
    subcategory:
      typeof search.subcategory === "string" ? search.subcategory || undefined : undefined,
    gov: typeof search.gov === "string" ? search.gov || undefined : undefined,
    district: typeof search.district === "string" ? search.district || undefined : undefined,
    price_min:
      typeof search.price_min === "string" || typeof search.price_min === "number"
        ? String(search.price_min) || undefined
        : undefined,
    price_max:
      typeof search.price_max === "string" || typeof search.price_max === "number"
        ? String(search.price_max) || undefined
        : undefined,
    price_type: typeof search.price_type === "string" ? search.price_type || undefined : undefined,
    condition: typeof search.condition === "string" ? search.condition || undefined : undefined,
    car_make: typeof search.car_make === "string" ? search.car_make || undefined : undefined,
    car_model: typeof search.car_model === "string" ? search.car_model || undefined : undefined,
    fuel: typeof search.fuel === "string" ? search.fuel || undefined : undefined,
    transmission:
      typeof search.transmission === "string" ? search.transmission || undefined : undefined,
    property_purpose:
      typeof search.property_purpose === "string"
        ? search.property_purpose || undefined
        : undefined,
    property_type:
      typeof search.property_type === "string" ? search.property_type || undefined : undefined,
    rooms: typeof search.rooms === "string" ? search.rooms || undefined : undefined,
    rental_duration:
      typeof search.rental_duration === "string" ? search.rental_duration || undefined : undefined,
    electronics_brand:
      typeof search.electronics_brand === "string"
        ? search.electronics_brand || undefined
        : undefined,
    detail_condition:
      typeof search.detail_condition === "string"
        ? search.detail_condition || undefined
        : undefined,
    employment_type:
      typeof search.employment_type === "string" ? search.employment_type || undefined : undefined,
    salary_type:
      typeof search.salary_type === "string" ? search.salary_type || undefined : undefined,
    sort:
      search.sort === "cheapest" || search.sort === "expensive" || search.sort === "featured"
        ? search.sort
        : undefined,
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
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [frequency, setFrequency] = useState<LocalSearch["frequency"]>("weekly");
  const [message, setMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  const [savingFrequencyId, setSavingFrequencyId] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("");
  const loadRequestIdRef = useRef(0);
  const loadedProfileIdRef = useRef<string | null>(null);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  const creatingSearchProfilesRef = useRef<Set<string>>(new Set());
  const frequencyScopesRef = useRef<Set<string>>(new Set());
  const deletingSearchScopesRef = useRef<Set<string>>(new Set());
  profileIdRef.current = profileId;

  const loadSavedSearches = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);
    setScanMessage("");
    try {
      const result = await fetchSavedSearches(currentProfileId);
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }

      setItems(result.data);
      setHasLoaded(true);
      setLoading(false);

      try {
        const scanResult = await scanDueSavedSearchAlerts(currentProfileId);
        if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current)
          return;
        if (!scanResult.ok) {
          setScanMessage(
            text(
              "تم تحميل عمليات البحث، لكن تعذر فحص النتائج الجديدة الآن.",
              "Saved searches loaded, but new matches could not be scanned right now.",
            ),
          );
          return;
        }
        if (scanResult.data.createdNotifications > 0) {
          setScanMessage(
            text(
              "تم العثور على " +
                scanResult.data.createdNotifications +
                " نتيجة جديدة وإضافتها إلى إشعاراتك.",
              scanResult.data.createdNotifications +
                " new matches were added to your notifications.",
            ),
          );
        }
        const refreshed = await fetchSavedSearches(currentProfileId);
        if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current)
          return;
        if (refreshed.ok) {
          setItems(refreshed.data);
        } else {
          setScanMessage(
            text(
              "تم فحص التنبيهات، لكن تعذر تحديث تفاصيل عمليات البحث فورًا.",
              "Alerts were scanned, but saved-search details could not refresh immediately.",
            ),
          );
        }
      } catch {
        if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current)
          return;
        setScanMessage(
          text(
            "تم تحميل عمليات البحث، لكن تعذر فحص النتائج الجديدة الآن.",
            "Saved searches loaded, but new matches could not be scanned right now.",
          ),
        );
      }
    } catch (caught) {
      if (requestId !== loadRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      setLoadError({
        code: "unknown",
        message:
          caught instanceof Error
            ? caught.message
            : text("تعذر تحميل عمليات البحث المحفوظة.", "Could not load saved searches."),
        operation: "saved_searches_load",
      });
    } finally {
      if (requestId === loadRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setLoading(false);
      }
    }
  }, [profileId, text]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      loadRequestIdRef.current += 1;
      loadedProfileIdRef.current = null;
      setItems([]);
      setLocalItems([]);
      setLoading(false);
      setHasLoaded(false);
      setLoadError(null);
      setName("");
      setKeyword("");
      setFrequency("weekly");
      setSavingFrequencyId(null);
      setCreating(false);
      setDeletingIds(new Set());
      setMessage("");
      setScanMessage("");
      return;
    }

    const profileChanged = loadedProfileIdRef.current !== profileId;
    loadedProfileIdRef.current = profileId;
    loadRequestIdRef.current += 1;
    setItems([]);
    setLoading(false);
    setHasLoaded(false);
    setLoadError(null);
    setMessage("");
    setScanMessage("");
    if (profileChanged) {
      setLocalItems([]);
      setName("");
      setKeyword("");
      setFrequency("weekly");
      setSavingFrequencyId(null);
    }
    void loadSavedSearches();

    return () => {
      loadRequestIdRef.current += 1;
    };
  }, [auth.status, loadSavedSearches, profileId]);

  function buildListingFilters(): ListingFilters {
    const filters: ListingFilters = {};
    if (search.taxonomy) filters.taxonomyNodeId = search.taxonomy;

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

    if (search.price_min !== undefined) {
      const parsed = Number(search.price_min);
      if (!Number.isNaN(parsed)) filters.priceMin = parsed;
    }
    if (search.price_max !== undefined) {
      const parsed = Number(search.price_max);
      if (!Number.isNaN(parsed)) filters.priceMax = parsed;
    }
    if (
      search.price_type === "fixed" ||
      search.price_type === "negotiable" ||
      search.price_type === "contact" ||
      search.price_type === "free"
    ) {
      filters.priceType = search.price_type;
    }
    if (search.condition) filters.condition = search.condition;

    if (search.car_make) filters.carMake = search.car_make;
    if (search.car_model) filters.carModel = search.car_model;
    if (search.fuel) filters.fuelType = search.fuel;
    if (search.transmission) filters.transmission = search.transmission;
    if (search.property_purpose) filters.propertyPurpose = search.property_purpose;
    if (search.property_type) filters.propertyType = search.property_type;
    if (search.rooms !== undefined) {
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
    const currentProfileId = profileId;
    if (!currentProfileId || creatingSearchProfilesRef.current.has(currentProfileId)) return;

    const label = name.trim() || text("بحث محفوظ", "Saved search");
    const filters = buildListingFilters();
    const currentFrequency = frequency;
    const saveLocally = () => {
      setLocalItems((current) => [
        {
          id: "local-" + currentProfileId + "-" + Date.now(),
          nameAr: label,
          filters: toLocalFilters(filters),
          createdAt: new Date().toISOString(),
          frequency: currentFrequency,
        },
        ...current,
      ]);
      setMessage(
        text(
          "تعذر حفظ البحث في الحساب، فتم حفظه لهذه الجلسة فقط.",
          "Could not save this search to the account, so it was saved for this session only.",
        ),
      );
    };

    creatingSearchProfilesRef.current.add(currentProfileId);
    setCreating(true);
    setMessage("");
    try {
      const result = await createSavedSearch(currentProfileId, {
        nameAr: label,
        filters,
        alertFrequency: currentFrequency,
      });
      if (currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setItems((current) => [
          result.data,
          ...current.filter((item) => item.id !== result.data.id),
        ]);
        setHasLoaded(true);
        setMessage(text("تم حفظ البحث في حسابك.", "Search saved to your account."));
      } else {
        saveLocally();
      }
      setName("");
      setKeyword("");
    } catch {
      if (currentProfileId !== profileIdRef.current) return;
      saveLocally();
      setName("");
      setKeyword("");
    } finally {
      creatingSearchProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setCreating(false);
    }
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

  async function changeAlertFrequency(id: string, next: SavedSearchAlertFrequency) {
    const currentProfileId = profileId;
    if (!currentProfileId) return;
    const scopeKey = [currentProfileId, id].join(":");
    if (frequencyScopesRef.current.has(scopeKey)) return;

    const previous = items;
    frequencyScopesRef.current.add(scopeKey);
    setSavingFrequencyId(id);
    setMessage("");
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, alertFrequency: next } : item)),
    );
    try {
      const result = await updateSavedSearchAlertFrequency(currentProfileId, id, next);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setItems(previous);
        setMessage(result.error.message);
        return;
      }
      setItems((current) => current.map((item) => (item.id === id ? result.data : item)));
      setMessage(text("تم تحديث تكرار التنبيه.", "Alert frequency updated."));
    } catch (caught) {
      if (currentProfileId !== profileIdRef.current) return;
      setItems(previous);
      setMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحديث تكرار التنبيه.", "Could not update alert frequency."),
      );
    } finally {
      frequencyScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) setSavingFrequencyId(null);
    }
  }

  async function removeSavedSearch(id: string) {
    const currentProfileId = profileId;
    if (!currentProfileId) return;
    const scopeKey = [currentProfileId, id].join(":");
    if (deletingSearchScopesRef.current.has(scopeKey)) return;

    deletingSearchScopesRef.current.add(scopeKey);
    setDeletingIds((current) => new Set(current).add(id));
    setMessage("");
    try {
      const result = await deleteSavedSearch(currentProfileId, id);
      if (currentProfileId !== profileIdRef.current) return;
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setItems((current) => current.filter((item) => item.id !== id));
      setMessage(text("تم حذف البحث المحفوظ.", "Saved search removed."));
    } catch (caught) {
      if (currentProfileId !== profileIdRef.current) return;
      setMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر حذف البحث المحفوظ.", "Could not remove the saved search."),
      );
    } finally {
      deletingSearchScopesRef.current.delete(scopeKey);
      if (currentProfileId === profileIdRef.current) {
        setDeletingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      }
    }
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
      <main className="container-wide rawaj-account-collection-v3 rawaj-content-stack mobile-page-bottom pt-4">
        <section className="rounded-2xl bg-card p-4 hairline">
          <h2 className="text-sm font-extrabold">
            {text("احفظ فلاتر البحث المهمة", "Save important search filters")}
          </h2>
          <p className="mt-1 text-xs leading-6 text-muted-foreground">
            {text(
              "أنشئ بحثاً باسم واضح واضبط تكرار التنبيه. يطابق الخادم الإعلانات الجديدة عند اعتمادها ويجمع النتائج دون تكرار.",
              "Create a clearly named search and choose an alert cadence. The server matches newly approved listings and aggregates results without duplicates.",
            )}
          </p>
        </section>

        <form
          onSubmit={addSavedSearch}
          aria-busy={creating}
          className="grid grid-cols-1 gap-3 rounded-2xl bg-card p-4 hairline md:grid-cols-[1fr_1fr_180px_auto]"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={text("اسم البحث", "Search name")}
            aria-label={text("اسم البحث المحفوظ", "Saved search name")}
            disabled={creating}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm disabled:opacity-60"
          />
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={text("كلمة البحث", "Search keyword")}
            aria-label={text("كلمة البحث", "Search keyword")}
            disabled={creating}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm disabled:opacity-60"
          />
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as LocalSearch["frequency"])}
            aria-label={text("تكرار التنبيه", "Alert frequency")}
            disabled={creating}
            className="rounded-xl border border-input bg-card px-3 py-2.5 text-sm disabled:opacity-60"
          >
            <option value="daily">{text("تنبيه يومي", "Daily alert")}</option>
            <option value="weekly">{text("تنبيه أسبوعي", "Weekly alert")}</option>
            <option value="off">{text("بدون تنبيه", "No alert")}</option>
          </select>
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {text("حفظ البحث", "Save search")}
          </button>
        </form>

        {scanMessage ? (
          <p className="rounded-xl bg-emerald-trust/10 p-3 text-xs font-semibold text-foreground">
            {scanMessage}
          </p>
        ) : null}

        {message ? (
          <p className="rounded-xl bg-muted-surface p-3 text-xs font-semibold text-foreground hairline">
            {message}
          </p>
        ) : null}

        {loading && !hasLoaded ? (
          <Panel title={text("جارٍ تحميل عمليات البحث", "Loading saved searches")} />
        ) : loadError && !hasLoaded && localItems.length === 0 ? (
          <Panel
            title={text("تعذر تحميل عمليات البحث", "Could not load saved searches")}
            body={loadError.message}
            actionLabel={text("إعادة المحاولة", "Try again")}
            onAction={() => void loadSavedSearches()}
            actionDisabled={loading}
          />
        ) : (
          <>
            {loadError ? (
              <RecoveryNotice
                title={text("تعذر تحديث عمليات البحث", "Could not refresh saved searches")}
                body={loadError.message}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void loadSavedSearches()}
                actionDisabled={loading}
              />
            ) : null}
            {items.length === 0 && localItems.length === 0 ? (
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
                    key={`${profileId ?? "signed-out"}:${item.id}`}
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
                    key={`${profileId ?? "signed-out"}:${item.id}`}
                    id={item.id}
                    name={item.nameAr}
                    createdAt={item.createdAt}
                    filters={item.filters as Record<string, unknown>}
                    frequency={item.alertFrequency}
                    frequencyDisabled={savingFrequencyId === item.id}
                    removeDisabled={deletingIds.has(item.id)}
                    onFrequencyChange={(next) => void changeAlertFrequency(item.id, next)}
                    onRemove={() => void removeSavedSearch(item.id)}
                  />
                ))}
              </ul>
            )}
          </>
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
  frequencyDisabled = false,
  removeDisabled = false,
  onFrequencyChange,
  onRemove,
}: {
  id: string;
  name: string;
  createdAt: string;
  filters: Record<string, unknown>;
  frequency: SavedSearchAlertFrequency;
  local?: boolean;
  frequencyDisabled?: boolean;
  removeDisabled?: boolean;
  onFrequencyChange?: (next: SavedSearchAlertFrequency) => void;
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
            {onFrequencyChange ? (
              <label className="inline-flex items-center gap-1">
                <Bell className="h-3 w-3" />
                <span className="sr-only">{text("تكرار التنبيه", "Alert frequency")}</span>
                <select
                  value={frequency}
                  disabled={frequencyDisabled}
                  onChange={(event) =>
                    onFrequencyChange(event.target.value as SavedSearchAlertFrequency)
                  }
                  className="rounded-lg border border-border/70 bg-card px-1.5 py-1 text-[10px] font-semibold text-foreground disabled:opacity-60"
                >
                  <option value="daily">{text("يومي", "Daily")}</option>
                  <option value="weekly">{text("أسبوعي", "Weekly")}</option>
                  <option value="off">{text("متوقف", "Off")}</option>
                </select>
              </label>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {frequencyLabel(frequency, language)}
              </span>
            )}
            {local && <span>{text("محفوظ في هذه الجلسة", "Saved in this session")}</span>}
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={removeDisabled}
            aria-busy={removeDisabled}
            className="grid h-9 w-9 place-items-center rounded-full bg-muted-surface text-destructive disabled:cursor-wait disabled:opacity-50"
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
  const district = stringFilter(filters.districtAr) || stringFilter(filters.district);
  return {
    taxonomy: stringFilter(filters.taxonomyNodeId) || stringFilter(filters.taxonomy) || undefined,
    q: stringFilter(filters.query) || stringFilter(filters.q) || undefined,
    category: stringFilter(filters.categoryId) || stringFilter(filters.category) || undefined,
    subcategory:
      stringFilter(filters.subcategoryId) || stringFilter(filters.subcategory) || undefined,
    gov: stringFilter(filters.governorateId) || stringFilter(filters.gov) || undefined,
    location: district?.startsWith("@") ? district.slice(1) : undefined,
    district: district?.startsWith("@") ? undefined : district,
    price_min: numberFilter(filters.priceMin) ?? numberFilter(filters.price_min),
    price_max: numberFilter(filters.priceMax) ?? numberFilter(filters.price_max),
    price_type: priceTypeFilter(filters.priceType) ?? priceTypeFilter(filters.price_type),
    condition: stringFilter(filters.condition),
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

function priceTypeFilter(value: unknown): "fixed" | "negotiable" | "contact" | "free" | undefined {
  return value === "fixed" || value === "negotiable" || value === "contact" || value === "free"
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
      <main className="container-wide rawaj-account-collection-v3 rawaj-content-stack mobile-page-bottom pt-10">
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
  onAction,
  actionDisabled,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  actionTo?: string;
  actionSearch?: Record<string, string>;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  const { language } = useUiPreferences();
  return (
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted-surface">
        <Bookmark className="h-6 w-6 text-muted-foreground" />
      </span>
      <p className="mt-3 text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>}
      {actionLabel ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {onAction ? (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled}
              className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {actionLabel}
            </button>
          ) : actionTo ? (
            <Link
              to={actionTo}
              search={actionSearch}
              className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-primary-foreground"
            >
              {actionLabel}
            </Link>
          ) : null}
          {actionTo ? (
            <Link
              to="/categories"
              className="inline-block rounded-xl bg-muted-surface px-5 py-2 text-sm font-bold text-foreground"
            >
              {uiLabel("تصفح الأقسام", language)}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RecoveryNotice({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="rounded-xl bg-destructive/10 p-4 text-destructive hairline">
      <p className="text-xs font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5">{body}</p>
      <button
        type="button"
        onClick={onAction}
        disabled={actionDisabled}
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-card px-4 py-2 text-xs font-bold text-foreground hairline disabled:opacity-60"
      >
        {actionLabel}
      </button>
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
