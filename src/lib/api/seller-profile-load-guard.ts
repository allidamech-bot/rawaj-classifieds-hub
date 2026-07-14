import type {
  ClassifiedsError,
  ClassifiedsResult,
  PublicSellerProfile,
} from "@/lib/classifieds-types";

export class PublicSellerProfileLoadError extends Error {
  readonly code: ClassifiedsError["code"];
  readonly operation?: string;

  constructor(error: ClassifiedsError) {
    super(error.message);
    this.name = "PublicSellerProfileLoadError";
    this.code = error.code;
    this.operation = error.operation;
  }
}

export function isUnavailableSellerProfileError(error: ClassifiedsError) {
  return error.code === "not_found" || error.code === "validation_error";
}

export function guardPublicSellerProfileResult(
  result: ClassifiedsResult<PublicSellerProfile>,
): ClassifiedsResult<PublicSellerProfile> {
  if (result.ok || isUnavailableSellerProfileError(result.error)) return result;
  throw new PublicSellerProfileLoadError(result.error);
}
