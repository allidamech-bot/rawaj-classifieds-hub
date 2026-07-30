import { createFileRoute, Link } from "@tanstack/react-router";
import { History } from "lucide-react";

import { PageHeader } from "@/components/PageHeader";
import { RecentlyViewedHistory } from "@/features/retention/AccountRecentlyViewed";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/recently-viewed")({
  head: () => ({
    meta: [
      { title: "سجل المشاهدة | رَوَاج" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: RecentlyViewedPage,
});

function RecentlyViewedPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const userId = auth.profile?.id ?? auth.user?.id ?? null;

  return (
    <>
      <PageHeader title={text("سجل المشاهدة", "Viewing history")} />
      <main className="container-wide rawaj-content-stack mobile-page-bottom pb-8 pt-4">
        {auth.status === "loading" ? (
          <HistoryState
            title={text("جارٍ تحميل سجل المشاهدة", "Loading viewing history")}
            body={text("نجهّز الإعلانات التي فتحتها مؤخرًا.", "Preparing listings you recently opened.")}
          />
        ) : auth.status === "signedIn" && userId ? (
          <RecentlyViewedHistory userId={userId} />
        ) : auth.status === "authUnavailable" ? (
          <HistoryState
            title={text("سجل المشاهدة مرتبط بالحساب", "Viewing history is account based")}
            body={text(
              "تصفح الإعلانات الآن، وعند توفر جلسة الحساب سيظهر سجلك هنا.",
              "Browse listings now; when the account session is available, your history will appear here.",
            )}
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        ) : (
          <HistoryState
            title={text("تسجيل الدخول مطلوب", "Login required")}
            body={text(
              "سجّل الدخول لعرض الإعلانات التي شاهدتها من مكان واحد.",
              "Log in to view the listings you opened in one place.",
            )}
            actionLabel={text("تسجيل الدخول", "Log in")}
            actionTo="/login"
          />
        )}
      </main>
    </>
  );
}

function HistoryState({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: "/login" | "/listings";
}) {
  return (
    <section className="rawaj-account-section rounded-2xl p-6 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <History className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-extrabold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-xs leading-6 text-muted-foreground">{body}</p>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          search={actionTo === "/login" ? { returnTo: "/recently-viewed" } : undefined}
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </Link>
      ) : null}
    </section>
  );
}
