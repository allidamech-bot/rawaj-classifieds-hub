import type {
  ClassifiedsResult,
  CreateSupportRequestPayload,
  SupportRequest,
  SupportRequestStatus,
  SupportRequestType,
} from "@/lib/classifieds-types";
import { resolveAuthenticatedAccountId } from "@/lib/api/account-identity";
import { getClient, mapError, rowNullableString, rowString } from "@/lib/api/shared";

export async function createSupportRequest(
  userId: string | null,
  payload: CreateSupportRequestPayload,
): Promise<ClassifiedsResult<SupportRequest>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لإرسال طلب دعم." },
    };
  }

  const subject = payload.subject.trim();
  const message = payload.message.trim();

  if (subject.length < 4 || subject.length > 160) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل عنوانا بين 4 و160 حرفا." },
    };
  }

  if (message.length < 10 || message.length > 3000) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل رسالة بين 10 و3000 حرف." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("support_requests")
    .insert({
      user_id: userId,
      type: payload.type,
      subject,
      message,
      related_listing_id: payload.relatedListingId?.trim() || null,
      related_report_id: payload.relatedReportId?.trim() || null,
      status: "new",
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: mapSupportRequest(data as Record<string, unknown>) };
}

const ACCOUNT_DELETION_SUBJECT = "طلب حذف حساب رواج";

export async function createAccountDeletionRequest(): Promise<ClassifiedsResult<SupportRequest>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actor = await resolveAuthenticatedAccountId(
    clientResult.data,
    "account_deletion_request_auth",
  );
  if (!actor.ok) return actor;

  const rpcResult = await clientResult.data.rpc("rawaj_request_my_account_deletion");
  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    if (row && typeof row === "object") {
      return { ok: true, data: mapSupportRequest(row as Record<string, unknown>) };
    }
  } else if (!isMissingAccountDeletionRpc(rpcResult.error)) {
    return {
      ok: false,
      error: mapError(rpcResult.error, "account_deletion_request"),
    };
  }

  const { data: existing, error: existingError } = await clientResult.data
    .from("support_requests")
    .select(
      "id,user_id,type,status,subject,message,related_listing_id,related_report_id,admin_note,reviewed_by,reviewed_at,created_at,updated_at",
    )
    .eq("user_id", actor.data)
    .eq("subject", ACCOUNT_DELETION_SUBJECT)
    .in("status", ["new", "under_review"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: mapError(existingError, "account_deletion_request_lookup") };
  }
  if (existing) {
    return { ok: true, data: mapSupportRequest(existing as Record<string, unknown>) };
  }

  return createSupportRequest(actor.data, {
    type: "other",
    subject: ACCOUNT_DELETION_SUBJECT,
    message:
      "أطلب حذف حسابي وبياناته الشخصية من منصة رواج. أفهم أن الإدارة ستراجع الطلب وتتحقق من الالتزامات والعمليات المفتوحة قبل تنفيذ الحذف الآمن.",
  });
}

function isMissingAccountDeletionRpc(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    (error.message ?? "").includes("rawaj_request_my_account_deletion")
  );
}

export async function fetchMySupportRequests(
  userId: string | null,
): Promise<ClassifiedsResult<SupportRequest[]>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض طلبات الدعم." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("support_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: ((data ?? []) as Record<string, unknown>[]).map(mapSupportRequest) };
}

function mapSupportRequest(row: Record<string, unknown>): SupportRequest {
  return {
    id: rowString(row, "id"),
    userId: rowString(row, "user_id"),
    type: rowString(row, "type", "other") as SupportRequestType,
    status: rowString(row, "status", "new") as SupportRequestStatus,
    subject: rowString(row, "subject"),
    message: rowString(row, "message"),
    relatedListingId: rowNullableString(row, "related_listing_id"),
    relatedReportId: rowNullableString(row, "related_report_id"),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
