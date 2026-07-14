import { createOwnerDraftListing as createOwnerDraftListingBase } from "@/lib/api/listings";
import type {
  ClassifiedListing,
  ClassifiedsResult,
  CreateListingPayload,
} from "@/lib/classifieds-types";

const SUCCESS_REUSE_WINDOW_MS = 30_000;

interface DraftCreationRequest {
  promise: Promise<ClassifiedsResult<ClassifiedListing>>;
  expiresAt: number | null;
}

const ownerDraftCreationRequests = new Map<string, DraftCreationRequest>();

/**
 * Prevents duplicate draft rows when autosave and an explicit submit race with
 * the same owner payload in one browser runtime. In-flight requests never
 * expire; successful results remain reusable briefly so a repeated click
 * cannot create a second draft before React state receives the first draft id.
 */
export function createOwnerDraftListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  pruneExpiredDraftCreationRequests();

  const requestKey = `${userId ?? "anonymous"}:${stablePayloadKey(payload)}`;
  const existing = ownerDraftCreationRequests.get(requestKey);
  if (existing && (existing.expiresAt === null || existing.expiresAt > Date.now())) {
    return existing.promise;
  }

  const record = { expiresAt: null } as DraftCreationRequest;
  const request = createOwnerDraftListingBase(userId, payload)
    .then((result) => {
      if (!result.ok) {
        ownerDraftCreationRequests.delete(requestKey);
        return result;
      }

      record.expiresAt = Date.now() + SUCCESS_REUSE_WINDOW_MS;
      return result;
    })
    .catch((error: unknown) => {
      ownerDraftCreationRequests.delete(requestKey);
      throw error;
    });

  record.promise = request;
  ownerDraftCreationRequests.set(requestKey, record);

  return request;
}

function pruneExpiredDraftCreationRequests() {
  const now = Date.now();
  for (const [key, request] of ownerDraftCreationRequests) {
    if (request.expiresAt !== null && request.expiresAt <= now) {
      ownerDraftCreationRequests.delete(key);
    }
  }
}

function stablePayloadKey(payload: CreateListingPayload): string {
  return JSON.stringify(stableValue(payload));
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}
