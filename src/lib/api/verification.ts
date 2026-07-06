import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ClassifiedsResult,
  CreateSellerVerificationRequestPayload,
  ModerateSellerVerificationRequestPayload,
  SellerVerificationRequest,
  VerificationRequestStatus,
} from "@/lib/classifieds-types";
import { getClient, mapError, rowNullableString, rowString } from "@/lib/api/shared";

export async function createSellerVerificationRequest(
  payload: CreateSellerVerificationRequestPayload,
): Promise<ClassifiedsResult<SellerVerificationRequest>> {
  if (!payload.userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لطلب التوثيق." },
    };
  }

  const legalName = payload.legalName.trim();
  if (legalName.length < 3 || legalName.length > 120) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب الاسم القانوني بين 3 و120 حرفاً." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .insert({
      user_id: payload.userId,
      request_type: payload.requestType,
      legal_name: legalName,
      business_name: payload.businessName?.trim() || null,
      document_type: payload.documentType?.trim() || null,
      status: "pending_review",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapVerificationRequest(data as Record<string, unknown>) };
}

export async function fetchMyVerificationRequests(
  userId: string | null,
): Promise<ClassifiedsResult<SellerVerificationRequest[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض طلبات التوثيق." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapVerificationRequest),
  };
}

export async function adminFetchVerificationRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<SellerVerificationRequest[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التوثيق متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return { ok: false, error: mapError(error) };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapVerificationRequest),
  };
}

export async function adminModerateVerificationRequest(
  canUseAdminAccess: boolean,
  payload: ModerateSellerVerificationRequestPayload,
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التوثيق متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.requestId.trim()) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد طلب التوثيق." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from("seller_verification_requests")
    .update({
      status: payload.status,
      admin_note: payload.adminNote?.trim() || null,
    })
    .eq("id", payload.requestId);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

function mapVerificationRequest(row: Record<string, unknown>): SellerVerificationRequest {
  return {
    id: rowString(row, "id"),
    userId: rowString(row, "user_id"),
    status: rowString(row, "status", "pending_review") as VerificationRequestStatus,
    requestType: rowString(
      row,
      "request_type",
      "personal",
    ) as SellerVerificationRequest["requestType"],
    legalName: rowString(row, "legal_name"),
    businessName: rowNullableString(row, "business_name"),
    documentType: rowNullableString(row, "document_type"),
    documentPath: rowNullableString(row, "document_path"),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
