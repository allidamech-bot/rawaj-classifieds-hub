import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const FIXTURE_TOKEN = "rawaj-e2e-firebase-token";
const RESET_HEADER = "x-rawaj-e2e-reset";
const RESET_PATH = "/__rawaj_e2e__/messaging/reset";
const CONVERSATION_ID = "00000000-0000-4000-8000-000000000041";
const LISTING_ID = "00000000-0000-4000-8000-000000000042";
const INCOMING_MESSAGE_ID = "00000000-0000-4000-8000-000000000043";
const INCOMING_OFFER_ID = "00000000-0000-4000-8000-000000000044";
const BUYER_ID = "00000000-0000-4000-8000-000000000045";
const SELLER_ID = "00000000-0000-4000-8000-000000000046";
const FIXTURE_STARTED_AT = "2026-07-30T12:30:00.000Z";

interface FixtureMessage extends Record<string, unknown> {
  id: string;
  conversation_id: string;
  body: string;
  is_mine: number;
  created_at: string;
}

interface FixtureOffer {
  id: string;
  listingId: string;
  conversationId: string;
  buyerId: string;
  sellerId: string;
  createdBy: string;
  createdByMe: boolean;
  parentOfferId: string | null;
  amount: number;
  currency: string;
  status: "pending" | "accepted" | "rejected" | "countered" | "withdrawn" | "expired";
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type OfferRole = "buyer" | "seller";

export function createRawajE2eMessagingFixturePlugin(): Plugin {
  const messages: FixtureMessage[] = [];
  const sentByRequestId = new Map<string, FixtureMessage>();
  const offers: FixtureOffer[] = [];
  const offerByRequestId = new Map<string, FixtureOffer>();
  const offerActionByRequestId = new Map<string, FixtureOffer>();
  let unreadCount = 1;
  let messageSequence = 0;
  let offerSequence = 0;
  let offerRole: OfferRole = "seller";

  function resetFixture(nextRole: OfferRole = "seller"): void {
    messages.splice(0, messages.length, initialIncomingMessage());
    sentByRequestId.clear();
    offers.splice(0, offers.length);
    offerByRequestId.clear();
    offerActionByRequestId.clear();
    unreadCount = 1;
    messageSequence = 0;
    offerSequence = 0;
    offerRole = nextRole;
    if (offerRole === "seller") offers.push(initialIncomingOffer());
  }

  resetFixture();

  return {
    name: "rawaj-e2e-messaging-fixture",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const method = request.method ?? "GET";
        const url = new URL(request.url ?? "/", "http://127.0.0.1");
        const path = url.pathname;
        const messagesMatch = path.match(/^\/v1\/conversations\/([^/]+)\/messages$/);
        const readMatch = path.match(/^\/v1\/conversations\/([^/]+)\/read$/);
        const offersMatch = path.match(/^\/v1\/conversations\/([^/]+)\/offers$/);
        const offerMatch = path.match(/^\/v1\/offers\/([^/]+)$/);

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
          const requestedRole = url.searchParams.get("offerRole");
          resetFixture(requestedRole === "buyer" ? "buyer" : "seller");
          sendJson(response, { data: { success: true, offerRole } });
          return;
        }

        const handled =
          path === "/v1/account/conversations" ||
          path === "/v1/account/messages/unread-count" ||
          Boolean(messagesMatch) ||
          Boolean(readMatch) ||
          Boolean(offersMatch) ||
          Boolean(offerMatch);

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

        if (method === "GET" && path === "/v1/account/conversations") {
          sendJson(response, {
            data: {
              items: [conversationRow(unreadCount, messages.at(-1) ?? null)],
              nextCursor: null,
              pageSize: 50,
            },
          });
          return;
        }

        if (method === "GET" && path === "/v1/account/messages/unread-count") {
          sendJson(response, { data: { unreadCount } });
          return;
        }

        if (offersMatch && decodeURIComponent(offersMatch[1] ?? "") === CONVERSATION_ID) {
          if (method === "GET") {
            sendJson(response, {
              data: { items: offers, role: offerRole, listingAvailable: true },
            });
            return;
          }

          if (method === "POST") {
            const body = await readJsonBody(request);
            const requestId = text(body.requestId);
            const amount = positiveInteger(body.amount);
            if (!requestId || amount === null) {
              sendJson(
                response,
                { error: { code: "validation_error", message: "Offer amount is required." } },
                400,
              );
              return;
            }
            const existing = offerByRequestId.get(requestId);
            if (existing) {
              sendJson(response, { data: existing });
              return;
            }
            if (offerRole !== "buyer") {
              sendJson(
                response,
                { error: { code: "permission_denied", message: "Only the buyer can offer." } },
                403,
              );
              return;
            }
            if (offers.some((offer) => offer.status === "pending")) {
              sendJson(
                response,
                { error: { code: "status_mismatch", message: "Offer already pending." } },
                409,
              );
              return;
            }
            const created = createOffer({
              amount,
              createdBy: BUYER_ID,
              createdByMe: true,
              parentOfferId: null,
            });
            offers.push(created);
            offerByRequestId.set(requestId, created);
            sendJson(response, { data: created }, 201);
            return;
          }
        }

        if (offerMatch && method === "PATCH") {
          const offerId = decodeURIComponent(offerMatch[1] ?? "");
          const current = offers.find((offer) => offer.id === offerId);
          if (!current) {
            sendJson(
              response,
              { error: { code: "not_found", message: "Fixture offer was not found." } },
              404,
            );
            return;
          }
          const body = await readJsonBody(request);
          const action = text(body.action);
          const requestId = text(body.requestId);
          const expectedUpdatedAt = text(body.expectedUpdatedAt);
          const replay = offerActionByRequestId.get(requestId);
          if (replay) {
            sendJson(response, { data: replay });
            return;
          }
          if (!requestId || current.updatedAt !== expectedUpdatedAt || current.status !== "pending") {
            sendJson(
              response,
              { error: { code: "stale_write", message: "Fixture offer changed." } },
              409,
            );
            return;
          }

          if (action === "withdraw" && current.createdByMe) {
            updateOffer(current, "withdrawn");
            offerActionByRequestId.set(requestId, current);
            sendJson(response, { data: current });
            return;
          }

          if ((action === "accept" || action === "reject") && !current.createdByMe) {
            updateOffer(current, action === "accept" ? "accepted" : "rejected");
            offerActionByRequestId.set(requestId, current);
            sendJson(response, { data: current });
            return;
          }

          if (action === "counter" && !current.createdByMe) {
            const amount = positiveInteger(body.amount);
            if (amount === null) {
              sendJson(
                response,
                { error: { code: "validation_error", message: "Counter amount is required." } },
                400,
              );
              return;
            }
            updateOffer(current, "countered");
            const counter = createOffer({
              amount,
              createdBy: SELLER_ID,
              createdByMe: true,
              parentOfferId: current.id,
            });
            offers.push(counter);
            offerActionByRequestId.set(requestId, counter);
            sendJson(response, { data: counter }, 201);
            return;
          }

          sendJson(
            response,
            { error: { code: "permission_denied", message: "Fixture action denied." } },
            403,
          );
          return;
        }

        if (messagesMatch && decodeURIComponent(messagesMatch[1] ?? "") === CONVERSATION_ID) {
          if (method === "GET") {
            sendJson(response, {
              data: { items: messages, nextCursor: null, pageSize: 50 },
            });
            return;
          }

          if (method === "POST") {
            const body = await readJsonBody(request);
            const requestId = text(body.requestId);
            const messageBody = text(body.body).trim();
            if (!requestId || !messageBody) {
              sendJson(
                response,
                { error: { code: "validation_error", message: "Message body is required." } },
                400,
              );
              return;
            }

            const existing = sentByRequestId.get(requestId);
            if (existing) {
              sendJson(response, { data: existing });
              return;
            }

            messageSequence += 1;
            const message: FixtureMessage = {
              id: `00000000-0000-4000-8000-${String(43 + messageSequence).padStart(12, "0")}`,
              conversation_id: CONVERSATION_ID,
              body: messageBody,
              is_mine: 1,
              attachment_path: null,
              attachment_mime_type: null,
              attachment_size_bytes: null,
              attachment_kind: null,
              attachment_duration_ms: null,
              created_at: new Date(
                Date.parse(FIXTURE_STARTED_AT) + (messageSequence + 1) * 1_000,
              ).toISOString(),
              edited_at: null,
              deleted_at: null,
            };
            sentByRequestId.set(requestId, message);
            messages.push(message);
            sendJson(response, { data: message }, 201);
            return;
          }
        }

        if (
          method === "POST" &&
          readMatch &&
          decodeURIComponent(readMatch[1] ?? "") === CONVERSATION_ID
        ) {
          await drainBody(request);
          unreadCount = 0;
          sendJson(response, { data: { success: true } });
          return;
        }

        sendJson(
          response,
          { error: { code: "not_found", message: "Fixture conversation was not found." } },
          404,
        );
      });
    },
  };

  function createOffer(input: {
    amount: number;
    createdBy: string;
    createdByMe: boolean;
    parentOfferId: string | null;
  }): FixtureOffer {
    offerSequence += 1;
    const timestamp = new Date(Date.parse(FIXTURE_STARTED_AT) + (20 + offerSequence) * 1_000).toISOString();
    return {
      id: `00000000-0000-4000-8000-${String(44 + offerSequence).padStart(12, "0")}`,
      listingId: LISTING_ID,
      conversationId: CONVERSATION_ID,
      buyerId: BUYER_ID,
      sellerId: SELLER_ID,
      createdBy: input.createdBy,
      createdByMe: input.createdByMe,
      parentOfferId: input.parentOfferId,
      amount: input.amount,
      currency: "SYP",
      status: "pending",
      expiresAt: new Date(Date.parse(timestamp) + 72 * 60 * 60 * 1_000).toISOString(),
      respondedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}

function initialIncomingMessage(): FixtureMessage {
  return {
    id: INCOMING_MESSAGE_ID,
    conversation_id: CONVERSATION_ID,
    body: "مرحباً، هل السيارة ما زالت متوفرة؟",
    is_mine: 0,
    attachment_path: null,
    attachment_mime_type: null,
    attachment_size_bytes: null,
    attachment_kind: null,
    attachment_duration_ms: null,
    created_at: FIXTURE_STARTED_AT,
    edited_at: null,
    deleted_at: null,
  };
}

function initialIncomingOffer(): FixtureOffer {
  return {
    id: INCOMING_OFFER_ID,
    listingId: LISTING_ID,
    conversationId: CONVERSATION_ID,
    buyerId: BUYER_ID,
    sellerId: SELLER_ID,
    createdBy: BUYER_ID,
    createdByMe: false,
    parentOfferId: null,
    amount: 425_000_000,
    currency: "SYP",
    status: "pending",
    expiresAt: "2026-08-02T12:30:00.000Z",
    respondedAt: null,
    createdAt: "2026-07-30T12:31:00.000Z",
    updatedAt: "2026-07-30T12:31:00.000Z",
  };
}

function updateOffer(offer: FixtureOffer, status: FixtureOffer["status"]): void {
  const timestamp = new Date(Date.parse(offer.updatedAt) + 1_000).toISOString();
  offer.status = status;
  offer.respondedAt = timestamp;
  offer.updatedAt = timestamp;
}

function conversationRow(unreadCount: number, latest: FixtureMessage | null) {
  return {
    id: CONVERSATION_ID,
    listing_id: LISTING_ID,
    listing_title: "سيارة تجريبية معتمدة",
    status: "active",
    other_display_name: "سارة التجريبية",
    other_avatar_url: null,
    last_message_at: latest?.created_at ?? FIXTURE_STARTED_AT,
    last_message_preview: latest?.body ?? null,
    unread_count: unreadCount,
    other_last_read_at: null,
    created_at: FIXTURE_STARTED_AT,
    updated_at: latest?.created_at ?? FIXTURE_STARTED_AT,
  };
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

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function positiveInteger(value: unknown): number | null {
  const normalized = Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : null;
}

function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Request-Id", "00000000-0000-4000-8000-000000000097");
  response.end(JSON.stringify(payload));
}
