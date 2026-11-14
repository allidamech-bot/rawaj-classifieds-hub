import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ArrowUpLeft, BadgePercent, Clock3, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListingCardImage } from "@/features/listings/cards/ListingCardImage";
import { fetchActivePriceDropOffers, type ListingPriceDropOffer } from "@/lib/classifieds-api";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { marketLocale } from "@/lib/market-locale";
import { createSeo } from "@/lib/seo";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";

export const Route = createFileRoute("/offers")({
  loader: async () => {
    const result = await fetchActivePriceDropOffers(30);
    return result.ok ? { offers: result.data, error: null } : { offers: [], error: result.error };
  },
  head: () =>
    createSeo({
      title: "العروض الحقيقية | RAWAJ / رواج",
      description:
        "إعلانات انخفض سعرها فعلياً على رواج، مع السعر السابق والجديد ونسبة التخفيض وتاريخ الانخفاض.",
      path: "/offers",
    }),
  component: OffersPage,
});

function OffersPage() {
  const router = useRouter();
  const { text } = useUiPreferences();
  const { offers, error } = Route.useLoaderData();
  const [retrying, setRetrying] = useState(false);
  const retryInFlightRef = useRef(false);

  async function retryOffers() {
    if (retryInFlightRef.current) return;
    retryInFlightRef.current = true;
    setRetrying(true);
    try {
      await router.invalidate();
    } finally {
      retryInFlightRef.current = false;
      setRetrying(false);
    }
  }

  return (
    <>
      <PageHeader title={text("العروض", "Offers")} />
      <main className="rawaj-pulse-page rawaj-offers-premium-v3 min-h-dvh">
        <div className="container-wide mobile-page-bottom pb-8 pt-3 sm:pt-5">
          <section className="rawaj-offers-stage">
            <div className="relative z-10 grid min-h-[15rem] gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.45fr)] lg:items-end lg:p-9">
              <div className="self-end">
                <span className="rawaj-signature-kicker text-gold">
                  {text("تخفيضات موثقة", "Recorded price drops")}
                </span>
                <h1 className="mt-3 max-w-xl text-[1.7rem] font-extrabold leading-[1.38] text-[#fffaf0] sm:text-[2.3rem]">
                  {text(
                    "السعر نزل فعلاً — وهنا يظهر.",
                    "The price really dropped — it shows here.",
                  )}
                </h1>
                <p className="mt-3 max-w-xl text-xs leading-6 text-[#fffaf0]/72 sm:text-sm sm:leading-7">
                  {text(
                    "نعرض فقط الإعلانات التي خفّض صاحبها السعر فعلياً. السعر السابق والجديد ونسبة التخفيض محفوظة في البيانات، ولا علاقة للإعلان المميز بهذه الصفحة.",
                    "Only listings with a real owner-recorded price reduction appear here. Old price, new price and discount percentage come from recorded data; featured promotion is separate.",
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <OfferSignal
                  icon={BadgePercent}
                  label={text("الخصم", "Discount")}
                  value={text("محسوب من السعرين", "Calculated from prices")}
                />
                <OfferSignal
                  icon={Clock3}
                  label={text("الحداثة", "Recency")}
                  value={text("آخر 30 يوماً", "Last 30 days")}
                />
                <OfferSignal
                  icon={ShieldCheck}
                  label={text("التحقق", "Verification")}
                  value={text("السعر الحالي يطابق التخفيض", "Current price must match")}
                />
                <OfferSignal
                  icon={Sparkles}
                  label={text("الوضوح", "Clarity")}
                  value={text("لا Featured مزيف", "No fake featured offers")}
                />
              </div>
            </div>
          </section>

          <section className="mt-7">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="rawaj-signature-kicker">
                  {text("تخفيضات حديثة", "Recent reductions")}
                </span>
                <h2 className="mt-1 text-xl font-extrabold text-primary sm:text-2xl">
                  {text("إعلانات انخفض سعرها فعلياً", "Listings with real price drops")}
                </h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {text(
                    "يختفي العرض تلقائياً إذا تغيّر السعر الحالي أو انتهى الإعلان أو لم يعد متاحاً للعامة.",
                    "An offer disappears automatically if the current price changes, the listing expires, or it is no longer public.",
                  )}
                </p>
              </div>

              <Link
                to="/listings"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground"
              >
                {text("كل الإعلانات", "All listings")}
                <ArrowUpLeft className="h-3.5 w-3.5 rtl:-rotate-90" />
              </Link>
            </div>

            {error ? (
              <OffersState
                title={text("تعذر تحميل العروض", "Could not load offers")}
                body={text(
                  "لم نتمكن من جلب التخفيضات الآن. حاول مرة أخرى بعد قليل.",
                  "We could not load price drops right now. Please try again shortly.",
                )}
                actionLabel={text("إعادة المحاولة", "Try again")}
                onAction={() => void retryOffers()}
                actionDisabled={retrying}
              />
            ) : offers.length === 0 ? (
              <OffersState
                title={text("لا توجد تخفيضات حقيقية حالياً", "No real price drops right now")}
                body={text(
                  "لن نملأ الصفحة بإعلانات مميزة أو خصومات غير موثقة. ستظهر هنا التخفيضات الفعلية عند تسجيلها.",
                  "We will not fill this page with featured listings or unverified discounts. Real recorded reductions will appear here.",
                )}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {offers.map((offer) => (
                  <PriceDropOfferCard key={offer.listing.id} offer={offer} />
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
  icon: typeof BadgePercent;
  label: string;
  value: string;
}) {
  return (
    <div className="rawaj-id-stat rounded-[1rem] p-3">
      <Icon className="h-4 w-4 text-gold" />
      <span className="mt-2 block text-xs font-semibold text-[#fffaf0]/80">{label}</span>
      <strong className="mt-1 block text-xs leading-4 text-[#fffaf0]">{value}</strong>
    </div>
  );
}

function PriceDropOfferCard({ offer }: { offer: ListingPriceDropOffer }) {
  const { language, text } = useUiPreferences();
  const { listing } = offer;

  return (
    <Link to="/listings/$id" params={{ id: listing.id }} className="rawaj-product-card group block">
      <div className="rawaj-product-media aspect-[16/9]">
        <ListingCardImage
          src={listing.primaryImageUrl}
          alt={listing.title}
          placeholder={listing.categoryPlaceholder ?? "misc"}
          placeholderAspect="wide"
          width={640}
          height={360}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
        />
        <span className="absolute start-2.5 top-2.5 rounded-full bg-destructive px-2.5 py-1 text-[10px] font-extrabold text-destructive-foreground shadow-soft">
          -{formatDiscountPercent(offer.discountPercent)}%
        </span>
      </div>

      <div className="p-3.5">
        <p className="text-[11px] font-bold text-muted-foreground">
          {categoryName(listing.categoryId, listing.categoryNameAr, language)}
        </p>
        <h3 className="mt-1 line-clamp-2 text-sm font-bold">{listing.title}</h3>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <strong className="text-base font-extrabold text-primary">
            {formatPriceLocalized(offer.newPrice, listing.priceType, language, listing.currency)}
          </strong>
          <span className="text-[11px] text-muted-foreground line-through decoration-destructive/60">
            {formatPriceLocalized(offer.oldPrice, listing.priceType, language, listing.currency)}
          </span>
        </div>

        <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {governorateName(listing.governorateId, listing.governorateNameAr, language)}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock3 className="h-3 w-3" />
          {text("انخفض السعر", "Price dropped")} {formatDropDate(offer.droppedAt, language)}
        </p>
      </div>
    </Link>
  );
}

function OffersState({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled = false,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <section className="rawaj-offers-empty mt-5 overflow-hidden rounded-[1.5rem] p-6 text-center sm:p-8">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-orange text-white">
        <BadgePercent className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-sm font-extrabold text-primary">{title}</h3>
      {body ? (
        <p className="mx-auto mt-1 max-w-xl text-xs leading-6 text-muted-foreground">{body}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          aria-busy={actionDisabled}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function formatDiscountPercent(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatDropDate(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(marketLocale(language), {
    day: "numeric",
    month: "short",
  }).format(date);
}
