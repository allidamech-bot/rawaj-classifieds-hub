import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateSupportRequestPayload,
  SupportRequest,
  SupportRequestType,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import {
  isSupportRequestType,
  normalizeModerationSubject,
  normalizeModerationText,
} from "@/lib/moderation-contract";

export async function createMySupportRequest(
  payload: CreateSupportRequestPayload,
): Promise<ClassifiedsResult<SupportRequest>> {
  const normalized = validateSupportPayload(payload);
  if (!normalized.ok) return normalized;
  const result = await cloudflareApiRequest<SupportRequest>("/v1/account/support-requests", {
    method: "POST",
    body: normalized.data,
  });
  return fromApi(result);
}

export const createSupportRequest = createMySupportRequest;

export async function fetchMySupportRequests(): Promise<ClassifiedsResult<SupportRequest[]>> {
  return fromApi(await cloudflareApiRequest<SupportRequest[]>("/v1/account/support-requests?limit=50"));
}

export async function fetchMySupportRequest(
  requestId: string,
): Promise<ClassifiedsResult<SupportRequest | null>> {
  const cleanId = requestId.trim();
  if (!cleanId) return { ok: true, data: null };
  const result = await cloudflareApiRequest<SupportRequest>(
    `/v1/account/support-requests/${encodeURIComponent(cleanId)}`,
  );
  if (!result.ok && result.code === "not_found") return { ok: true, data: null };
  return fromApi(result);
}

const ACCOUNT_DELETION_SUBJECT = "طلب حذف حساب رواج";

export function createAccountDeletionRequest(): Promise<ClassifiedsResult<SupportRequest>> {
  return createMySupportRequest({
    type: "other",
    subject: ACCOUNT_DELETION_SUBJECT,
    message:
      "أطلب حذف حسابي وبياناته الشخصية من منصة رواج. أفهم أن الإدارة ستراجع الطلب والالتزامات المفتوحة قبل تنفيذ الحذف الآمن.",
  });
}

function validateSupportPayload(payload: CreateSupportRequestPayload): ClassifiedsResult<{
  type: SupportRequestType;
  subject: string;
  message: string;
  relatedListingId: string | null;
  relatedReportId: string | null;
}> {
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

function fromApi<T>(
  result:
    | { ok: true; data: T }
    | { ok: false; error: string; code: string },
): ClassifiedsResult<T> {
  return result.ok
    ? { ok: true, data: result.data }
    : {
        ok: false,
        error: { code: result.code as ClassifiedsErrorCode, message: result.error },
      };
}
