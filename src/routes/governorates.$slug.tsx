import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/shell/spatial-primitives";
import { RealListingCard } from "@/features/listings/RealListingCard";
import { fetchPublicGovernorates, fetchPublicListings } from "@/lib/classifieds-api";
import {
  buildBreadcrumbStructuredData,
  createSeo,
  jsonLdScript,
  plainText,
} from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/governorates/$slug")({
  loader: async ({ params }) => {
    const governoratesResult = await fetchPublicGovernorates();
    if (!governoratesResult.ok) throw new Error(governoratesResult.error.message);
    const governorate = governoratesResult.data.find((item) => item.slug === params.slug);
    if (!governorate) throw notFound();

    const listingsResult = await fetchPublicListings({ governorateId: governorate.id }, null, 24);
    return {
      governorate,
      listings: listingsResult.ok ? listingsResult.data.items : [],
      listingLoadFailed: !listingsResult.ok,
    };
  },
  head: ({ loaderData, params }) =>
    createSeo({
      title: loaderData
        ? `إعلانات ${loaderData.governorate.nameAr} | RAWAJ / رواج`
        : "محافظة غير متاحة | RAWAJ / رواج",
      description: loaderData
        ? plainText(
            `تصفح أحدث إعلانات البيع والخدمات المعتمدة في ${loaderData.governorate.nameAr} ومناطقها على رواج.`,
            160,
          )
        : "هذه المحافظة غير متاحة على رواج.",
      path: `/governorates/${params.slug}`,
      noindex: !loaderData,
    }),
  component: GovernorateSeoLandingPage,
});

function GovernorateSeoLandingPage() {
  const { governorate, listings, listingLoadFailed } = Route.useLoaderData();
  const { text } = useUiPreferences();
  const breadcrumbs = buildBreadcrumbStructuredData([
    { name: "RAWAJ / رواج", path: "/" },
    { name: text("المحافظات", "Governorates"), path: "/governorates" },
    { name: governorate.nameAr, path: `/governorates/${governorate.slug}` },
  ]);

  return (
    <>
      <PageHeader title={governorate.nameAr} to="/governorates" />
      <main className="container-wide mobile-page-bottom py-5 sm:py-7">
        <nav className="mb-4 text-xs text-muted-foreground" aria-label={text("مسار الصفحة", "Breadcrumb")}>
          <Link to="/governorates" className="font-semibold hover:text-foreground">
            {text("المحافظات", "Governorates")}
          </Link>
          <span className="mx-2">/</span>
          <span>{governorate.nameAr}</span>
        </nav>

        <section className="rawaj-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <MapPin className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-brand-orange">
                {text("السوق المحلي", "Local marketplace")}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {text(`إعلانات ${governorate.nameAr}`, `${governorate.nameAr} listings`)}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                {text(
                  `تصفح أحدث الإعلانات المعتمدة في ${governorate.nameAr} والمناطق التابعة لها.`,
                  `Browse the latest approved listings in ${governorate.nameAr} and its areas.`,
                )}
              </p>
            </div>
          </div>

          {governorate.districtsAr.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2" aria-label={text("المناطق", "Areas")}>
              {governorate.districtsAr.slice(0, 12).map((district) => (
                <span key={district} className="rawaj-chip px-3 py-1.5 text-[11px] font-bold">
                  {district}
                </span>
              ))}
            </div>
          ) : null}

          <Link
            to="/listings"
            search={{ gov: governorate.id }}
            className="rawaj-button-primary mt-5 inline-flex min-h-11 items-center gap-2 px-5"
          >
            {text("عرض كل إعلانات المحافظة", "View all governorate listings")}
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </section>

        <section className="mt-7" aria-labelledby="governorate-latest-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-brand-orange">
                {text("إعلانات معتمدة", "Approved listings")}
              </p>
              <h2 id="governorate-latest-title" className="mt-1 text-xl font-black text-foreground">
                {text(`الأحدث في ${governorate.nameAr}`, `Latest in ${governorate.nameAr}`)}
              </h2>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {listings.length} {text("إعلان", "listings")}
            </span>
          </div>

          {listingLoadFailed ? (
            <EmptyState
              title={text("تعذر تحميل إعلانات المحافظة", "Governorate listings could not be loaded")}
              description={text("حاول فتح النتائج مرة أخرى بعد قليل.", "Try opening the results again shortly.")}
            />
          ) : listings.length === 0 ? (
            <EmptyState
              title={text("لا توجد إعلانات متاحة الآن", "No listings are available yet")}
              description={text(
                "سيظهر هنا أول إعلان معتمد في هذه المحافظة.",
                "The first approved listing in this governorate will appear here.",
              )}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {listings.map((listing) => (
                <RealListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
        <script {...jsonLdScript(breadcrumbs)} />
      </main>
    </>
  );
}
