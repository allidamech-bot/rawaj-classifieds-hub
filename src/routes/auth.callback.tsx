import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { sanitizeAuthReturnTo } from "@/lib/auth-return";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [{ title: "تأكيد الحساب | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const { text } = useUiPreferences();
  const locationSearch = useRouterState({ select: (state) => state.location.search });
  const looseSearch = locationSearch as unknown as Record<string, unknown>;
  const returnTo = sanitizeAuthReturnTo(
    typeof looseSearch.returnTo === "string" ? looseSearch.returnTo : undefined,
    "/more",
  );
  const mode = typeof looseSearch.mode === "string" ? looseSearch.mode : "";
  const oobCode = typeof looseSearch.oobCode === "string" ? looseSearch.oobCode : "";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (mode === "resetPassword" && oobCode) {
        window.location.replace(
          `/reset-password?mode=resetPassword&oobCode=${encodeURIComponent(oobCode)}&returnTo=${encodeURIComponent(returnTo)}`,
        );
        return;
      }
      window.location.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mode, oobCode, returnTo]);

  return (
    <main className="rawaj-auth-callback-v4">
      <div
        className="rawaj-auth-callback-v4__card text-center"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <svg
          aria-hidden="true"
          className="rawaj-auth-callback-v4__spinner mx-auto h-10 w-10 animate-spin"
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
        <h1 className="mt-4 text-lg font-bold">
          {text("جارٍ إكمال عملية الحساب...", "Completing the account request...")}
        </h1>
        <p className="mx-auto mt-2 max-w-sm">
          {text(
            "سيتم نقلك تلقائياً إلى الخطوة المناسبة خلال لحظات.",
            "You will be redirected automatically to the correct next step.",
          )}
        </p>
      </div>
    </main>
  );
}
