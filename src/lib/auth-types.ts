export type UserRole = "owner" | "admin" | "moderator" | "seller" | "user";

export type AccountStatus = "active" | "frozen" | "disabled" | "pending_review";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface UserProfile {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  role: UserRole;
  roles: UserRole[];
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  governorate: string | null;
  cityArea: string | null;
  bio: string | null;
  businessName: string | null;
  phone: string | null;
  whatsapp: string | null;
  preferredContactMethod: string | null;
  avatarPath: string | null;
  avatarUrl: string | null;
  coverPath: string | null;
  coverUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RolePermissions {
  canViewAdminDashboard: boolean;
  canManageOwnerControls: boolean;
  canManageAdmins: boolean;
  canModerateListings: boolean;
  canManageReports: boolean;
  canManageUsers: boolean;
  canSuspendUsers: boolean;
  canBanUsers: boolean;
  canRestoreUsers: boolean;
  canManageUserRestrictions: boolean;
  canManageReviews: boolean;
  canManageVerifications: boolean;
  canManagePromotions: boolean;
  canManageAdPlacements: boolean;
  canManageAdCampaigns: boolean;
  canCreateManagedListings: boolean;
  canPublishOfficialListings: boolean;
  canUseBulkActions: boolean;
  canManageRoles: boolean;
  canViewAuditLogs: boolean;
  canManageSystemSettings: boolean;
}

export type RolePermission = keyof RolePermissions;

export const rolePermissions: Record<UserRole, RolePermissions> = {
  owner: {
    canViewAdminDashboard: true,
    canManageOwnerControls: true,
    canManageAdmins: true,
    canModerateListings: true,
    canManageReports: true,
    canManageUsers: true,
    canSuspendUsers: true,
    canBanUsers: true,
    canRestoreUsers: true,
    canManageUserRestrictions: true,
    canManageReviews: true,
    canManageVerifications: true,
    canManagePromotions: true,
    canManageAdPlacements: true,
    canManageAdCampaigns: true,
    canCreateManagedListings: true,
    canPublishOfficialListings: true,
    canUseBulkActions: true,
    canManageRoles: true,
    canViewAuditLogs: true,
    canManageSystemSettings: true,
  },
  admin: {
    canViewAdminDashboard: true,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: true,
    canManageReports: true,
    canManageUsers: true,
    canSuspendUsers: true,
    canBanUsers: false,
    canRestoreUsers: true,
    canManageUserRestrictions: true,
    canManageReviews: true,
    canManageVerifications: true,
    canManagePromotions: true,
    canManageAdPlacements: false,
    canManageAdCampaigns: false,
    canCreateManagedListings: false,
    canPublishOfficialListings: false,
    canUseBulkActions: true,
    canManageRoles: false,
    canViewAuditLogs: true,
    canManageSystemSettings: false,
  },
  moderator: {
    canViewAdminDashboard: true,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: true,
    canManageReports: true,
    canManageUsers: false,
    canSuspendUsers: false,
    canBanUsers: false,
    canRestoreUsers: false,
    canManageUserRestrictions: false,
    canManageReviews: true,
    canManageVerifications: false,
    canManagePromotions: false,
    canManageAdPlacements: false,
    canManageAdCampaigns: false,
    canCreateManagedListings: false,
    canPublishOfficialListings: false,
    canUseBulkActions: false,
    canManageRoles: false,
    canViewAuditLogs: false,
    canManageSystemSettings: false,
  },
  seller: {
    canViewAdminDashboard: false,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: false,
    canManageReports: false,
    canManageUsers: false,
    canSuspendUsers: false,
    canBanUsers: false,
    canRestoreUsers: false,
    canManageUserRestrictions: false,
    canManageReviews: false,
    canManageVerifications: false,
    canManagePromotions: false,
    canManageAdPlacements: false,
    canManageAdCampaigns: false,
    canCreateManagedListings: false,
    canPublishOfficialListings: false,
    canUseBulkActions: false,
    canManageRoles: false,
    canViewAuditLogs: false,
    canManageSystemSettings: false,
  },
  user: {
    canViewAdminDashboard: false,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: false,
    canManageReports: false,
    canManageUsers: false,
    canSuspendUsers: false,
    canBanUsers: false,
    canRestoreUsers: false,
    canManageUserRestrictions: false,
    canManageReviews: false,
    canManageVerifications: false,
    canManagePromotions: false,
    canManageAdPlacements: false,
    canManageAdCampaigns: false,
    canCreateManagedListings: false,
    canPublishOfficialListings: false,
    canUseBulkActions: false,
    canManageRoles: false,
    canViewAuditLogs: false,
    canManageSystemSettings: false,
  },
};

export const emptyRolePermissions: RolePermissions = Object.freeze(
  Object.fromEntries(
    (Object.keys(rolePermissions.user) as RolePermission[]).map((permission) => [permission, false]),
  ) as unknown as RolePermissions,
);

export function effectiveRolePermissions(profile: UserProfile | null): RolePermissions {
  if (!profile || profile.accountStatus !== "active") return emptyRolePermissions;

  const permissions = { ...emptyRolePermissions };
  for (const role of profile.roles) {
    const roleMatrix = rolePermissions[role];
    for (const permission of Object.keys(roleMatrix) as RolePermission[]) {
      permissions[permission] ||= roleMatrix[permission];
    }
  }
  return permissions;
}

export function hasRolePermission(
  profile: UserProfile | null,
  permission: RolePermission,
): boolean {
  return effectiveRolePermissions(profile)[permission];
}

export function canAccessAdmin(profile: UserProfile | null): boolean {
  return hasRolePermission(profile, "canViewAdminDashboard");
}

export function canAccessOwnerControls(profile: UserProfile | null): boolean {
  return Boolean(
    profile?.roles.includes("owner") && hasRolePermission(profile, "canManageOwnerControls"),
  );
}

export function canPost(profile: UserProfile | null, _emailConfirmed: boolean): boolean {
  if (!profile) return false;
  if (profile.accountStatus === "disabled" || profile.accountStatus === "frozen") return false;
  return true;
}
