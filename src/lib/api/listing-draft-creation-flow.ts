const FLOW_STORAGE_PREFIX = "rawaj:listing-draft-creation-flow:v1";
const FLOW_QUERY_PARAM = "draftFlow";
const FLOW_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface OwnerDraftCreationFlow {
  requestId: string;
  listingId: string | null;
  createdAt: number;
}

const memoryFlows = new Map<string, OwnerDraftCreationFlow>();

export function readOrCreateOwnerDraftCreationRequestId(userId: string): string {
  const cleanUserId = userId.trim();
  if (!cleanUserId) throw new Error("Draft creation requires an authenticated user id.");

  const requestId = readFlowRequestIdFromUrl() ?? createAndAttachFlowRequestId();
  const existing = readOwnerDraftCreationFlow(cleanUserId, requestId);
  if (existing) return existing.requestId;

  const flow: OwnerDraftCreationFlow = {
    requestId,
    listingId: null,
    createdAt: Date.now(),
  };
  writeOwnerDraftCreationFlow(cleanUserId, flow);
  return requestId;
}

export function rememberOwnerDraftCreationListing(
  userId: string,
  requestId: string,
  listingId: string,
): void {
  const cleanUserId = userId.trim();
  const cleanRequestId = requestId.trim();
  const cleanListingId = listingId.trim();
  if (!cleanUserId || !UUID_PATTERN.test(cleanRequestId) || !cleanListingId) return;

  const current = readOwnerDraftCreationFlow(cleanUserId, cleanRequestId);
  if (!current) return;
  writeOwnerDraftCreationFlow(cleanUserId, { ...current, listingId: cleanListingId });
}

export function readOwnerDraftCreationListing(userId: string, requestId: string): string | null {
  const cleanUserId = userId.trim();
  const cleanRequestId = requestId.trim();
  if (!cleanUserId || !UUID_PATTERN.test(cleanRequestId)) return null;
  return readOwnerDraftCreationFlow(cleanUserId, cleanRequestId)?.listingId ?? null;
}

export function completeOwnerDraftCreationFlow(userId: string | null, listingId: string): void {
  const cleanUserId = userId?.trim() ?? "";
  const cleanListingId = listingId.trim();
  const requestId = readFlowRequestIdFromUrl();
  if (!cleanUserId || !cleanListingId || !requestId) return;

  const current = readOwnerDraftCreationFlow(cleanUserId, requestId);
  if (!current || current.listingId !== cleanListingId) return;

  memoryFlows.delete(flowMemoryKey(cleanUserId, requestId));
  const storage = readFlowStorage();
  if (storage) {
    try {
      storage.removeItem(flowStorageKey(cleanUserId, requestId));
    } catch {
      // A completed server-side draft remains valid even if browser storage is unavailable.
    }
  }
  removeFlowRequestIdFromUrl(requestId);
}

function readOwnerDraftCreationFlow(
  userId: string,
  requestId: string,
): OwnerDraftCreationFlow | null {
  const memoryKey = flowMemoryKey(userId, requestId);
  const memory = memoryFlows.get(memoryKey);
  if (memory && isFreshFlow(memory)) return memory;
  if (memory) memoryFlows.delete(memoryKey);

  const storage = readFlowStorage();
  if (!storage) return null;
  try {
    const key = flowStorageKey(userId, requestId);
    const parsed: unknown = JSON.parse(storage.getItem(key) ?? "null");
    if (!isOwnerDraftCreationFlow(parsed) || !isFreshFlow(parsed)) {
      storage.removeItem(key);
      return null;
    }
    memoryFlows.set(memoryKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeOwnerDraftCreationFlow(userId: string, flow: OwnerDraftCreationFlow): void {
  memoryFlows.set(flowMemoryKey(userId, flow.requestId), flow);
  const storage = readFlowStorage();
  if (!storage) return;
  try {
    storage.setItem(flowStorageKey(userId, flow.requestId), JSON.stringify(flow));
  } catch {
    // In-memory idempotency remains available when session storage is blocked or full.
  }
}

function readFlowRequestIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = new URL(window.location.href).searchParams.get(FLOW_QUERY_PARAM)?.trim() ?? "";
    return UUID_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function createAndAttachFlowRequestId(): string {
  const requestId = createUuid();
  if (typeof window === "undefined") return requestId;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set(FLOW_QUERY_PARAM, requestId);
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // In-memory idempotency still protects this mounted page when URL replacement is unavailable.
  }
  return requestId;
}

function removeFlowRequestIdFromUrl(requestId: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(FLOW_QUERY_PARAM) !== requestId) return;
    url.searchParams.delete(FLOW_QUERY_PARAM);
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // The completed database flow does not depend on URL cleanup succeeding.
  }
}

function readFlowStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function flowMemoryKey(userId: string, requestId: string): string {
  return `${userId}:${requestId}`;
}

function flowStorageKey(userId: string, requestId: string): string {
  return `${FLOW_STORAGE_PREFIX}:${userId}:${requestId}`;
}

function isFreshFlow(flow: OwnerDraftCreationFlow): boolean {
  return Date.now() - flow.createdAt <= FLOW_MAX_AGE_MS;
}

function isOwnerDraftCreationFlow(value: unknown): value is OwnerDraftCreationFlow {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.requestId === "string" &&
    UUID_PATTERN.test(record.requestId) &&
    (typeof record.listingId === "string" || record.listingId === null) &&
    typeof record.createdAt === "number" &&
    Number.isFinite(record.createdAt) &&
    record.createdAt > 0
  );
}

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
