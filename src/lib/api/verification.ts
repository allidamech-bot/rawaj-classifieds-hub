import type {
  AdminSellerVerificationRequest,
  ClassifiedsErrorCode,
  ClassifiedsResult,
  CreateSellerVerificationRequestPayload,
  ModerateSellerVerificationRequestPayload,
  SellerVerificationRequest,
  VerificationDocumentType,
  VerificationRequestStatus,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest, cloudflareAuthorizedFetch } from "@/lib/cloudflare-auth";

/** Compatibility name only; verification documents are private R2 objects. */
export const verificationDocumentsBucket = "r2-private-verification-documents";
const verificationDocumentMaxBytes = 10 * 1024 * 1024;
const verificationRequestIds = new WeakMap<File, string>();
const verificationDocumentUrls = new Map<string, { url: string; expiresAt: number }>();
const documentObjectUrlTtlMs = 2 * 60_000;
const verificationDocumentExtensions: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

type ApiFailure = { ok: false; error: string; code: string };

export async function createMyVerificationRequest(
  payload: CreateSellerVerificationRequestPayload,
): Promise<ClassifiedsResult<SellerVerificationRequest>> {
  if (!(["personal", "business"] as const).includes(payload.requestType)) {
    return invalidVerificationInput("نوع طلب التوثيق غير مدعوم.");
  }
  const legalName = normalizePrivateName(payload.legalName);
  if (legalName.length < 3 || legalName.length > 120) {
    return invalidVerificationInput("اكتب الاسم القانوني بين 3 و120 حرفاً.");
  }
  const businessName = normalizePrivateName(payload.businessName) || null;
  if (
    payload.requestType === "business" &&
    (!businessName || businessName.length < 3 || businessName.length > 120)
  ) {
    return invalidVerificationInput("اكتب اسم المنشأة القانوني بين 3 و120 حرفاً.");
  }
  const fileValidation = validateVerificationDocumentFile(payload.documentFile);
  if (!fileValidation.ok) return fileValidation;
  if (!documentTypeMatchesRequest(payload.requestType, payload.documentType)) {
    return invalidVerificationInput("نوع المستند لا يطابق نوع طلب التوثيق.");
  }

  const requestId = verificationRequestIds.get(payload.documentFile) ?? crypto.randomUUID();
  verificationRequestIds.set(payload.documentFile, requestId);
  const form = new FormData();
  form.set("requestId", requestId);
  form.set("requestType", payload.requestType);
  form.set("legalName", legalName);
  form.set("businessName", payload.requestType === "business" ? (businessName ?? "") : "");
  form.set("documentType", payload.documentType);
  form.set("file", payload.documentFile, payload.documentFile.name);

  const result = await cloudflareApiRequest<Record<string, unknown>>("/v1/account/verifications", {
    method: "POST",
    body: form,
  });
  return result.ok
    ? { ok: true, data: mapOwnerVerificationRequest(result.data) }
    : apiFailure(result, "my_verification_create");
}

export const createSellerVerificationRequest = createMyVerificationRequest;

export async function fetchMyVerificationRequests(): Promise<
  ClassifiedsResult<SellerVerificationRequest[]>
> {
  const result = await cloudflareApiRequest<Record<string, unknown>[]>("/v1/account/verifications");
  return result.ok
    ? { ok: true, data: result.data.map(mapOwnerVerificationRequest) }
    : apiFailure(result, "my_verification_history");
}

export async function adminFetchVerificationRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<AdminSellerVerificationRequest[]>> {
  if (!canUseAdminAccess) return adminDenied();
  const result = await cloudflareApiRequest<Record<string, unknown>[]>("/v1/admin/verifications");
  return result.ok
    ? { ok: true, data: result.data.map(mapAdminVerificationRequest) }
    : apiFailure(result, "admin_verification_history");
}

export async function adminCreateVerificationDocumentSignedUrl(
  canManageVerifications: boolean,
  requestId: string,
): Promise<ClassifiedsResult<string | null>> {
  if (!canManageVerifications) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "عرض وثائق التوثيق متاح لحساب مخول فقط.",
      },
    };
  }
  const cleanRequestId = requestId.trim();
  if (!isUuid(cleanRequestId)) return invalidVerificationInput("تعذر تحديد طلب التوثيق.");
  if (typeof URL === "undefined") return { ok: true, data: null };

  const cached = verificationDocumentUrls.get(cleanRequestId);
  if (cached && cached.expiresAt > Date.now()) return { ok: true, data: cached.url };
  if (cached) {
    URL.revokeObjectURL(cached.url);
    verificationDocumentUrls.delete(cleanRequestId);
  }

  const response = await cloudflareAuthorizedFetch(
    `/v1/admin/verifications/${encodeURIComponent(cleanRequestId)}/document`,
  );
  if (!response) {
    return { ok: false, error: { code: "unknown", message: "تعذر الاتصال بخدمة التوثيق." } };
  }
  if (!response.ok) {
    return {
      ok: false,
      error: {
        code:
          response.status === 404
            ? "not_found"
            : response.status === 403
              ? "permission_denied"
              : "unknown",
        message: "تعذر فتح وثيقة التوثيق.",
      },
    };
  }
  const blob = await response.blob();
  if (!blob.size) return { ok: true, data: null };
  const url = URL.createObjectURL(blob);
  const expiresAt = Date.now() + documentObjectUrlTtlMs;
  verificationDocumentUrls.set(cleanRequestId, { url, expiresAt });
  setTimeout(() => {
    const current = verificationDocumentUrls.get(cleanRequestId);
    if (!current || current.url !== url || current.expiresAt > Date.now()) return;
    URL.revokeObjectURL(url);
    verificationDocumentUrls.delete(cleanRequestId);
  }, documentObjectUrlTtlMs + 1_000);
  return { ok: true, data: url };
}

export async function adminModerateVerificationRequest(
  canUseAdminAccess: boolean,
  payload: ModerateSellerVerificationRequestPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) return adminDenied();
  const requestId = payload.requestId.trim();
  const expectedUpdatedAt = payload.expectedUpdatedAt.trim();
  if (!isUuid(requestId) || !expectedUpdatedAt) {
    return invalidVerificationInput("تعذر تحديد طلب التوثيق أو نسخته الحالية.");
  }
  const result = await cloudflareApiRequest<{ success: boolean; updatedAt: string }>(
    `/v1/admin/verifications/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      body: {
        status: payload.status,
        adminNote: normalizePrivateName(payload.adminNote) || null,
        expectedUpdatedAt,
      },
    },
  );
  return result.ok ? { ok: true, data: null } : apiFailure(result, "admin_verification_moderate");
}

function validateVerificationDocumentFile(file: File): ClassifiedsResult<null> {
  const allowedExtensions = verificationDocumentExtensions[file.type];
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    return invalidVerificationInput("استخدم صورة JPG أو PNG أو WebP أو ملف PDF مطابقاً لامتداده.");
  }
  if (file.size <= 0 || file.size > verificationDocumentMaxBytes) {
    return invalidVerificationInput("يجب ألا يتجاوز ملف التوثيق 10 MB وألا يكون فارغاً.");
  }
  return { ok: true, data: null };
}

function documentTypeMatchesRequest(
  requestType: "personal" | "business",
  documentType: VerificationDocumentType,
): boolean {
  return requestType === "business"
    ? ["commercial_registration", "business_license", "tax_document"].includes(documentType)
    : ["national_id", "passport", "other_government_id"].includes(documentType);
}

function invalidVerificationInput<T = never>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}

function adminDenied<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "permission_denied",
      message: "مراجعة التوثيق متاحة لحساب إداري مخول فقط.",
    },
  };
}

function normalizePrivateName(value: string | null | undefined): string {
  return Array.from(value ?? "", (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127 ? " " : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function mapOwnerVerificationRequest(row: Record<string, unknown>): SellerVerificationRequest {
  return {
    id: rowString(row, "id"),
    status: rowString(row, "status", "pending_review") as VerificationRequestStatus,
    requestType: rowString(
      row,
      "request_type",
      "personal",
      "requestType",
    ) as SellerVerificationRequest["requestType"],
    legalName: rowString(row, "legal_name", "", "legalName"),
    businessName: rowNullableString(row, "business_name", "businessName"),
    documentType: rowNullableString(row, "document_type", "documentType"),
    reviewedAt: rowNullableString(row, "reviewed_at", "reviewedAt"),
    createdAt: rowString(row, "created_at", "", "createdAt"),
    updatedAt: rowString(row, "updated_at", "", "updatedAt"),
  };
}

function mapAdminVerificationRequest(row: Record<string, unknown>): AdminSellerVerificationRequest {
  return {
    ...mapOwnerVerificationRequest(row),
    userId: rowString(row, "user_id", "", "userId"),
    documentPath: rowNullableString(row, "document_asset_id", "documentPath"),
    adminNote: rowNullableString(row, "admin_note", "adminNote"),
    reviewedBy: rowNullableString(row, "reviewed_by", "reviewedBy"),
  };
}

function apiFailure<T>(result: ApiFailure, operation: string): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: normalizeApiCode(result.code),
      message: localizedMessage(result),
      operation,
    },
  };
}

function normalizeApiCode(code: string): ClassifiedsErrorCode {
  if (
    [
      "auth_required",
      "permission_denied",
      "not_found",
      "status_mismatch",
      "validation_error",
    ].includes(code)
  ) {
    return code as ClassifiedsErrorCode;
  }
  if (code === "invalid_transition") return "stale_review";
  return "unknown";
}

function localizedMessage(result: ApiFailure): string {
  if (result.code === "status_mismatch" && /already pending/i.test(result.error)) {
    return "لديك طلب توثيق قيد المراجعة بالفعل.";
  }
  if (result.code === "status_mismatch" && /already verified/i.test(result.error)) {
    return "الحساب موثّق بالفعل.";
  }
  if (result.code === "status_mismatch" || result.code === "invalid_transition") {
    return "تغيّر طلب التوثيق منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.";
  }
  return result.error || "تعذر إكمال عملية التوثيق.";
}

function rowValue(row: Record<string, unknown>, snake: string, camel?: string): unknown {
  return row[snake] ?? (camel ? row[camel] : undefined);
}

function rowString(
  row: Record<string, unknown>,
  key: string,
  fallback = "",
  camel?: string,
): string {
  const value = rowValue(row, key, camel);
  return typeof value === "string" ? value : fallback;
}

function rowNullableString(
  row: Record<string, unknown>,
  key: string,
  camel?: string,
): string | null {
  const value = rowValue(row, key, camel);
  return typeof value === "string" && value ? value : null;
}
