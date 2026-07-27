import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { sanitizeAuthReturnTo } from "@/lib/auth-return";
import { supabaseAuth } from "@/lib/supabase-auth";
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

  useEffect(() => {
    const client = supabaseAuth;
    let finished = false;
    const finish = (destination: string) => {
      if (finished) return;
      finished = true;
      window.location.replace(destination);
    };

    if (!client) {
      finish(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (session) finish(returnTo);
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (data.session) finish(returnTo);
      else if (error) finish(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    });

    const timeout = window.setTimeout(
      () => finish(`/login?returnTo=${encodeURIComponent(returnTo)}`),
      10_000,
    );
    return () => {
      window.clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, [returnTo]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="rawaj-surface relative w-full max-w-md overflow-hidden rounded-[1.7rem] p-8 text-center sm:p-10">
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
          {text("جارٍ إكمال عملية الحساب...", "Completing the account request...")}
        </h1>
      </div>
    </main>
  );
}
