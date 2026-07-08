import type { AccountStatus, UserRole, VerificationStatus } from "@/lib/auth-types";
import { getClient, mapError, rowNullableString, rowNumber, rowString } from "@/lib/api/shared";
import type { ClassifiedsResult } from "@/lib/classifieds-types";

export type UserRestrictionType = "posting" | "messaging" | "reviews" | "promotions" | "uploads";

export interface AdminUserSummary {
  id: string;
  email: string | null;
  displayName: string | null;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  createdAt: string | null;
  roles: UserRole[];
  listingCount: number;
  reportsSubmitted: number;
  reportsReceived: number;
  activeRestrictions: UserRestrictionType[];
}

export async function adminFetchUsers(
  canUseAdminAccess: boolean,
): Promise<ClassifiedsResult<AdminUserSummary[]>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "إدارة المستخدمين متاحة لحساب إداري مخول فقط.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_admin_fetch_users");
  if (error) return { ok: false, error: mapError(error) };

  return {
    ok: true,
    data: ((data ?? []) as Record<string, unknown>[]).map(mapAdminUserSummary),
  };
}

export async function adminManageUserAccount(
  canUseAdminAccess: boolean,
  payload: { userId: string; status: AccountStatus; reason: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا تملك صلاحية إدارة حالة الحساب." },
    };
  }

  if (!payload.userId.trim() || payload.reason.trim().length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر المستخدم وأدخل سبباً واضحاً." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_manage_user_account", {
    p_user_id: payload.userId,
    p_status: payload.status,
    p_reason: payload.reason.trim(),
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function adminSetUserRestriction(
  canUseAdminAccess: boolean,
  payload: {
    userId: string;
    restrictionType: UserRestrictionType;
    reason: string;
    endsAt?: string | null;
  },
): Promise<ClassifiedsResult<string>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا تملك صلاحية تقييد المستخدم." },
    };
  }

  if (!payload.userId.trim() || payload.reason.trim().length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر المستخدم وأدخل سبباً واضحاً." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc("rawaj_set_user_restriction", {
    p_user_id: payload.userId,
    p_restriction_type: payload.restrictionType,
    p_reason: payload.reason.trim(),
    p_ends_at: payload.endsAt || null,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: typeof data === "string" ? data : String(data) };
}

export async function adminLiftUserRestriction(
  canUseAdminAccess: boolean,
  payload: { userId: string; restrictionType: UserRestrictionType; reason: string },
): Promise<ClassifiedsResult<null>> {
  if (!canUseAdminAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "لا تملك صلاحية رفع تقييد المستخدم." },
    };
  }

  if (!payload.userId.trim() || payload.reason.trim().length < 3) {
    return {
      ok: false,
      error: { code: "validation_error", message: "اختر المستخدم وأدخل سبباً واضحاً." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_lift_user_restriction", {
    p_user_id: payload.userId,
    p_restriction_type: payload.restrictionType,
    p_reason: payload.reason.trim(),
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function ownerAssignStaffRole(
  canUseOwnerAccess: boolean,
  payload: { userId: string; role: "admin" | "moderator"; note?: string | null },
): Promise<ClassifiedsResult<null>> {
  if (!canUseOwnerAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "تعيين الطاقم متاح للمالك فقط." },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_owner_assign_staff_role", {
    p_user_id: payload.userId,
    p_role: payload.role,
    p_note: payload.note?.trim() || null,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

export async function ownerRemoveStaffRole(
  canUseOwnerAccess: boolean,
  payload: { userId: string; role: "admin" | "moderator"; reason?: string | null },
): Promise<ClassifiedsResult<null>> {
  if (!canUseOwnerAccess) {
    return {
      ok: false,
      error: {
        code: "permission_denied",
        message: "إزالة صلاحية الطاقم متاحة للمالك فقط.",
      },
    };
  }

  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc("rawaj_owner_remove_staff_role", {
    p_user_id: payload.userId,
    p_role: payload.role,
    p_reason: payload.reason?.trim() || null,
  });

  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, data: null };
}

function mapAdminUserSummary(row: Record<string, unknown>): AdminUserSummary {
  const roles = Array.isArray(row.roles)
    ? row.roles.filter((value): value is UserRole => typeof value === "string")
    : [];
  const activeRestrictions = Array.isArray(row.active_restrictions)
    ? row.active_restrictions.filter(
        (value): value is UserRestrictionType => typeof value === "string",
      )
    : [];

  return {
    id: rowString(row, "id"),
    email: rowNullableString(row, "email"),
    displayName: rowNullableString(row, "display_name"),
    accountStatus: rowString(row, "account_status", "pending_review") as AccountStatus,
    verificationStatus: rowString(row, "verification_status", "unverified") as VerificationStatus,
    createdAt: rowNullableString(row, "created_at"),
    roles,
    listingCount: rowNumber(row, "listing_count"),
    reportsSubmitted: rowNumber(row, "reports_submitted"),
    reportsReceived: rowNumber(row, "reports_received"),
    activeRestrictions,
  };
}
