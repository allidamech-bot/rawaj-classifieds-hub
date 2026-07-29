import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";

export async function scanOwnerListingExpiryReminders(
  userId: string | null,
): Promise<ClassifiedsResult<number>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لفحص تنبيهات انتهاء الإعلانات." },
    };
  }
  const result = await cloudflareApiRequest<{ deliveredCount: number }>(
    "/v1/account/listings/expiry-reminders/scan",
    { method: "POST", body: {} },
  );
  if (!result.ok) {
    return {
      ok: false,
      error: { code: result.code as ClassifiedsErrorCode, message: result.error },
    };
  }
  if (result.data.deliveredCount > 0) emitUnreadActivityChanged();
  return { ok: true, data: result.data.deliveredCount };
}
