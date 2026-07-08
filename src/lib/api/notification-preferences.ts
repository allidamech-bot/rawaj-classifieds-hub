import { getClient, mapError, rowBoolean, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export interface NotificationPreferences {
  userId: string;
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
  "userId" | "updatedAt"
>;

const DEFAULT_NOTIFICATION_PREFERENCES: Omit<NotificationPreferences, "userId"> = {
  messagesEnabled: true,
  priceChangesEnabled: true,
  savedSearchMatchesEnabled: true,
  listingStatusEnabled: true,
  reviewsEnabled: true,
  promotionsEnabled: true,
  updatedAt: null,
};

const COLUMN_BY_KEY: Record<NotificationPreferenceKey, string> = {
  messagesEnabled: "messages_enabled",
  priceChangesEnabled: "price_changes_enabled",
  savedSearchMatchesEnabled: "saved_search_matches_enabled",
  listingStatusEnabled: "listing_status_enabled",
  reviewsEnabled: "reviews_enabled",
  promotionsEnabled: "promotions_enabled",
};

export async function fetchNotificationPreferences(
  userId: string | null,
): Promise<ClassifiedsResult<NotificationPreferences>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لعرض تفضيلات الإشعارات." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: mapError(error) };
  if (!data) {
    return {
      ok: true,
      data: { userId, ...DEFAULT_NOTIFICATION_PREFERENCES },
    };
  }

  const row = data as Record<string, unknown>;
  return {
    ok: true,
    data: {
      userId: rowString(row, "user_id", userId),
      messagesEnabled: rowBoolean(row, "messages_enabled", true),
      priceChangesEnabled: rowBoolean(row, "price_changes_enabled", true),
      savedSearchMatchesEnabled: rowBoolean(row, "saved_search_matches_enabled", true),
      listingStatusEnabled: rowBoolean(row, "listing_status_enabled", true),
      reviewsEnabled: rowBoolean(row, "reviews_enabled", true),
      promotionsEnabled: rowBoolean(row, "promotions_enabled", true),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    },
  };
}

export async function updateNotificationPreference(
  userId: string | null,
  key: NotificationPreferenceKey,
  enabled: boolean,
): Promise<ClassifiedsResult<NotificationPreferences>> {
  if (!userId) {
    return {
      ok: false,
      error: { code: "auth_required", message: "يجب تسجيل الدخول لتحديث تفضيلات الإشعارات." },
    };
  }

  const column = COLUMN_BY_KEY[key];
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.from("notification_preferences").upsert(
    {
      user_id: userId,
      [column]: enabled,
    },
    { onConflict: "user_id" },
  );

  if (error) return { ok: false, error: mapError(error) };
  return fetchNotificationPreferences(userId);
}
