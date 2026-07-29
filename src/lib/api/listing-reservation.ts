import { fetchOwnerListingDetail } from "@/lib/api/listings";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type {
  ClassifiedListing,
  ClassifiedsErrorCode,
  ClassifiedsResult,
} from "@/lib/classifieds-types";

export async function setOwnerListingReserved(
  userId: string | null,
  listingId: string,
  reserved: boolean,
): Promise<ClassifiedsResult<ClassifiedListing>> {
  if (!userId) return failure("auth_required", "يجب تسجيل الدخول لإدارة حجز الإعلان.");
  const cleanId = listingId.trim();
  if (!cleanId) return failure("validation_error", "تعذر تحديد الإعلان.");
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/listings/${encodeURIComponent(cleanId)}/lifecycle`,
    { method: "PATCH", body: { action: reserved ? "reserve" : "unreserve" } },
  );
  if (!result.ok) return failure(result.code as ClassifiedsErrorCode, result.error);
  return fetchOwnerListingDetail(userId, cleanId);
}

function failure<T>(code: ClassifiedsErrorCode, message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code, message } };
}
