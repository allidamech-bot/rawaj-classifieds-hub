import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { getClient, mapError } from "@/lib/api/shared";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";

const MAX_EXPIRY_REMINDER_CANDIDATES = 20;
const EXPIRY_REMINDER_WINDOW_DAYS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type ListingExpiryReminderKind = "expiring_7d" | "expiring_1d";

export async function scanOwnerListingExpiryReminders(
  userId: string | null,
): Promise<ClassifiedsResult<number>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لفحص تنبيهات انتهاء الإعلانات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + EXPIRY_REMINDER_WINDOW_DAYS * ONE_DAY_MS,
  ).toISOString();

  const { data, error } = await clientResult.data
    .from("listings")
    .select("id, expires_at")
    .eq("owner_id", userId)
    .eq("status", "approved")
    .not("expires_at", "is", null)
    .gt("expires_at", now.toISOString())
    .lte("expires_at", windowEnd)
    .order("expires_at", { ascending: true })
    .limit(MAX_EXPIRY_REMINDER_CANDIDATES);

  if (error) return { ok: false, error: mapError(error) };

  const candidates = (data ?? []) as Array<{ id: string; expires_at: string }>;
  let deliveredCount = 0;

  for (const candidate of candidates) {
    const expiresAt = Date.parse(candidate.expires_at);
    if (!Number.isFinite(expiresAt)) continue;

    const kind: ListingExpiryReminderKind =
      expiresAt - now.getTime() <= ONE_DAY_MS ? "expiring_1d" : "expiring_7d";

    const { data: delivered, error: reminderError } = await clientResult.data.rpc(
      "rawaj_record_listing_expiry_reminder",
      {
        p_listing_id: candidate.id,
        p_reminder_kind: kind,
      },
    );

    if (reminderError) return { ok: false, error: mapError(reminderError) };
    if (delivered === true) deliveredCount += 1;
  }

  if (deliveredCount > 0) emitUnreadActivityChanged();
  return { ok: true, data: deliveredCount };
}
