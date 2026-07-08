import { getClient, mapError, rowNullableString, rowNumber, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import type { UserRole } from "@/lib/auth-types";

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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_admin_command_center_metrics");
  if (error) return { ok: false, error: mapError(error) };

  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : null;
  if (!row) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "تعذر تحميل مؤشرات مركز القيادة." },
    };
  }

  return {
    ok: true,
    data: {
      totalUsers: rowNumber(row, "total_users"),
      activeUsers: rowNumber(row, "active_users"),
      frozenUsers: rowNumber(row, "frozen_users"),
      disabledUsers: rowNumber(row, "disabled_users"),
      pendingListings: rowNumber(row, "pending_listings"),
      openListingReports: rowNumber(row, "open_listing_reports"),
      openMessageReports: rowNumber(row, "open_message_reports"),
      pendingVerifications: rowNumber(row, "pending_verifications"),
      pendingPromotions: rowNumber(row, "pending_promotions"),
      activeRestrictions: rowNumber(row, "active_restrictions"),
      adminCount: rowNumber(row, "admin_count"),
      moderatorCount: rowNumber(row, "moderator_count"),
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

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_admin_fetch_audit_logs", {
    p_limit: options.limit ?? 50,
    p_offset: options.offset ?? 0,
    p_action_prefix: options.actionPrefix?.trim() || null,
  });

  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      id: rowString(row, "id"),
      actorId: rowNullableString(row, "actor_id"),
      actorRole: (rowNullableString(row, "actor_role") as UserRole | null) ?? null,
      action: rowString(row, "action"),
      targetTable: rowNullableString(row, "target_table"),
      targetId: rowNullableString(row, "target_id"),
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : {},
      createdAt: rowNullableString(row, "created_at"),
    })),
  };
}
