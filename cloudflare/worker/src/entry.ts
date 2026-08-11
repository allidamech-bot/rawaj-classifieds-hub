import { handlePublicCore, type PublicCoreEnv } from "./index";
import { handlePublicListingsRequest, type PublicListingsEnv } from "./public-listings";
import { handlePublicSellers, type PublicSellersEnv } from "./public-sellers";
import type { AuthEnv } from "./auth";
import { handleMarketplacePrivate, type MarketplaceEnv } from "./marketplace-private";
import { handleAccountSocial, type AccountSocialEnv } from "./account-social";
import { handleNotifications, type NotificationsEnv } from "./notifications";
import { handlePushDeviceSession, type PushDeviceSessionEnv } from "./push-device-session";
import { handleAdmin, type AdminEnv } from "./admin";
import { handleAdPlacements, type AdPlacementsEnv } from "./ad-placements";
import { handleManagedMedia, type ManagedMediaEnv } from "./managed-media";
import { handleTaxonomy, type TaxonomyEnv } from "./taxonomy";
import { handleListingAttributes, type ListingAttributesEnv } from "./listing-attributes";
import { handleSystemControls, type SystemControlsEnv } from "./system-controls";
import { handleFeedback, isFeedbackPath, type FeedbackEnv } from "./feedback";
import { handleVerification, type VerificationEnv } from "./verification";
import { handleTrustSupport, type TrustSupportEnv } from "./trust-support";
import { handleListingOperations, type ListingOperationsEnv } from "./listing-operations";
import { handleListingOffers, type ListingOffersEnv } from "./listing-offers";
import { handleDiscovery, type DiscoveryEnv } from "./discovery";
import { handleAdminCampaigns, type AdminCampaignsEnv } from "./admin-campaigns";
import { handleAdminSafety, type AdminSafetyEnv } from "./admin-safety";
import { handleAdminTaxonomyReview, type AdminTaxonomyReviewEnv } from "./admin-taxonomy-review";
import { handleAdminDataQuality, type AdminDataQualityEnv } from "./admin-data-quality";
import { corsHeadersForOrigin } from "./cors";
import { enforceRequestSecurity, type SecurityEnv } from "./security";

type EntryEnv = PublicCoreEnv &
  PublicListingsEnv &
  PublicSellersEnv &
  AuthEnv &
  MarketplaceEnv &
  AccountSocialEnv &
  NotificationsEnv &
  PushDeviceSessionEnv &
  AdminEnv &
  AdPlacementsEnv &
  ManagedMediaEnv &
  TaxonomyEnv &
  ListingAttributesEnv &
  SystemControlsEnv &
  FeedbackEnv &
  VerificationEnv &
  TrustSupportEnv &
  ListingOperationsEnv &
  ListingOffersEnv &
  DiscoveryEnv &
  AdminCampaignsEnv &
  AdminSafetyEnv &
  AdminTaxonomyReviewEnv &
  AdminDataQualityEnv &
  SecurityEnv & {
    API_ALLOWED_ORIGINS?: string;
  };

export default {
  async fetch(request: Request, env: EntryEnv): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeadersForOrigin(origin, env);
    const requestId = crypto.randomUUID();

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: responseHeaders(cors, requestId, request),
      });
    }

    try {
      const securityResult = await enforceRequestSecurity(request, env, requestId);
      if (securityResult instanceof Response) {
        return withCors(securityResult, responseHeaders(cors, requestId, request));
      }

      const securedRequest = securityResult instanceof Request ? securityResult : request;
      const response = await routeRequest(securedRequest, env);
      return withCors(response, responseHeaders(cors, requestId, securedRequest));
    } catch (error) {
      const pathname = new URL(request.url).pathname;
      console.error(
        JSON.stringify({
          event: "worker_unhandled_exception",
          requestId,
          method: request.method,
          pathname,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : String(error),
        }),
      );

      const headers = responseHeaders(cors, requestId, request);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Cache-Control", "no-store");

      return new Response(
        JSON.stringify({
          error: {
            code: "internal_error",
            message: "حدث خطأ داخلي في خدمة رواج.",
            requestId,
            path: pathname,
          },
        }),
        { status: 500, headers },
      );
    }
  },
};

async function routeRequest(request: Request, env: EntryEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/v1/admin/system-controls" || path === "/v1/system-status") {
    return required(await handleSystemControls(request, env));
  }
  if (isFeedbackPath(path)) {
    return required(await handleFeedback(request, env));
  }
  if (/^\/v1\/listings\/[^/]+\/attributes(?:\/completeness)?$/.test(path)) {
    return required(await handleListingAttributes(request, env));
  }
  if (
    /^\/v1\/taxonomy(?:\/|$)/.test(path) ||
    /^\/v1\/vehicles(?:\/|$)/.test(path) ||
    /^\/v1\/listings\/[^/]+\/taxonomy$/.test(path)
  ) {
    return required(await handleTaxonomy(request, env));
  }
  if (
    /^\/v1\/media\/assets\/[^/]+$/.test(path) ||
    /^\/v1\/admin\/listings\/[^/]+\/images$/.test(path) ||
    /^\/v1\/admin\/media\/assets\/[^/]+$/.test(path)
  ) {
    const mediaResponse = await handleManagedMedia(request, env);
    if (mediaResponse) return mediaResponse;
  }
  if (/^\/v1\/admin\/ad-placements(?:\/|$)/.test(path)) {
    return required(await handleAdPlacements(request, env));
  }
  if (/^\/v1\/(?:account\/verifications|admin\/verifications)(?:\/|$)/.test(path)) {
    return required(await handleVerification(request, env));
  }
  if (isTrustSupportPath(path)) {
    return required(await handleTrustSupport(request, env));
  }
  if (isListingOperationsPath(path)) {
    return required(await handleListingOperations(request, env));
  }
  if (isListingOfferPath(path)) {
    return required(await handleListingOffers(request, env));
  }
  if (isDiscoveryPath(path)) {
    return required(await handleDiscovery(request, env));
  }
  if (/^\/v1\/admin\/campaigns(?:\/|$)/.test(path)) {
    return required(await handleAdminCampaigns(request, env));
  }
  if (/^\/v1\/admin\/safety(?:\/|$)/.test(path)) {
    return required(await handleAdminSafety(request, env));
  }
  if (/^\/v1\/admin\/(?:taxonomy-mappings|vehicle-references)(?:\/|$)/.test(path)) {
    return required(await handleAdminTaxonomyReview(request, env));
  }
  if (/^\/v1\/admin\/data-quality(?:\/|$)/.test(path)) {
    return required(await handleAdminDataQuality(request, env));
  }
  if (/^\/v1\/admin\/message-reports(?:\/|$)/.test(path)) {
    return required(await handleAccountSocial(request, env));
  }
  if (/^\/v1\/admin\b/.test(path)) {
    return required(await handleAdmin(request, env));
  }
  if (request.method === "DELETE" && /^\/v1\/account\/push-devices\/[^/]+$/.test(path)) {
    return required(await handlePushDeviceSession(request, env));
  }
  if (/^\/v1\/account\/(?:notifications|notification-preferences|push-devices)\b/.test(path)) {
    return required(await handleNotifications(request, env));
  }
  if (isAccountSocialPath(path)) {
    return required(await handleAccountSocial(request, env));
  }
  if (isMarketplacePrivatePath(path, request.method)) {
    return required(await handleMarketplacePrivate(request, env));
  }
  if (/^\/v1\/sellers(?:\/|$)/.test(path)) {
    return required(await handlePublicSellers(request, env));
  }
  if (request.method === "GET" && path === "/v1/listings") {
    return handlePublicListingsRequest(request, env);
  }

  if (isPublicCorePath(path)) {
    return required(await handlePublicCore(request, env));
  }

  return new Response(
    JSON.stringify({ error: { code: "not_found", message: "Resource not found." } }),
    { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
  );
}

function isPublicCorePath(path: string): boolean {
  return (
    path === "/v1/health" ||
    path === "/v1/references" ||
    path === "/v1/ad-placements" ||
    /^\/v1\/locations(?:\/|$)/.test(path) ||
    /^\/v1\/media\/assets\/[^/]+$/.test(path) ||
    requestMethodIndependentListingDetail(path)
  );
}

function requestMethodIndependentListingDetail(path: string): boolean {
  return /^\/v1\/listings\/[^/]+$/.test(path);
}

function isDiscoveryPath(path: string): boolean {
  return (
    path === "/v1/listing-facets" || path === "/v1/listings/nearby" || /^\/v1\/sitemap\//.test(path)
  );
}

function isListingOperationsPath(path: string): boolean {
  return (
    /^\/v1\/listings\/[^/]+\/(?:lifecycle|price-context)$/.test(path) ||
    path === "/v1/account/listings/expiry-reminders/scan" ||
    path === "/v1/offers/price-drops" ||
    /^\/v1\/(?:account|admin)\/promotions(?:\/|$)/.test(path) ||
    /^\/v1\/admin\/promotion-receipts\//.test(path)
  );
}

function isListingOfferPath(path: string): boolean {
  return (
    /^\/v1\/conversations\/[^/]+\/offers$/.test(path) ||
    /^\/v1\/offers\/(?!price-drops$)[^/]+$/.test(path)
  );
}

function isTrustSupportPath(path: string): boolean {
  return (
    /^\/v1\/account\/support-requests(?:\/|$)/.test(path) ||
    /^\/v1\/listings\/[^/]+\/reports$/.test(path) ||
    /^\/v1\/sellers\/[^/]+\/(?:review-eligibility|reviews)$/.test(path) ||
    /^\/v1\/reviews\/[^/]+\/(?:response|reports)$/.test(path) ||
    /^\/v1\/admin\/(?:support-requests|listing-reports|seller-reviews|seller-review-reports)(?:\/|$)/.test(
      path,
    )
  );
}

function isAccountSocialPath(path: string): boolean {
  return (
    path === "/v1/account/favorites" ||
    path === "/v1/account/recent-views" ||
    path === "/v1/account/followed-sellers" ||
    path === "/v1/account/saved-searches" ||
    /^\/v1\/account\/saved-searches\//.test(path) ||
    /^\/v1\/account\/recent-views\//.test(path) ||
    path === "/v1/account/conversations" ||
    path === "/v1/account/messages/unread-count" ||
    /^\/v1\/account\/chat-media\//.test(path) ||
    path === "/v1/conversations" ||
    /^\/v1\/conversations\//.test(path) ||
    /^\/v1\/messages\/[^/]+\/report$/.test(path) ||
    /^\/v1\/admin\/message-reports(?:\/|$)/.test(path) ||
    /^\/v1\/listings\/[^/]+\/(?:favorite|recent-view)$/.test(path) ||
    /^\/v1\/sellers\/[^/]+\/follow$/.test(path)
  );
}

function isMarketplacePrivatePath(path: string, method: string): boolean {
  const normalizedPath = path.replace(/^\/api\b/, "/v1");
  if (normalizedPath === "/v1/profile" || normalizedPath === "/v1/profile/media") return true;
  if (/^\/v1\/profile\/media\/(?:avatar|cover)$/.test(normalizedPath)) return true;
  if (/^\/v1\/account\/(?:listings|media)\b/.test(normalizedPath)) return true;
  if (/^\/v1\/listing-images\//.test(normalizedPath)) return true;
  if (/^\/v1\/listings\/[^/]+\/images$/.test(normalizedPath)) return true;
  if (/^\/v1\/listings\/[^/]+$/.test(normalizedPath)) {
    return path.startsWith("/api/") || method !== "GET";
  }
  return normalizedPath === "/v1/listings" && (path.startsWith("/api/") || method !== "GET");
}

function required(response: Response | null): Response {
  return (
    response ??
    new Response(
      JSON.stringify({ error: { code: "route_not_handled", message: "Route not handled." } }),
      { status: 404, headers: { "Content-Type": "application/json; charset=utf-8" } },
    )
  );
}

function responseHeaders(cors: Headers, requestId: string, request: Request): Headers {
  const headers = new Headers(cors);
  headers.set("X-Request-Id", requestId);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  if (new URL(request.url).protocol === "https:") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return headers;
}

function withCors(response: Response, cors: Headers): Response {
  const headers = new Headers(response.headers);
  cors.forEach((value, key) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
