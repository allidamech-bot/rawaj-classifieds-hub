import type { ClassifiedsError } from "@/lib/classifieds-types";
import type { PlaceholderType } from "@/types";

export function mapError(
  error: { code?: string; message?: string; details?: string },
  operation?: string,
): ClassifiedsError {
  const message = error.message ?? "حدث خطأ غير متوقع أثناء الاتصال بقاعدة البيانات.";
  const isMissingSchema =
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("relation") ||
    message.includes("does not exist") ||
    message.includes("schema cache");

  if (isMissingSchema) {
    return {
      code: "schema_missing",
      message: "تعذر تحميل البيانات الآن. حاول مرة أخرى.",
      details: message,
      operation,
    };
  }

  if (error.code === "23503") {
    return {
      code: "foreign_key_conflict",
      message: "تعذر إكمال الحذف لأن العنصر مرتبط ببيانات محفوظة أخرى.",
      details: message,
      operation,
    };
  }

  if (error.code === "42501") {
    return {
      code: "permission_denied",
      message: "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
      details: message,
      operation,
    };
  }

  return { code: "unknown", message, details: error.details, operation };
}

export function mapStorageError(error: {
  statusCode?: string | number;
  message?: string;
}): ClassifiedsError {
  const message = error.message ?? "تعذر تنفيذ عملية التخزين.";
  const isMissingStorage =
    message.includes("Bucket not found") ||
    message.includes("bucket not found") ||
    message.includes("The resource was not found") ||
    error.statusCode === 404 ||
    error.statusCode === "404";

  if (isMissingStorage) {
    return {
      code: "storage_unconfigured",
      message: "تعذر رفع الصور الآن. يمكنك إرسال الإعلان بدون صور والمحاولة مرة أخرى بعد حفظه.",
      details: message,
    };
  }

  return { code: "unknown", message };
}

export function isMissingMessageReportRpc(error: {
  code?: string;
  message?: string;
  details?: string;
}) {
  const message = error.message ?? "";
  const details = error.details ?? "";
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    message.includes("rawaj_create_message_report") ||
    details.includes("rawaj_create_message_report")
  );
}

export function rowString(row: Record<string, unknown>, key: string, fallback = ""): string {
  const value = row[key];
  return typeof value === "string" ? value : fallback;
}

export function rowNullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" ? value : null;
}

export function rowBoolean(row: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

export function rowNumber(row: Record<string, unknown>, key: string, fallback = 0): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return fallback;
}

export function rowNullableNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) return Number(value);
  return null;
}

export function rowArray(row: Record<string, unknown>, key: string): string[] {
  const value = row[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function rowRecord(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = row[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function rowBooleanRecord(
  row: Record<string, unknown>,
  key: string,
): Record<string, boolean> {
  const source = rowRecord(row, key);
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === "boolean",
    ),
  );
}

export function normalizePlaceholder(value: string): PlaceholderType {
  const allowed = [
    "car",
    "realestate",
    "phone",
    "electronics",
    "furniture",
    "job",
    "service",
    "fashion",
    "food",
    "animals",
    "education",
    "business",
    "misc",
  ];
  return allowed.includes(value as PlaceholderType) ? (value as PlaceholderType) : "misc";
}

export function cleanOptionalText(
  value: string | null | undefined,
  maxLength: number,
): string | null {
  const clean = value?.trim() ?? "";
  return clean ? clean.slice(0, maxLength) : null;
}

export function escapePostgrestSearchTerm(value: string) {
  return value.replace(/[\\%_,().:*"]/g, "\\$&");
}

export function escapePostgrestFilterValue(value: string) {
  return value.replace(/[\\(),]/g, "\\$&");
}

export function validateListingCursor(
  value: unknown,
): import("@/lib/classifieds-types").ListingCursor | null {
  if (!value || typeof value !== "object") return null;
  const cursor = value as Record<string, unknown>;
  const type = cursor.type;
  if (typeof type !== "string") return null;

  const id = cursor.id;
  if (typeof id !== "string" || !id.trim()) return null;

  switch (type) {
    case "latest": {
      const created_at = cursor.created_at;
      if (typeof created_at !== "string" || !created_at.trim()) return null;
      return { type: "latest", created_at, id };
    }
    case "cheapest":
    case "expensive": {
      const price = cursor.price;
      if (typeof price !== "number" && price !== null) return null;
      return { type, price, id };
    }
    case "featured": {
      const is_featured = cursor.is_featured;
      const created_at = cursor.created_at;
      if (typeof is_featured !== "boolean" || typeof created_at !== "string" || !created_at.trim())
        return null;
      return { type: "featured", is_featured, created_at, id };
    }
    default:
      return null;
  }
}

export function encodeListingCursor(
  cursor: import("@/lib/classifieds-types").ListingCursor,
): string {
  const json = JSON.stringify(cursor);
  const base64 = Buffer.from(json, "utf-8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function decodeListingCursor(
  value: string | null | undefined,
): import("@/lib/classifieds-types").ListingCursor | null {
  if (!value || typeof value !== "string") return null;
  try {
    let base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    const json = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(json);
    return validateListingCursor(parsed);
  } catch {
    return null;
  }
}
