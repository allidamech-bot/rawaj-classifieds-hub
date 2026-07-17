const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SAFE_TARGET_TYPES = new Map<string, string>([
  ["listing", "listing"],
  ["conversation", "conversation"],
  ["chat", "conversation"],
  ["seller", "seller"],
  ["saved_search", "saved_search"],
  ["owner_listing", "owner_listing"],
  ["profile_listing", "owner_listing"],
  ["support", "support"],
  ["support_request", "support"],
  ["verification", "verification"],
  ["verification_request", "verification"],
  ["promotion", "promotion"],
  ["listing_promotion_request", "promotion"],
]);

export interface NotificationOrderRecord {
  id: string;
  createdAt: string;
}

export function normalizeNotificationId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

export function normalizeNotificationTargetType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return SAFE_TARGET_TYPES.get(value.trim().toLowerCase()) ?? null;
}

export function normalizeNotificationText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127);
    })
    .join("")
    .trim()
    .slice(0, Math.max(0, maxLength));
  return normalized || null;
}

export function compareNotificationsNewestFirst(
  left: NotificationOrderRecord,
  right: NotificationOrderRecord,
): number {
  const timeDifference = Date.parse(right.createdAt) - Date.parse(left.createdAt);
  if (Number.isFinite(timeDifference) && timeDifference !== 0) return timeDifference;
  return right.id.localeCompare(left.id);
}

export function mergeNotifications<T extends NotificationOrderRecord>(
  current: readonly T[],
  incoming: readonly T[],
): T[] {
  const byId = new Map<string, T>();
  for (const item of [...current, ...incoming]) {
    const id = normalizeNotificationId(item.id);
    if (!id) continue;
    byId.set(id, { ...item, id });
  }
  return [...byId.values()].sort(compareNotificationsNewestFirst);
}

export function notificationIsUnread(item: { readAt: string | null }): boolean {
  return item.readAt === null;
}

export function notificationIsWithinReadCutoff(
  item: { createdAt: string },
  cutoff: string,
): boolean {
  const createdAt = Date.parse(item.createdAt);
  const cutoffAt = Date.parse(cutoff);
  return Number.isFinite(createdAt) && Number.isFinite(cutoffAt) && createdAt <= cutoffAt;
}
