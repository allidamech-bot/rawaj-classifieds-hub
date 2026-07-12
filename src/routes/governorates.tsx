import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, MapPinned } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/shell/spatial-primitives";
import { fetchPublicGovernorates } from "@/lib/classifieds-api";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/governorates")({
  loader: async () => {
    const result = await fetchPublicGovernorates();
    return {
      governorates: result.ok ? result.data : [],
      loadFailed: !result.ok,
    };
  },
  head: () =>
    createSeo({
      title: "إعلانات المحافظات السورية | RAWAJ / رواج",
      description:
        "تصفح إعلانات البيع والخدمات حسب المحافظات السورية، من دمشق وحلب إلى حمص واللاذقية وبقية المحافظات على رواج.",
      path: "/governorates",
    }),
  component: GovernoratesDirectoryPage,
});

function GovernoratesDirectoryPage() {
  const { governorates, loadFailed } = Route.useLoaderData();
  const { text } = useUiPreferences();

  return (
    <>
      <PageHeader title={text("المحافظات السورية", "Syrian governorates")} to="/" />
      <main className="container-wide mobile-page-bottom py-5 sm:py-7">
        <section className="rawaj-surface rounded-[1.5rem] p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <MapPinned className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-extrabold text-brand-orange">
                {text("اكتشف السوق محلياً", "Discover the local marketplace")}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {text("إعلانات حسب المحافظة", "Listings by governorate")}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                {text(
                  "اختر المحافظة للوصول إلى أحدث الإعلانات المعتمدة والمناطق المرتبطة بها.",
                  "Choose a governorate to reach its latest approved listings and related areas.",
                )}
              </p>
            </div>
          </div>
        </section>

        {loadFailed ? (
          <EmptyState
            className="mt-6"
            title={text("تعذر تحميل المحافظات", "Governorates could not be loaded")}
            description={text("حاول مرة أخرى بعد قليل.", "Try again shortly.")}
          />
        ) : (
          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {governorates.map((governorate) => (
              <article key={governorate.id} className="rawaj-surface tap-card rounded-[1.25rem]">
                <Link
                  to="/governorates/$slug"
                  params={{ slug: governorate.slug }}
                  className="group flex h-full items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary">
                    <MapPinned className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-extrabold text-foreground">
                      {governorate.nameAr}
                    </strong>
                    <small className="mt-1 block text-[10px] font-semibold text-muted-foreground">
                      {governorate.districtsAr.length} {text("منطقة", "areas")}
                    </small>
                  </span>
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-foreground rtl:rotate-180" />
                </Link>
              </article>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
