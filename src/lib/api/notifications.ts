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
const RECENT_UNREAD_COUNT_WINDOW_MS = 5_000;

interface RecentUnreadCount {
  value: number;
  fetchedAt: number;
  generation: number;
}

let unreadCountGeneration = 0;
let recentUnreadCount: RecentUnreadCount | null = null;

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
  return request<NotificationItem | null>(`/v1/account/notifications/${encodeURIComponent(id)}`);
}

export async function fetchUnreadNotificationsCount(): Promise<ClassifiedsResult<number>> {
  const generation = unreadCountGeneration;
  const result = await request<number>("/v1/account/notifications/unread-count");
  if (result.ok && generation === unreadCountGeneration) {
    recentUnreadCount = {
      value: Math.max(0, result.data),
      fetchedAt: Date.now(),
      generation,
    };
  }
  return result;
}

export function getRecentUnreadNotificationsCount(
  maxAgeMs = RECENT_UNREAD_COUNT_WINDOW_MS,
): number | null {
  const snapshot = recentUnreadCount;
  if (!snapshot || snapshot.generation !== unreadCountGeneration) return null;
  if (Date.now() - snapshot.fetchedAt > Math.max(0, maxAgeMs)) return null;
  return snapshot.value;
}

function invalidateRecentUnreadNotificationsCount() {
  unreadCountGeneration += 1;
  recentUnreadCount = null;
}

export async function markNotificationRead(
  notificationId: string,
): Promise<ClassifiedsResult<null>> {
  const id = notificationId.trim();
  if (!id) return validationError("تعذر تحديد الإشعار.");
  const result = await request<null>(`/v1/account/notifications/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: {},
  });
  if (result.ok) {
    invalidateRecentUnreadNotificationsCount();
    emitUnreadActivityChanged();
  }
  return result;
}

export async function markAllNotificationsRead(): Promise<
  ClassifiedsResult<MarkAllNotificationsReadResult>
> {
  const result = await request<MarkAllNotificationsReadResult>(
    "/v1/account/notifications/read-all",
    { method: "POST", body: {} },
  );
  if (result.ok) {
    invalidateRecentUnreadNotificationsCount();
    emitUnreadActivityChanged();
  }
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
