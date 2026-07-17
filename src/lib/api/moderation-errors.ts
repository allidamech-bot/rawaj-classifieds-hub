import type { ClassifiedsError } from "@/lib/classifieds-types";

export function mapModerationError(
  error: { code?: string; message?: string },
  operation: string,
  fallbackMessage: string,
): ClassifiedsError {
  const message = (error.message ?? "").toLowerCase();

  if (error.code === "PGRST202" || error.code === "42883" || message.includes("schema cache")) {
    return {
      code: "schema_missing",
      message: "تعذر إكمال العملية لأن إعدادات الحماية المطلوبة غير مفعلة بعد.",
      operation,
    };
  }
  if (message.includes("auth_required") || message.includes("authentication")) {
    return { code: "auth_required", message: "يجب تسجيل الدخول لإكمال العملية.", operation };
  }
  if (message.includes("permission") || message.includes("unauthorized")) {
    return {
      code: "permission_denied",
      message: "ليست لديك صلاحية لتنفيذ هذا الإجراء.",
      operation,
    };
  }
  if (message.includes("stale_")) {
    return {
      code: "stale_review",
      message: "تغير السجل منذ تحميله. أعد تحميل القائمة قبل اتخاذ قرار جديد.",
      operation,
    };
  }
  if (message.includes("rate_limit")) {
    return {
      code: "rate_limited",
      message: "تم إرسال عدة طلبات خلال وقت قصير. حاول لاحقًا.",
      operation,
    };
  }
  if (
    message.includes("unavailable") ||
    message.includes("not_found") ||
    message.includes("does not exist")
  ) {
    return { code: "not_found", message: "العنصر المطلوب غير متاح.", operation };
  }
  if (
    message.includes("invalid") ||
    message.includes("unsupported") ||
    message.includes("too_long") ||
    message.includes("self_report") ||
    message.includes("transition")
  ) {
    return { code: "validation_error", message: "البيانات المرسلة غير صالحة.", operation };
  }

  return { code: "unknown", message: fallbackMessage, operation };
}
