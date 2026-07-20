import "@/lib/classifieds-types";

// Governed dynamic filter extensions for listing search and pagination.
declare module "@/lib/classifieds-types" {
  interface ListingFilters {
    attributeFilters?: Record<string, string | boolean | string[] | { min?: number; max?: number }>;
  }

  interface PaginatedListingsResponse<T> {
    totalCount?: number;
  }
}
