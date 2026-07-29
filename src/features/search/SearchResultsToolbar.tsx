import { Link } from "@tanstack/react-router";
import {
  Bookmark,
  Filter,
  Grid2X2,
  History,
  List,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ListingsSort, ListingsView } from "@/features/listings/listings-search-schema";

const RECENT_SEARCHES_KEY = "rawaj_recent_listing_searches_v1";
const MAX_RECENT_SEARCHES = 5;

const emptySavedSearchParams = {
  taxonomy: "",
  q: "",
  category: "",
  subcategory: "",
  gov: "",
  district: "",
  price_min: "",
  price_max: "",
  price_type: "",
  condition: "",
  car_make: "",
  car_model: "",
  fuel: "",
  transmission: "",
  property_purpose: "",
  property_type: "",
  rooms: "",
  rental_duration: "",
  electronics_brand: "",
  detail_condition: "",
  employment_type: "",
  salary_type: "",
  attrs: "",
  sort: "latest" as ListingsSort,
};

function omitEmptySavedSearchParams(search: typeof emptySavedSearchParams) {
  return Object.fromEntries(
    Object.entries(search).map(([key, value]) => [
      key,
      value === "" || (key === "sort" && value === "latest") ? undefined : value,
    ]),
  ) as unknown as typeof emptySavedSearchParams;
}

interface SearchResultsToolbarProps {
  title: string;
  pathLabel?: string;
  query: string;
  onQueryChange: (value: string) => void;
  resultCount: number;
  loading: boolean;
  activeFilterCount: number;
  sort: ListingsSort;
  onSortChange: (sort: ListingsSort) => void;
  view: ListingsView;
  onViewChange: (view: ListingsView) => void;
  onOpenFilters: () => void;
  text: (ar: string, en: string) => string;
  savedSearch?: typeof emptySavedSearchParams;
}

function readRecentSearches() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .slice(0, MAX_RECENT_SEARCHES)
      : [];
  } catch {
    return [];
  }
}

export function SearchResultsToolbar({
  title,
  pathLabel,
  query,
  onQueryChange,
  resultCount,
  loading,
  activeFilterCount,
  sort,
  onSortChange,
  view,
  onViewChange,
  onOpenFilters,
  text,
  savedSearch = emptySavedSearchParams,
}: SearchResultsToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const savedSearchLinkParams = omitEmptySavedSearchParams(savedSearch);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editable =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (event.key === "/" && !editable) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function rememberSearch(value: string) {
    const normalized = value.trim();
    if (normalized.length < 2 || typeof window === "undefined") return;
    const next = [normalized, ...recentSearches.filter((item) => item !== normalized)].slice(
      0,
      MAX_RECENT_SEARCHES,
    );
    setRecentSearches(next);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  }

  return (
    <section
      className="rawaj-search-toolbar rawaj-search-toolbar-v2"
      aria-labelledby="rawaj-results-title"
      aria-busy={loading}
      data-state-contract="url-backed"
      data-view={view}
      data-has-query={Boolean(query.trim())}
      data-has-filters={activeFilterCount > 0}
    >
      <div className="rawaj-search-toolbar__heading">
        <div className="min-w-0">
          <p>{text("نتائج السوق", "Marketplace results")}</p>
          <h1 id="rawaj-results-title">{title}</h1>
          {pathLabel ? <span>{pathLabel}</span> : null}
        </div>
        <strong
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-loading={loading || undefined}
        >
          {loading
            ? text("جارٍ التحميل", "Loading")
            : text(`${resultCount} نتيجة`, `${resultCount} results`)}
        </strong>
      </div>

      <form
        className="rawaj-search-toolbar__search-row"
        role="search"
        aria-label={text("البحث ضمن النتائج", "Search within results")}
        onSubmit={(event) => {
          event.preventDefault();
          rememberSearch(query);
          searchInputRef.current?.blur();
        }}
      >
        <label className="rawaj-search-toolbar__search">
          <Search aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={query}
            onFocus={() => setRecentSearches(readRecentSearches())}
            onChange={(event) => onQueryChange(event.target.value)}
            onBlur={() => rememberSearch(query)}
            placeholder={text("ابحث ضمن النتائج...", "Search within results...")}
            aria-label={text("بحث في الإعلانات", "Search listings")}
            aria-describedby="rawaj-search-shortcut"
            list="rawaj-recent-searches"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            dir="auto"
          />
          {query ? (
            <button
              type="button"
              className="rawaj-search-toolbar__clear-query"
              onClick={() => {
                onQueryChange("");
                searchInputRef.current?.focus();
              }}
              aria-label={text("مسح البحث", "Clear search")}
            >
              <X aria-hidden="true" />
            </button>
          ) : (
            <kbd id="rawaj-search-shortcut" aria-label={text("اختصار البحث", "Search shortcut")}>
              /
            </kbd>
          )}
          <datalist id="rawaj-recent-searches">
            {recentSearches.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </label>
        <button
          type="button"
          onClick={onOpenFilters}
          className="rawaj-search-toolbar__filter"
          aria-label={text("فتح الفلاتر", "Open filters")}
          aria-haspopup="dialog"
          data-active={activeFilterCount > 0}
        >
          <SlidersHorizontal aria-hidden="true" />
          <span>{text("فلترة", "Filters")}</span>
          {activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}
        </button>
      </form>

      {recentSearches.length > 0 ? (
        <div
          className="rawaj-search-toolbar__recent"
          aria-label={text("عمليات البحث الأخيرة", "Recent searches")}
        >
          <History aria-hidden="true" />
          <span>{text("الأخيرة", "Recent")}</span>
          <div>
            {recentSearches.map((item) => (
              <button key={item} type="button" onClick={() => onQueryChange(item)}>
                {item}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rawaj-search-toolbar__controls">
        <label className="rawaj-search-toolbar__sort">
          <Filter aria-hidden="true" />
          <span className="sr-only">{text("ترتيب النتائج", "Sort results")}</span>
          <select
            value={sort}
            onChange={(event) => onSortChange(event.target.value as ListingsSort)}
            aria-label={text("ترتيب النتائج", "Sort results")}
          >
            <option value="latest">{text("الأحدث", "Latest")}</option>
            <option value="cheapest">{text("الأرخص", "Lowest price")}</option>
            <option value="expensive">{text("الأعلى سعرًا", "Highest price")}</option>
            <option value="featured">{text("المميز", "Featured")}</option>
          </select>
        </label>

        <div className="rawaj-search-toolbar__views" aria-label={text("طريقة العرض", "View mode")}>
          <button
            type="button"
            onClick={() => onViewChange("grid")}
            aria-pressed={view === "grid"}
            aria-label={text("عرض شبكي", "Grid view")}
          >
            <Grid2X2 aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            aria-pressed={view === "list"}
            aria-label={text("عرض قائمة", "List view")}
          >
            <List aria-hidden="true" />
          </button>
        </div>

        <Link
          to="/saved-searches"
          search={savedSearchLinkParams}
          className="rawaj-search-toolbar__saved"
        >
          <Bookmark aria-hidden="true" />
          <span>{text("عمليات البحث", "Saved searches")}</span>
        </Link>
      </div>
    </section>
  );
}
