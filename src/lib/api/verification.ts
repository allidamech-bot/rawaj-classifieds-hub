import type {
  ClassifiedsResult,
  CreateSellerVerificationRequestPayload,
  ModerateSellerVerificationRequestPayload,
  SellerVerificationRequest,
  VerificationDocumentType,
  VerificationRequestStatus,
} from "@/lib/classifieds-types";
import {
  getClient,
  mapError,
  mapStorageError,
  rowNullableString,
  rowString,
} from "@/lib/api/shared";

export const verificationDocumentsBucket = "verification-documents";
const verificationDocumentMaxBytes = 10 * 1024 * 1024;
const verificationDocumentSignedUrlSeconds = 300;
const verificationDocumentExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

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

  const businessName = payload.businessName?.trim() || null;
  if (payload.requestType === "business" && (!businessName || businessName.length < 3)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اكتب اسم المنشأة القانوني." },
    };
  }

  const fileValidation = validateVerificationDocumentFile(payload.documentFile);
  if (!fileValidation.ok) return fileValidation;

  if (!documentTypeMatchesRequest(payload.requestType, payload.documentType)) {
    return {
      ok: false,
      error: { code: "validation_error", message: "نوع المستند لا يطابق نوع طلب التوثيق." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const requestId = crypto.randomUUID();
  const storagePath = buildVerificationDocumentPath(
    payload.userId,
    requestId,
    payload.documentFile,
  );
  const uploadResult = await clientResult.data.storage
    .from(verificationDocumentsBucket)
    .upload(storagePath, payload.documentFile, {
      cacheControl: "3600",
      contentType: payload.documentFile.type,
      upsert: false,
    });

  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const { data, error } = await clientResult.data.rpc("rawaj_create_verification_request_v2", {
    p_request_id: requestId,
    p_request_type: payload.requestType,
    p_legal_name: legalName,
    p_business_name: businessName,
    p_document_type: payload.documentType,
    p_document_path: storagePath,
  });

  if (error) {
    const cleanupResult = await clientResult.data.storage
      .from(verificationDocumentsBucket)
      .remove([storagePath]);
    if (cleanupResult.error) {
      console.error("Failed to clean up unattached verification document", cleanupResult.error);
    }
    return { ok: false, error: mapVerificationCreationError(error) };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "تم إرسال طلب التوثيق دون نتيجة قابلة للتحقق.",
      },
    };
  }

  return { ok: true, data: mapVerificationRequest(row as Record<string, unknown>) };
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

export async function adminCreateVerificationDocumentSignedUrl(
  canManageVerifications: boolean,
  documentPath: string | null,
): Promise<ClassifiedsResult<string | null>> {
  if (!canManageVerifications) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "عرض وثائق التوثيق متاح لحساب مخول فقط." },
    };
  }

  const normalizedPath = documentPath?.trim() || "";
  if (!normalizedPath) return { ok: true, data: null };

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.storage
    .from(verificationDocumentsBucket)
    .createSignedUrl(normalizedPath, verificationDocumentSignedUrlSeconds);

  if (error) return { ok: false, error: mapStorageError(error) };
  return { ok: true, data: data.signedUrl };
}

export async function adminModerateVerificationRequest(
  canUseAdminAccess: boolean,
  payload: ModerateSellerVerificationRequestPayload & { expectedUpdatedAt: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التوثيق متاحة لحساب إداري مخول فقط." },
    };
  }

  if (!payload.requestId.trim() || !payload.expectedUpdatedAt) {
    return {
      ok: false,
      error: { code: "validation_error", message: "تعذر تحديد طلب التوثيق أو نسخته الحالية." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_verification_request", {
    p_request_id: payload.requestId,
    p_status: payload.status,
    p_admin_note: payload.adminNote?.trim() || null,
    p_expected_updated_at: payload.expectedUpdatedAt,
  });

  if (error) {
    if (error.message?.includes("stale_verification_request")) {
      return {
        ok: false,
        error: {
          code: "stale_review",
          message: "تغيّر طلب التوثيق منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.",
        },
      };
    }
    return { ok: false, error: mapError(error) };
  }

  return { ok: true, data: null };
}

function validateVerificationDocumentFile(file: File): ClassifiedsResult<null> {
  if (!verificationDocumentExtensions[file.type]) {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: "استخدم صورة JPG أو PNG أو WebP أو ملف PDF.",
      },
    };
  }

  if (file.size <= 0 || file.size > verificationDocumentMaxBytes) {
    return {
      ok: false,
      error: { code: "validation_error", message: "يجب ألا يتجاوز ملف التوثيق 10 MB." },
    };
  }

  return { ok: true, data: null };
}

function buildVerificationDocumentPath(userId: string, requestId: string, file: File) {
  const extension = verificationDocumentExtensions[file.type];
  return `${userId}/${requestId}/${crypto.randomUUID()}.${extension}`;
}

function documentTypeMatchesRequest(
  requestType: "personal" | "business",
  documentType: VerificationDocumentType,
) {
  if (requestType === "business") {
    return ["commercial_registration", "business_license", "tax_document"].includes(documentType);
  }
  return ["national_id", "passport", "other_government_id"].includes(documentType);
}

function mapVerificationCreationError(error: { message?: string | null }) {
  if (error.message?.includes("verification_request_already_pending")) {
    return { code: "validation_error", message: "لديك طلب توثيق قيد المراجعة بالفعل." };
  }
  if (error.message?.includes("verification_document_not_owned")) {
    return { code: "permission_denied", message: "تعذر التحقق من ملكية وثيقة التوثيق." };
  }
  return mapError(error);
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
