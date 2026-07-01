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
  canViewAuditLogs: boolean;
}

export const rolePermissions: Record<UserRole, RolePermissions> = {
  owner: {
    canViewAdminDashboard: true,
    canManageOwnerControls: true,
    canManageAdmins: true,
    canModerateListings: true,
    canManageReports: true,
    canManageUsers: true,
    canViewAuditLogs: true,
  },
  admin: {
    canViewAdminDashboard: true,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: true,
    canManageReports: true,
    canManageUsers: true,
    canViewAuditLogs: true,
  },
  moderator: {
    canViewAdminDashboard: true,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: true,
    canManageReports: true,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
  seller: {
    canViewAdminDashboard: false,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: false,
    canManageReports: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
  user: {
    canViewAdminDashboard: false,
    canManageOwnerControls: false,
    canManageAdmins: false,
    canModerateListings: false,
    canManageReports: false,
    canManageUsers: false,
    canViewAuditLogs: false,
  },
};

export function canAccessAdmin(profile: UserProfile | null): boolean {
  if (!profile || profile.accountStatus !== "active") return false;
  return profile.roles.some((role) => rolePermissions[role].canViewAdminDashboard);
}

export function canAccessOwnerControls(profile: UserProfile | null): boolean {
  if (!profile || profile.accountStatus !== "active") return false;
  return profile.roles.includes("owner") && rolePermissions.owner.canManageOwnerControls;
}

export function canPost(profile: UserProfile | null, _emailConfirmed: boolean): boolean {
  if (!profile) return false;
  if (profile.accountStatus === "disabled" || profile.accountStatus === "frozen") return false;
  return true;
}
