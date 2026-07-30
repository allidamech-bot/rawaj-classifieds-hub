import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FIXTURE_USER_ID = "00000000-0000-4000-8000-000000000020";
const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const FIXTURE_GOVERNORATE_ID = "gov-damascus";
const FIXTURE_LOCATION_ID = "location-damascus";
const FIXTURE_TIMESTAMP = "2026-07-30T12:00:00.000Z";
const FIXTURE_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='640' height='480' viewBox='0 0 640 480'%3E%3Crect width='640' height='480' fill='%23242a30'/%3E%3Cpath d='M0 350L180 170L300 290L440 120L640 360V480H0Z' fill='%23d9468f'/%3E%3C/svg%3E";

interface FixtureListing extends Record<string, unknown> {
  id: string;
  ownerId: string;
  categoryId: string;
  subcategoryId: string | null;
  governorateId: string;
  title: string;
  description: string;
  status: string;
  updatedAt: string;
}

interface FixtureImage extends Record<string, unknown> {
  id: string;
  listingId: string;
}

export function createRawajE2ePrivateFixturePlugin(): Plugin {
  const listings = new Map<string, FixtureListing>();
  const images = new Map<string, FixtureImage[]>();
  const taxonomyAssignments = new Map<string, string>();
  const attributes = new Map<string, Record<string, unknown>>();
  let listingSequence = 0;
  let imageSequence = 0;
  let versionSequence = 0;

  return {
    name: "rawaj-e2e-private-fixtures",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const method = request.method ?? "GET";
        const path = url.pathname;

        if (method === "OPTIONS" && (path.startsWith("/api/") || path.startsWith("/v1/"))) {
          sendEmpty(response, 204);
          return;
        }

        if (method === "GET" && path === "/v1/system-status") {
          sendJson(response, {
            data: {
              maintenance: false,
              readOnly: false,
              postingFrozen: false,
              messagingFrozen: false,
              promotionFrozen: false,
              verificationFrozen: false,
            },
          });
          return;
        }

        const leafMatch = path.match(/^\/v1\/taxonomy\/leaf\/([^/]+)$/);
        if (method === "GET" && leafMatch) {
          const taxonomyNodeId = decodeURIComponent(leafMatch[1] ?? "");
          sendJson(response, {
            data: {
              found: true,
              version: { id: "taxonomy-version-e2e", number: 1, publishedAt: FIXTURE_TIMESTAMP },
              leaf: {
                id: taxonomyNodeId,
                parentId: null,
                slug: taxonomyNodeId,
                nameAr: "قسم تجريبي",
                nameEn: "Fixture category",
                descriptionAr: null,
                descriptionEn: null,
                iconKey: "package",
                filterSchemaKey: null,
                displaySchemaKey: null,
                classificationKey: null,
                classificationValue: null,
              },
              fields: [],
              conditionalRules: [],
            },
          });
          return;
        }

        if (method === "GET" && path === "/v1/locations/search") {
          sendJson(response, {
            data: [
              {
                node: locationNode(),
                matchedAlias: "دمشق",
                pathAr: "دمشق",
                pathEn: "Damascus",
              },
            ],
          });
          return;
        }

        if (method === "GET" && path === "/v1/locations/roots") {
          sendJson(response, { data: [locationNode()] });
          return;
        }

        const locationMatch = path.match(/^\/v1\/locations\/([^/]+)(?:\/children)?$/);
        if (method === "GET" && locationMatch) {
          const includesDescendants = url.searchParams.get("include") === "descendants";
          const isChildren = path.endsWith("/children");
          sendJson(response, {
            data: includesDescendants ? [FIXTURE_LOCATION_ID] : isChildren ? [] : [locationNode()],
          });
          return;
        }

        const privateRequest =
          path.startsWith("/api/") ||
          path.startsWith("/v1/account/") ||
          (path.startsWith("/v1/listings") && method !== "GET") ||
          path.startsWith("/v1/listing-images/");

        if (privateRequest && !hasFixtureAuthorization(request)) {
          sendJson(
            response,
            { error: { code: "auth_required", message: "Fixture authorization required." } },
            401,
          );
          return;
        }

        if (method === "GET" && path === "/api/profile") {
          sendJson(response, {
            data: {
              id: FIXTURE_USER_ID,
              email: "browser-smoke@rawa-j.test",
              firstName: "مستخدم",
              lastName: "تجريبي",
              displayName: "مستخدم رواج التجريبي",
              businessName: null,
              bio: null,
              governorate: "دمشق",
              cityArea: null,
              phone: null,
              whatsapp: null,
              preferredContactMethod: "message",
              verificationStatus: "unverified",
              accountStatus: "active",
              roles: ["user"],
              avatarUrl: null,
              coverUrl: null,
              createdAt: FIXTURE_TIMESTAMP,
              updatedAt: FIXTURE_TIMESTAMP,
            },
          });
          return;
        }

        if (method === "POST" && path === "/v1/listings") {
          const body = await readJsonBody(request);
          listingSequence += 1;
          const id = `e2e-owner-listing-${listingSequence}`;
          const updatedAt = nextTimestamp(++versionSequence);
          const listing: FixtureListing = {
            id,
            ownerId: FIXTURE_USER_ID,
            categoryId: text(body.categoryId, "cat-vehicles"),
            subcategoryId: nullableText(body.subcategoryId),
            categoryNameAr: "السيارات",
            categoryPlaceholder: "car",
            governorateId: text(body.governorateId, FIXTURE_GOVERNORATE_ID),
            governorateNameAr: "دمشق",
            locationNodeId: nullableText(body.locationNodeId),
            title: text(body.title, "إعلان تجريبي"),
            description: text(body.description),
            price: nullableNumber(body.price),
            currency: "SYP",
            priceType: text(body.priceType, "fixed"),
            condition: text(body.condition, "used"),
            status: body.submit === true ? "pending_review" : "draft",
            districtAr: nullableText(body.districtAr),
            contactName: nullableText(body.contactName),
            contactOptions: record(body.contactOptions),
            details: record(body.details),
            isFeatured: false,
            featuredUntil: null,
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: null,
            publishedAt: null,
            archivedAt: null,
            reservedAt: null,
            expiresAt: null,
            renewedAt: null,
            expiryDays: 60,
            createdAt: updatedAt,
            updatedAt,
            primaryImageUrl: null,
          };
          listings.set(id, listing);
          images.set(id, []);
          sendJson(response, { data: { id, status: listing.status, updatedAt } }, 201);
          return;
        }

        if (method === "GET" && path === "/v1/account/listings") {
          sendJson(response, { data: [...listings.values()] });
          return;
        }

        const ownerDetailMatch = path.match(/^\/api\/listings\/([^/]+)$/);
        if (method === "GET" && ownerDetailMatch) {
          const listingId = decodeURIComponent(ownerDetailMatch[1] ?? "");
          const listing = listings.get(listingId);
          if (!listing) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Listing not found." } },
              404,
            );
            return;
          }
          sendJson(response, { data: { listing, images: images.get(listingId) ?? [] } });
          return;
        }

        const listingMatch = path.match(/^\/v1\/listings\/([^/]+)$/);
        if (method === "PATCH" && listingMatch) {
          const listingId = decodeURIComponent(listingMatch[1] ?? "");
          const listing = listings.get(listingId);
          if (!listing) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Listing not found." } },
              404,
            );
            return;
          }
          const body = await readJsonBody(request);
          const updatedAt = nextTimestamp(++versionSequence);
          const next: FixtureListing = {
            ...listing,
            ...copyDefined(body, [
              "categoryId",
              "subcategoryId",
              "governorateId",
              "locationNodeId",
              "title",
              "description",
              "price",
              "priceType",
              "condition",
              "districtAr",
              "contactName",
              "contactOptions",
              "details",
            ]),
            status: body.submit === true ? "pending_review" : listing.status,
            updatedAt,
          };
          listings.set(listingId, next);
          sendJson(response, { data: { id: listingId, status: next.status, updatedAt } });
          return;
        }

        const taxonomyMatch = path.match(/^\/v1\/listings\/([^/]+)\/taxonomy$/);
        if (taxonomyMatch && (method === "PUT" || method === "GET")) {
          const listingId = decodeURIComponent(taxonomyMatch[1] ?? "");
          if (method === "PUT") {
            const body = await readJsonBody(request);
            taxonomyAssignments.set(listingId, text(body.taxonomyNodeId));
          }
          const taxonomyNodeId = taxonomyAssignments.get(listingId) ?? null;
          sendJson(response, {
            data: taxonomyNodeId
              ? {
                  listingId,
                  taxonomyNodeId,
                  assignmentSource: "explicit",
                  updatedAt: listings.get(listingId)?.updatedAt ?? FIXTURE_TIMESTAMP,
                }
              : null,
          });
          return;
        }

        const attributesMatch = path.match(
          /^\/v1\/listings\/([^/]+)\/attributes(?:\/(completeness))?$/,
        );
        if (attributesMatch) {
          const listingId = decodeURIComponent(attributesMatch[1] ?? "");
          const listing = listings.get(listingId);
          if (!listing) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Listing not found." } },
              404,
            );
            return;
          }
          if (method === "PATCH") {
            const body = await readJsonBody(request);
            const values = record(body.attributes);
            attributes.set(listingId, values);
            const updatedAt = nextTimestamp(++versionSequence);
            listing.updatedAt = updatedAt;
            sendJson(response, {
              data: {
                listingId,
                updatedAt,
                writtenCount: Object.keys(values).length,
                completeness: completeness(taxonomyAssignments.get(listingId) ?? null, values),
              },
            });
            return;
          }
          if (method === "GET" && attributesMatch[2] === "completeness") {
            sendJson(response, {
              data: completeness(
                taxonomyAssignments.get(listingId) ?? null,
                attributes.get(listingId) ?? {},
              ),
            });
            return;
          }
          if (method === "GET") {
            const values = attributes.get(listingId) ?? {};
            sendJson(response, {
              data: {
                listingId,
                listingUpdatedAt: listing.updatedAt,
                listingStatus: listing.status,
                taxonomyVersionId: "taxonomy-version-e2e",
                taxonomyVersionNumber: 1,
                taxonomyNodeId: taxonomyAssignments.get(listingId) ?? null,
                valueCount: Object.keys(values).length,
                values,
              },
            });
            return;
          }
        }

        const imageUploadMatch = path.match(/^\/v1\/listings\/([^/]+)\/images$/);
        if (method === "POST" && imageUploadMatch) {
          const listingId = decodeURIComponent(imageUploadMatch[1] ?? "");
          await drainBody(request);
          imageSequence += 1;
          const image: FixtureImage = {
            id: `e2e-image-${imageSequence}`,
            listingId,
            storagePath: null,
            publicUrl: FIXTURE_IMAGE,
            signedUrlExpiresIn: null,
            altAr: listings.get(listingId)?.title ?? "صورة إعلان تجريبية",
            sortOrder: images.get(listingId)?.length ?? 0,
            createdAt: nextTimestamp(++versionSequence),
          };
          images.set(listingId, [...(images.get(listingId) ?? []), image]);
          const listing = listings.get(listingId);
          if (listing && !listing.primaryImageUrl) listing.primaryImageUrl = FIXTURE_IMAGE;
          sendJson(response, { data: image }, 201);
          return;
        }

        if (method === "GET" && path === "/v1/account/notifications") {
          sendJson(response, { data: { items: [], nextCursor: null, unreadCount: 0 } });
          return;
        }
        if (method === "GET" && path === "/v1/account/messages/unread-count") {
          sendJson(response, { data: { unreadCount: 0 } });
          return;
        }
        if (
          method === "GET" &&
          [
            "/v1/account/favorites",
            "/v1/account/recent-views",
            "/v1/account/followed-sellers",
            "/v1/account/saved-searches",
            "/v1/account/conversations",
          ].includes(path)
        ) {
          sendJson(response, { data: [] });
          return;
        }

        if (path.startsWith("/api/") || privateRequest) {
          sendJson(
            response,
            {
              error: {
                code: "fixture_route_missing",
                message: `Authenticated E2E route is not locally fixture-backed: ${method} ${path}`,
              },
            },
            501,
          );
          return;
        }

        next();
      });
    },
  };
}

function hasFixtureAuthorization(request: IncomingMessage): boolean {
  return request.headers.authorization === `Bearer ${FIXTURE_TOKEN}`;
}

function locationNode() {
  return {
    id: FIXTURE_LOCATION_ID,
    parentId: null,
    countryCode: "SY",
    nodeType: "governorate",
    nameAr: "دمشق",
    nameEn: "Damascus",
    slug: "damascus",
    officialCode: "SY-DI",
    externalSource: "e2e",
    externalId: "e2e-damascus",
    latitude: 33.5138,
    longitude: 36.2765,
    sortOrder: 1,
    depth: 0,
    isActive: true,
    searchAliases: ["دمشق", "Damascus"],
    legacyGovernorateId: FIXTURE_GOVERNORATE_ID,
    legacyDistrictAr: null,
  };
}

function completeness(taxonomyNodeId: string | null, values: Record<string, unknown>) {
  return {
    complete: true,
    blockingCode: null,
    taxonomyVersionId: "taxonomy-version-e2e",
    taxonomyNodeId,
    requiredCount: 0,
    filledRequiredCount: 0,
    filledCount: Object.keys(values).length,
    missingRequiredFields: [],
  };
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const body = await readBody(request);
  if (!body) return {};
  try {
    return record(JSON.parse(body));
  } catch {
    return {};
  }
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

async function drainBody(request: IncomingMessage): Promise<void> {
  await readBody(request);
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.statusCode = statusCode;
  commonHeaders(response);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function sendEmpty(response: ServerResponse, statusCode: number): void {
  response.statusCode = statusCode;
  commonHeaders(response);
  response.end();
}

function commonHeaders(response: ServerResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.setHeader("X-Request-Id", "00000000-0000-4000-8000-000000000099");
}

function nextTimestamp(sequence: number): string {
  return new Date(Date.parse(FIXTURE_TIMESTAMP) + sequence * 1_000).toISOString();
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function copyDefined(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(
    keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]),
  );
}
