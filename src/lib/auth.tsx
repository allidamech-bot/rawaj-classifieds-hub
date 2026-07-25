import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  canAccessAdmin,
  canAccessOwnerControls,
  effectiveRolePermissions,
  emptyRolePermissions,
  type RolePermission,
  type UserProfile,
} from "./auth-types";
import {
  AuthContext,
  type AuthContextValue,
  type AuthSession,
  type AuthUser,
} from "./auth-context";
import type { AuthStatus } from "./auth-status";
import { sanitizeAuthReturnTo } from "./auth-return";
import { loadCloudflareUserProfile } from "./cloudflare-auth";
import { firebaseAuth } from "./firebase";
import { clearLocalNativePushState } from "./native-push";

function firebaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "تعذر إكمال عملية الحساب.";
  const source = error as { code?: unknown; message?: unknown };
  const code = typeof source.code === "string" ? source.code : "";
  const message = typeof source.message === "string" ? source.message : "تعذر إكمال عملية الحساب.";
  return code ? `${code}: ${message}` : message;
}

function toAuthUser(user: FirebaseUser): AuthUser {
  const displayName = user.displayName?.trim() || undefined;
  const photoURL = user.photoURL?.trim() || undefined;
  return {
    id: user.uid,
    uid: user.uid,
    email: user.email,
    email_confirmed_at: user.emailVerified ? new Date().toISOString() : null,
    user_metadata: {
      ...(displayName ? { display_name: displayName, full_name: displayName } : {}),
      ...(photoURL ? { avatar_url: photoURL, picture: photoURL } : {}),
    },
  };
}

async function toAuthSession(user: FirebaseUser): Promise<AuthSession> {
  return {
    access_token: await user.getIdToken(),
    user: toAuthUser(user),
  };
}

function fallbackProfile(user: AuthUser): UserProfile {
  const displayName =
    user.user_metadata.display_name?.trim() ||
    user.user_metadata.full_name?.trim() ||
    user.email?.split("@", 1)[0]?.trim() ||
    "حساب رواج";
  const now = new Date().toISOString();
  return {
    id: user.id,
    email: user.email ?? "",
    firstName: null,
    lastName: null,
    displayName,
    businessName: null,
    bio: null,
    governorate: null,
    cityArea: null,
    phone: null,
    whatsapp: null,
    preferredContactMethod: null,
    verificationStatus: "unverified",
    accountStatus: "active",
    role: "user",
    roles: ["user"],
    avatarPath: null,
    avatarUrl: user.user_metadata.avatar_url ?? user.user_metadata.picture ?? null,
    coverPath: null,
    coverUrl: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);

  const applyFirebaseUser = useCallback(async (firebaseUser: FirebaseUser | null) => {
    const requestId = ++loadRequestIdRef.current;
    if (!firebaseUser) {
      setSession(null);
      setProfile(null);
      setStatus("signedOut");
      setReason(null);
      return { error: null };
    }

    try {
      const nextSession = await toAuthSession(firebaseUser);
      if (requestId !== loadRequestIdRef.current) return { error: null };
      setSession(nextSession);
      setStatus("signedIn");
      setReason(null);

      try {
        const nextProfile = await loadCloudflareUserProfile(nextSession.user);
        if (requestId !== loadRequestIdRef.current) return { error: null };
        setProfile(nextProfile);
      } catch (error) {
        if (requestId !== loadRequestIdRef.current) return { error: null };
        const message = error instanceof Error ? error.message : "تعذر تحميل بيانات الحساب.";
        console.error("rawaj_profile_bootstrap_failed", message);
        setProfile(fallbackProfile(nextSession.user));
        setReason(message);
      }

      return { error: null };
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return { error: null };
      const message = error instanceof Error ? error.message : "تعذر إكمال تسجيل الدخول.";
      setSession(null);
      setProfile(null);
      setStatus("authError");
      setReason(message);
      return { error: message };
    }
  }, []);

  const load = useCallback(
    async () => applyFirebaseUser(firebaseAuth.currentUser),
    [applyFirebaseUser],
  );

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, (nextUser) => {
      queueMicrotask(() => void applyFirebaseUser(nextUser));
    });
    return unsubscribe;
  }, [applyFirebaseUser]);

  const value = useMemo<AuthContextValue>(() => {
    const signOut = async () => {
      loadRequestIdRef.current += 1;
      const localNotificationCleanup = clearLocalNativePushState();
      try {
        await firebaseSignOut(firebaseAuth);
        await localNotificationCleanup;
        setSession(null);
        setProfile(null);
        setStatus("signedOut");
        setReason(null);
        return { error: null };
      } catch (error) {
        await localNotificationCleanup;
        return { error: firebaseErrorMessage(error) };
      }
    };

    const signInWithPassword = async (email: string, password: string) => {
      try {
        const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
        return applyFirebaseUser(credential.user);
      } catch (error) {
        return { error: firebaseErrorMessage(error) };
      }
    };

    const signUpWithPassword = async (email: string, password: string, displayName: string) => {
      try {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          email.trim(),
          password,
        );
        const cleanDisplayName = displayName.trim();
        if (cleanDisplayName)
          await updateProfile(credential.user, { displayName: cleanDisplayName });
        return applyFirebaseUser(credential.user);
      } catch (error) {
        return { error: firebaseErrorMessage(error) };
      }
    };

    const requestPasswordReset = async (email: string) => {
      try {
        const origin =
          typeof window === "undefined" ? "https://rawa-j.com" : window.location.origin;
        await sendPasswordResetEmail(firebaseAuth, email.trim(), {
          url: `${origin}/login`,
          handleCodeInApp: false,
        });
        return { error: null };
      } catch (error) {
        return { error: firebaseErrorMessage(error) };
      }
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
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          const result = await signInWithPopup(firebaseAuth, provider);
          const applied = await applyFirebaseUser(result.user);
          if (applied.error) return applied;
          const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
          if (typeof window !== "undefined") window.location.assign(safeReturnTo);
          return { error: null };
        } catch (error) {
          return { error: firebaseErrorMessage(error) };
        }
      },
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
    };
  }, [applyFirebaseUser, load, profile, reason, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
