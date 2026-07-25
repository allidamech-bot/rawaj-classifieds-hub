import baseWorker from "./index";
import { handlePublicListingsRequest, type PublicListingsEnv } from "./public-listings";
import { handlePublicSellers, type PublicSellersEnv } from "./public-sellers";
import type { AuthEnv } from "./auth";
import { handleMarketplacePrivate, type MarketplaceEnv } from "./marketplace-private";
import { handleAccountSocial, type AccountSocialEnv } from "./account-social";
import { handleNotifications, type NotificationsEnv } from "./notifications";
import { handleAdmin, type AdminEnv } from "./admin";
import { handleAdPlacements, type AdPlacementsEnv } from "./ad-placements";
import { handleTaxonomy, type TaxonomyEnv } from "./taxonomy";
import { handleListingAttributes, type ListingAttributesEnv } from "./listing-attributes";
import { handleSystemControls, type SystemControlsEnv } from "./system-controls";

type EntryEnv = PublicListingsEnv &
  PublicSellersEnv &
  AuthEnv &
  MarketplaceEnv &
  AccountSocialEnv &
  NotificationsEnv &
  AdminEnv &
  AdPlacementsEnv &
  TaxonomyEnv &
  ListingAttributesEnv &
  SystemControlsEnv & {
    API_ALLOWED_ORIGINS?: string;
  };

const OFFICIAL_ORIGINS = ["https://rawa-j.com", "https://www.rawa-j.com"] as const;

export default {
  async fetch(request: Request, env: EntryEnv): Promise<Response> {
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const requestId = crypto.randomUUID();

    try {
      const response = await routeRequest(request, env);
      const headers = new Headers(cors);
      headers.set("X-Request-Id", requestId);
      return withCors(response, headers);
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

      const headers = new Headers(cors);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("Cache-Control", "no-store");
      headers.set("X-Request-Id", requestId);

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

  if (/^\/v1\/system-controls\b/.test(path)) {
    return required(await handleSystemControls(request, env));
  }
  if (/^\/v1\/listing-attributes\b/.test(path)) {
    return required(await handleListingAttributes(request, env));
  }
  if (/^\/v1\/taxonomy\b/.test(path)) {
    return required(await handleTaxonomy(request, env));
  }
  if (/^\/v1\/ad-placements\b/.test(path)) {
    return required(await handleAdPlacements(request, env));
  }
  if (/^\/v1\/admin\b/.test(path)) {
    return required(await handleAdmin(request, env));
  }
  if (/^\/v1\/(?:account\/)?notifications\b/.test(path)) {
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

  return baseWorker.fetch(request, env as never);
}

function isAccountSocialPath(path: string): boolean {
  return (
    path === "/v1/account/favorites" ||
    path === "/v1/account/saved-searches" ||
    /^\/v1\/account\/saved-searches\//.test(path) ||
    path === "/v1/account/conversations" ||
    path === "/v1/account/messages/unread-count" ||
    path === "/v1/conversations" ||
    /^\/v1\/conversations\//.test(path) ||
    /^\/v1\/listings\/[^/]+\/favorite$/.test(path)
  );
}

function isMarketplacePrivatePath(path: string, method: string): boolean {
  if (path === "/api/profile" || path === "/v1/profile") return true;
  if (/^\/v1\/account\/(?:listings|media)\b/.test(path)) return true;
  if (/^\/v1\/listing-images\//.test(path)) return true;
  if (/^\/v1\/listings\/[^/]+\/images$/.test(path)) return true;
  if (/^\/v1\/listings\/[^/]+$/.test(path) && method !== "GET") return true;
  return path === "/v1/listings" && method !== "GET";
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

function corsHeaders(origin: string | null, env: EntryEnv): Headers {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, If-None-Match",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });

  if (!origin) return headers;

  const allowed = new Set<string>(OFFICIAL_ORIGINS);
  for (const value of (env.API_ALLOWED_ORIGINS ?? "").split(",")) {
    const normalized = value.trim();
    if (normalized) allowed.add(normalized);
  }

  if (allowed.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
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
