import type {
  AdminSellerVerificationRequest,
  ClassifiedsError,
  ClassifiedsResult,
  CreateSellerVerificationRequestPayload,
  ModerateSellerVerificationRequestPayload,
  SellerVerificationRequest,
  VerificationDocumentType,
  VerificationRequestStatus,
} from "@/lib/classifieds-types";
import {
  accountSessionStillMatches,
  resolveAuthenticatedAccountId,
} from "@/lib/api/account-identity";
import {
  getClient,
  mapError,
  mapStorageError,
  rowNullableString,
  rowString,
} from "@/lib/api/shared";

export const verificationDocumentsBucket = "verification-documents";
const verificationDocumentMaxBytes = 10 * 1024 * 1024;
const verificationDocumentSignedUrlSeconds = 120;
const ownerVerificationRequestSelect =
  "id,status,request_type,legal_name,business_name,document_type,reviewed_at,created_at,updated_at";
const adminVerificationRequestSelect =
  "id,user_id,status,request_type,legal_name,business_name,document_type,document_path,admin_note,reviewed_by,reviewed_at,created_at,updated_at";
const verificationDocumentExtensions: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "application/pdf": ["pdf"],
};

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const client = clientResult.data;
  const actor = await resolveAuthenticatedAccountId(client, "my_verification_create_auth");
  if (!actor.ok) return actor;

  const requestId = crypto.randomUUID();
  const storagePath = buildVerificationDocumentPath(actor.data, requestId, payload.documentFile);
  const uploadResult = await client.storage
    .from(verificationDocumentsBucket)
    .upload(storagePath, payload.documentFile, {
      cacheControl: "0",
      contentType: payload.documentFile.type,
      upsert: false,
    });
  if (uploadResult.error) return { ok: false, error: mapStorageError(uploadResult.error) };

  const session = await accountSessionStillMatches(
    client,
    actor.data,
    "my_verification_upload_stale_guard",
  );
  if (!session.ok) {
    await cleanupUnattachedVerificationDocument(storagePath);
    return session;
  }

  const { data, error } = await client.rpc("rawaj_create_verification_request_v2", {
    p_request_id: requestId,
    p_request_type: payload.requestType,
    p_legal_name: legalName,
    p_business_name: payload.requestType === "business" ? businessName : null,
    p_document_type: payload.documentType,
    p_document_path: storagePath,
  });

  if (error) {
    await cleanupUnattachedVerificationDocument(storagePath);
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

  return { ok: true, data: mapOwnerVerificationRequest(row as Record<string, unknown>) };
}

export const createSellerVerificationRequest = createMyVerificationRequest;

export async function fetchMyVerificationRequests(): Promise<
  ClassifiedsResult<SellerVerificationRequest[]>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actor = await resolveAuthenticatedAccountId(
    clientResult.data,
    "my_verification_history_auth",
  );
  if (!actor.ok) return actor;

  const rpcResult = await clientResult.data.rpc("rawaj_fetch_my_verification_requests");
  if (!rpcResult.error) {
    return {
      ok: true,
      data: ((rpcResult.data ?? []) as Record<string, unknown>[]).map(mapOwnerVerificationRequest),
    };
  }
  if (!isMissingVerificationIntegrityRpc(rpcResult.error)) {
    return { ok: false, error: mapError(rpcResult.error, "my_verification_history") };
  }

  // Legacy compatibility: identity is still auth-derived and the select is owner-safe.
  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .select(ownerVerificationRequestSelect)
    .eq("user_id", actor.data)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: mapError(error, "my_verification_history_legacy") };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapOwnerVerificationRequest),
  };
}

export async function adminFetchVerificationRequests(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<AdminSellerVerificationRequest[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مراجعة التوثيق متاحة لحساب إداري مخول فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actor = await resolveAuthenticatedAccountId(
    clientResult.data,
    "admin_verification_history_auth",
  );
  if (!actor.ok) return actor;

  const { data, error } = await clientResult.data
    .from("seller_verification_requests")
    .select(adminVerificationRequestSelect)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return { ok: false, error: mapError(error, "admin_verification_history") };
  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapAdminVerificationRequest),
  };
}

export async function adminCreateVerificationDocumentSignedUrl(
  canManageVerifications: boolean,
  requestId: string,
): Promise<ClassifiedsResult<string | null>> {
  if (!canManageVerifications) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "عرض وثائق التوثيق متاح لحساب مخول فقط." },
    };
  }
  if (!isUuid(requestId)) return invalidVerificationInput("تعذر تحديد طلب التوثيق.");

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actor = await resolveAuthenticatedAccountId(clientResult.data, "admin_document_auth");
  if (!actor.ok) return actor;

  const { data: request, error: requestError } = await clientResult.data
    .from("seller_verification_requests")
    .select("id,document_path")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) {
    return { ok: false, error: mapError(requestError, "admin_document_authorize") };
  }
  const documentPath = request
    ? rowNullableString(request as Record<string, unknown>, "document_path")
    : null;
  if (!documentPath) return { ok: true, data: null };

  const { data, error } = await clientResult.data.storage
    .from(verificationDocumentsBucket)
    .createSignedUrl(documentPath, verificationDocumentSignedUrlSeconds);
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
  if (!isUuid(payload.requestId) || !payload.expectedUpdatedAt) {
    return invalidVerificationInput("تعذر تحديد طلب التوثيق أو نسخته الحالية.");
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actor = await resolveAuthenticatedAccountId(
    clientResult.data,
    "admin_verification_moderate_auth",
  );
  if (!actor.ok) return actor;

  const { error } = await clientResult.data.rpc("rawaj_admin_moderate_verification_request", {
    p_request_id: payload.requestId,
    p_status: payload.status,
    p_admin_note: normalizePrivateName(payload.adminNote) || null,
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
    return { ok: false, error: mapError(error, "admin_verification_moderate") };
  }
  return { ok: true, data: null };
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

function buildVerificationDocumentPath(userId: string, requestId: string, file: File) {
  const extension = verificationDocumentExtensions[file.type]?.[0];
  return `${userId}/${requestId}/${crypto.randomUUID()}.${extension}`;
}

function documentTypeMatchesRequest(
  requestType: "personal" | "business",
  documentType: VerificationDocumentType,
) {
  return requestType === "business"
    ? ["commercial_registration", "business_license", "tax_document"].includes(documentType)
    : ["national_id", "passport", "other_government_id"].includes(documentType);
}

async function cleanupUnattachedVerificationDocument(storagePath: string) {
  const clientResult = getClient();
  if (!clientResult.ok) return;
  await clientResult.data.storage.from(verificationDocumentsBucket).remove([storagePath]);
}

function invalidVerificationInput<T = never>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
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
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function isMissingVerificationIntegrityRpc(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    (error.message ?? "").includes("rawaj_fetch_my_verification_requests")
  );
}

function mapVerificationCreationError(error: {
  code?: string;
  message?: string;
  details?: string;
}): ClassifiedsError {
  if (error.message?.includes("verification_request_already_pending")) {
    return { code: "validation_error", message: "لديك طلب توثيق قيد المراجعة بالفعل." };
  }
  if (error.message?.includes("verification_document_not_owned")) {
    return { code: "permission_denied", message: "تعذر التحقق من ملكية وثيقة التوثيق." };
  }
  return mapError(error, "my_verification_create");
}

function mapOwnerVerificationRequest(row: Record<string, unknown>): SellerVerificationRequest {
  return {
    id: rowString(row, "id"),
    status: rowString(row, "status", "pending_review") as VerificationRequestStatus,
    requestType: rowString(
      row,
      "request_type",
      "personal",
    ) as SellerVerificationRequest["requestType"],
    legalName: rowString(row, "legal_name"),
    businessName: rowNullableString(row, "business_name"),
    documentType: rowNullableString(row, "document_type"),
    reviewedAt: rowNullableString(row, "reviewed_at"),
    createdAt: rowString(row, "created_at"),
    updatedAt: rowString(row, "updated_at"),
  };
}

function mapAdminVerificationRequest(row: Record<string, unknown>): AdminSellerVerificationRequest {
  return {
    ...mapOwnerVerificationRequest(row),
    userId: rowString(row, "user_id"),
    documentPath: rowNullableString(row, "document_path"),
    adminNote: rowNullableString(row, "admin_note"),
    reviewedBy: rowNullableString(row, "reviewed_by"),
  };
}
