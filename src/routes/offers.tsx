import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin, Plus, Search, Sparkles } from "lucide-react";
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
        "مساحة مخصصة للإعلانات المميزة داخل الأقسام. تظهر الإعلانات المميزة من البيانات المتاحة بعد مراجعة الإدارة.",
      path: "/offers",
    }),
  component: OffersPage,
});

const offerChips = [
  { labelAr: "الإعلانات المميزة", labelEn: "Featured listings" },
  { labelAr: "كل الإعلانات المميزة", labelEn: "All featured listings" },
  { labelAr: "السيارات", labelEn: "Vehicles", q: "سيارات" },
  { labelAr: "العقارات", labelEn: "Real estate", q: "عقارات" },
  { labelAr: "الجوالات والإلكترونيات", labelEn: "Electronics", q: "جوالات" },
  { labelAr: "الخدمات", labelEn: "Services", q: "خدمات" },
  { labelAr: "حسب المحافظة", labelEn: "By governorate" },
];

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
      const result = await fetchPublicListings({ sort: "featured" });
      if (cancelled) return;
      if (result.ok) setListings(result.data.filter((listing) => listing.isFeatured));
      else setError(result.error);
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const featuredOffers = listings.slice(0, 5);
  const regularOffers = listings.slice(5);

  return (
    <>
      <PageHeader title={text("العروض والإعلانات المميزة", "Offers and featured listings")} />
      <main className="container-wide mobile-page-bottom pt-4">
        <section className="rounded-2xl bg-card p-4 shadow-soft hairline">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/15 text-gold">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-extrabold">
                {text("العروض والإعلانات المميزة", "Offers and featured listings")}
              </h1>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "تعرض هذه الصفحة الإعلانات المميزة المتاحة حالياً من بيانات السوق، دون افتراض خصومات أو عروض شركات غير مؤكدة.",
                  "This page shows currently available featured marketplace listings without assuming discounts or company-only offers.",
                )}
              </p>
            </div>
          </div>
          <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {offerChips.map((chip) => (
              <Link
                key={chip.labelAr}
                to={chip.q ? "/listings" : "/offers"}
                search={chip.q ? { q: chip.q } : undefined}
                className="shrink-0 rounded-full bg-muted-surface px-3 py-1.5 text-xs font-bold text-foreground hairline transition active:scale-[0.98]"
              >
                {text(chip.labelAr, chip.labelEn)}
              </Link>
            ))}
          </div>
        </section>

        {loading ? (
          <EmptyOffer title={text("جاري تحميل العروض", "Loading offers")} />
        ) : error ? (
          <EmptyOffer title={text("تعذر تحميل العروض", "Could not load offers")} body={error.message} />
        ) : featuredOffers.length === 0 ? (
          <EmptyOffer
            title={text("لا توجد إعلانات مميزة حالياً", "No featured listings right now")}
            body={text(
              "يمكنك إضافة إعلانك أو طلب ترويج يدوي ليظهر ضمن المساحات المناسبة بعد المراجعة.",
              "You can post a listing or request manual promotion for suitable spaces after review.",
            )}
          />
        ) : (
          <>
            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-extrabold">{text("إعلانات مميزة", "Featured listings")}</h2>
                <Link to="/promotion" className="text-xs font-bold text-primary">
                  {text("طلب ترويج", "Request promotion")}
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                {featuredOffers.map((listing, index) => (
                  <OfferCard key={listing.id} listing={listing} large={index === 0} />
                ))}
              </div>
            </section>

            {regularOffers.length > 0 && (
              <section className="mt-7">
                <h2 className="mb-3 text-sm font-extrabold">
                  {text("إعلانات مميزة أخرى", "More featured listings")}
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {regularOffers.map((listing) => (
                    <OfferCard key={listing.id} listing={listing} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}

function OfferCard({
  listing,
  large = false,
}: {
  listing: ClassifiedListing;
  large?: boolean;
}) {
  const { language, text } = useUiPreferences();
  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className={`overflow-hidden rounded-2xl bg-card shadow-soft hairline tap-card ${
        large ? "lg:col-span-2 lg:row-span-2" : ""
      }`}
    >
      <div className="relative">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            className="aspect-[16/9] max-h-52 w-full object-cover lg:max-h-none"
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
        <span className="mt-3 inline-flex rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
          {text("شاهد الإعلان", "View listing")}
        </span>
      </div>
    </Link>
  );
}

function EmptyOffer({ title, body }: { title: string; body?: string }) {
  const { text } = useUiPreferences();
  return (
    <section className="mt-5 rounded-2xl bg-card p-6 text-center shadow-soft hairline">
      <Search className="mx-auto h-7 w-7 text-gold" />
      <h2 className="mt-3 text-base font-extrabold">{title}</h2>
      {body && <p className="mx-auto mt-1 max-w-xl text-xs leading-6 text-muted-foreground">{body}</p>}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          to="/add-listing"
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-extrabold text-gold-foreground"
        >
          <Plus className="h-4 w-4" />
          {text("أضف إعلانك", "Post your listing")}
        </Link>
        <Link
          to="/promotion"
          className="rounded-xl bg-muted-surface px-4 py-2 text-xs font-bold text-foreground hairline"
        >
          {text("طلب ترويج", "Request promotion")}
        </Link>
      </div>
    </section>
  );
}
