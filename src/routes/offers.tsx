import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { fetchPublicListings } from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/offers")({
  head: () =>
    createSeo({
      title: "العروض | RAWAJ / رواج",
      description:
        "مساحة مخصصة لعروض المتاجر والشركات على رواج، مع عرض الإعلانات المميزة بشكل منفصل دون افتراض خصومات.",
      path: "/offers",
    }),
  component: OffersPage,
});

function OffersPage() {
  const { language, text } = useUiPreferences();
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchPublicListings({ sort: "featured" }, null, 30);
      if (cancelled) return;
      if (result.ok) setListings(result.data.items.filter((listing) => listing.isFeatured));
      else setError(result.error);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PageHeader title={text("العروض", "Offers")} />
      <main className="container-wide mobile-page-bottom pt-4">
        <section className="hero-navy relative overflow-hidden rounded-3xl p-4 shadow-premium sm:p-6">
          <div className="relative z-10 flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-orange text-white shadow-soft">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-gold">
                {text("مساحة العروض", "Offers space")}
              </p>
              <h1 className="mt-1 text-xl font-extrabold text-primary-foreground sm:text-2xl">
                {text("العروض والإعلانات المميزة", "Offers & featured listings")}
              </h1>
              <p className="mt-1.5 max-w-xl text-xs leading-6 text-primary-foreground/80 sm:text-sm">
                {text(
                  "مساحة مخصصة لعروض المتاجر والشركات. لا توجد عروض تجارية متاحة حالياً، وتظهر الإعلانات المميزة أدناه كقسم منفصل وليست خصومات.",
                  "A dedicated space for store and company offers. No commercial offers are available right now; featured listings below are separate and are not discounts.",
                )}
              </p>
            </div>
          </div>
        </section>


        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-extrabold">
                {text("إعلانات مميزة", "Featured listings")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {text("ليست خصومات أو عروضاً تجارية.", "Not discounts or business offers.")}
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link to="/promotion" className="text-xs font-bold text-primary">
                {text("طلب ترويج إعلان", "Request listing promotion")}
              </Link>
              <Link
                to="/listings"
                search={{ sort: "featured" }}
                className="text-xs font-bold text-primary"
              >
                {text("عرض في النتائج", "View in results")}
              </Link>
            </div>
          </div>
          {loading ? (
            <OffersState
              title={text("جاري تحميل الإعلانات المميزة", "Loading featured listings")}
            />
          ) : error ? (
            <OffersState
              title={text("تعذر تحميل الإعلانات المميزة", "Could not load featured listings")}
              body={error.message}
            />
          ) : listings.length === 0 ? (
            <OffersState
              title={text(
                "لا توجد عروض تجارية متاحة حالياً",
                "No commercial offers available right now",
              )}
              body={text(
                "لا توجد عروض تجارية متاحة حالياً. عند توفر إعلانات مميزة بعد مراجعة الإدارة ستظهر هنا بشكل منفصل.",
                "No commercial offers are available right now. When admin-reviewed featured listings are available, they will appear here separately.",
              )}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {listings.map((listing) => (
                <FeaturedListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function FeaturedListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="overflow-hidden bg-card hairline tap-card"
    >
      <div className="relative">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            className="aspect-[16/9] w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <span className="absolute top-2 start-2 rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
          {text("إعلان مميز", "Featured listing")}
        </span>
      </div>
      <div className="p-3">
        <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {categoryName(listing.categoryId, listing.categoryNameAr, language)}
        </div>
        <h3 className="line-clamp-2 text-sm font-bold">{listing.title}</h3>
        <p className="mt-1 text-base font-extrabold">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language)}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {governorateName(listing.governorateId, listing.governorateNameAr, language)}
        </p>
      </div>
    </Link>
  );
}

function OffersState({ title, body }: { title: string; body?: string }) {
  return (
    <section className="mt-5 overflow-hidden rounded-2xl bg-card p-6 text-center hairline shadow-soft">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-orange/12 text-brand-orange">
        <Sparkles className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-base font-extrabold text-primary">{title}</h2>
      {body && (
        <p className="mx-auto mt-1 max-w-xl text-xs leading-6 text-muted-foreground">{body}</p>
      )}
    </section>
  );
}
