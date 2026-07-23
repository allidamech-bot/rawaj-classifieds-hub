import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { RolePermission, RolePermissions, UserProfile } from "./auth-types";
import type { AuthStatus } from "./auth-status";

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
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
  ) => Promise<{ error: string | null; requiresEmailConfirmation?: boolean }>;
  requestPasswordReset: (
    email: string,
  ) => Promise<{ error: string | null; developmentToken?: string }>;
  emailConfirmed: boolean;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
