import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  const callbackContext = useMemo(() => {
    if (typeof window === "undefined") return { isRecovery: false, returnTo: "/more" };
    const searchParams = new URLSearchParams(window.location.search);
    return {
      isRecovery: searchParams.get("type") === "recovery",
      returnTo: sanitizeAuthReturnTo(searchParams.get("returnTo"), "/more"),
    };
  }, []);
  const [status, setStatus] = useState<CallbackStatus>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let completionTimer: ReturnType<typeof setTimeout> | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;

    async function handleCallback() {
      const client = supabase;
      if (!client) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(text("تعذر الوصول إلى خدمة الحسابات الآن.", "Account service is unavailable right now."));
        }
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const code = searchParams.get("code");
      let observedRecoveryEvent = false;
      let completed = false;

      const finish = (recovery: boolean) => {
        if (cancelled || completed) return;
        completed = true;
        clearTimeout(expiryTimer);
        setStatus("success");
        completionTimer = setTimeout(() => {
          if (cancelled) return;
          if (recovery || callbackContext.isRecovery) {
            const destination = `/reset-password?returnTo=${encodeURIComponent(callbackContext.returnTo)}`;
            window.location.assign(destination);
            return;
          }
          void navigate({ to: callbackContext.returnTo });
        }, 650);
      };

      const { data: listener } = client.auth.onAuthStateChange((event, session) => {
        if (cancelled || !session) return;
        if (event === "PASSWORD_RECOVERY") observedRecoveryEvent = true;
        if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
          finish(observedRecoveryEvent || event === "PASSWORD_RECOVERY");
        }
      });

      try {
        if (code) {
          const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (data.session) {
          finish(observedRecoveryEvent || callbackContext.isRecovery);
          return;
        }

        expiryTimer = setTimeout(async () => {
          if (cancelled || completed) return;
          const { data: lateSession, error: lateError } = await client.auth.getSession();
          if (cancelled || completed) return;
          if (!lateError && lateSession.session) {
            finish(observedRecoveryEvent || callbackContext.isRecovery);
            return;
          }
          listener.subscription.unsubscribe();
          setStatus("error");
          setErrorMsg(
            callbackContext.isRecovery
              ? text("تعذر تجهيز جلسة استعادة كلمة المرور. قد يكون الرابط منتهيًا أو استُخدم سابقًا. اطلب رابطًا جديدًا وحاول مرة أخرى.", "Could not prepare the password recovery session. The link may be expired or already used. Request a new link and try again.")
              : text("تعذر تسجيل الدخول. حاول مرة أخرى.", "Could not sign in. Please try again."),
          );
        }, 20000);
      } catch (error) {
        if (cancelled) return;
        listener.subscription.unsubscribe();
        setStatus("error");
        setErrorMsg(error instanceof Error ? error.message : text("حدث خطأ غير متوقع.", "An unexpected error occurred."));
      }
    }

    void handleCallback();

    return () => {
      cancelled = true;
      clearTimeout(completionTimer);
      clearTimeout(expiryTimer);
    };
  }, [callbackContext.isRecovery, callbackContext.returnTo, navigate, text]);

  const loginDestination = `/login?returnTo=${encodeURIComponent(callbackContext.returnTo)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="rawaj-surface relative w-full max-w-md overflow-hidden rounded-[1.7rem] p-8 text-center sm:p-10">
        {status === "loading" && (
          <>
            <svg className="mx-auto h-10 w-10 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <h1 className="mt-4 text-lg font-bold text-primary">
              {callbackContext.isRecovery ? text("جاري تجهيز استعادة كلمة المرور...", "Preparing password recovery...") : text("جاري تسجيل الدخول...", "Signing in...")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {callbackContext.isRecovery ? text("ننتظر اكتمال جلسة الاستعادة الآمنة قبل فتح صفحة كلمة المرور الجديدة.", "Waiting for the secure recovery session to finish before opening the new-password page.") : text("جارٍ تأكيد جلسة الحساب وإعادتك للصفحة المناسبة.", "Verifying your account session and returning you to the right page.")}
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <svg className="mx-auto h-10 w-10 text-emerald-trust" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="mt-4 text-lg font-bold text-primary">
              {callbackContext.isRecovery ? text("تم تأكيد رابط الاستعادة", "Recovery link confirmed") : text("تم تسجيل الدخول", "Signed in")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {callbackContext.isRecovery ? text("جارٍ فتح صفحة تعيين كلمة المرور الجديدة...", "Opening the new-password page...") : text("جارٍ تحويلك إلى الصفحة المناسبة...", "Redirecting you to the right page...")}
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <svg className="mx-auto h-10 w-10 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h1 className="mt-4 text-lg font-bold text-primary">
              {callbackContext.isRecovery ? text("تعذر استكمال الاستعادة", "Recovery could not be completed") : text("فشل تسجيل الدخول", "Sign in failed")}
            </h1>
            <p className="mt-2 text-sm text-destructive">{errorMsg}</p>
            <button type="button" onClick={() => window.location.assign(loginDestination)} className="rawaj-button-primary mt-6 px-5 py-2.5">
              {callbackContext.isRecovery ? text("طلب رابط جديد", "Request a new link") : text("العودة لتسجيل الدخول", "Back to login")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
