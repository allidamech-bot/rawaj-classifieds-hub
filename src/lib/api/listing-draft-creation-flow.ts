const FLOW_STORAGE_PREFIX = "rawaj:listing-draft-creation-flow:v1";
const FLOW_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface OwnerDraftCreationFlow {
  requestId: string;
  listingId: string | null;
  createdAt: number;
}

const memoryFlows = new Map<string, OwnerDraftCreationFlow>();

export function readOrCreateOwnerDraftCreationRequestId(userId: string): string {
  const cleanUserId = userId.trim();
  if (!cleanUserId) throw new Error("Draft creation requires an authenticated user id.");

  const existing = readOwnerDraftCreationFlow(cleanUserId);
  if (existing) return existing.requestId;

  const flow: OwnerDraftCreationFlow = {
    requestId: createUuid(),
    listingId: null,
    createdAt: Date.now(),
  };
  writeOwnerDraftCreationFlow(cleanUserId, flow);
  return flow.requestId;
}

export function rememberOwnerDraftCreationListing(
  userId: string,
  requestId: string,
  listingId: string,
): void {
  const cleanUserId = userId.trim();
  const cleanRequestId = requestId.trim();
  const cleanListingId = listingId.trim();
  if (!cleanUserId || !cleanRequestId || !cleanListingId) return;

  const current = readOwnerDraftCreationFlow(cleanUserId);
  if (!current || current.requestId !== cleanRequestId) return;
  writeOwnerDraftCreationFlow(cleanUserId, { ...current, listingId: cleanListingId });
}

export function completeOwnerDraftCreationFlow(userId: string | null, listingId: string): void {
  const cleanUserId = userId?.trim() ?? "";
  const cleanListingId = listingId.trim();
  if (!cleanUserId || !cleanListingId) return;

  const current = readOwnerDraftCreationFlow(cleanUserId);
  if (!current || current.listingId !== cleanListingId) return;

  memoryFlows.delete(cleanUserId);
  const storage = readFlowStorage();
  if (!storage) return;
  try {
    storage.removeItem(flowStorageKey(cleanUserId));
  } catch {
    // A completed server-side draft remains valid even if browser storage is unavailable.
  }
}

function readOwnerDraftCreationFlow(userId: string): OwnerDraftCreationFlow | null {
  const memory = memoryFlows.get(userId);
  if (memory && isFreshFlow(memory)) return memory;
  if (memory) memoryFlows.delete(userId);

  const storage = readFlowStorage();
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(flowStorageKey(userId)) ?? "null");
    if (!isOwnerDraftCreationFlow(parsed) || !isFreshFlow(parsed)) {
      storage.removeItem(flowStorageKey(userId));
      return null;
    }
    memoryFlows.set(userId, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeOwnerDraftCreationFlow(userId: string, flow: OwnerDraftCreationFlow): void {
  memoryFlows.set(userId, flow);
  const storage = readFlowStorage();
  if (!storage) return;
  try {
    storage.setItem(flowStorageKey(userId), JSON.stringify(flow));
  } catch {
    // In-memory idempotency remains available when session storage is blocked or full.
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

function flowStorageKey(userId: string): string {
  return `${FLOW_STORAGE_PREFIX}:${userId}`;
}

function isFreshFlow(flow: OwnerDraftCreationFlow): boolean {
  return Date.now() - flow.createdAt <= FLOW_MAX_AGE_MS;
}

function isOwnerDraftCreationFlow(value: unknown): value is OwnerDraftCreationFlow {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.requestId === "string" &&
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
