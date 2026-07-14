import type {
  ClassifiedListing,
  ClassifiedsError,
  ClassifiedsResult,
} from "@/lib/classifieds-types";

export class PublicListingDetailLoadError extends Error {
  readonly code: ClassifiedsError["code"];
  readonly operation?: string;

  constructor(error: ClassifiedsError) {
    super(error.message);
    this.name = "PublicListingDetailLoadError";
    this.code = error.code;
    this.operation = error.operation;
  }
}

export function isUnavailableListingDetailError(error: ClassifiedsError) {
  return error.code === "not_found" || error.code === "validation_error";
}

export function guardPublicListingDetailResult(
  result: ClassifiedsResult<ClassifiedListing>,
): ClassifiedsResult<ClassifiedListing> {
  if (result.ok || isUnavailableListingDetailError(result.error)) return result;
  throw new PublicListingDetailLoadError(result.error);
}
