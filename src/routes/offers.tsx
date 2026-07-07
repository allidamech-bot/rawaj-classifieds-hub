import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpLeft,
  BadgePercent,
  Building2,
  MapPin,
  Megaphone,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
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
      <main className="rawaj-pulse-page min-h-dvh">
        <div className="container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">
          <section className="rawaj-offers-stage">
            <div className="relative z-10 grid min-h-[18rem] gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:items-end lg:p-9">
              <div className="self-end">
                <span className="rawaj-signature-kicker text-gold">
                  {text("مساحة العروض", "Offers space")}
                </span>
                <h1 className="mt-3 max-w-xl text-[1.7rem] font-extrabold leading-[1.38] text-[#fffaf0] sm:text-[2.3rem]">
                  {text("عروض حقيقية عندما تتوفر.", "Real offers when they are available.")}
                </h1>
                <p className="mt-3 max-w-xl text-xs leading-6 text-[#fffaf0]/68 sm:text-sm sm:leading-7">
                  {text(
                    "هذه مساحة مخصصة لعروض المتاجر والشركات. لا نعرض خصماً أو سعراً ترويجياً ما لم يكن موجوداً فعلاً في البيانات.",
                    "A dedicated space for store and company offers. Discounts or promotional prices are shown only when real offer data exists.",
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <OfferSignal
                  icon={Store}
                  label={text("عروض المتاجر", "Store offers")}
                  value={text("عند توفرها", "When available")}
                />
                <OfferSignal
                  icon={BadgePercent}
                  label={text("الخصومات", "Discounts")}
                  value={text("بيانات حقيقية فقط", "Real data only")}
                />
                <OfferSignal
                  icon={ShieldCheck}
                  label={text("الوضوح", "Clarity")}
                  value={text("بدون ادعاءات", "No fake claims")}
                />
                <OfferSignal
                  icon={Megaphone}
                  label={text("الترويج", "Promotion")}
                  value={text("منفصل وواضح", "Clearly separate")}
                />
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-3 sm:grid-cols-3">
            <OfferPrinciple
              icon={Store}
              world="rawaj-world-orange"
              title={text("عروض تجارية", "Commercial offers")}
              body={text(
                "تظهر هنا فقط عندما تتوفر عروض فعلية من متجر أو شركة.",
                "Shown here only when real store or company offers exist.",
              )}
            />
            <OfferPrinciple
              icon={Sparkles}
              world="rawaj-world-indigo"
              title={text("إعلانات مميزة", "Featured listings")}
              body={text(
                "مساحة منفصلة للترويج، وليست خصماً تلقائياً.",
                "A separate promotion space, not an automatic discount.",
              )}
            />
            <OfferPrinciple
              icon={ShieldCheck}
              world="rawaj-world-emerald"
              title={text("فصل واضح", "Clear separation")}
              body={text(
                "لا نخلط الإعلان المميز مع العرض التجاري.",
                "Featured listings are not presented as commercial offers.",
              )}
            />
          </section>

          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="rawaj-signature-kicker">
                  {text("مساحة ترويج منفصلة", "Separate promotion space")}
                </span>
                <h2 className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">
                  {text("الإعلانات المميزة", "Featured listings")}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {text(
                    "هذه ليست خصومات أو عروضاً تجارية.",
                    "These are not discounts or commercial offers.",
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to="/promotion"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-orange px-3.5 py-2 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(232,111,50,0.2)]"
                >
                  {text("طلب ترويج إعلان", "Request promotion")}
                  <ArrowUpLeft className="h-3.5 w-3.5 rtl:-rotate-90" />
                </Link>
                <Link
                  to="/listings"
                  search={{ sort: "featured" }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-[11px] font-bold text-primary-foreground"
                >
                  {text("عرض في النتائج", "View in results")}
                </Link>
              </div>
            </div>

            {loading ? (
              <OffersState
                title={text("جاري تحميل الإعلانات المميزة", "Loading featured listings")}
                body={text(
                  "يتم الآن جلب الإعلانات المميزة المتاحة.",
                  "Loading available featured listings.",
                )}
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
                  "ولا توجد حالياً إعلانات مميزة معتمدة لعرضها هنا. ستظهر البيانات الفعلية فقط عند توفرها.",
                  "There are also no approved featured listings to show here right now. Only real available data will appear.",
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
        </div>
      </main>
    </>
  );
}

function OfferSignal({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Store;
  label: string;
  value: string;
}) {
  return (
    <div className="rawaj-id-stat rounded-[1rem] p-3">
      <Icon className="h-4 w-4 text-gold" />
      <span className="mt-2 block text-[9px] font-semibold text-[#fffaf0]/52">{label}</span>
      <strong className="mt-1 block text-[11px] leading-4 text-[#fffaf0]">{value}</strong>
    </div>
  );
}

function OfferPrinciple({
  icon: Icon,
  world,
  title,
  body,
}: {
  icon: typeof Store;
  world: string;
  title: string;
  body: string;
}) {
  return (
    <article className={`rawaj-color-card ${world} rounded-[1.35rem] p-4`}>
      <div className="relative z-10 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.95rem] bg-primary text-primary-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-primary">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{body}</p>
        </div>
      </div>
    </article>
  );
}

function FeaturedListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();
  return (
    <Link to="/listings/$id" params={{ id: listing.id }} className="rawaj-product-card group block">
      <div className="rawaj-product-media aspect-[16/9]">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <span className="absolute start-2.5 top-2.5 rounded-full bg-primary/90 px-2.5 py-1 text-[9px] font-semibold text-primary-foreground shadow-soft backdrop-blur">
          {text("إعلان مميز", "Featured listing")}
        </span>
      </div>
      <div className="p-3.5">
        <div className="mb-1 inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
          <Building2 className="h-3 w-3" />
          {categoryName(listing.categoryId, listing.categoryNameAr, language)}
        </div>
        <h3 className="line-clamp-2 text-sm font-bold">{listing.title}</h3>
        <p className="mt-1.5 text-base font-extrabold text-primary">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
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
    <section className="rawaj-offers-empty mt-5 overflow-hidden rounded-[1.5rem] p-6 text-center sm:p-8">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-orange text-white shadow-[0_12px_28px_rgba(232,111,50,0.24)]">
        <Sparkles className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-base font-extrabold text-primary">{title}</h2>
      {body ? (
        <p className="mx-auto mt-1 max-w-xl text-xs leading-6 text-muted-foreground">{body}</p>
      ) : null}
    </section>
  );
}
