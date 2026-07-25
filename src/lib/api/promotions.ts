import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateListingPromotionRequestPayload,
  ListingPromotionRequest,
  ModerateListingPromotionRequestPayload,
  PromotionReceiptUploadPayload,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest, cloudflareAuthorizedFetch } from "@/lib/cloudflare-auth";
import { validateReceiptFile } from "@/lib/api/storage";

export async function createListingPromotionRequest(
  payload: CreateListingPromotionRequestPayload,
): Promise<ClassifiedsResult<ListingPromotionRequest>> {
  if (!payload.requesterUserId) return failure("auth_required", "يجب تسجيل الدخول لطلب الترويج.");
  const listingId = payload.listingId.trim();
  if (!listingId || payload.requestedDays < 1 || payload.requestedDays > 90) {
    return failure("validation_error", "اختر إعلاناً معتمداً ومدة بين 1 و90 يوماً.");
  }
  const result = await cloudflareApiRequest<ListingPromotionRequest>("/v1/account/promotions", {
    method: "POST",
    body: {
      clientRequestId: crypto.randomUUID(),
      listingId,
      promotionType: payload.promotionType,
      requestedDays: payload.requestedDays,
      paymentMethod: payload.paymentMethod?.trim() || null,
      paymentReference: payload.paymentReference?.trim() || null,
    },
  });
  return result.ok ? { ok: true, data: result.data } : failure(result.code as ClassifiedsErrorCode, result.error);
}

export async function uploadPromotionReceipt({
  userId,
  requestId,
  file,
}: PromotionReceiptUploadPayload): Promise<ClassifiedsResult<string>> {
  if (!userId) return failure("auth_required", "يجب تسجيل الدخول لرفع إيصال الترويج.");
  const cleanId = requestId.trim();
  if (!cleanId) return failure("validation_error", "تعذر تحديد طلب الترويج.");
  const validation = validateReceiptFile(file);
  if (!validation.ok) {
    return failure("validation_error", validation.error ?? "تعذر التحقق من ملف الإيصال.");
  }
  const form = new FormData();
  form.set("file", file);
  const result = await cloudflareApiRequest<{ proofPath: string }>(
    `/v1/account/promotions/${encodeURIComponent(cleanId)}/receipt`,
    { method: "POST", body: form },
  );
  return result.ok
    ? { ok: true, data: result.data.proofPath }
    : failure(result.code as ClassifiedsErrorCode, result.error);
}

export async function createPromotionReceiptSignedUrl(
  proofPath: string | null,
): Promise<ClassifiedsResult<string | null>> {
  const assetId = proofPath?.trim();
  if (!assetId) return { ok: true, data: null };
  const response = await cloudflareAuthorizedFetch(
    `/v1/admin/promotion-receipts/${encodeURIComponent(assetId)}`,
  );
  if (!response) return failure("unknown", "تعذر الاتصال بخدمة إيصالات الترويج.");
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: { code?: ClassifiedsErrorCode; message?: string } }
      | null;
    return failure(payload?.error?.code ?? "unknown", payload?.error?.message ?? "تعذر فتح الإيصال.");
  }
  const blob = await response.blob();
  return { ok: true, data: URL.createObjectURL(blob) };
}

export async function fetchMyPromotionRequests(
  userId: string | null,
): Promise<ClassifiedsResult<ListingPromotionRequest[]>> {
  if (!userId) return failure("auth_required", "يجب تسجيل الدخول لعرض طلبات الترويج.");
  const result = await cloudflareApiRequest<ListingPromotionRequest[]>("/v1/account/promotions");
  return result.ok ? { ok: true, data: result.data } : failure(result.code as ClassifiedsErrorCode, result.error);
}

export async function adminFetchPromotionRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<ListingPromotionRequest[]>> {
  if (!canUseAdminAccess) return failure("permission_denied", "مراجعة الترويج متاحة لحساب إداري مخول فقط.");
  const result = await cloudflareApiRequest<ListingPromotionRequest[]>("/v1/admin/promotions");
  return result.ok ? { ok: true, data: result.data } : failure(result.code as ClassifiedsErrorCode, result.error);
}

export async function adminModeratePromotionRequest(
  canUseAdminAccess: boolean,
  payload: ModerateListingPromotionRequestPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) return failure("permission_denied", "مراجعة الترويج متاحة لحساب إداري مخول فقط.");
  const requestId = payload.requestId.trim();
  if (!requestId || !payload.expectedUpdatedAt) {
    return failure("validation_error", "تعذر تحديد طلب الترويج أو نسخته الحالية.");
  }
  const result = await cloudflareApiRequest<{ success: boolean }>(
    `/v1/admin/promotions/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      body: {
        status: payload.status,
        adminNote: payload.adminNote?.trim() || null,
        expectedUpdatedAt: payload.expectedUpdatedAt,
      },
    },
  );
  return result.ok ? { ok: true, data: null } : failure(result.code as ClassifiedsErrorCode, result.error);
}

function failure<T>(code: ClassifiedsErrorCode, message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code, message } };
}
