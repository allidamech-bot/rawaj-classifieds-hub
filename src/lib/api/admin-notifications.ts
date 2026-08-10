import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export const ADMIN_NOTIFICATIONS_UPDATED_EVENT = "rawaj:admin-notifications-updated";

export interface AdminNotificationSummary {
  unreadTotal: number;
  byType: Record<string, number>;
}

export interface AdminNotificationItem {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  eventKey: string;
  createdAt: string;
  readAt: string | null;
}

export function notifyAdminNotificationsUpdated(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ADMIN_NOTIFICATIONS_UPDATED_EVENT));
  }
}

export async function adminFetchNotificationSummary(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<AdminNotificationSummary>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "الإشعارات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<AdminNotificationSummary>(
      "/v1/admin/notifications/summary",
    );
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: {
            code: result.code as import("@/lib/classifieds-types").ClassifiedsErrorCode,
            message: result.error,
          },
        };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "الإشعارات متاحة فقط في وضع Cloudflare.",
    },
  };
}

export async function adminFetchNotifications(
  canUseAdminAccess: boolean,
  entityType?: string,
  limit = 50,
): Promise<ClassifiedsResult<AdminNotificationItem[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "الإشعارات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const params = new URLSearchParams();
    if (entityType) params.set("entityType", entityType);
    params.set("limit", String(Math.max(1, Math.min(200, Math.trunc(limit)))));
    const result = await cloudflareApiRequest<AdminNotificationItem[]>(
      `/v1/admin/notifications?${params.toString()}`,
    );
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: {
            code: result.code as import("@/lib/classifieds-types").ClassifiedsErrorCode,
            message: result.error,
          },
        };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "الإشعارات متاحة فقط في وضع Cloudflare.",
    },
  };
}

export async function adminMarkNotificationsReadByEntity(
  canUseAdminAccess: boolean,
  entityType: string,
  entityId: string,
): Promise<ClassifiedsResult<{ markedRead: number }>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "الإشعارات متاحة لحساب إداري مخول فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<{ markedRead: number }>(
      "/v1/admin/notifications/read-by-entity",
      {
        method: "POST",
        body: { entityType, entityId },
      },
    );
    return result.ok
      ? { ok: true, data: result.data }
      : {
          ok: false,
          error: {
            code: result.code as import("@/lib/classifieds-types").ClassifiedsErrorCode,
            message: result.error,
          },
        };
  }

  return {
    ok: false,
    error: {
      code: "setup_required",
      message: "الإشعارات متاحة فقط في وضع Cloudflare.",
    },
  };
}

export async function adminMarkListedNotificationsRead(
  canUseAdminAccess: boolean,
  entityType?: string,
): Promise<ClassifiedsResult<{ markedRead: number }>> {
  const listed = await adminFetchNotifications(canUseAdminAccess, entityType, 200);
  if (!listed.ok) return listed;

  const unreadEntities = new Map<string, { entityType: string; entityId: string }>();
  for (const item of listed.data) {
    if (item.readAt) continue;
    const key = `${item.entityType}\u0000${item.entityId}`;
    if (!unreadEntities.has(key)) {
      unreadEntities.set(key, { entityType: item.entityType, entityId: item.entityId });
    }
  }

  let markedRead = 0;
  for (const entity of unreadEntities.values()) {
    const result = await adminMarkNotificationsReadByEntity(
      canUseAdminAccess,
      entity.entityType,
      entity.entityId,
    );
    if (!result.ok) return result;
    markedRead += result.data.markedRead;
  }

  if (unreadEntities.size > 0) notifyAdminNotificationsUpdated();
  return { ok: true, data: { markedRead } };
}
