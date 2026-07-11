import { Link } from "@tanstack/react-router";
import { Bookmark, Filter, Grid2X2, List, Map, Search, SlidersHorizontal } from "lucide-react";
import type { ListingsSort, ListingsView } from "@/features/listings/listings-search-schema";

const emptySavedSearchParams = {
  q: "",
  category: "",
  subcategory: "",
  gov: "",
  district: "",
  price_min: "",
  price_max: "",
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
  sort: "latest" as const,
};

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
}: SearchResultsToolbarProps) {
  return (
    <section
      className="rawaj-search-toolbar"
      aria-labelledby="rawaj-results-title"
      data-state-contract="url-backed"
    >
      <div className="rawaj-search-toolbar__heading">
        <div className="min-w-0">
          <p>{text("نتائج السوق", "Marketplace results")}</p>
          <h1 id="rawaj-results-title">{title}</h1>
          {pathLabel ? <span>{pathLabel}</span> : null}
        </div>
        <strong aria-live="polite" aria-atomic="true">
          {loading
            ? text("جارٍ التحميل", "Loading")
            : text(`${resultCount} نتيجة`, `${resultCount} results`)}
        </strong>
      </div>

      <div
        className="rawaj-search-toolbar__search-row"
        role="search"
        aria-label={text("البحث ضمن النتائج", "Search within results")}
      >
        <label className="rawaj-search-toolbar__search">
          <Search aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={text("ابحث ضمن النتائج...", "Search within results...")}
            aria-label={text("بحث في الإعلانات", "Search listings")}
            type="search"
          />
        </label>
        <button
          type="button"
          onClick={onOpenFilters}
          className="rawaj-search-toolbar__filter"
          aria-label={text("فتح الفلاتر", "Open filters")}
        >
          <SlidersHorizontal aria-hidden="true" />
          <span>{text("فلترة", "Filters")}</span>
          {activeFilterCount > 0 ? <b>{activeFilterCount}</b> : null}
        </button>
      </div>

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
          <button
            type="button"
            disabled
            data-view-foundation="map"
            aria-label={text("عرض الخريطة قيد التجهيز", "Map view foundation")}
          >
            <Map aria-hidden="true" />
          </button>
        </div>

        <Link
          to="/saved-searches"
          search={emptySavedSearchParams}
          className="rawaj-search-toolbar__saved"
        >
          <Bookmark aria-hidden="true" />
          <span>{text("عمليات البحث", "Saved searches")}</span>
        </Link>
      </div>
    </section>
  );
}
