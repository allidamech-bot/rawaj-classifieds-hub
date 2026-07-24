import type {
  ClassifiedsResult,
  NotificationCursor,
  NotificationItem,
  NotificationTargetType,
} from "@/lib/classifieds-types";
import {
  mergeNotifications,
  normalizeNotificationId,
  normalizeNotificationTargetType,
  normalizeNotificationText,
} from "@/lib/notification-integrity";
import {
  getAuthenticatedUserId,
  getClient,
  mapError,
  rowNullableString,
  rowRecord,
  rowString,
} from "@/lib/api/shared";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";

const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20;
const MAX_NOTIFICATIONS_PAGE_SIZE = 50;
const NOTIFICATION_SELECT =
  "id,type,title_ar,body_ar,target_type,target_id,metadata,read_at,created_at";

export interface NotificationPageOptions {
  cursor?: NotificationCursor | null;
  limit?: number;
}

export interface NotificationsPage {
  items: NotificationItem[];
  nextCursor: NotificationCursor | null;
  hasMore: boolean;
}

export interface MarkAllNotificationsReadResult {
  cutoff: string;
  updatedCount: number | null;
}

export async function fetchMyNotifications(
  options: NotificationPageOptions = {},
): Promise<ClassifiedsResult<NotificationItem[]>> {
  const result = await fetchMyNotificationsPage(options);
  if (!result.ok) return result;
  return { ok: true, data: result.data.items };
}

export async function fetchMyNotificationsPage(
  options: NotificationPageOptions = {},
): Promise<ClassifiedsResult<NotificationsPage>> {
  if (isCloudflarePublicDataProvider()) {
    return { ok: true, data: { items: [], nextCursor: null, hasMore: false } };
  }
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const boundedLimit = Math.min(
    MAX_NOTIFICATIONS_PAGE_SIZE,
    Math.max(1, Math.floor(options.limit ?? DEFAULT_NOTIFICATIONS_PAGE_SIZE)),
  );
  const cursor = normalizeCursor(options.cursor);
  let query = clientResult.data
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("recipient_id", actorResult.data)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(boundedLimit + 1);

  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: mapError(error) };

  const mapped = mergeNotifications(
    [],
    ((data ?? []) as Record<string, unknown>[])
      .map(mapNotification)
      .filter((item): item is NotificationItem => item !== null),
  );
  const hasMore = mapped.length > boundedLimit;
  const items = mapped.slice(0, boundedLimit);
  const last = items.at(-1);
  return {
    ok: true,
    data: {
      items,
      hasMore,
      nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
    },
  };
}

export async function fetchMyNotificationById(
  notificationId: string,
): Promise<ClassifiedsResult<NotificationItem | null>> {
  if (isCloudflarePublicDataProvider()) return { ok: true, data: null };
  const id = normalizeNotificationId(notificationId);
  if (!id) return validationError("تعذر تحديد الإشعار.");

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { data, error } = await clientResult.data
    .from("notifications")
    .select(NOTIFICATION_SELECT)
    .eq("id", id)
    .eq("recipient_id", actorResult.data)
    .maybeSingle();
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: data ? mapNotification(data as Record<string, unknown>) : null };
}

export async function fetchUnreadNotificationsCount(): Promise<ClassifiedsResult<number>> {
  if (isCloudflarePublicDataProvider()) return { ok: true, data: 0 };
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { count, error } = await clientResult.data
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", actorResult.data)
    .is("read_at", null);
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: Math.max(0, count ?? 0) };
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ClassifiedsResult<null>> {
  if (isCloudflarePublicDataProvider()) return cloudflareUnavailable();
  const id = normalizeNotificationId(notificationId);
  if (!id) return validationError("تعذر تحديد الإشعار.");

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const { error } = await clientResult.data
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("recipient_id", actorResult.data)
    .is("read_at", null);
  if (error) return { ok: false, error: mapError(error) };
  emitUnreadActivityChanged();
  return { ok: true, data: null };
}

export async function markAllNotificationsRead(): Promise<
  ClassifiedsResult<MarkAllNotificationsReadResult>
> {
  if (isCloudflarePublicDataProvider()) return cloudflareUnavailable();
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;
  const actorResult = await getAuthenticatedUserId(clientResult.data);
  if (!actorResult.ok) return actorResult;

  const rpcResult = await clientResult.data.rpc("rawaj_mark_all_notifications_read_v1");
  if (!rpcResult.error) {
    const row = Array.isArray(rpcResult.data)
      ? (rpcResult.data[0] as Record<string, unknown> | undefined)
      : undefined;
    const cutoff = rowString(row ?? {}, "cutoff_at");
    emitUnreadActivityChanged();
    return {
      ok: true,
      data: {
        cutoff: cutoff || new Date().toISOString(),
        updatedCount: Number.isFinite(Number(row?.updated_count))
          ? Number(row?.updated_count)
          : null,
      },
    };
  }
  if (!isMissingMarkAllRpc(rpcResult.error)) {
    return { ok: false, error: mapError(rpcResult.error) };
  }

  const cutoff = new Date().toISOString();
  const { error } = await clientResult.data
    .from("notifications")
    .update({ read_at: cutoff })
    .eq("recipient_id", actorResult.data)
    .is("read_at", null)
    .lte("created_at", cutoff);
  if (error) return { ok: false, error: mapError(error) };
  emitUnreadActivityChanged();
  return { ok: true, data: { cutoff, updatedCount: null } };
}

function mapNotification(row: Record<string, unknown>): NotificationItem | null {
  const id = normalizeNotificationId(rowString(row, "id"));
  const createdAt = rowString(row, "created_at");
  const titleAr = normalizeNotificationText(row.title_ar, 180);
  if (!id || !createdAt || !titleAr) return null;
  const metadata = rowRecord(row, "metadata");
  const targetType = normalizeNotificationTargetType(
    row.target_type,
  ) as NotificationTargetType | null;
  const targetId = targetType ? normalizeNotificationId(row.target_id) : null;
  return {
    id,
    type: normalizeNotificationText(row.type, 80) ?? "system.notice",
    titleAr,
    titleEn:
      normalizeNotificationText(metadata.title_en, 180) ??
      normalizeNotificationText(metadata.titleEn, 180),
    bodyAr: normalizeNotificationText(row.body_ar, 500),
    bodyEn:
      normalizeNotificationText(metadata.body_en, 500) ??
      normalizeNotificationText(metadata.bodyEn, 500),
    targetType: targetId ? targetType : null,
    targetId,
    readAt: rowNullableString(row, "read_at"),
    createdAt,
  };
}

function normalizeCursor(cursor: NotificationCursor | null | undefined): NotificationCursor | null {
  if (!cursor) return null;
  const id = normalizeNotificationId(cursor.id);
  if (!id || !Number.isFinite(Date.parse(cursor.createdAt))) return null;
  return { id, createdAt: new Date(cursor.createdAt).toISOString() };
}

function validationError<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}

function cloudflareUnavailable<T>(): ClassifiedsResult<T> {
  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "الإشعارات غير متاحة مؤقتًا أثناء استكمال نقل الخدمة.",
      operation: "cloudflare_notifications_unavailable",
    },
  };
}

function isMissingMarkAllRpc(error: { code?: string; message?: string; details?: string }) {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    text.includes("rawaj_mark_all_notifications_read_v1")
  );
}
