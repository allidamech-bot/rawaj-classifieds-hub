import type { ListingsSort, ListingsView } from "@/features/listings/listings-search-schema";

const STORAGE_KEY = "rawaj:listing-browsing-preferences:v1";

export interface ListingBrowsingPreferences {
  view: ListingsView;
  sort: ListingsSort;
}

const defaults: ListingBrowsingPreferences = {
  view: "grid",
  sort: "latest",
};

const validViews = new Set<ListingsView>(["grid", "list"]);
const validSorts = new Set<ListingsSort>(["latest", "cheapest", "expensive", "featured"]);

export function readListingBrowsingPreferences(): ListingBrowsingPreferences {
  if (typeof window === "undefined") return defaults;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<
      string,
      unknown
    >;
    return {
      view: validViews.has(parsed.view as ListingsView)
        ? (parsed.view as ListingsView)
        : defaults.view,
      sort: validSorts.has(parsed.sort as ListingsSort)
        ? (parsed.sort as ListingsSort)
        : defaults.sort,
    };
  } catch {
    return defaults;
  }
}

export function writeListingBrowsingPreferences(preferences: ListingBrowsingPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        view: validViews.has(preferences.view) ? preferences.view : defaults.view,
        sort: validSorts.has(preferences.sort) ? preferences.sort : defaults.sort,
      }),
    );
  } catch {
    // Browsing remains available when local storage is unavailable.
  }
}
