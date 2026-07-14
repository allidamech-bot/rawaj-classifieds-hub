import type { ClassifiedsError, ClassifiedsResult } from "@/lib/classifieds-types";

export class PublicMarketplaceLandingLoadError extends Error {
  readonly code: ClassifiedsError["code"];
  readonly operation: string;

  constructor(error: ClassifiedsError, fallbackOperation: string) {
    super(error.message);
    this.name = "PublicMarketplaceLandingLoadError";
    this.code = error.code;
    this.operation = error.operation ?? fallbackOperation;
  }
}

export function requirePublicMarketplaceLandingData<T>(
  result: ClassifiedsResult<T>,
  fallbackOperation: string,
): T {
  if (result.ok) return result.data;
  throw new PublicMarketplaceLandingLoadError(result.error, fallbackOperation);
}
