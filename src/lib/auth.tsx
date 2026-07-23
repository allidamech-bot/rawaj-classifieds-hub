import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  canAccessAdmin,
  canAccessOwnerControls,
  effectiveRolePermissions,
  emptyRolePermissions,
  type RolePermission,
  type UserProfile,
} from "./auth-types";
import { AuthContext, type AuthContextValue } from "./auth-context";
import type { AuthStatus } from "./auth-status";
import {
  authLogin,
  authLogout,
  authRequestPasswordReset,
  authSession,
  authSignup,
  loadCloudflareUserProfile,
  type CloudflareSession,
} from "./cloudflare-auth";

function compatibilityUser(session: CloudflareSession): User {
  return {
    id: session.user.id,
    email: session.user.email,
    email_confirmed_at: session.user.emailConfirmed ? new Date(0).toISOString() : undefined,
    app_metadata: {},
    user_metadata: { display_name: session.profile.displayName },
    aud: "authenticated",
    created_at: "",
  } as User;
}

function compatibilitySession(session: CloudflareSession): Session {
  return {
    access_token: "cookie-session",
    refresh_token: "",
    expires_in: 0,
    token_type: "bearer",
    user: compatibilityUser(session),
  } as Session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<CloudflareSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await authSession();
      setSession(next);
      setProfile(next ? await loadCloudflareUserProfile(next) : null);
      setStatus(next ? "signedIn" : "signedOut");
      setReason(null);
      return { error: null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر تحميل بيانات الحساب.";
      setSession(null);
      setProfile(null);
      setStatus("authError");
      setReason(message);
      return { error: message };
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AuthContextValue>(() => {
    const signOut = async () => {
      const result = await authLogout();
      if (!result.ok) return { error: result.error };
      setSession(null);
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return { error: null };
    };
    const signInWithPassword = async (email: string, password: string) => {
      const result = await authLogin(email, password);
      if (!result.ok) return { error: result.error };
      await load();
      return { error: null };
    };
    const signUpWithPassword = async (email: string, password: string, displayName: string) => {
      const result = await authSignup(email, password, displayName);
      if (!result.ok) return { error: result.error };
      await load();
      return {
        error: null,
        requiresEmailConfirmation: result.data.accepted === true && !result.data.session,
      };
    };
    const requestPasswordReset = async (email: string) => {
      const result = await authRequestPasswordReset(email);
      return result.ok
        ? { error: null, developmentToken: result.data.developmentToken }
        : { error: result.error };
    };
    const permissions = profile ? effectiveRolePermissions(profile) : emptyRolePermissions;
    const hasPermission = (permission: RolePermission) => permissions[permission];
    return {
      status,
      user: session ? compatibilityUser(session) : null,
      session: session ? compatibilitySession(session) : null,
      profile,
      reason,
      permissions,
      hasPermission,
      canAccessAdmin: canAccessAdmin(profile),
      canAccessOwnerControls: canAccessOwnerControls(profile),
      emailConfirmed: Boolean(session?.user.emailConfirmed),
      signOut,
      refreshProfile: load,
      signInWithGoogle: async () => ({ error: "تسجيل Google غير متاح بعد في خدمة Cloudflare." }),
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
    };
  }, [load, profile, reason, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
