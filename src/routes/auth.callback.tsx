import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "جاري تسجيل الدخول | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { text } = useUiPreferences();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let signedIn = false;

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

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setStatus("error");
          setErrorMsg(exchangeError.message);
          return;
        }
      }

      // Let Supabase's built-in detectSessionInUrl handle hash-based returns,
      // then wait for the auth state to propagate.
      const { data, error } = await client.auth.getSession();

      if (cancelled) return;

      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
        return;
      }

      if (data.session) {
        setStatus("success");
        // Wait a moment for the profile to load via AuthProvider's onAuthStateChange
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (!cancelled) {
          void navigate({ to: "/profile" });
        }
      } else {
        // Session not yet available — wait for onAuthStateChange
        const { data: listener } = client.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          if (event === "SIGNED_IN" && session) {
            signedIn = true;
            clearTimeout(timeoutId);
            listener.subscription.unsubscribe();
            setStatus("success");
            setTimeout(() => {
              if (!cancelled) {
                void navigate({ to: "/profile" });
              }
            }, 1500);
          }
        });

        // Timeout fallback
        timeoutId = setTimeout(() => {
          if (cancelled) return;
          listener.subscription.unsubscribe();
          if (!signedIn) {
            setStatus("error");
            setErrorMsg(
              text("تعذر تسجيل الدخول. حاول مرة أخرى.", "Could not sign in. Please try again."),
            );
          }
        }, 15000);
      }
    }

    handleCallback();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [navigate, text]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
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
            <h1 className="mt-4 text-lg font-extrabold text-foreground">
              {text("جاري تسجيل الدخول...", "Signing in...")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {text("جارٍ التحقق من حساب Google الخاص بك.", "Verifying your Google account.")}
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
            <h1 className="mt-4 text-lg font-extrabold text-foreground">
              {text("تم تسجيل الدخول", "Signed in")}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {text("جارٍ تحويلك إلى صفحة الحساب...", "Redirecting to your profile...")}
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
            <h1 className="mt-4 text-lg font-extrabold text-foreground">
              {text("فشل تسجيل الدخول", "Sign in failed")}
            </h1>
            <p className="mt-2 text-sm text-destructive">{errorMsg}</p>
            <button
              type="button"
              onClick={() => void navigate({ to: "/login" })}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
            >
              {text("العودة لتسجيل الدخول", "Back to login")}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
