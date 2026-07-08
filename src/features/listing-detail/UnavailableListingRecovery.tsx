import { Link } from "@tanstack/react-router";
import { ArrowLeft, Grid2X2, Home } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useUiPreferences } from "@/lib/ui-preferences";

export function UnavailableListingRecovery() {
  const { text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("تفاصيل الإعلان", "Listing details")} />
      <main className="container-wide mobile-page-bottom pt-8 sm:pt-10">
        <section className="rawaj-surface mx-auto max-w-xl rounded-[1.6rem] p-5 text-center sm:p-8">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted-surface text-primary">
            <ArrowLeft className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-lg font-extrabold text-foreground sm:text-xl">
            {text("هذا الإعلان لم يعد متاحاً", "This listing is no longer available")}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">
            {text(
              "قد يكون الإعلان قد بيع أو تأجر أو انتهت مدته أو أزيل من العرض. لا نكشف حالة خاصة غير عامة، لكن يمكنك متابعة البحث بدون الوصول إلى طريق مسدود.",
              "The listing may have been sold, rented, expired, or removed from public view. We do not expose private status details, but you can continue browsing without hitting a dead end.",
            )}
          </p>

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <Link to="/listings" className="rawaj-button-primary px-4 py-3">
              {text("تصفح البدائل", "Browse alternatives")}
            </Link>
            <Link
              to="/categories"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/75 bg-card px-4 py-3 text-sm font-bold text-foreground transition hover:border-gold/40"
            >
              <Grid2X2 className="h-4 w-4" />
              {text("استكشف الأقسام", "Explore categories")}
            </Link>
          </div>

          <Link
            to="/"
            className="mt-3 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-muted-foreground transition hover:text-primary"
          >
            <Home className="h-3.5 w-3.5" />
            {text("العودة للرئيسية", "Back to home")}
          </Link>
        </section>
      </main>
    </>
  );
}
