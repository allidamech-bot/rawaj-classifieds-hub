import "@/lib/classifieds-types";

declare module "@/lib/classifieds-types" {
  interface ListingFilters {
    attributeFilters?: Record<string, string | boolean | string[] | { min?: number; max?: number }>;
  }

  interface PaginatedListingsResponse<T> {
    totalCount?: number;
  }
}
