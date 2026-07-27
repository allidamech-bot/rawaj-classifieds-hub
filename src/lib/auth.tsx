import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import {
  getSupabaseAuthUnavailableReason,
  isSupabaseAuthConfigured,
  supabaseAuth,
} from "./supabase-auth";

const unavailableReason = getSupabaseAuthUnavailableReason();

function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "تعذر إكمال عملية الحساب.";
  const source = error as { message?: unknown };
  return typeof source.message === "string" && source.message.trim()
    ? source.message
    : "تعذر إكمال عملية الحساب.";
}

function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseAuthConfigured ? "loading" : "authUnavailable",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState<string | null>(unavailableReason);
  const loadRequestIdRef = useRef(0);
  const profileLoadRef = useRef<{
    userId: string;
    promise: Promise<UserProfile>;
  } | null>(null);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const requestId = ++loadRequestIdRef.current;
    if (!nextSession) {
      profileLoadRef.current = null;
      setSession(null);
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return { error: null };
    }

    setSession(nextSession);
    setProfile(null);
    setStatus("loading");
    setReason(null);

    try {
      const user = nextSession.user;
      const existingProfileLoad = profileLoadRef.current;
      const profilePromise =
        existingProfileLoad?.userId === user.id
          ? existingProfileLoad.promise
          : loadCloudflareUserProfile(user);
      profileLoadRef.current = { userId: user.id, promise: profilePromise };
      const nextProfile = await profilePromise;
      if (profileLoadRef.current?.promise === profilePromise) {
        profileLoadRef.current = null;
      }
      if (requestId !== loadRequestIdRef.current) return { error: null };
      setProfile(nextProfile);
      setStatus("signedIn");
      return { error: null };
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return { error: null };
      const message = authErrorMessage(error);
      setProfile(null);
      setStatus("authError");
      setReason(message);
      return { error: message };
    }
  }, []);

  const load = useCallback(async () => {
    const client = supabaseAuth;
    if (!client) return { error: unavailableReason ?? "Auth unavailable" };
    const { data, error } = await client.auth.getSession();
    if (error) return { error: error.message };
    return applySession(data.session);
  }, [applySession]);

  useEffect(() => {
    const client = supabaseAuth;
    if (!client) return;

    let active = true;
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setStatus("authError");
        setReason(error.message);
        return;
      }
      void applySession(data.session);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        if (active) void applySession(nextSession);
      });
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo<AuthContextValue>(() => {
    const signOut = async () => {
      loadRequestIdRef.current += 1;
      profileLoadRef.current = null;
      const localNotificationCleanup = clearLocalNativePushState();
      const client = supabaseAuth;
      if (!client) {
        await localNotificationCleanup.catch(() => undefined);
        return { error: unavailableReason ?? "Auth unavailable" };
      }

      const { error } = await client.auth.signOut();
      await localNotificationCleanup.catch(() => undefined);
      if (error) return { error: error.message };

      setSession(null);
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return { error: null };
    };

    const signInWithPassword = async (email: string, password: string) => {
      const client = supabaseAuth;
      if (!client) return { error: unavailableReason ?? "Auth unavailable" };
      const { data, error } = await client.auth.signInWithPassword({
        email: normalizeAuthEmail(email),
        password,
      });
      if (error) return { error: error.message };
      return applySession(data.session);
    };

    const signUpWithPassword = async (email: string, password: string, displayName: string) => {
      const client = supabaseAuth;
      if (!client) return { error: unavailableReason ?? "Auth unavailable" };
      const cleanDisplayName = displayName.trim();
      const { data, error } = await client.auth.signUp({
        email: normalizeAuthEmail(email),
        password,
        options: {
          data: {
            display_name: cleanDisplayName,
            full_name: cleanDisplayName,
          },
        },
      });
      if (error) return { error: error.message };
      if (!data.session) {
        return {
          error:
            "تم إنشاء الحساب، لكن جلسة الدخول لم تبدأ. تحقق من إعدادات تأكيد البريد في Supabase ثم سجل الدخول.",
        };
      }
      return applySession(data.session);
    };

    const requestPasswordReset = async (email: string) => {
      const client = supabaseAuth;
      if (!client) return { error: unavailableReason ?? "Auth unavailable" };
      const origin = typeof window === "undefined" ? "https://rawa-j.com" : window.location.origin;
      const { error } = await client.auth.resetPasswordForEmail(normalizeAuthEmail(email), {
        redirectTo: `${origin}/reset-password`,
      });
      return { error: error?.message ?? null };
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
        const client = supabaseAuth;
        if (!client) return { error: unavailableReason ?? "Auth unavailable" };
        const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
        const callbackUrl = new URL("/auth/callback", window.location.origin);
        callbackUrl.searchParams.set("returnTo", safeReturnTo);
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: callbackUrl.toString() },
        });
        return { error: error?.message ?? null };
      },
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
    };
  }, [applySession, load, profile, reason, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
