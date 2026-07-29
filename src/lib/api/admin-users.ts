import type { AccountStatus, UserRole, VerificationStatus } from "@/lib/auth-types";
import type { ClassifiedsResult } from "@/lib/classifieds-types";
import { isCloudflarePublicDataProvider } from "@/lib/public-data/config";
import { cloudflareApiRequest } from "@/lib/cloudflare-auth";

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

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<AdminUserSummary[]>("/v1/admin/users");
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
      message: "إدارة المستخدمين متاحة فقط في وضع Cloudflare.",
    },
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

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<null>("/v1/admin/users/status", {
      method: "POST",
      body: { userId: payload.userId, status: payload.status, reason: payload.reason },
    });
    return result.ok
      ? { ok: true, data: null }
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
      message: "إدارة الحسابات متاحة فقط في وضع Cloudflare.",
    },
  };
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

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<string>("/v1/admin/users/restrictions", {
      method: "POST",
      body: { ...payload, action: "set" },
    });
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
      message: "تقييد المستخدمين متاح فقط في وضع Cloudflare.",
    },
  };
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

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<null>("/v1/admin/users/restrictions", {
      method: "POST",
      body: { ...payload, action: "lift" },
    });
    return result.ok
      ? { ok: true, data: null }
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
      message: "رفع التقييدات متاحة فقط في وضع Cloudflare.",
    },
  };
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

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<null>("/v1/admin/users/roles", {
      method: "POST",
      body: { ...payload, action: "assign" },
    });
    return result.ok
      ? { ok: true, data: null }
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
      message: "تعيين الأدوار متاح فقط في وضع Cloudflare.",
    },
  };
}

export async function ownerRemoveStaffRole(
  canUseOwnerAccess: boolean,
  payload: { userId: string; role: "admin" | "moderator"; reason?: string | null },
): Promise<ClassifiedsResult<null>> {
  if (!canUseOwnerAccess) {
    return {
      ok: false,
      error: { code: "permission_denied", message: "إزالة صلاحية الطاقم متاحة للمالك فقط." },
    };
  }

  if (isCloudflarePublicDataProvider()) {
    const result = await cloudflareApiRequest<null>("/v1/admin/users/roles", {
      method: "POST",
      body: { ...payload, action: "remove" },
    });
    return result.ok
      ? { ok: true, data: null }
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
      message: "إزالة الأدوار متاحة فقط في وضع Cloudflare.",
    },
  };
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
    id: typeof row.id === "string" ? row.id : "",
    email: typeof row.email === "string" ? row.email : null,
    displayName: typeof row.displayName === "string" ? row.displayName : null,
    accountStatus:
      typeof row.accountStatus === "string" ? (row.accountStatus as AccountStatus) : "active",
    verificationStatus:
      typeof row.verificationStatus === "string"
        ? (row.verificationStatus as VerificationStatus)
        : "unverified",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : null,
    roles,
    listingCount: typeof row.listingCount === "number" ? row.listingCount : 0,
    reportsSubmitted: typeof row.reportsSubmitted === "number" ? row.reportsSubmitted : 0,
    reportsReceived: typeof row.reportsReceived === "number" ? row.reportsReceived : 0,
    activeRestrictions,
  };
}
