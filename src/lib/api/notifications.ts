import type {
  ClassifiedsErrorCode,
  ClassifiedsResult,
  NotificationCursor,
  NotificationItem,
} from "@/lib/classifieds-types";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";
import { emitUnreadActivityChanged } from "@/lib/unread-activity-events";

const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 20;
const MAX_NOTIFICATIONS_PAGE_SIZE = 50;

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
  return result.ok ? { ok: true, data: result.data.items } : result;
}

export async function fetchMyNotificationsPage(
  options: NotificationPageOptions = {},
): Promise<ClassifiedsResult<NotificationsPage>> {
  const limit = Math.min(
    MAX_NOTIFICATIONS_PAGE_SIZE,
    Math.max(1, Math.floor(options.limit ?? DEFAULT_NOTIFICATIONS_PAGE_SIZE)),
  );
  const params = new URLSearchParams({ limit: String(limit) });
  if (options.cursor?.createdAt && options.cursor.id) {
    params.set("cursorAt", options.cursor.createdAt);
    params.set("cursorId", options.cursor.id);
  }
  return request<NotificationsPage>(`/v1/account/notifications?${params.toString()}`);
}

export async function fetchMyNotificationById(
  notificationId: string,
): Promise<ClassifiedsResult<NotificationItem | null>> {
  const id = notificationId.trim();
  if (!id) return validationError("تعذر تحديد الإشعار.");
  return request<NotificationItem | null>(
    `/v1/account/notifications/${encodeURIComponent(id)}`,
  );
}

export function fetchUnreadNotificationsCount(): Promise<ClassifiedsResult<number>> {
  return request<number>("/v1/account/notifications/unread-count");
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ClassifiedsResult<null>> {
  const id = notificationId.trim();
  if (!id) return validationError("تعذر تحديد الإشعار.");
  const result = await request<null>(
    `/v1/account/notifications/${encodeURIComponent(id)}`,
    { method: "PATCH", body: {} },
  );
  if (result.ok) emitUnreadActivityChanged();
  return result;
}

export async function markAllNotificationsRead(): Promise<
  ClassifiedsResult<MarkAllNotificationsReadResult>
> {
  const result = await request<MarkAllNotificationsReadResult>(
    "/v1/account/notifications/read-all",
    { method: "POST", body: {} },
  );
  if (result.ok) emitUnreadActivityChanged();
  return result;
}

async function request<T>(
  path: string,
  init: { method?: string; body?: Record<string, unknown> } = {},
): Promise<ClassifiedsResult<T>> {
  const result = await cloudflareApiRequest<T>(path, init);
  return result.ok
    ? { ok: true, data: result.data }
    : {
        ok: false,
        error: {
          code: normalizeErrorCode(result.code),
          message: result.error,
          operation: `cloudflare_notifications:${path.split("?", 1)[0]}`,
        },
      };
}

function normalizeErrorCode(code: string): ClassifiedsErrorCode {
  if (code === "auth_required") return "auth_required";
  if (code === "permission_denied") return "permission_denied";
  if (code === "validation_error") return "validation_error";
  if (code === "not_found") return "not_found";
  if (code === "database_unavailable") return "setup_required";
  if (code === "rate_limited") return "rate_limited";
  return "unknown";
}

function validationError<T>(message: string): ClassifiedsResult<T> {
  return { ok: false, error: { code: "validation_error", message } };
}
