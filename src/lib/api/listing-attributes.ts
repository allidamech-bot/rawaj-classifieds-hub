import { rememberOwnerListingUpdatedAt } from "@/lib/api/listing-owner-version";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";

export interface MissingListingAttribute {
  fieldKey: string;
  labelAr: string;
  labelEn: string | null;
  groupKey: string | null;
  sortOrder: number;
}

export interface ListingAttributeCompleteness {
  complete: boolean;
  blockingCode: string | null;
  taxonomyVersionId: string | null;
  taxonomyNodeId: string | null;
  requiredCount: number;
  filledRequiredCount: number;
  filledCount: number;
  missingRequiredFields: MissingListingAttribute[];
}

export interface ListingAttributeWriteResult {
  listingId: string;
  updatedAt: string;
  writtenCount: number;
  completeness: ListingAttributeCompleteness;
}

export interface OwnerListingAttributeValues {
  listingId: string;
  listingUpdatedAt: string;
  listingStatus: string;
  taxonomyVersionId: string | null;
  taxonomyVersionNumber: number | null;
  taxonomyNodeId: string | null;
  valueCount: number;
  values: Record<string, unknown>;
}

export async function fetchOwnerListingAttributes(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<OwnerListingAttributeValues>> {
  if (!userId) return authenticationFailure();
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return listingValidationFailure();

  const result = await cloudflareApiRequest<OwnerListingAttributeValues>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/attributes`,
  );
  if (!result.ok) return apiFailure(result, "listing_attribute_fetch");

  const payload = normalizeOwnerValues(result.data);
  if (!payload.listingId || !payload.listingUpdatedAt) {
    return confirmationFailure(
      "لم يؤكد الخادم تحميل تفاصيل الإعلان المنظمة.",
      "listing_attribute_fetch",
    );
  }
  rememberOwnerListingUpdatedAt(userId, payload.listingId, payload.listingUpdatedAt);
  return { ok: true, data: payload };
}

export async function fetchOwnerListingAttributeCompleteness(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ListingAttributeCompleteness>> {
  if (!userId) return authenticationFailure();
  const cleanListingId = listingId.trim();
  if (!cleanListingId) return listingValidationFailure();

  const result = await cloudflareApiRequest<ListingAttributeCompleteness>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/attributes/completeness`,
  );
  return result.ok
    ? { ok: true, data: parseCompleteness(result.data) }
    : apiFailure(result, "listing_attribute_completeness");
}

export async function replaceOwnerListingAttributes(
  userId: string | null,
  listingId: string,
  expectedUpdatedAt: string,
  attributes: Record<string, unknown>,
): Promise<ClassifiedsResult<ListingAttributeWriteResult>> {
  if (!userId) return authenticationFailure();
  const cleanListingId = listingId.trim();
  const cleanExpectedUpdatedAt = expectedUpdatedAt.trim();
  if (!cleanListingId || !cleanExpectedUpdatedAt) return listingValidationFailure();

  const result = await cloudflareApiRequest<ListingAttributeWriteResult>(
    `/v1/listings/${encodeURIComponent(cleanListingId)}/attributes`,
    {
      method: "PATCH",
      body: { expectedUpdatedAt: cleanExpectedUpdatedAt, attributes },
    },
  );
  if (!result.ok) return apiFailure(result, "listing_attribute_replace");

  const payload = record(result.data);
  const returnedListingId = text(payload.listingId);
  const updatedAt = text(payload.updatedAt);
  if (!returnedListingId || !updatedAt) {
    return confirmationFailure(
      "لم يؤكد الخادم حفظ تفاصيل الإعلان المنظمة.",
      "listing_attribute_replace",
    );
  }

  rememberOwnerListingUpdatedAt(userId, returnedListingId, updatedAt);
  return {
    ok: true,
    data: {
      listingId: returnedListingId,
      updatedAt,
      writtenCount: integer(payload.writtenCount),
      completeness: parseCompleteness(payload.completeness),
    },
  };
}

function normalizeOwnerValues(value: unknown): OwnerListingAttributeValues {
  const payload = record(value);
  return {
    listingId: text(payload.listingId),
    listingUpdatedAt: text(payload.listingUpdatedAt),
    listingStatus: text(payload.listingStatus),
    taxonomyVersionId: nullableText(payload.taxonomyVersionId),
    taxonomyVersionNumber: nullableNumber(payload.taxonomyVersionNumber),
    taxonomyNodeId: nullableText(payload.taxonomyNodeId),
    valueCount: integer(payload.valueCount),
    values: record(payload.values),
  };
}

function apiFailure<T>(
  result: { ok: false; code: string; error: string },
  operation: string,
): ClassifiedsResult<T> {
  const code = result.code as ClassifiedsErrorCode;
  if (code === "status_mismatch") {
    return {
      ok: false,
      error: {
        code,
        message: "تغيّرت المسودة أثناء الحفظ. حدّث الصفحة ثم أعد المحاولة.",
        details: result.error,
        operation,
      },
    };
  }
  if (code === "permission_denied" || code === "auth_required") {
    return {
      ok: false,
      error: {
        code,
        message:
          code === "auth_required"
            ? "يجب تسجيل الدخول لحفظ تفاصيل الإعلان."
            : "لا تملك صلاحية تعديل تفاصيل هذا الإعلان.",
        details: result.error,
        operation,
      },
    };
  }
  if (code === "validation_error" || code === "invalid_transition") {
    return {
      ok: false,
      error: {
        code: "validation_error",
        message: result.error || "تحتوي تفاصيل الإعلان على قيمة غير صالحة لهذا التصنيف.",
        operation,
      },
    };
  }
  return {
    ok: false,
    error: {
      code: code || "unknown",
      message: result.error || "تعذر إكمال العملية.",
      operation,
    },
  };
}

function parseCompleteness(value: unknown): ListingAttributeCompleteness {
  const payload = record(value);
  return {
    complete: boolean(payload.complete),
    blockingCode: nullableText(payload.blockingCode),
    taxonomyVersionId: nullableText(payload.taxonomyVersionId),
    taxonomyNodeId: nullableText(payload.taxonomyNodeId),
    requiredCount: integer(payload.requiredCount),
    filledRequiredCount: integer(payload.filledRequiredCount),
    filledCount: integer(payload.filledCount),
    missingRequiredFields: records(payload.missingRequiredFields)
      .map((item) => {
        const fieldKey = text(item.fieldKey);
        const labelAr = text(item.labelAr);
        if (!fieldKey || !labelAr) return null;
        return {
          fieldKey,
          labelAr,
          labelEn: nullableText(item.labelEn),
          groupKey: nullableText(item.groupKey),
          sortOrder: integer(item.sortOrder),
        };
      })
      .filter((item): item is MissingListingAttribute => item !== null),
  };
}

function authenticationFailure<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: "auth_required", message: "يجب تسجيل الدخول لحفظ تفاصيل الإعلان." },
  };
}

function listingValidationFailure<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "validation_error",
      message: "تعذر تحديد مسودة الإعلان أو نسختها الحالية.",
    },
  };
}

function confirmationFailure<T>(message: string, operation: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "unknown", message, operation } };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  const result = text(value).trim();
  return result || null;
}

function integer(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}
