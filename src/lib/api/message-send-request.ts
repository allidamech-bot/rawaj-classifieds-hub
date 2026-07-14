const MESSAGE_SEND_STORAGE_PREFIX = "rawaj:message-send-request:v1";
const MESSAGE_SEND_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MessageSendAttempt {
  requestId: string;
  body: string;
  createdAt: number;
}

const memoryAttempts = new Map<string, MessageSendAttempt>();

export function readOrCreateMessageSendRequestId(
  userId: string,
  conversationId: string,
  body: string,
): string {
  const cleanUserId = userId.trim();
  const cleanConversationId = conversationId.trim();
  const cleanBody = body.trim();
  if (!cleanUserId || !cleanConversationId || !cleanBody) {
    throw new Error("Message send requests require a user, conversation, and body.");
  }

  const key = attemptKey(cleanUserId, cleanConversationId);
  const existing = readAttempt(key);
  if (existing && existing.body === cleanBody) return existing.requestId;

  const attempt: MessageSendAttempt = {
    requestId: createUuid(),
    body: cleanBody,
    createdAt: Date.now(),
  };
  writeAttempt(key, attempt);
  return attempt.requestId;
}

export function completeMessageSendRequest(
  userId: string,
  conversationId: string,
  requestId: string,
): void {
  const key = attemptKey(userId.trim(), conversationId.trim());
  const cleanRequestId = requestId.trim();
  if (!key || !UUID_PATTERN.test(cleanRequestId)) return;

  const current = readAttempt(key);
  if (!current || current.requestId !== cleanRequestId) return;

  memoryAttempts.delete(key);
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(key));
  } catch {
    // The database result is authoritative even when browser cleanup fails.
  }
}

function readAttempt(key: string): MessageSendAttempt | null {
  const memory = memoryAttempts.get(key);
  if (memory && isFreshAttempt(memory)) return memory;
  if (memory) memoryAttempts.delete(key);

  const storage = readStorage();
  if (!storage) return null;
  try {
    const parsed: unknown = JSON.parse(storage.getItem(storageKey(key)) ?? "null");
    if (!isMessageSendAttempt(parsed) || !isFreshAttempt(parsed)) {
      storage.removeItem(storageKey(key));
      return null;
    }
    memoryAttempts.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeAttempt(key: string, attempt: MessageSendAttempt): void {
  memoryAttempts.set(key, attempt);
  const storage = readStorage();
  if (!storage) return;
  try {
    storage.setItem(storageKey(key), JSON.stringify(attempt));
  } catch {
    // In-memory retry safety remains available when storage is blocked.
  }
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function attemptKey(userId: string, conversationId: string): string {
  if (!userId || !conversationId) return "";
  return `${userId}:${conversationId}`;
}

function storageKey(key: string): string {
  return `${MESSAGE_SEND_STORAGE_PREFIX}:${key}`;
}

function isFreshAttempt(attempt: MessageSendAttempt): boolean {
  return Date.now() - attempt.createdAt <= MESSAGE_SEND_MAX_AGE_MS;
}

function isMessageSendAttempt(value: unknown): value is MessageSendAttempt {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.requestId === "string" &&
    UUID_PATTERN.test(record.requestId) &&
    typeof record.body === "string" &&
    record.body.trim().length > 0 &&
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
