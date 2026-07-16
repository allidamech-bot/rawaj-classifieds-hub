import homeDiscoveryV3Css from "../home-discovery-v3.css?url";
import homeMarketplaceV2Css from "../home-marketplace-v2.css?url";
import homeSignatureCss from "../home-signature.css?url";
import listingDetailFoundationCss from "../listing-detail-foundation.css?url";
import listingDetailV2Css from "../listing-detail-v2.css?url";
import listingDetailV3Css from "../listing-detail-v3.css?url";
import listingsResultsCss from "../listings-results.css?url";
import offersSignatureCss from "../offers-signature.css?url";
import searchFiltersV1Css from "../search-filters-v1.css?url";
import searchFiltersV2Css from "../search-filters-v2.css?url";
import sellerStorefrontFoundationCss from "../seller-storefront-foundation.css?url";
import sellerStorefrontV2Css from "../seller-storefront-v2.css?url";

export const routeStyleHrefs = {
  homeSignature: homeSignatureCss,
  homeMarketplaceV2: homeMarketplaceV2Css,
  homeDiscoveryV3: homeDiscoveryV3Css,
  listingsResults: listingsResultsCss,
  searchFiltersV1: searchFiltersV1Css,
  searchFiltersV2: searchFiltersV2Css,
  listingDetailFoundation: listingDetailFoundationCss,
  listingDetailV2: listingDetailV2Css,
  listingDetailV3: listingDetailV3Css,
  offersSignature: offersSignatureCss,
  sellerStorefrontFoundation: sellerStorefrontFoundationCss,
  sellerStorefrontV2: sellerStorefrontV2Css,
} as const;

export interface RouteStyleScope {
  home: boolean;
  listingResults: boolean;
  listingDetail: boolean;
  offers: boolean;
  storefront: boolean;
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

export function resolveRouteStyleScope(pathname: string): RouteStyleScope {
  const normalizedPathname = normalizePathname(pathname);

  return {
    home: normalizedPathname === "/",
    listingResults: normalizedPathname === "/listings",
    listingDetail: /^\/listings\/[^/]+$/.test(normalizedPathname),
    offers: normalizedPathname === "/offers",
    storefront:
      /^\/seller\/[^/]+$/.test(normalizedPathname) || normalizedPathname === "/profile/listings",
  };
}
