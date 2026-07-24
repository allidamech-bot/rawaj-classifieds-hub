import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
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
import { sanitizeAuthReturnTo } from "./auth-return";
import { loadCloudflareUserProfile } from "./cloudflare-auth";
import { clearLocalNativePushState } from "./native-push";
import { getSupabaseAuthUnavailableReason, supabase } from "./supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const requestId = ++loadRequestIdRef.current;
    setSession(nextSession);
    if (!nextSession) {
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return { error: null };
    }
    try {
      const nextProfile = await loadCloudflareUserProfile(nextSession.user);
      if (requestId !== loadRequestIdRef.current) return { error: null };
      setProfile(nextProfile);
      setStatus("signedIn");
      setReason(null);
      return { error: null };
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return { error: null };
      const message = error instanceof Error ? error.message : "تعذر تحميل بيانات الحساب.";
      setProfile(null);
      setStatus("authError");
      setReason(message);
      return { error: message };
    }
  }, []);

  const load = useCallback(async () => {
    if (!supabase) {
      const message = getSupabaseAuthUnavailableReason() ?? "خدمة الحسابات غير متاحة.";
      setStatus("authError");
      setReason(message);
      return { error: message };
    }
    const result = await supabase.auth.getSession();
    if (result.error) {
      setStatus("authError");
      setReason(result.error.message);
      return { error: result.error.message };
    }
    return applySession(result.data.session);
  }, [applySession]);

  useEffect(() => {
    if (!supabase) {
      void load();
      return;
    }
    void load();
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => void applySession(nextSession));
    });
    return () => data.subscription.unsubscribe();
  }, [applySession, load]);

  const value = useMemo<AuthContextValue>(() => {
    const signOut = async () => {
      if (!supabase) return { error: getSupabaseAuthUnavailableReason() };
      loadRequestIdRef.current += 1;
      const localNotificationCleanup = clearLocalNativePushState();
      const result = await supabase.auth.signOut();
      await localNotificationCleanup;
      if (result.error) return { error: result.error.message };
      setSession(null);
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return { error: null };
    };
    const signInWithPassword = async (email: string, password: string) => {
      if (!supabase) return { error: getSupabaseAuthUnavailableReason() };
      const result = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) return { error: result.error.message };
      await applySession(result.data.session);
      return { error: null };
    };
    const signUpWithPassword = async (email: string, password: string, displayName: string) => {
      if (!supabase) return { error: getSupabaseAuthUnavailableReason() };
      const result = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (result.error) return { error: result.error.message };
      if (result.data.session) await applySession(result.data.session);
      return { error: null };
    };
    const requestPasswordReset = async (email: string) => {
      if (!supabase) return { error: getSupabaseAuthUnavailableReason() };
      const redirectTo =
        typeof window === "undefined"
          ? "https://rawa-j.com/auth/callback?type=recovery"
          : `${window.location.origin}/auth/callback?type=recovery`;
      const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      return { error: result.error?.message ?? null };
    };
    const permissions = profile ? effectiveRolePermissions(profile) : emptyRolePermissions;
    const hasPermission = (permission: RolePermission) => permissions[permission];
    return {
      status,
      user: session?.user ?? null,
      session,
      profile,
      reason,
      permissions,
      hasPermission,
      canAccessAdmin: canAccessAdmin(profile),
      canAccessOwnerControls: canAccessOwnerControls(profile),
      emailConfirmed: Boolean(session?.user.email_confirmed_at),
      signOut,
      refreshProfile: load,
      signInWithGoogle: async (returnTo) => {
        if (!supabase) return { error: getSupabaseAuthUnavailableReason() };
        const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
        const origin = typeof window === "undefined" ? "https://rawa-j.com" : window.location.origin;
        const redirectTo = `${origin}/auth/callback?returnTo=${encodeURIComponent(safeReturnTo)}`;
        const result = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        return { error: result.error?.message ?? null };
      },
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
    };
  }, [applySession, load, profile, reason, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
