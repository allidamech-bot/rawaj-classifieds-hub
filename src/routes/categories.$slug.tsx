import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Grid3X3 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/shell/spatial-primitives";
import { RealListingCard } from "@/features/listings/RealListingCard";
import { fetchPublicCategories, fetchPublicListings } from "@/lib/classifieds-api";
import {
  buildBreadcrumbStructuredData,
  createSeo,
  jsonLdScript,
  plainText,
} from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/categories/$slug")({
  loader: async ({ params }) => {
    const categoriesResult = await fetchPublicCategories();
    if (!categoriesResult.ok) throw new Error(categoriesResult.error.message);
    const category = categoriesResult.data.find((item) => item.slug === params.slug);
    if (!category) throw notFound();

    const listingsResult = await fetchPublicListings({ categoryId: category.id }, null, 24);
    return {
      category,
      listings: listingsResult.ok ? listingsResult.data.items : [],
      listingLoadFailed: !listingsResult.ok,
    };
  },
  head: ({ loaderData, params }) =>
    createSeo({
      title: loaderData
        ? `${loaderData.category.nameAr} للبيع في سوريا | RAWAJ / رواج`
        : "قسم غير متاح | RAWAJ / رواج",
      description: loaderData
        ? plainText(
            loaderData.category.hintAr ||
              `تصفح أحدث إعلانات ${loaderData.category.nameAr} المعتمدة في سوريا على رواج.`,
            160,
          )
        : "هذا القسم غير متاح على رواج.",
      path: `/categories/${params.slug}`,
      noindex: !loaderData,
    }),
  component: CategorySeoLandingPage,
});

function CategorySeoLandingPage() {
  const { category, listings, listingLoadFailed } = Route.useLoaderData();
  const { text } = useUiPreferences();
  const breadcrumbs = buildBreadcrumbStructuredData([
    { name: "RAWAJ / رواج", path: "/" },
    { name: text("الأقسام", "Categories"), path: "/categories" },
    { name: category.nameAr, path: `/categories/${category.slug}` },
  ]);

  return (
    <>
      <PageHeader title={category.nameAr} to="/categories" />
      <main className="container-wide mobile-page-bottom py-5 sm:py-7">
        <nav className="mb-4 text-xs text-muted-foreground" aria-label={text("مسار الصفحة", "Breadcrumb")}>
          <Link to="/categories" className="font-semibold hover:text-foreground">
            {text("الأقسام", "Categories")}
          </Link>
          <span className="mx-2">/</span>
          <span>{category.nameAr}</span>
        </nav>

        <section className="rawaj-surface overflow-hidden rounded-[1.5rem] p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Grid3X3 className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-brand-orange">
                {text("دليل القسم", "Category guide")}
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                {category.nameAr}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
                {category.hintAr ||
                  text(
                    `تصفح أحدث إعلانات ${category.nameAr} المعتمدة في سوريا.`,
                    `Browse the latest approved ${category.nameAr} listings in Syria.`,
                  )}
              </p>
            </div>
          </div>
          <Link
            to="/listings"
            search={{ category: category.id }}
            className="rawaj-button-primary mt-5 inline-flex min-h-11 items-center gap-2 px-5"
          >
            {text("عرض كل نتائج القسم", "View all category results")}
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </section>

        <section className="mt-7" aria-labelledby="category-latest-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-brand-orange">
                {text("إعلانات معتمدة", "Approved listings")}
              </p>
              <h2 id="category-latest-title" className="mt-1 text-xl font-black text-foreground">
                {text(`أحدث إعلانات ${category.nameAr}`, `Latest ${category.nameAr} listings`)}
              </h2>
            </div>
            <span className="text-xs font-semibold text-muted-foreground">
              {listings.length} {text("إعلان", "listings")}
            </span>
          </div>

          {listingLoadFailed ? (
            <EmptyState
              title={text("تعذر تحميل إعلانات القسم", "Category listings could not be loaded")}
              description={text("حاول فتح النتائج مرة أخرى بعد قليل.", "Try opening the results again shortly.")}
            />
          ) : listings.length === 0 ? (
            <EmptyState
              title={text("لا توجد إعلانات متاحة الآن", "No listings are available yet")}
              description={text(
                "سيظهر هنا أول إعلان معتمد في هذا القسم.",
                "The first approved listing in this category will appear here.",
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
