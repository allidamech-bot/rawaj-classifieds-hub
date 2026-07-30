import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithCredential,
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
import {
  clearNativeGoogleCredentialState,
  isNativeAndroidGoogleAuthAvailable,
  nativeGoogleAuthErrorMessage,
  requestNativeGoogleIdToken,
} from "./native-google-auth";
import {
  clearLocalNativePushState,
  detachNativePushBeforeSignOut,
} from "./native-push";

function firebaseErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "تعذر إكمال عملية الحساب.";
  const source = error as { code?: unknown; message?: unknown };
  const code = typeof source.code === "string" ? source.code : "";
  const message = typeof source.message === "string" ? source.message : "تعذر إكمال عملية الحساب.";
  return code ? `${code}: ${message}` : message;
}

function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const googleSignInAttemptRef = useRef(0);
  const googleSignInRequestRef = useRef<Promise<{ error: string | null }> | null>(null);
  const profileLoadRef = useRef<{
    userId: string;
    promise: Promise<UserProfile>;
  } | null>(null);

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
      setProfile(null);
      setStatus("loading");
      setReason(null);

      try {
        const existingProfileLoad = profileLoadRef.current;
        const profilePromise =
          existingProfileLoad?.userId === firebaseUser.uid
            ? existingProfileLoad.promise
            : loadCloudflareUserProfile(nextSession.user);
        profileLoadRef.current = { userId: firebaseUser.uid, promise: profilePromise };
        const nextProfile = await profilePromise;
        if (profileLoadRef.current?.promise === profilePromise) {
          profileLoadRef.current = null;
        }
        if (requestId !== loadRequestIdRef.current) return { error: null };
        setProfile(nextProfile);
        setStatus("signedIn");
      } catch (error) {
        if (profileLoadRef.current?.userId === firebaseUser.uid) {
          profileLoadRef.current = null;
        }
        if (requestId !== loadRequestIdRef.current) return { error: null };
        const message = error instanceof Error ? error.message : "تعذر تحميل بيانات الحساب.";
        console.error("rawaj_profile_bootstrap_failed", message);
        setProfile(null);
        setStatus("authError");
        setReason(message);
        return { error: message };
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

  const refreshProfile = useCallback(async () => {
    const firebaseUser = firebaseAuth.currentUser;
    if (!firebaseUser) return { error: "تسجيل الدخول مطلوب." };

    const requestId = ++loadRequestIdRef.current;
    try {
      const existingProfileLoad = profileLoadRef.current;
      const profilePromise =
        existingProfileLoad?.userId === firebaseUser.uid
          ? existingProfileLoad.promise
          : loadCloudflareUserProfile(toAuthUser(firebaseUser));
      profileLoadRef.current = { userId: firebaseUser.uid, promise: profilePromise };
      const nextProfile = await profilePromise;
      if (profileLoadRef.current?.promise === profilePromise) {
        profileLoadRef.current = null;
      }
      if (
        requestId !== loadRequestIdRef.current ||
        firebaseAuth.currentUser?.uid !== firebaseUser.uid
      ) {
        return { error: null };
      }
      setProfile(nextProfile);
      setStatus("signedIn");
      setReason(null);
      return { error: null };
    } catch (error) {
      if (profileLoadRef.current?.userId === firebaseUser.uid) {
        profileLoadRef.current = null;
      }
      if (
        requestId !== loadRequestIdRef.current ||
        firebaseAuth.currentUser?.uid !== firebaseUser.uid
      ) {
        return { error: null };
      }
      const message = error instanceof Error ? error.message : "تعذر تحديث بيانات الحساب.";
      return { error: message };
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(firebaseAuth, (nextUser) => {
      queueMicrotask(() => void applyFirebaseUser(nextUser));
    });
    return unsubscribe;
  }, [applyFirebaseUser]);

  const value = useMemo<AuthContextValue>(() => {
    const signOut = async () => {
      googleSignInAttemptRef.current += 1;
      loadRequestIdRef.current += 1;
      profileLoadRef.current = null;

      const detachResult = await detachNativePushBeforeSignOut();
      if (!detachResult.ok) {
        return { error: detachResult.error.message };
      }

      const localNotificationCleanup = clearLocalNativePushState();
      const nativeGoogleCleanup = clearNativeGoogleCredentialState();
      const completeLocalCleanup = () =>
        Promise.all([
          localNotificationCleanup.catch(() => undefined),
          nativeGoogleCleanup.catch(() => undefined),
        ]);
      try {
        await firebaseSignOut(firebaseAuth);
        setSession(null);
        setProfile(null);
        setStatus("signedOut");
        setReason(null);
        await completeLocalCleanup();
        return { error: null };
      } catch (error) {
        await completeLocalCleanup();
        if (!firebaseAuth.currentUser) {
          setSession(null);
          setProfile(null);
          setStatus("signedOut");
          setReason(null);
        }
        return { error: firebaseErrorMessage(error) };
      }
    };

    const signInWithPassword = async (email: string, password: string) => {
      try {
        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          normalizeAuthEmail(email),
          password,
        );
        return applyFirebaseUser(credential.user);
      } catch (error) {
        return { error: firebaseErrorMessage(error) };
      }
    };

    const signUpWithPassword = async (email: string, password: string, displayName: string) => {
      try {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          normalizeAuthEmail(email),
          password,
        );
        const cleanDisplayName = displayName.trim();
        if (cleanDisplayName) {
          await updateProfile(credential.user, { displayName: cleanDisplayName });
          await credential.user.getIdToken(true);
        }
        return applyFirebaseUser(credential.user);
      } catch (error) {
        return { error: firebaseErrorMessage(error) };
      }
    };

    const requestPasswordReset = async (email: string) => {
      try {
        const origin =
          typeof window === "undefined" ? "https://rawa-j.com" : window.location.origin;
        await sendPasswordResetEmail(firebaseAuth, normalizeAuthEmail(email), {
          url: `${origin}/login`,
          handleCodeInApp: false,
        });
        return { error: null };
      } catch (error) {
        return { error: firebaseErrorMessage(error) };
      }
    };

    const signInWithGoogle = async (returnTo?: string) => {
      const pending = googleSignInRequestRef.current;
      if (pending) return pending;

      const attemptId = ++googleSignInAttemptRef.current;
      const request = (async (): Promise<{ error: string | null }> => {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });

          let result;
          if (isNativeAndroidGoogleAuthAvailable()) {
            let idToken: string;
            try {
              idToken = await requestNativeGoogleIdToken();
            } catch (error) {
              return { error: nativeGoogleAuthErrorMessage(error) };
            }
            if (attemptId !== googleSignInAttemptRef.current) {
              return { error: "تم إلغاء تسجيل الدخول باستخدام Google." };
            }
            const credential = GoogleAuthProvider.credential(idToken);
            result = await signInWithCredential(firebaseAuth, credential);
          } else {
            result = await signInWithPopup(firebaseAuth, provider);
          }

          if (attemptId !== googleSignInAttemptRef.current) {
            await firebaseSignOut(firebaseAuth).catch(() => undefined);
            return { error: "تم إلغاء تسجيل الدخول باستخدام Google." };
          }
          const applied = await applyFirebaseUser(result.user);
          if (applied.error) return applied;
          const safeReturnTo = sanitizeAuthReturnTo(returnTo, "/more");
          if (typeof window !== "undefined") window.location.assign(safeReturnTo);
          return { error: null };
        } catch (error) {
          return { error: firebaseErrorMessage(error) };
        }
      })();

      googleSignInRequestRef.current = request;
      try {
        return await request;
      } finally {
        if (googleSignInRequestRef.current === request) {
          googleSignInRequestRef.current = null;
        }
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
      refreshProfile,
      signInWithGoogle,
      signInWithPassword,
      signUpWithPassword,
      requestPasswordReset,
    };
  }, [applyFirebaseUser, profile, reason, refreshProfile, session, status]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
