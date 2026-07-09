import type {
  ClassifiedsResult,
  CreateListingPromotionRequestPayload,
  ListingPromotionRequest,
  ModerateListingPromotionRequestPayload,
  PromotionReceiptUploadPayload,
  PromotionRequestStatus,
  PromotionType,
} from "@/lib/classifieds-types";
import {
  getClient,
  mapError,
  mapStorageError,
  rowNullableString,
  rowNumber,
  rowRecord,
  rowString,
} from "@/lib/api/shared";

import {
  buildPromotionReceiptPath,
  promotionReceiptsBucket,
  validateReceiptFile,
} from "@/lib/api/storage";

const signedImageUrlExpiresInSeconds = 900;

export async function createListingPromotionRequest(
  payload: CreateListingPromotionRequestPayload,
): Promise<ClassifiedsResult<ListingPromotionRequest>> {
  if (!payload.requesterUserId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لطلب الترويج." },
    };
  }

  if (
    !payload.listingId.trim() ||
    payload.requestedDays < 1 ||
    payload.requestedDays > 90
  ) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "اختر إعلاناً معتمداً ومدة بين 1 و90 يوماً.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_promotion_requests")
    .insert({
      listing_id: payload.listingId,
      requester_user_id: payload.requesterUserId,
      promotion_type: payload.promotionType,
      requested_days: payload.requestedDays,
      payment_method: payload.paymentMethod?.trim() || null,
      payment_reference: payload.paymentReference?.trim() || null,
      proof_path: payload.proofPath?.trim() || null,
      status: "pending_review",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapPromotionRequest(data as Record<string, unknown>) };
}

export async function uploadPromotionReceipt({
  userId,
  requestId,
  file,
}: PromotionReceiptUploadPayload): Promise<ClassifiedsResult<string>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لرفع إيصال الترويج." },
    };
  }

  if (!requestId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد طلب الترويج." },
    };
  }

  const validation = validateReceiptFile(file);
  if (!validation.ok) {
    return { ok: false, error: { code: "validation_error", message: validation.error! } };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data: request, error: requestError } = await clientResult.data
    .from("listing_promotion_requests")
    .select("id, requester_user_id, status")
    .eq("id", requestId)
    .eq("requester_user_id", userId)
    .eq("status", "pending_review")
    .maybeSingle();

  if (requestError) return { ok: false, error: mapError(requestError) };
  if (!request) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "يمكن رفع الإيصال فقط لطلب ترويج قيد المراجعة تملكه.",
      },
    };
  }

  const storagePath = buildPromotionReceiptPath(userId, requestId, file.name);

  const uploadResult = await clientResult.data.storage
    .from(promotionReceiptsBucket)
    .upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const attachResult = await clientResult.data.rpc("rawaj_attach_promotion_receipt", {
    request_id: requestId,
    receipt_path: storagePath,
  });

  if (attachResult.error) {
    await clientResult.data.storage.from(promotionReceiptsBucket).remove([storagePath]);
    return { ok: false, error: mapError(attachResult.error) };
  }

  return { ok: true, data: storagePath };
}

export async function createPromotionReceiptSignedUrl(
  proofPath: string | null,
): Promise<ClassifiedsResult<string | null>> {
  if (!proofPath?.trim()) return { ok: true, data: null };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.storage
    .from(promotionReceiptsBucket)
    .createSignedUrl(proofPath, signedImageUrlExpiresInSeconds);

  if (error) return { ok: false, error: mapStorageError(error) };
  return { ok: true, data: data.signedUrl };
}

export async function fetchMyPromotionRequests(
  userId: string | null,
): Promise<ClassifiedsResult<ListingPromotionRequest[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض طلبات الترويج." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_promotion_requests")
    .select("*, listings(title)")
    .eq("requester_user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  const promotionRequests = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapPromotionRequest({
      ...row,
      listing_title: rowRecord(row, "listings").title,
    }),
  );
  return { ok: true, data: promotionRequests };
}

export async function adminFetchPromotionRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<ListingPromotionRequest[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة الترويج متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("listing_promotion_requests")
    .select("*, listings(title)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  const promotionRequests = ((data ?? []) as Record<string, unknown>[]).map((row) =>
    mapPromotionRequest({
      ...row,
      listing_title: rowRecord(row, "listings").title,
    }),
  );
  return { ok: true, data: promotionRequests };
}

export async function adminModeratePromotionRequest(
  canUseAdminAccess: boolean,
  payload: ModerateListingPromotionRequestPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "مراجعة الترويج متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  if (!payload.requestId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "تعذر تحديد طلب الترويج أو نسخته الحالية.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_promotion_request", {
    p_request_id: payload.requestId,
    p_status: payload.status,
    p_admin_note: payload.adminNote?.trim() || null,
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    if (error.message?.includes("stale_promotion_request")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر طلب الترويج منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  return { ok: true, data: null };
}

function mapPromotionRequest(row: Record<string, unknown>): ListingPromotionRequest {
  return {
    id: rowString(row, "id"),
    listingId: rowString(row, "listing_id"),
    requesterUserId: rowString(row, "requester_user_id"),
    promotionType: rowString(row, "promotion_type", "featured_home") as PromotionType,
    status: rowString(row, "status", "pending_review") as PromotionRequestStatus,
    requestedDays: rowNumber(row, "requested_days", 7),
    startsAt: rowNullableString(row, "starts_at"),
    endsAt: rowNullableString(row, "ends_at"),
    paymentMethod: rowNullableString(row, "payment_method"),
    paymentReference: rowNullableString(row, "payment_reference"),
    proofPath: rowNullableString(row, "proof_path"),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
    listingTitle: rowNullableString(row, "listing_title"),
  };
}
