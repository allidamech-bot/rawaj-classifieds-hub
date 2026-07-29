import type { ClassifiedsErrorCode, ClassifiedsResult } from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export interface NotificationPreferences {
  pushEnabled: boolean;
  messagesEnabled: boolean;
  priceChangesEnabled: boolean;
  savedSearchMatchesEnabled: boolean;
  listingStatusEnabled: boolean;
  reviewsEnabled: boolean;
  promotionsEnabled: boolean;
  updatedAt: string | null;
}

export type NotificationPreferenceKey = Exclude<
  keyof NotificationPreferences,
  "pushEnabled" | "updatedAt"
>;

export async function fetchNotificationPreferences(): Promise<
  ClassifiedsResult<NotificationPreferences>
> {
  const result = await cloudflareApiRequest<NotificationPreferences>(
    "/v1/account/notification-preferences",
  );
  return result.ok ? { ok: true, data: normalizePreferences(result.data) } : apiFailure(result);
}

export async function updateNotificationPreference(
  key: NotificationPreferenceKey,
  enabled: boolean,
): Promise<ClassifiedsResult<NotificationPreferences>> {
  const result = await cloudflareApiRequest<NotificationPreferences>(
    "/v1/account/notification-preferences",
    { method: "PATCH", body: { key, enabled } },
  );
  return result.ok ? { ok: true, data: normalizePreferences(result.data) } : apiFailure(result);
}

function normalizePreferences(value: NotificationPreferences): NotificationPreferences {
  return {
    pushEnabled: Boolean(value.pushEnabled),
    messagesEnabled: value.messagesEnabled !== false,
    priceChangesEnabled: value.priceChangesEnabled !== false,
    savedSearchMatchesEnabled: value.savedSearchMatchesEnabled !== false,
    listingStatusEnabled: value.listingStatusEnabled !== false,
    reviewsEnabled: value.reviewsEnabled !== false,
    promotionsEnabled: value.promotionsEnabled !== false,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function apiFailure<T>(result: { ok: false; error: string; code: string }): ClassifiedsResult<T> {
  return {
    ok: false,
    error: { code: result.code as ClassifiedsErrorCode, message: result.error },
  };
}
