import type { ClassifiedsResult } from "@/lib/classifieds-types";
import type { UserRole } from "@/lib/auth-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

export interface AdminCommandCenterMetrics {
  totalUsers: number;
  activeUsers: number;
  frozenUsers: number;
  disabledUsers: number;
  pendingListings: number;
  openListingReports: number;
  openMessageReports: number;
  pendingVerifications: number;
  pendingPromotions: number;
  activeRestrictions: number;
  adminCount: number;
  moderatorCount: number;
}

export interface AdminAuditLogEntry {
  id: string;
  actorId: string | null;
  actorRole: UserRole | null;
  action: string;
  targetTable: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string | null;
}

export async function adminFetchCommandCenterMetrics(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<AdminCommandCenterMetrics>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "مؤشرات التشغيل متاحة لحساب إداري مخول فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<AdminCommandCenterMetrics>("/v1/admin/metrics");
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
      message: "مؤشرات التشغيل متاحة فقط في وضع Cloudflare.",
    },
  };
}

export async function adminFetchAuditLogs(
  canUseAdminAccess: boolean,
  options: { limit?: number; offset?: number; actionPrefix?: string | null } = {},
): Promise<ClassifiedsResult<AdminAuditLogEntry[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "سجل التدقيق متاح لحساب إداري مخول فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const params = new URLSearchParams();
    params.set("limit", String(options.limit ?? 50));
    const result = await cloudflareApiRequest<AdminAuditLogEntry[]>(
      `/v1/admin/audit?${params.toString()}`,
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
      message: "سجل التدقيق متاح فقط في وضع Cloudflare.",
    },
  };
}
