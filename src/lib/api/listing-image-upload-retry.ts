const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 300;

interface ListingImageUploadRetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  wait?: (delayMs: number) => Promise<void>;
}

export function isRetryableListingImageUploadError(error: unknown): boolean {
  const status = readStorageStatus(error);
  if (status === 408 || status === 425 || status === 429 || (status !== null && status >= 500)) {
    return true;
  }

  const message = readStorageMessage(error).toLowerCase();
  return [
    "network",
    "failed to fetch",
    "fetch failed",
    "timeout",
    "timed out",
    "temporarily unavailable",
    "rate limit",
    "too many requests",
    "connection reset",
    "econnreset",
  ].some((token) => message.includes(token));
}

export async function uploadListingImageObjectWithRetry<T extends { error: unknown | null }>(
  operation: () => Promise<T>,
  options: ListingImageUploadRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS, 5));
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  const wait = options.wait ?? waitForDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await operation();
      if (
        !result.error ||
        attempt === maxAttempts ||
        !isRetryableListingImageUploadError(result.error)
      ) {
        return result;
      }
    } catch (error: unknown) {
      if (attempt === maxAttempts || !isRetryableListingImageUploadError(error)) {
        throw error;
      }
    }

    await wait(baseDelayMs * 2 ** (attempt - 1));
  }

  throw new Error("Listing image upload retry loop ended unexpectedly.");
}

function readStorageStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  for (const key of ["statusCode", "status"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  }
  return null;
}

function readStorageMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "";
  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : "";
}

function waitForDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, delayMs));
}
