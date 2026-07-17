import { getAuthenticatedUserId, getClient, mapError, rowBoolean } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

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

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: false,
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

const PREFERENCE_SELECT =
  "push_enabled,messages_enabled,price_changes_enabled,saved_search_matches_enabled,listing_status_enabled,reviews_enabled,promotions_enabled,updated_at";

export async function fetchNotificationPreferences(): Promise<
  ClassifiedsResult<NotificationPreferences>
> {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { data, error } = await clientResult.data
    .from("notification_preferences")
    .select(PREFERENCE_SELECT)
    .eq("user_id", actorResult.data)
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error) };
  if (!data) return { ok: true, data: DEFAULT_NOTIFICATION_PREFERENCES };
  return { ok: true, data: mapPreferences(data as Record<string, unknown>) };
}

export async function updateNotificationPreference(
  key: NotificationPreferenceKey,
  enabled: boolean,
): Promise<ClassifiedsResult<NotificationPreferences>> {
  const column = COLUMN_BY_KEY[key];
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { error } = await clientResult.data
    .from("notification_preferences")
    .upsert({ user_id: actorResult.data, [column]: enabled }, { onConflict: "user_id" });
  if (error) return { ok: false, error: mapError(error) };
  return fetchNotificationPreferences();
}

function mapPreferences(row: Record<string, unknown>): NotificationPreferences {
  return {
    pushEnabled: rowBoolean(row, "push_enabled", false),
    messagesEnabled: rowBoolean(row, "messages_enabled", true),
    priceChangesEnabled: rowBoolean(row, "price_changes_enabled", true),
    savedSearchMatchesEnabled: rowBoolean(row, "saved_search_matches_enabled", true),
    listingStatusEnabled: rowBoolean(row, "listing_status_enabled", true),
    reviewsEnabled: rowBoolean(row, "reviews_enabled", true),
    promotionsEnabled: rowBoolean(row, "promotions_enabled", true),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}
