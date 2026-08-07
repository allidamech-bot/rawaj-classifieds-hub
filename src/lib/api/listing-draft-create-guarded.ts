import { createOwnerDraftListingIdempotent } from "@/lib/api/listing-draft-create-rpc";
import {
  readOrCreateOwnerDraftCreationRequestId,
  rememberOwnerDraftCreationListing,
} from "@/lib/api/listing-draft-creation-flow";
import { rememberOwnerListingVersion } from "@/lib/api/listing-owner-version";
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
 * the same owner payload in one browser runtime. The creation request id also
 * survives a page reload so the database can return the same draft after an
 * ambiguous response or repeated request.
 */
export function createOwnerDraftCopyRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `copy-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function createOwnerDraftListingCopy(
  userId: string | null,
  payload: CreateListingPayload,
  creationRequestId: string,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  return createOwnerDraftListingIdempotent(userId, payload, creationRequestId);
}

export function createOwnerDraftListing(
  userId: string | null,
  payload: CreateListingPayload,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  pruneExpiredDraftCreationRequests();

  const creationRequestId = userId ? readOrCreateOwnerDraftCreationRequestId(userId) : "anonymous";
  const requestKey = `${userId ?? "anonymous"}:${creationRequestId}:${stablePayloadKey(payload)}`;
  const existing = ownerDraftCreationRequests.get(requestKey);
  if (existing && (existing.expiresAt === null || existing.expiresAt > Date.now())) {
    return existing.promise;
  }

  const record = { expiresAt: null } as DraftCreationRequest;
  const request = createOwnerDraftListingIdempotent(userId, payload, creationRequestId)
    .then((result) => {
      if (!result.ok) {
        ownerDraftCreationRequests.delete(requestKey);
        return result;
      }

      if (userId) {
        rememberOwnerDraftCreationListing(userId, creationRequestId, result.data.id);
      }
      rememberOwnerListingVersion(userId, result.data);
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
