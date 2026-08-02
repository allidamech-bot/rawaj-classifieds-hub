import { normalizeChatResourceId } from "@/lib/chat-integrity";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";

export type ListingPriceOfferStatus =
  "pending" | "accepted" | "rejected" | "countered" | "withdrawn" | "expired";

export type ListingPriceOfferAction = "accept" | "reject" | "counter" | "withdraw";

export interface ListingPriceOffer {
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
  status: ListingPriceOfferStatus;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationPriceOffersSnapshot {
  items: ListingPriceOffer[];
  role: "buyer" | "seller";
  listingAvailable: boolean;
}

const REQUEST_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_OFFER_AMOUNT = 9_007_199_254_740_991;

export async function fetchConversationPriceOffers(
  conversationId: string,
): Promise<ClassifiedsResult<ConversationPriceOffersSnapshot>> {
  const cleanConversationId = normalizeChatResourceId(conversationId);
  if (!cleanConversationId) return failure("validation_error", "تعذر تحديد المحادثة.");
  const result = await cloudflareApiRequest<{
    items: Record<string, unknown>[];
    role: "buyer" | "seller";
    listingAvailable: boolean;
  }>(`/v1/conversations/${encodeURIComponent(cleanConversationId)}/offers`);
  if (!result.ok) return failure(result.code as ClassifiedsErrorCode, result.error);
  return {
    ok: true,
    data: {
      items: result.data.items.map(mapListingPriceOffer),
      role: result.data.role,
      listingAvailable: result.data.listingAvailable,
    },
  };
}

export async function createConversationPriceOffer(payload: {
  conversationId: string;
  amount: number;
  requestId: string;
}): Promise<ClassifiedsResult<ListingPriceOffer>> {
  const conversationId = normalizeChatResourceId(payload.conversationId);
  const amount = normalizeAmount(payload.amount);
  const requestId = payload.requestId.trim();
  if (!conversationId || amount === null || !REQUEST_UUID_PATTERN.test(requestId)) {
    return failure("validation_error", "أدخل مبلغ عرض صحيحاً.");
  }
  const result = await cloudflareApiRequest<Record<string, unknown>>(
    `/v1/conversations/${encodeURIComponent(conversationId)}/offers`,
    { method: "POST", body: { amount, requestId } },
  );
  return result.ok
    ? { ok: true, data: mapListingPriceOffer(result.data) }
    : failure(result.code as ClassifiedsErrorCode, result.error);
}

export async function transitionListingPriceOffer(payload: {
  offerId: string;
  action: ListingPriceOfferAction;
  expectedUpdatedAt: string;
  requestId: string;
  amount?: number;
}): Promise<ClassifiedsResult<ListingPriceOffer>> {
  const offerId = normalizeChatResourceId(payload.offerId);
  const requestId = payload.requestId.trim();
  const expectedUpdatedAt = payload.expectedUpdatedAt.trim();
  const amount = payload.action === "counter" ? normalizeAmount(payload.amount) : undefined;
  if (
    !offerId ||
    !REQUEST_UUID_PATTERN.test(requestId) ||
    !expectedUpdatedAt ||
    (payload.action === "counter" && amount === null)
  ) {
    return failure("validation_error", "تعذر تنفيذ إجراء العرض.");
  }
  const result = await cloudflareApiRequest<Record<string, unknown>>(
    `/v1/offers/${encodeURIComponent(offerId)}`,
    {
      method: "PATCH",
      body: {
        action: payload.action,
        expectedUpdatedAt,
        requestId,
        ...(payload.action === "counter" ? { amount } : {}),
      },
    },
  );
  return result.ok
    ? { ok: true, data: mapListingPriceOffer(result.data) }
    : failure(result.code as ClassifiedsErrorCode, result.error);
}

function mapListingPriceOffer(row: Record<string, unknown>): ListingPriceOffer {
  return {
    id: text(row.id),
    listingId: text(row.listingId),
    conversationId: text(row.conversationId),
    buyerId: text(row.buyerId),
    sellerId: text(row.sellerId),
    createdBy: text(row.createdBy),
    createdByMe: row.createdByMe === true,
    parentOfferId: nullableText(row.parentOfferId),
    amount: Math.max(0, Math.trunc(number(row.amount))),
    currency: text(row.currency) || "SAR",
    status: offerStatus(row.status),
    expiresAt: text(row.expiresAt),
    respondedAt: nullableText(row.respondedAt),
    createdAt: text(row.createdAt),
    updatedAt: text(row.updatedAt),
  };
}

function offerStatus(value: unknown): ListingPriceOfferStatus {
  if (
    value === "accepted" ||
    value === "rejected" ||
    value === "countered" ||
    value === "withdrawn" ||
    value === "expired"
  ) {
    return value;
  }
  return "pending";
}

function normalizeAmount(value: unknown): number | null {
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(normalized) && normalized > 0 && normalized <= MAX_OFFER_AMOUNT
    ? normalized
    : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function nullableText(value: unknown): string | null {
  const normalized = text(value).trim();
  return normalized || null;
}

function number(value: unknown): number {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function failure<T>(code: ClassifiedsErrorCode, message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code, message } };
}
