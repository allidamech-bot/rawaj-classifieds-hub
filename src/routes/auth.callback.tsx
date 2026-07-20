import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  hasActivePasswordRecoverySession,
  markPasswordRecoverySession,
} from "@/lib/auth-recovery-session";
import { sanitizeAuthReturnTo } from "@/lib/auth-return";
import { supabase } from "@/lib/supabase";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "تأكيد الحساب | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AuthCallbackPage,
});

type CallbackStatus = "loading" | "success" | "error";

function AuthCallbackPage() {
  const { text } = useUiPreferences();
  const navigate = useNavigate();
  const locationSearch = useRouterState({ select: (state) => state.location.search });
  const looseSearch = locationSearch as unknown as Record<string, unknown>;
  const callbackContext = {
    isRecovery: looseSearch.type === "recovery",
    returnTo: sanitizeAuthReturnTo(
      typeof looseSearch.returnTo === "string" ? looseSearch.returnTo : undefined,
      "/more",
    ),
  };
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribeAuth: (() => void) | undefined;

    async function handleCallback() {
      const client = supabase;
      if (!client) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(
            text(
              "تعذر الوصول إلى خدمة الحسابات الآن.",
              "Account service is unavailable right now.",
            ),
          );
        }
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = searchParams.get("code");
      const recoveryCodeRequested = Boolean(code && callbackContext.isRecovery);
      const recoveryHashAccessToken =
        callbackContext.isRecovery && hashParams.get("type") === "recovery"
          ? hashParams.get("access_token")
          : null;
      let observedRecoveryEvent = false;
      let completed = false;

      function hasRecoveryHashProof(session: Session | null): session is Session {
        return Boolean(
          session && recoveryHashAccessToken && session.access_token === recoveryHashAccessToken,
        );
      }

      function hasRecoveryProof(session: Session | null): session is Session {
        if (!session) return false;
        return (
          observedRecoveryEvent ||
          hasRecoveryHashProof(session) ||
          hasActivePasswordRecoverySession(session.user.id)
        );
      }

      function recoveryFailureMessage() {
        return text(
          "تعذر تجهيز جلسة استعادة كلمة المرور. قد يكون الرابط منتهيًا أو استُخدم سابقًا. اطلب رابطًا جديدًا وحاول مرة أخرى.",
          "Could not prepare the password recovery session. The link may be expired or already used. Request a new link and try again.",
        );
      }

      function failCallback() {
        if (cancelled || completed) return;
        completed = true;
        clearTimeout(expiryTimer);
        setStatus("error");
        setErrorMsg(
          callbackContext.isRecovery
            ? recoveryFailureMessage()
            : text("تعذر تسجيل الدخول. حاول مرة أخرى.", "Could not sign in. Please try again."),
        );
      }

      function finish(recoveryAuthorized: boolean, session: Session | null) {
        if (cancelled || completed) return;
        if (recoveryAuthorized && !session?.user.id) {
          failCallback();
          return;
        }

        completed = true;
        clearTimeout(expiryTimer);
        if (recoveryAuthorized && session) markPasswordRecoverySession(session.user.id);
        setStatus("success");
        completionTimer = setTimeout(() => {
          if (cancelled) return;
          if (recoveryAuthorized) {
            const destination = `/reset-password?returnTo=${encodeURIComponent(callbackContext.returnTo)}`;
            window.location.assign(destination);
            return;
          }
          void navigate({ to: callbackContext.returnTo });
        }, 650);
      }

      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (cancelled || !session) return;
        if (event === "PASSWORD_RECOVERY") {
          observedRecoveryEvent = true;
          finish(true, session);
          return;
        }
        if (hasRecoveryHashProof(session)) {
          finish(true, session);
          return;
        }
        if (!callbackContext.isRecovery && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
          finish(false, session);
        }
      });
      unsubscribeAuth = () => listener.subscription.unsubscribe();

      if (!code) {
        const { data, error } = await client.auth.getSession();
        if (cancelled) return;
        if (error) {
          listener.subscription.unsubscribe();
          setStatus("error");
          setErrorMsg(
            authErrorMessage(error, callbackContext.isRecovery ? "recovery" : "callback", text),
          );
          return;
        }

        if (!callbackContext.isRecovery && data.session) {
          finish(false, data.session);
          return;
        }
        if (callbackContext.isRecovery && hasRecoveryProof(data.session)) {
          finish(true, data.session);
          return;
        }
        if (!callbackContext.isRecovery) {
          failCallback();
          return;
        }

        expiryTimer = setTimeout(async () => {
          if (cancelled || completed) return;
          const { data: lateSession, error: lateError } = await client.auth.getSession();
          if (cancelled || completed) return;
          if (!lateError && hasRecoveryProof(lateSession.session)) {
            finish(true, lateSession.session);
            return;
          }
          listener.subscription.unsubscribe();
          failCallback();
        }, 15000);
        return;
      }

      try {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;

        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session) {
          finish(recoveryCodeRequested, data.session);
          return;
        }

        expiryTimer = setTimeout(async () => {
          if (cancelled || completed) return;
          const { data: lateSession, error: lateError } = await client.auth.getSession();
          if (cancelled || completed) return;
          if (!lateError && lateSession.session) {
            finish(recoveryCodeRequested, lateSession.session);
            return;
          }
          listener.subscription.unsubscribe();
          failCallback();
        }, 20000);
      } catch (error) {
        if (cancelled) return;
        listener.subscription.unsubscribe();
        setStatus("error");
        setErrorMsg(
          authErrorMessage(
            error instanceof Error ? error : null,
            callbackContext.isRecovery ? "recovery" : "callback",
            text,
          ),
        );
      }
    }

    void handleCallback();

    return () => {
      cancelled = true;
      clearTimeout(completionTimer);
      clearTimeout(expiryTimer);
      unsubscribeAuth?.();
    };
  }, [callbackContext.isRecovery, callbackContext.returnTo, navigate, text]);

  const loginDestination = callbackContext.isRecovery
    ? `/login?mode=forgot&returnTo=${encodeURIComponent(callbackContext.returnTo)}`
    : `/login?returnTo=${encodeURIComponent(callbackContext.returnTo)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="rawaj-surface relative w-full max-w-md overflow-hidden rounded-[1.7rem] p-8 text-center sm:p-10">
        {status === "loading" && (
          <>
            <svg
              className="mx-auto h-10 w-10 animate-spin text-primary"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <h1 className="mt-4 text-lg font-bold text-primary">
              {callbackContext.isRecovery
                ? text("جاري تجهيز استعادة كلمة المرور...", "Preparing password recovery...")
                : text("جاري تسجيل الدخول...", "Signing in...")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {callbackContext.isRecovery
                ? text(
                    "ننتظر اكتمال جلسة الاستعادة الآمنة قبل فتح صفحة كلمة المرور الجديدة.",
                    "Waiting for the secure recovery session to finish before opening the new-password page.",
                  )
                : text(
                    "جارٍ تأكيد جلسة الحساب وإعادتك للصفحة المناسبة.",
                    "Verifying your account session and returning you to the right page.",
                  )}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <svg
              className="mx-auto h-10 w-10 text-emerald-trust"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h1 className="mt-4 text-lg font-bold text-primary">
              {callbackContext.isRecovery
                ? text("تم تأكيد رابط الاستعادة", "Recovery link confirmed")
                : text("تم تسجيل الدخول", "Signed in")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {callbackContext.isRecovery
                ? text(
                    "جارٍ فتح صفحة تعيين كلمة المرور الجديدة...",
                    "Opening the new-password page...",
                  )
                : text(
                    "جارٍ تحويلك إلى الصفحة المناسبة...",
                    "Redirecting you to the right page...",
                  )}
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <svg
              className="mx-auto h-10 w-10 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <h1 className="mt-4 text-lg font-bold text-primary">
              {callbackContext.isRecovery
                ? text("تعذر استكمال الاستعادة", "Recovery could not be completed")
                : text("فشل تسجيل الدخول", "Sign in failed")}
            </h1>
            <p className="mt-2 text-sm text-destructive">{errorMsg}</p>
            <button
              type="button"
              onClick={() => window.location.assign(loginDestination)}
              className="rawaj-button-primary mt-6 px-5 py-2.5"
            >
              {callbackContext.isRecovery
                ? text("طلب رابط جديد", "Request a new link")
                : text("العودة لتسجيل الدخول", "Back to login")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
