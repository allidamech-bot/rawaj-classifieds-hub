import "../auth-stable-route-styles.css";
import "../auth-support-correction-v1.css";
import "../listing-studio-navigation-fix";
import "../listing-studio-image-validation";
import "../listing-studio-price-type-guard";
import "../listing-studio-mobile-recovery.css";
import "../rawaj-home-feedback-fixes.css";
import activityMoreFoundationCss from "../activity-more-foundation.css?url";
import communicationCenterV3Css from "../communication-center-v3.css?url";
import messagingV4Css from "../messaging-v4.css?url";
import homeDiscoveryV3Css from "../home-discovery-v3.css?url";
import homeMarketplaceV2Css from "../home-marketplace-v2.css?url";
import homeSignatureCss from "../home-signature.css?url";
import listingDetailFoundationCss from "../listing-detail-foundation.css?url";
import listingDetailV2Css from "../listing-detail-v2.css?url";
import listingDetailV3Css from "../listing-detail-v3.css?url";
import listingStudioSignatureCss from "../listing-studio-signature.css?url";
import listingStudioV2Css from "../listing-studio-v2.css?url";
import listingStudioV3Css from "../listing-studio-v3.css?url";
import listingStudioV4Css from "../listing-studio-v4.css?url";
import listingsResultsCss from "../listings-results.css?url";
import myStoreBrandPolishCss from "../my-store-brand-polish.css?url";
import myStoreHeaderRefinementCss from "../my-store-header-refinement.css?url";
import myStoreRedesignCss from "../my-store-redesign.css?url";
import offersSignatureCss from "../offers-signature.css?url";
import personalSpacePolishCss from "../personal-space-polish.css?url";
import searchFiltersV1Css from "../search-filters-v1.css?url";
import searchFiltersV2Css from "../search-filters-v2.css?url";
import sellerStorefrontFoundationCss from "../seller-storefront-foundation.css?url";
import sellerStorefrontV2Css from "../seller-storefront-v2.css?url";
import trustSupportHubV2Css from "../trust-support-hub-v2.css?url";

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
  listingStudioSignature: listingStudioSignatureCss,
  listingStudioV2: listingStudioV2Css,
  listingStudioV3: listingStudioV3Css,
  listingStudioV4: listingStudioV4Css,
  communicationCenterV2: communicationCenterV3Css,
  messagingV4: messagingV4Css,
  activityMoreFoundation: activityMoreFoundationCss,
  personalSpacePolish: personalSpacePolishCss,
  myStoreRedesign: myStoreRedesignCss,
  myStoreHeaderRefinement: myStoreHeaderRefinementCss,
  myStoreBrandPolish: myStoreBrandPolishCss,
  trustSupportHubV2: trustSupportHubV2Css,
} as const;

export interface RouteStyleScope {
  home: boolean;
  listingResults: boolean;
  listingDetail: boolean;
  offers: boolean;
  storefront: boolean;
  listingStudio: boolean;
  messaging: boolean;
  communication: boolean;
  personalSpace: boolean;
  ownerStore: boolean;
  trustSupport: boolean;
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "");
}

export function resolveRouteStyleScope(pathname: string): RouteStyleScope {
  const normalizedPathname = normalizePathname(pathname);

  return {
    home: normalizedPathname === "/",
    // The category atlas styles intentionally live in search-filters-v1.css.
    // Keep that discovery bundle active on /categories so its hero, search,
    // and directory cards do not fall back to unstyled utility-only rows.
    listingResults: ["/listings", "/categories"].includes(normalizedPathname),
    listingDetail: /^\/listings\/[^/]+$/.test(normalizedPathname),
    offers: normalizedPathname === "/offers",
    storefront:
      /^\/seller\/[^/]+$/.test(normalizedPathname) || normalizedPathname === "/profile/listings",
    listingStudio:
      normalizedPathname === "/add-listing" ||
      /^\/profile\/listings\/[^/]+$/.test(normalizedPathname),
    messaging: normalizedPathname === "/chats",
    communication: ["/chats", "/notifications", "/activity"].includes(normalizedPathname),
    personalSpace: [
      "/favorites",
      "/saved-searches",
      "/activity",
      "/chats",
      "/notifications",
      "/more",
      "/profile",
    ].includes(normalizedPathname),
    ownerStore: normalizedPathname === "/profile/listings",
    trustSupport: ["/more", "/support", "/safety", "/terms", "/privacy"].includes(
      normalizedPathname,
    ),
  };
}
