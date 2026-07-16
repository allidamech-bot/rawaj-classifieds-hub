import { createFileRoute, Outlet } from "@tanstack/react-router";
import { listingsSearchSchema } from "@/features/listings/listings-search-schema";
import {
  loadPublicListingsPageData,
  type PublicListingsPageData,
} from "@/features/listings/public-listings-page-data";

const emptyPageData: PublicListingsPageData = {
  references: {
    categories: [],
    subcategories: [],
    governorates: [],
    taxonomyNodes: [],
    taxonomyAvailable: false,
    error: null,
  },
  results: {
    items: [],
    sellerResults: [],
    nextCursor: null,
    error: null,
    sellerSearchError: null,
    filterKey: null,
  },
};

export const Route = createFileRoute("/listings")({
  validateSearch: listingsSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps, location }) =>
    location.pathname === "/listings" || location.pathname === "/listings/"
      ? loadPublicListingsPageData(deps)
      : emptyPageData,
  component: () => <Outlet />,
});
