import { getClient, mapError } from "@/lib/api/shared";
import type { ClassifiedsError, ClassifiedsResult } from "@/lib/classifieds-types";

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc(
    "rawaj_owner_fetch_listing_attributes_v1",
    {
      p_listing_id: cleanListingId,
    },
  );

  if (error) {
    return {
      ok: false,
      error: mapListingAttributeError(error, "listing_attribute_fetch"),
    };
  }

  const payload = record(data);
  const returnedListingId = text(payload.listingId);
  const listingUpdatedAt = text(payload.listingUpdatedAt);
  if (!returnedListingId || !listingUpdatedAt) {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "لم يؤكد الخادم تحميل تفاصيل الإعلان المنظمة.",
        operation: "listing_attribute_fetch",
      },
    };
  }

  return {
    ok: true,
    data: {
      listingId: returnedListingId,
      listingUpdatedAt,
      listingStatus: text(payload.listingStatus),
      taxonomyVersionId: nullableText(payload.taxonomyVersionId),
      taxonomyVersionNumber: nullableNumber(payload.taxonomyVersionNumber),
      taxonomyNodeId: nullableText(payload.taxonomyNodeId),
      valueCount: integer(payload.valueCount),
      values: record(payload.values),
    },
  };
}

export async function fetchOwnerListingAttributeCompleteness(
  userId: string | null,
  listingId: string,
): Promise<ClassifiedsResult<ListingAttributeCompleteness>> {
  if (!userId) return authenticationFailure();

  const cleanListingId = listingId.trim();
  if (!cleanListingId) return listingValidationFailure();

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_listing_attribute_completeness_v1", {
    p_listing_id: cleanListingId,
  });

  if (error) {
    return {
      ok: false,
      error: mapListingAttributeError(error, "listing_attribute_completeness"),
    };
  }

  return { ok: true, data: parseCompleteness(data) };
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_owner_replace_listing_attributes_v1", {
    p_listing_id: cleanListingId,
    p_expected_updated_at: cleanExpectedUpdatedAt,
    p_attributes: attributes,
  });

  if (error) {
    return {
      ok: false,
      error: mapListingAttributeError(error, "listing_attribute_replace"),
    };
  }

  const payload = record(data);
  const returnedListingId = text(payload.listingId);
  const updatedAt = text(payload.updatedAt);
  if (!returnedListingId || !updatedAt) {
    return {
      ok: false,
      error: {
        code: "unknown",
        message: "لم يؤكد الخادم حفظ تفاصيل الإعلان المنظمة.",
        operation: "listing_attribute_replace",
      },
    };
  }

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

function mapListingAttributeError(
  error: { code?: string; message?: string; details?: string },
  operation: string,
): ClassifiedsError {
  const message = `${error.message ?? ""} ${error.details ?? ""}`;

  if (message.includes("stale_owner_update")) {
    return {
      code: "status_mismatch",
      message: "تغيّرت المسودة أثناء الحفظ. أعد المحاولة بعد تحديث الصفحة.",
      details: error.details ?? error.message,
      operation,
    };
  }

  if (message.includes("listing_attribute_read_forbidden")) {
    return {
      code: "forbidden",
      message: "لا تملك صلاحية قراءة تفاصيل هذا الإعلان المنظمة.",
      details: error.details ?? error.message,
      operation,
    };
  }

  if (
    message.includes("published_taxonomy_leaf_required") ||
    message.includes("listing_published_taxonomy_leaf_required")
  ) {
    return {
      code: "validation_error",
      message: "اختر التصنيف النهائي المنشور قبل حفظ التفاصيل المنظمة.",
      details: error.details ?? error.message,
      operation,
    };
  }

  if (message.includes("listing_attributes_incomplete")) {
    return {
      code: "validation_error",
      message: "أكمل الحقول المطلوبة الخاصة بهذا التصنيف قبل إرسال الإعلان.",
      details: error.details ?? error.message,
      operation,
    };
  }

  if (
    message.includes("listing_attribute_keys_not_allowed") ||
    message.includes("listing_attribute_")
  ) {
    return {
      code: "validation_error",
      message: "تحتوي تفاصيل الإعلان على قيمة غير صالحة لهذا التصنيف.",
      details: error.details ?? error.message,
      operation,
    };
  }

  return mapError(error, operation);
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
    error: {
      code: "auth_required",
      message: "يجب تسجيل الدخول لحفظ تفاصيل الإعلان.",
    },
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
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function boolean(value: unknown): boolean {
  return value === true || value === "true";
}
