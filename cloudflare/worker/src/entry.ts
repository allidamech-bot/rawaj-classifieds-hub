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
      const url = new URL(request.url);
      const response =
        (await handleSystemControls(request, env)) ??
        (await handleListingAttributes(request, env)) ??
        (await handleTaxonomy(request, env)) ??
        (await handleAdPlacements(request, env)) ??
        (await handleAdmin(request, env)) ??
        (await handleNotifications(request, env)) ??
        (await handleAccountSocial(request, env)) ??
        (await handleMarketplacePrivate(request, env)) ??
        (await handlePublicSellers(request, env)) ??
        (request.method === "GET" && url.pathname === "/v1/listings"
          ? await handlePublicListingsRequest(request, env)
          : await baseWorker.fetch(request, env as never));

      const headers = new Headers(cors);
      headers.set("X-Request-Id", requestId);
      return withCors(response, headers);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "worker_unhandled_exception",
          requestId,
          method: request.method,
          pathname: new URL(request.url).pathname,
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
          },
        }),
        { status: 500, headers },
      );
    }
  },
};

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
