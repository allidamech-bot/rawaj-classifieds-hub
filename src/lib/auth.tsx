import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import {
  canAccessAdmin,
  canAccessOwnerControls,
  type UserProfile,
  type UserRole,
} from "./auth-types";
import { getSupabaseAuthUnavailableReason, isSupabaseConfigured, supabase } from "./supabase";

export type AuthStatus = "loading" | "signedOut" | "signedIn" | "authUnavailable";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  reason: string | null;
  canAccessAdmin: boolean;
  canAccessOwnerControls: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const signedOutState: AuthContextValue = {
  status: "signedOut",
  user: null,
  session: null,
  profile: null,
  reason: null,
  canAccessAdmin: false,
  canAccessOwnerControls: false,
};

async function fetchProfile(client: SupabaseClient, user: User): Promise<UserProfile> {
  const { data } = await client
    .from("profiles")
    .select(
      "id,email,display_name,account_status,verification_status,governorate,created_at,updated_at,user_roles(role)",
    )
    .eq("id", user.id)
    .maybeSingle();

  const roleRows = Array.isArray(data?.user_roles) ? data.user_roles : [];
  const role = (roleRows[0]?.role ?? "user") as UserRole;

  return {
    id: user.id,
    email: data?.email ?? user.email ?? null,
    displayName: data?.display_name ?? null,
    role,
    accountStatus: data?.account_status ?? "pending_review",
    verificationStatus: data?.verification_status ?? "unverified",
    governorate: data?.governorate ?? null,
    createdAt: data?.created_at ?? null,
    updatedAt: data?.updated_at ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured ? "loading" : "authUnavailable",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const client = supabase;

    if (!client) {
      setStatus("authUnavailable");
      setSession(null);
      setProfile(null);
      return;
    }

    let active = true;

    async function loadSession(client: SupabaseClient) {
      const { data } = await client.auth.getSession();
      if (!active) return;
      setSession(data.session);
      setStatus(data.session ? "signedIn" : "signedOut");
      await loadProfile(client, data.session?.user ?? null);
    }

    async function loadProfile(client: SupabaseClient, user: User | null) {
      if (!user) {
        setProfile(null);
        return;
      }

      const nextProfile = await fetchProfile(client, user);
      if (!active) return;
      setProfile(nextProfile);
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
    if (!isSupabaseConfigured) {
      return {
        ...signedOutState,
        status: "authUnavailable",
        reason: getSupabaseAuthUnavailableReason(),
      };
    }

    return {
      status,
      user: session?.user ?? null,
      session,
      profile,
      reason: null,
      canAccessAdmin: canAccessAdmin(profile),
      canAccessOwnerControls: canAccessOwnerControls(profile),
    };
  }, [profile, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
