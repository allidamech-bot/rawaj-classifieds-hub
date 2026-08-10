import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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
    const result = await cloudflareApiRequest<AdminNotificationItem[]>(
      `/v1/admin/notifications${params.toString() ? `?${params.toString()}` : ""}`,
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
