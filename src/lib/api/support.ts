import type {
  ClassifiedsResult,
  CreateSupportRequestPayload,
  SupportRequest,
  SupportRequestStatus,
  SupportRequestType,
} from "@/lib/classifieds-types";
import {
  accountSessionStillMatches,
  resolveAuthenticatedAccountId,
} from "@/lib/api/account-identity";
import { mapModerationError } from "@/lib/api/moderation-errors";
import { getClient, mapError, rowNullableString, rowString } from "@/lib/api/shared";
import {
  isSupportRequestType,
  normalizeModerationSubject,
  normalizeModerationText,
} from "@/lib/moderation-contract";

const ownerSupportRequestSelect =
  "id,user_id,type,status,subject,message,related_listing_id,related_report_id,public_response,created_at,updated_at";
const legacyOwnerSupportRequestSelect =
  "id,user_id,type,status,subject,message,related_listing_id,related_report_id,created_at,updated_at";

export async function createMySupportRequest(
  payload: CreateSupportRequestPayload,
): Promise<ClassifiedsResult<SupportRequest>> {
  const normalized = validateSupportPayload(payload);
  if (!normalized.ok) return normalized;

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const actor = await resolveAuthenticatedAccountId(client, "support_request_auth");
  if (!actor.ok) return actor;

  const rpcResult = await client.rpc("rawaj_create_my_support_request", {
    p_type: normalized.data.type,
    p_subject: normalized.data.subject,
    p_message: normalized.data.message,
    p_related_listing_id: normalized.data.relatedListingId,
    p_related_report_id: normalized.data.relatedReportId,
  });

  let row: Record<string, unknown> | null = null;
  if (!rpcResult.error) {
    const raw = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
    row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  } else if (isMissingSupportRpc(rpcResult.error)) {
    // Compatibility before the repository migration is manually applied. Actor
    // identity is still session-derived and legacy RLS remains authoritative.
    const fallback = await client
      .from("support_requests")
      .insert({
        user_id: actor.data,
        type: normalized.data.type,
        subject: normalized.data.subject,
        message: normalized.data.message,
        related_listing_id: normalized.data.relatedListingId,
        related_report_id: normalized.data.relatedReportId,
        status: "new",
      })
      .select(legacyOwnerSupportRequestSelect)
      .single();
    if (fallback.error) {
      return {
        ok: false,
        error: mapModerationError(
          fallback.error,
          "support_request_create_legacy",
          "تعذر إرسال طلب الدعم الآن.",
        ),
      };
    }
    row = fallback.data as Record<string, unknown>;
  } else {
    return {
      ok: false,
      error: mapModerationError(
        rpcResult.error,
        "support_request_create",
        "تعذر إرسال طلب الدعم الآن.",
      ),
    };
  }

  const current = await accountSessionStillMatches(client, actor.data, "support_request_stale");
  if (!current.ok) return current;
  if (!row) {
    return {
      ok: false,
      error: { code: "unknown", message: "تعذر تأكيد طلب الدعم المحفوظ." },
    };
  }
  return { ok: true, data: mapOwnerSupportRequest(row) };
}

/** Compatibility name with an actor-free signature. */
export const createSupportRequest = createMySupportRequest;

export async function fetchMySupportRequests(): Promise<ClassifiedsResult<SupportRequest[]>> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const actor = await resolveAuthenticatedAccountId(client, "support_history_auth");
  if (!actor.ok) return actor;

  const rpcResult = await client.rpc("rawaj_fetch_my_support_requests", { p_limit: 50 });
  let rows: Record<string, unknown>[];
  if (!rpcResult.error) {
    rows = (rpcResult.data ?? []) as Record<string, unknown>[];
  } else if (isMissingSupportRpc(rpcResult.error)) {
    const fallback = await client
      .from("support_requests")
      .select(legacyOwnerSupportRequestSelect)
      .eq("user_id", actor.data)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);
    if (fallback.error) return { ok: false, error: mapError(fallback.error, "support_history") };
    rows = (fallback.data ?? []) as Record<string, unknown>[];
  } else {
    return {
      ok: false,
      error: mapModerationError(rpcResult.error, "support_history", "تعذر تحميل طلبات الدعم."),
    };
  }

  const current = await accountSessionStillMatches(client, actor.data, "support_history_stale");
  if (!current.ok) return current;
  return { ok: true, data: rows.map(mapOwnerSupportRequest) };
}

export async function fetchMySupportRequest(
  requestId: string,
): Promise<ClassifiedsResult<SupportRequest | null>> {
  const cleanId = requestId.trim();
  if (!cleanId) return { ok: true, data: null };
  const list = await fetchMySupportRequests();
  if (!list.ok) return list;
  return { ok: true, data: list.data.find((request) => request.id === cleanId) ?? null };
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
      const current = await accountSessionStillMatches(
        clientResult.data,
        actor.data,
        "account_deletion_request_stale",
      );
      if (!current.ok) return current;
      return { ok: true, data: mapOwnerSupportRequest(row as Record<string, unknown>) };
    }
  } else if (!isMissingAccountDeletionRpc(rpcResult.error)) {
    return {
      ok: false,
      error: mapModerationError(
        rpcResult.error,
        "account_deletion_request",
        "تعذر إرسال طلب حذف الحساب.",
      ),
    };
  }

  return createMySupportRequest({
    type: "other",
    subject: ACCOUNT_DELETION_SUBJECT,
    message:
      "أطلب حذف حسابي وبياناته الشخصية من منصة رواج. أفهم أن الإدارة ستراجع الطلب والالتزامات المفتوحة قبل تنفيذ الحذف الآمن.",
  });
}

function validateSupportPayload(payload: CreateSupportRequestPayload): ClassifiedsResult<
  Required<Pick<CreateSupportRequestPayload, "type" | "subject" | "message">> & {
    relatedListingId: string | null;
    relatedReportId: string | null;
  }
> {
  const subject = normalizeModerationSubject(payload.subject, 160);
  const message = normalizeModerationText(payload.message, 3000);
  if (!isSupportRequestType(payload.type)) {
    return { ok: false, error: { code: "validation_error", message: "اختر نوع طلب صالحًا." } };
  }
  if (subject.length < 4 || message.length < 10) {
    return {
      ok: false,
      error: { code: "validation_error", message: "أدخل عنوانًا ورسالة واضحة لطلب الدعم." },
    };
  }
  return {
    ok: true,
    data: {
      type: payload.type,
      subject,
      message,
      relatedListingId: payload.relatedListingId?.trim() || null,
      relatedReportId: payload.relatedReportId?.trim() || null,
    },
  };
}

function isMissingSupportRpc(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" || error.code === "42883" || (error.message ?? "").includes("rawaj_")
  );
}

function isMissingAccountDeletionRpc(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    (error.message ?? "").includes("rawaj_request_my_account_deletion")
  );
}

function mapOwnerSupportRequest(row: Record<string, unknown>): SupportRequest {
  return {
    id: rowString(row, "id"),
    userId: rowString(row, "user_id"),
    type: rowString(row, "type", "other") as SupportRequestType,
    status: rowString(row, "status", "new") as SupportRequestStatus,
    subject: rowString(row, "subject"),
    message: rowString(row, "message"),
    relatedListingId: rowNullableString(row, "related_listing_id"),
    relatedReportId: rowNullableString(row, "related_report_id"),
    publicResponse: rowNullableString(row, "public_response"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}
