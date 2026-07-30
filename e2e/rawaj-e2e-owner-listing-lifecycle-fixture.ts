import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const FIXTURE_COOKIE = "rawaj-e2e-owner-listing-lifecycle";
const OWNER_ID = "00000000-0000-4000-8000-000000000020";
const APPROVED_LISTING_ID = "00000000-0000-4000-8000-000000000071";
const DRAFT_LISTING_ID = "00000000-0000-4000-8000-000000000072";
const RESET_HEADER = "x-rawaj-e2e-reset";
const RESET_PATH = "/__rawaj_e2e__/owner-listings/reset";
const BASE_TIMESTAMP = "2026-07-30T12:00:00.000Z";
const ACTION_TIMESTAMP = "2026-07-30T17:00:00.000Z";
const FIXTURE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='900'%3E%3Crect width='1200' height='900' fill='%23e7ecea'/%3E%3Cpath d='M80 650L360 350L590 560L840 260L1140 650V900H80Z' fill='%23143f38'/%3E%3C/svg%3E";

type ListingStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived"
  | "expired"
  | "sold"
  | "rented"
  | "unavailable";

interface FixtureListing extends Record<string, unknown> {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  status: ListingStatus;
  price: number | null;
  priceType: "fixed" | "negotiable";
  reservedAt: string | null;
  expiresAt: string | null;
  renewedAt: string | null;
  expiryDays: 30 | 60 | 90 | null;
  statusChangedAt: string | null;
  updatedAt: string;
}

export function createRawajE2eOwnerListingLifecycleFixturePlugin(): Plugin {
  const listings = new Map<string, FixtureListing>();

  function resetFixture(): void {
    listings.clear();
    listings.set(APPROVED_LISTING_ID, approvedListing());
    listings.set(DRAFT_LISTING_ID, draftListing());
  }

  resetFixture();

  return {
    name: "rawaj-e2e-owner-listing-lifecycle-fixture",
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

        if (!hasFixtureCookie(request)) {
          next();
          return;
        }

        const lifecycleMatch = path.match(/^\/v1\/listings\/([^/]+)\/lifecycle$/);
        const ownerDetailMatch = path.match(/^\/api\/listings\/([^/]+)$/);
        const deleteMatch = path.match(/^\/v1\/listings\/([^/]+)$/);
        const sellerMatch = path.match(/^\/v1\/sellers\/([^/]+)$/);
        const lifecycleListingId = decodedMatch(lifecycleMatch);
        const ownerDetailListingId = decodedMatch(ownerDetailMatch);
        const deleteListingId = decodedMatch(deleteMatch);
        const sellerId = decodedMatch(sellerMatch);
        const relevantRoute =
          path === "/v1/account/listings" ||
          isFixtureListingId(lifecycleListingId) ||
          isFixtureListingId(ownerDetailListingId) ||
          isFixtureListingId(deleteListingId) ||
          sellerId === OWNER_ID;
        const handled =
          (method === "GET" && path === "/v1/account/listings") ||
          (method === "PATCH" && isFixtureListingId(lifecycleListingId)) ||
          (method === "GET" && isFixtureListingId(ownerDetailListingId)) ||
          (method === "DELETE" && isFixtureListingId(deleteListingId)) ||
          (method === "GET" && sellerId === OWNER_ID) ||
          (method === "OPTIONS" && relevantRoute);

        if (!handled) {
          next();
          return;
        }

        if (method === "OPTIONS") {
          sendEmpty(response, 204);
          return;
        }

        if (sellerId === OWNER_ID && method === "GET") {
          sendJson(response, { data: sellerProfile([...listings.values()]) });
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

        if (method === "GET" && path === "/v1/account/listings") {
          sendJson(response, { data: [...listings.values()] });
          return;
        }

        if (ownerDetailListingId && method === "GET") {
          const listing = listings.get(ownerDetailListingId);
          if (!listing) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Fixture listing was not found." } },
              404,
            );
            return;
          }
          sendJson(response, { data: { listing, images: [] } });
          return;
        }

        if (lifecycleListingId && method === "PATCH") {
          const listing = listings.get(lifecycleListingId);
          if (!listing) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Fixture listing was not found." } },
              404,
            );
            return;
          }
          const body = await readJsonBody(request);
          const action = text(body.action);
          const nextListing = applyLifecycle(listing, action, body);
          if (!nextListing) {
            sendJson(
              response,
              {
                error: {
                  code: "status_mismatch",
                  message: "Fixture lifecycle action rejected.",
                },
              },
              409,
            );
            return;
          }
          listings.set(lifecycleListingId, nextListing);
          sendJson(response, { data: { success: true, updatedAt: nextListing.updatedAt } });
          return;
        }

        if (deleteListingId && method === "DELETE") {
          const listing = listings.get(deleteListingId);
          if (!listing) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Fixture listing was not found." } },
              404,
            );
            return;
          }
          listings.delete(deleteListingId);
          sendJson(response, { data: { success: true } });
          return;
        }

        sendJson(
          response,
          { error: { code: "not_found", message: "Fixture owner-listing route was not found." } },
          404,
        );
      });
    },
  };
}

function applyLifecycle(
  listing: FixtureListing,
  action: string,
  body: Record<string, unknown>,
): FixtureListing | null {
  if (action === "reserve" && listing.status === "approved") {
    return { ...listing, reservedAt: ACTION_TIMESTAMP, updatedAt: ACTION_TIMESTAMP };
  }
  if (action === "unreserve" && listing.status === "approved") {
    return { ...listing, reservedAt: null, updatedAt: ACTION_TIMESTAMP };
  }
  if (action === "reduce_price" && listing.status === "approved") {
    const newPrice = Number(body.newPrice);
    if (
      !Number.isFinite(newPrice) ||
      newPrice <= 0 ||
      (listing.price !== null && newPrice >= listing.price)
    ) {
      return null;
    }
    return { ...listing, price: newPrice, updatedAt: ACTION_TIMESTAMP };
  }
  if (action === "set_expiry" && listing.status === "approved") {
    const rawDays = body.expiryDays;
    const expiryDays =
      rawDays === null
        ? null
        : rawDays === 30 || rawDays === 60 || rawDays === 90
          ? rawDays
          : undefined;
    if (expiryDays === undefined) return null;
    return {
      ...listing,
      expiryDays,
      expiresAt: expiryDays === null ? null : "2026-10-28T17:00:00.000Z",
      renewedAt: ACTION_TIMESTAMP,
      updatedAt: ACTION_TIMESTAMP,
    };
  }
  if (["sold", "rented", "unavailable"].includes(action) && listing.status === "approved") {
    return {
      ...listing,
      status: action as ListingStatus,
      reservedAt: null,
      statusChangedAt: ACTION_TIMESTAMP,
      updatedAt: ACTION_TIMESTAMP,
    };
  }
  if (
    action === "reactivate" &&
    ["sold", "rented", "unavailable", "expired"].includes(listing.status)
  ) {
    return {
      ...listing,
      status: "pending_review",
      reservedAt: null,
      expiresAt: null,
      statusChangedAt: ACTION_TIMESTAMP,
      updatedAt: ACTION_TIMESTAMP,
    };
  }
  return null;
}

function approvedListing(): FixtureListing {
  return baseListing({
    id: APPROVED_LISTING_ID,
    title: "سيارة عائلية معتمدة",
    description: "إعلان معتمد مخصص لاختبار إدارة دورة حياة الإعلان.",
    status: "approved",
    price: 450_000_000,
    priceType: "fixed",
    expiryDays: 60,
    expiresAt: "2026-09-28T12:00:00.000Z",
    renewedAt: null,
  });
}

function draftListing(): FixtureListing {
  return baseListing({
    id: DRAFT_LISTING_ID,
    title: "مسودة أثاث منزل",
    description: "مسودة محلية قابلة للحذف.",
    status: "draft",
    price: 8_000_000,
    priceType: "negotiable",
    expiryDays: null,
    expiresAt: null,
    renewedAt: null,
  });
}

function baseListing(
  overrides: Partial<FixtureListing> &
    Pick<
      FixtureListing,
      | "id"
      | "title"
      | "description"
      | "status"
      | "price"
      | "priceType"
      | "expiryDays"
      | "expiresAt"
      | "renewedAt"
    >,
): FixtureListing {
  return {
    id: overrides.id,
    ownerId: OWNER_ID,
    categoryId: "cat-vehicles",
    subcategoryId: "sub-cars",
    categoryNameAr: "السيارات",
    categoryPlaceholder: "car",
    governorateId: "gov-damascus",
    governorateNameAr: "دمشق",
    locationNodeId: null,
    title: overrides.title,
    description: overrides.description,
    price: overrides.price,
    currency: "SYP",
    priceType: overrides.priceType,
    condition: "used",
    status: overrides.status,
    districtAr: "المزة",
    contactName: "مالك رواج",
    contactOptions: { message: true, phone: false, whatsapp: true },
    details: { _taxonomy_node_id: "taxonomy-vehicles" },
    isFeatured: false,
    featuredUntil: null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    publishedAt: overrides.status === "approved" ? BASE_TIMESTAMP : null,
    archivedAt: null,
    reservedAt: null,
    statusChangedAt: null,
    expiresAt: overrides.expiresAt,
    renewedAt: overrides.renewedAt,
    expiryDays: overrides.expiryDays,
    createdAt: BASE_TIMESTAMP,
    updatedAt: BASE_TIMESTAMP,
    primaryImageUrl: FIXTURE_IMAGE,
  };
}

function sellerProfile(currentListings: FixtureListing[]): Record<string, unknown> {
  const approved = currentListings.filter((listing) => listing.status === "approved");
  return {
    id: OWNER_ID,
    displayName: "مالك رواج التجريبي",
    verified: false,
    joinedAt: BASE_TIMESTAMP,
    locationAr: "دمشق",
    bio: "متجر تجريبي لاختبارات المتصفح المحلية.",
    businessName: "متجر رواج التجريبي",
    avatarUrl: null,
    coverUrl: null,
    approvedListingCount: approved.length,
    inventoryStatus: "ready",
    listingDisplayLimit: 24,
    ratingSummary: {
      average: null,
      count: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    reviews: [],
    reviewsStatus: "ready",
    approvedReviewCount: 0,
    reviewDisplayLimit: 10,
    listings: approved,
  };
}

function hasFixtureCookie(request: IncomingMessage): boolean {
  return (request.headers.cookie ?? "")
    .split(";")
    .some((cookie) => cookie.trim() === `${FIXTURE_COOKIE}=1`);
}

function decodedMatch(match: RegExpMatchArray | null): string | null {
  return match ? decodeURIComponent(match[1] ?? "") : null;
}

function isFixtureListingId(value: string | null): boolean {
  return value === APPROVED_LISTING_ID || value === DRAFT_LISTING_ID;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
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
  response.setHeader("X-Request-Id", "00000000-0000-4000-8000-000000000094");
  response.end(JSON.stringify(payload));
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, PATCH, DELETE, OPTIONS");
}
