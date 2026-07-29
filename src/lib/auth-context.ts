import { createContext } from "react";
import type { RolePermission, RolePermissions, UserProfile } from "./auth-types";
import type { AuthStatus } from "./auth-status";

export interface AuthUser {
  id: string;
  uid: string;
  email: string | null;
  email_confirmed_at: string | null;
  user_metadata: {
    display_name?: string;
    full_name?: string;
    avatar_url?: string;
    picture?: string;
  };
}

export interface AuthSession {
  access_token: string;
  user: AuthUser;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
  profile: UserProfile | null;
  reason: string | null;
  permissions: RolePermissions;
  hasPermission: (permission: RolePermission) => boolean;
  canAccessAdmin: boolean;
  canAccessOwnerControls: boolean;
  signOut: () => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<{ error: string | null }>;
  signInWithGoogle: (returnTo?: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null }>;
  requestPasswordReset: (
    email: string,
  ) => Promise<{ error: string | null; developmentToken?: string }>;
  emailConfirmed: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
