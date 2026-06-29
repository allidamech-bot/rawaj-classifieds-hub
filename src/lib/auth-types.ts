export type UserRole = "owner" | "admin" | "moderator" | "seller" | "user";

export type AccountStatus = "active" | "frozen" | "disabled" | "pending_review";

export type VerificationStatus = "unverified" | "pending" | "verified" | "rejected";

export interface UserProfile {
  id: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  governorate: string | null;
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
  return rolePermissions[profile.role].canViewAdminDashboard;
}

export function canAccessOwnerControls(profile: UserProfile | null): boolean {
  if (!profile || profile.accountStatus !== "active") return false;
  return rolePermissions[profile.role].canManageOwnerControls;
}
