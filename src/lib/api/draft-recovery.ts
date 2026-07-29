import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export interface RecoverableDraft {
  listing: ClassifiedListing;
  lastSavedAt: string;
}

export async function fetchLatestRecoverableOwnerDraft(
  userId: string | null,
): Promise<ClassifiedsResult<RecoverableDraft | null>> {
  if (!userId) return failure("auth_required", "يجب تسجيل الدخول لاسترجاع المسودة.");
  const result = await cloudflareApiRequest<ClassifiedListing[]>("/v1/account/listings");
  if (!result.ok) return failure(result.code as ClassifiedsErrorCode, result.error);
  const draft = [...result.data]
    .filter((listing) => listing.status === "draft")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  return { ok: true, data: draft ? { listing: draft, lastSavedAt: draft.updatedAt } : null };
}

export async function discardRecoverableOwnerDraft(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<null>> {
  if (!userId) return failure("auth_required", "يجب تسجيل الدخول لحذف المسودة.");
  const cleanId = listingId.trim();
  if (!cleanId) return failure("validation_error", "تعذر تحديد المسودة المطلوبة.");
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanId)}`,
    { method: "DELETE", body: {} },
  );
  return result.ok
    ? { ok: true, data: null }
    : failure(result.code as ClassifiedsErrorCode, result.error);
}

function failure<T>(code: ClassifiedsErrorCode, message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code, message } };
}
