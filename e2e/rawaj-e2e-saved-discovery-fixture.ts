import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const FIXTURE_USER_ID = "00000000-0000-4000-8000-000000000020";
const RESET_HEADER = "x-rawaj-e2e-reset";
const RESET_PATH = "/__rawaj_e2e__/saved-discovery/reset";
const LISTING_ID = "e2e-listing-featured";
const SAVED_SEARCH_ID = "00000000-0000-4000-8000-000000000061";
const FIXTURE_TIMESTAMP = "2026-07-30T15:00:00.000Z";
const FIXTURE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='1000' viewBox='0 0 1600 1000'%3E%3Crect width='1600' height='1000' fill='%23e6ece9'/%3E%3Cpath d='M0 700L430 360L730 620L1050 270L1600 720V1000H0Z' fill='%23123f38'/%3E%3C/svg%3E";

interface FixtureSavedSearch extends Record<string, unknown> {
  id: string;
  userId: string;
  nameAr: string;
  filters: Record<string, unknown>;
  alertFrequency: "daily" | "weekly" | "off";
  lastAlertCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function createRawajE2eSavedDiscoveryFixturePlugin(): Plugin {
  const favorites = new Set<string>();
  const savedSearches = new Map<string, FixtureSavedSearch>();

  function resetFixture(): void {
    favorites.clear();
    savedSearches.clear();
  }

  resetFixture();

  return {
    name: "rawaj-e2e-saved-discovery-fixture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const method = request.method ?? "GET";
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const path = url.pathname;

        if (method === "POST" && path === RESET_PATH) {
          await drainBody(request);
          if (request.headers[RESET_HEADER] !== "1") {
            sendJson(
              response,
              { error: { code: "permission_denied", message: "Fixture reset denied." } },
              403,
            );
            return;
          }
          resetFixture();
          sendJson(response, { data: { success: true } });
          return;
        }

        if (method === "OPTIONS" && isHandledPath(path)) {
          sendEmpty(response, 204);
          return;
        }

        const favoriteMatch = path.match(/^\/v1\/listings\/([^/]+)\/favorite$/);
        const savedSearchMatch = path.match(/^\/v1\/account\/saved-searches\/([^/]+)$/);
        const handled =
          path === "/v1/account/favorites" ||
          path === "/v1/account/saved-searches" ||
          Boolean(favoriteMatch) ||
          Boolean(savedSearchMatch);

        if (!handled) {
          next();
          return;
        }

        if (request.headers.authorization !== `Bearer ${FIXTURE_TOKEN}`) {
          sendJson(
            response,
            { error: { code: "auth_required", message: "Fixture authorization required." } },
            401,
          );
          return;
        }

        if (favoriteMatch) {
          const listingId = decodeURIComponent(favoriteMatch[1] ?? "");
          if (listingId !== LISTING_ID) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Fixture listing was not found." } },
              404,
            );
            return;
          }

          if (method === "GET") {
            sendJson(response, { data: { favorited: favorites.has(listingId) } });
            return;
          }
          if (method === "POST") {
            await drainBody(request);
            favorites.add(listingId);
            sendJson(response, { data: { favorited: true } });
            return;
          }
          if (method === "DELETE") {
            favorites.delete(listingId);
            sendJson(response, { data: { favorited: false } });
            return;
          }
        }

        if (method === "GET" && path === "/v1/account/favorites") {
          sendJson(response, {
            data: favorites.has(LISTING_ID) ? [favoriteRow()] : [],
          });
          return;
        }

        if (path === "/v1/account/saved-searches") {
          if (method === "GET") {
            sendJson(response, { data: [...savedSearches.values()] });
            return;
          }
          if (method === "POST") {
            const body = await readJsonBody(request);
            const savedSearch: FixtureSavedSearch = {
              id: SAVED_SEARCH_ID,
              userId: FIXTURE_USER_ID,
              nameAr: text(body.nameAr, "بحث محفوظ تجريبي"),
              filters: record(body.filters),
              alertFrequency: frequency(body.alertFrequency),
              lastAlertCheckedAt: null,
              createdAt: FIXTURE_TIMESTAMP,
              updatedAt: FIXTURE_TIMESTAMP,
            };
            savedSearches.set(savedSearch.id, savedSearch);
            sendJson(response, { data: savedSearch }, 201);
            return;
          }
        }

        if (savedSearchMatch) {
          const savedSearchId = decodeURIComponent(savedSearchMatch[1] ?? "");
          const savedSearch = savedSearches.get(savedSearchId);
          if (!savedSearch) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Fixture saved search was not found." } },
              404,
            );
            return;
          }

          if (method === "PATCH") {
            const body = await readJsonBody(request);
            const updated: FixtureSavedSearch = {
              ...savedSearch,
              alertFrequency: frequency(body.alertFrequency),
              updatedAt: "2026-07-30T15:01:00.000Z",
            };
            savedSearches.set(savedSearchId, updated);
            sendJson(response, { data: updated });
            return;
          }
          if (method === "DELETE") {
            savedSearches.delete(savedSearchId);
            sendJson(response, { data: { success: true } });
            return;
          }
        }

        sendJson(
          response,
          { error: { code: "not_found", message: "Fixture saved-discovery route was not found." } },
          404,
        );
      });
    },
  };
}

function favoriteRow(): Record<string, unknown> {
  return {
    user_id: FIXTURE_USER_ID,
    listing_id: LISTING_ID,
    created_at: FIXTURE_TIMESTAMP,
    owner_id: "00000000-0000-4000-8000-000000000010",
    category_id: "cat-vehicles",
    subcategory_id: "sub-cars",
    category_name_ar: "السيارات",
    category_placeholder: "car",
    governorate_id: "gov-damascus",
    governorate_name_ar: "دمشق",
    location_node_id: null,
    title: "سيارة عائلية بحالة ممتازة",
    description: "إعلان تجريبي ثابت مخصص لاختبارات المتصفح المحلية.",
    price: 450000000,
    currency: "SYP",
    price_type: "fixed",
    condition: "used",
    status: "approved",
    district_ar: "المزة",
    contact_name: "بائع رواج",
    contact_options: { message: true, phone: false, whatsapp: false },
    details: { _taxonomy_node_id: "taxonomy-cars-sale" },
    is_featured: true,
    featured_until: "2099-01-01T00:00:00.000Z",
    reviewed_by: null,
    reviewed_at: null,
    rejection_reason: null,
    published_at: "2026-07-04T10:00:00.000Z",
    archived_at: null,
    reserved_at: null,
    expires_at: "2099-01-01T00:00:00.000Z",
    renewed_at: null,
    expiry_days: 60,
    listing_created_at: "2026-07-04T10:00:00.000Z",
    listing_updated_at: "2026-07-04T10:00:00.000Z",
    primary_image_url: FIXTURE_IMAGE,
  };
}

function isHandledPath(path: string): boolean {
  return (
    path === "/v1/account/favorites" ||
    path.startsWith("/v1/account/saved-searches") ||
    /^\/v1\/listings\/[^/]+\/favorite$/.test(path)
  );
}

function frequency(value: unknown): FixtureSavedSearch["alertFrequency"] {
  return value === "daily" || value === "off" ? value : "weekly";
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(request);
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

async function drainBody(request: IncomingMessage): Promise<void> {
  await readBody(request);
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer | string) =>
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
    );
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendEmpty(response: ServerResponse, statusCode: number): void {
  response.statusCode = statusCode;
  setCorsHeaders(response);
  response.end();
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.statusCode = statusCode;
  setCorsHeaders(response);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Request-Id", "00000000-0000-4000-8000-000000000096");
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
}
