import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  canAccessAdmin,
  canAccessOwnerControls,
  type UserProfile,
  type UserRole,
} from "./auth-types";
import { AuthContext, type AuthContextValue } from "./auth-context";
import type { AuthStatus } from "./auth-status";
import { getSupabaseAuthUnavailableReason, isSupabaseConfigured, supabase } from "./supabase";

const rolePriority: UserRole[] = ["owner", "admin", "moderator", "seller", "user"];

const unavailableReason = getSupabaseAuthUnavailableReason();

const signedOutState: AuthContextValue = {
  status: "signedOut",
  user: null,
  session: null,
  profile: null,
  reason: null,
  canAccessAdmin: false,
  canAccessOwnerControls: false,
  emailConfirmed: false,
  signOut: async () => ({ error: null }),
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

async function fetchProfile(client: SupabaseClient, user: User): Promise<UserProfile> {
  const { data: profileData, error: profileError } = await client
    .from("profiles")
    .select(
      "id,email,display_name,account_status,verification_status,governorate,created_at,updated_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
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
    email: profileData?.email ?? user.email ?? null,
    displayName: profileData?.display_name ?? null,
    role,
    roles,
    accountStatus: profileData?.account_status ?? "pending_review",
    verificationStatus: profileData?.verification_status ?? "unverified",
    governorate: profileData?.governorate ?? null,
    createdAt: profileData?.created_at ?? null,
    updatedAt: profileData?.updated_at ?? null,
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

    let active = true;

    async function loadProfile(client: SupabaseClient, user: User | null) {
      if (!user) {
        setProfile(null);
        setReason(null);
        return;
      }

      try {
        const nextProfile = await fetchProfile(client, user);
        if (!active) return;
        setProfile(nextProfile);
        setReason(null);
        setStatus("signedIn");
      } catch (error) {
        if (!active) return;
        setProfile(null);
        setStatus("authError");
        setReason(error instanceof Error ? error.message : "تعذّر تحميل بيانات الحساب.");
      }
    }

    async function loadSession(client: SupabaseClient) {
      const { data, error } = await client.auth.getSession();
      if (!active) return;

      if (error) {
        setSession(null);
        setProfile(null);
        setStatus("authError");
        setReason(error.message);
        return;
      }

      setSession(data.session);
      setStatus(data.session ? "signedIn" : "signedOut");
      await loadProfile(client, data.session?.user ?? null);
    }

    loadSession(client);

    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setStatus(nextSession ? "signedIn" : "signedOut");
      loadProfile(client, nextSession?.user ?? null);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
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

    if (!isSupabaseConfigured) {
      return {
        ...signedOutState,
        status: "authUnavailable",
        reason: unavailableReason,
        emailConfirmed: false,
        signOut,
      };
    }

    return {
      status,
      user: session?.user ?? null,
      session,
      profile,
      reason,
      canAccessAdmin: canAccessAdmin(profile),
      canAccessOwnerControls: canAccessOwnerControls(profile),
      emailConfirmed: Boolean(session?.user?.email_confirmed_at),
      signOut,
    };
  }, [profile, reason, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
