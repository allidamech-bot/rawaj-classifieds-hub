import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import { NativeAppRuntime } from "@/components/native/NativeAppRuntime";
import {
  canAccessAdmin,
  canAccessOwnerControls,
  effectiveRolePermissions,
  emptyRolePermissions,
  type RolePermission,
  type UserProfile,
  type UserRole,
} from "./auth-types";
import { AuthContext, type AuthContextValue } from "./auth-context";
import type { AuthStatus } from "./auth-status";
import { sanitizeAuthReturnTo } from "./auth-return";
import { createAuthCallbackUrl, isNativeRawajApp, openExternalUrl } from "./native-runtime";
import { getSupabaseAuthUnavailableReason, isSupabaseConfigured, supabase } from "./supabase";

const rolePriority: UserRole[] = ["owner", "admin", "moderator", "seller", "user"];
const REFRESH_EARLY_SECONDS = 60;

const unavailableReason = getSupabaseAuthUnavailableReason();

const signedOutState: AuthContextValue = {
  status: "signedOut",
  user: null,
  session: null,
  profile: null,
  reason: null,
  permissions: emptyRolePermissions,
  hasPermission: () => false,
  canAccessAdmin: false,
  canAccessOwnerControls: false,
  emailConfirmed: false,
  signOut: async () => ({ error: null }),
  refreshProfile: async () => ({ error: null }),
  signInWithGoogle: async () => ({ error: null }),
};

function normalizeRoles(roles: string[] | null | undefined): UserRole[] {
  const knownRoles = new Set<UserRole>(rolePriority);
  const normalized = (roles ?? []).filter((role): role is UserRole =>
    knownRoles.has(role as UserRole),
  );

  return normalized.length > 0 ? normalized : ["user"];
}

function primaryRole(roles: UserRole[]): UserRole {
  return rolePriority.find((role) => roles.includes(role)) ?? "user";
}

function isRejectedRefreshTokenError(error: { message?: string; status?: number }): boolean {
  if (error.status !== 400) return false;
  return (error.message ?? "").toLowerCase().includes("refresh token");
}

async function fetchProfile(client: SupabaseClient, user: User): Promise<UserProfile> {
  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .select(
      "id,email,first_name,last_name,display_name,account_status,verification_status,governorate,city_area,bio,business_name,phone,whatsapp,preferred_contact_method,avatar_path,avatar_url,cover_path,cover_url,created_at,updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  let profile = profileData;

  if (!profileData) {
    const metadataName =
      typeof user.user_metadata?.display_name === "string"
        ? user.user_metadata.display_name
        : typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : (user.email?.split("@")[0] ?? "user");

    const { error: upsertError } = await client.from("profiles").upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name: metadataName,
      },
      { onConflict: "id", ignoreDuplicates: false },
    );

    if (upsertError && upsertError.code !== "23505") {
      throw new Error(upsertError.message);
    }

    const { data: bootstrappedProfile, error: bootstrapReadError } = await client
      .from("profiles")
      .select(
        "id,email,first_name,last_name,display_name,account_status,verification_status,governorate,city_area,bio,business_name,phone,whatsapp,preferred_contact_method,avatar_path,avatar_url,cover_path,cover_url,created_at,updated_at",
      )
      .eq("id", user.id)
      .maybeSingle();

    if (bootstrapReadError) {
      throw new Error(bootstrapReadError.message);
    }

    profile = bootstrappedProfile;
  }

  const { data: roleData, error: roleError } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  if (roleError) {
    throw new Error(roleError.message);
  }

  const roles = normalizeRoles(roleData?.map((row) => row.role));
  const role = primaryRole(roles);

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    displayName: profile?.display_name ?? null,
    role,
    roles,
    accountStatus: profile?.account_status ?? "pending_review",
    verificationStatus: profile?.verification_status ?? "unverified",
    governorate: profile?.governorate ?? null,
    cityArea: profile?.city_area ?? null,
    bio: profile?.bio ?? null,
    businessName: profile?.business_name ?? null,
    phone: profile?.phone ?? null,
    whatsapp: profile?.whatsapp ?? null,
    preferredContactMethod: profile?.preferred_contact_method ?? null,
    avatarPath: profile?.avatar_path ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    coverPath: profile?.cover_path ?? null,
    coverUrl: profile?.cover_url ?? null,
    createdAt: profile?.created_at ?? null,
    updatedAt: profile?.updated_at ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "authUnavailable",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState<string | null>(unavailableReason);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setStatus("authUnavailable");
      setSession(null);
      setProfile(null);
      setReason(unavailableReason);
      return;
    }

    const authClient = client;
    let active = true;
    let currentUserId: string | null = null;
    let reconcilePromise: Promise<void> | null = null;

    async function loadProfile(client: SupabaseClient, user: User | null) {
      if (!user) {
        currentUserId = null;
        setProfile(null);
        setReason(null);
        return;
      }

      try {
        const nextProfile = await fetchProfile(client, user);
        if (!active) return;
        currentUserId = user.id;
        setProfile(nextProfile);
        setReason(null);
        setStatus("signedIn");
      } catch (error) {
        if (!active) return;
        currentUserId = null;
        setProfile(null);
        setStatus("authError");
        setReason(error instanceof Error ? error.message : "تعذّر تحميل بيانات الحساب.");
      }
    }

    async function clearRejectedSession(client: SupabaseClient): Promise<boolean> {
      const { error: clearError } = await client.auth.signOut({ scope: "local" });
      if (!active || clearError) return false;
      currentUserId = null;
      setSession(null);
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return true;
    }

    async function applySession(nextSession: Session | null) {
      if (!active) return;
      setSession(nextSession);
      setStatus(nextSession ? "signedIn" : "signedOut");
      const nextUserId = nextSession?.user.id ?? null;
      if (nextUserId !== currentUserId) {
        await loadProfile(authClient, nextSession?.user ?? null);
      }
    }

    async function loadSession() {
      const { data, error } = await authClient.auth.getSession();
      if (!active) return;

      if (error) {
        if (isRejectedRefreshTokenError(error) && (await clearRejectedSession(authClient))) return;
        setSession(null);
        setProfile(null);
        setStatus("authError");
        setReason(error.message);
        return;
      }

      await applySession(data.session);
    }

    async function reconcileForegroundSession() {
      if (!active || document.visibilityState === "hidden" || reconcilePromise) return;

      reconcilePromise = (async () => {
        const { data, error } = await authClient.auth.getSession();
        if (!active) return;

        if (error) {
          if (isRejectedRefreshTokenError(error) && (await clearRejectedSession(authClient))) {
            return;
          }
          setStatus("authError");
          setReason(error.message);
          return;
        }

        let nextSession = data.session;
        const expiresSoon =
          nextSession?.expires_at !== undefined &&
          nextSession.expires_at <= Math.floor(Date.now() / 1000) + REFRESH_EARLY_SECONDS;

        if (expiresSoon) {
          const { data: refreshed, error: refreshError } = await authClient.auth.refreshSession();
          if (!active) return;
          if (refreshError) {
            if (
              isRejectedRefreshTokenError(refreshError) &&
              (await clearRejectedSession(authClient))
            ) {
              return;
            }
            setStatus("authError");
            setReason(refreshError.message);
            return;
          }
          nextSession = refreshed.session;
        }

        await applySession(nextSession);
      })().finally(() => {
        reconcilePromise = null;
      });

      await reconcilePromise;
    }

    void loadSession();

    const { data: listener } = authClient.auth.onAuthStateChange((_event, nextSession) => {
      void applySession(nextSession);
    });
    const handleForeground = () => void reconcileForegroundSession();
    document.addEventListener("visibilitychange", handleForeground);
    window.addEventListener("focus", handleForeground);

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      document.removeEventListener("visibilitychange", handleForeground);
      window.removeEventListener("focus", handleForeground);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const signOut = async () => {
      const client = supabase;

      if (!client) {
        return { error: unavailableReason };
      }

      const { error } = await client.auth.signOut();
      if (error) return { error: error.message };

      setSession(null);
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return { error: null };
    };

    const refreshProfile = async () => {
      const client = supabase;
      const user = session?.user ?? null;
      if (!client || !user) {
        return { error: unavailableReason ?? "يجب تسجيل الدخول لتحديث بيانات الحساب." };
      }

      try {
        const nextProfile = await fetchProfile(client, user);
        setProfile(nextProfile);
        setReason(null);
        setStatus("signedIn");
        return { error: null };
      } catch (error) {
        const message = error instanceof Error ? error.message : "تعذّر تحديث بيانات الحساب.";
        setReason(message);
        return { error: message };
      }
    };

    const signInWithGoogle = async (returnTo?: string) => {
      const client = supabase;
      if (!client) {
        return { error: unavailableReason ?? "Auth unavailable" };
      }

      const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
      const native = isNativeRawajApp();
      const callbackUrl = createAuthCallbackUrl(safeReturnTo);

      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          skipBrowserRedirect: native,
        },
      });

      if (error) return { error: error.message };
      if (!native) return { error: null };
      if (!data.url) return { error: "تعذر تجهيز رابط تسجيل الدخول باستخدام Google." };

      try {
        await openExternalUrl(data.url);
        return { error: null };
      } catch (openError) {
        return {
          error:
            openError instanceof Error
              ? openError.message
              : "تعذر فتح متصفح تسجيل الدخول باستخدام Google.",
        };
      }
    };

    const permissions = effectiveRolePermissions(profile);
    const hasPermission = (permission: RolePermission) => permissions[permission];

    if (!isSupabaseConfigured) {
      return {
        ...signedOutState,
        status: "authUnavailable",
        reason: unavailableReason,
        emailConfirmed: false,
        signOut,
        refreshProfile,
        signInWithGoogle,
      };
    }

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
      emailConfirmed: Boolean(session?.user?.email_confirmed_at),
      signOut,
      refreshProfile,
      signInWithGoogle,
    };
  }, [profile, reason, session, status]);

  return (
    <AuthContext.Provider value={value}>
      <NativeAppRuntime />
      {children}
    </AuthContext.Provider>
  );
}
