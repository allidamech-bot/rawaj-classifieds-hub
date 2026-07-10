import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  MapPin,
  MessageSquare,
  Package,
  ShieldAlert,
  Star,
  Store,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { SellerReviewCard } from "@/features/reviews/SellerReviewCard";
import {
  createSellerReview,
  fetchPublicSellerProfile,
  fetchSellerReviewEligibility,
} from "@/lib/classifieds-api";
import type { ClassifiedListing, PublicSellerProfile } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { absoluteUrl, createSeo, jsonLdScript, plainText } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/seller/$id")({
  loader: async ({ params }) => {
    const seller = await fetchPublicSellerProfile(params.id);
    if (!seller.ok) throw notFound();
    return seller.data;
  },
  notFoundComponent: () => (
    <SellerState
      titleAr="بائع"
      titleEn="Seller"
      bodyAr="تعذر عرض هذا البائع."
      bodyEn="This seller cannot be shown."
    />
  ),
  errorComponent: ({ reset }) => <SellerError reset={reset} />,
  head: ({ loaderData }) =>
    createSeo({
      title: loaderData
        ? `${loaderData.businessName || loaderData.displayName} | RAWAJ / رواج`
        : "بائع غير متاح | RAWAJ / رواج",
      description: loaderData
        ? sellerSeoDescription(loaderData)
        : "ملف البائع غير متاح للعرض العام على رواج.",
      path: loaderData ? `/seller/${loaderData.id}` : "/listings",
      type: "profile",
      image: loaderData?.avatarUrl ?? loaderData?.coverUrl ?? null,
      noindex: !loaderData,
    }),
  component: SellerPage,
});

function SellerPage() {
  const { text, language } = useUiPreferences();
  const seller = Route.useLoaderData();

  return (
    <div className="rawaj-pulse-page min-h-dvh" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader title={text("واجهة البائع", "Seller storefront")} />
      <main className="container-wide mobile-page-bottom pb-10 pt-3 sm:pt-5">
        <div className="space-y-7">
          <StorefrontHero seller={seller} />

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StorefrontMetric
              icon={MapPin}
              world="rawaj-world-orange"
              label={text("الموقع", "Location")}
              value={seller.locationAr ?? text("سوريا", "Syria")}
            />
            <StorefrontMetric
              icon={Package}
              world="rawaj-world-emerald"
              label={text("الإعلانات العامة", "Public listings")}
              value={`${seller.approvedListingCount}`}
            />
            <StorefrontMetric
              icon={CalendarDays}
              world="rawaj-world-indigo"
              label={text("على رواج منذ", "On RAWAJ since")}
              value={seller.joinedAt ? new Date(seller.joinedAt).getFullYear().toString() : "—"}
            />
            {seller.ratingSummary.count > 0 ? (
              <StorefrontMetric
                icon={Star}
                world="rawaj-world-gold"
                label={text("التقييم المعتمد", "Approved rating")}
                value={`${seller.ratingSummary.average} / 5`}
              />
            ) : (
              <StorefrontMetric
                icon={Store}
                world="rawaj-world-plum"
                label={text("نوع الواجهة", "Storefront")}
                value={
                  seller.businessName ? text("نشاط تجاري", "Business") : text("بائع", "Seller")
                }
              />
            )}
          </section>

          <section className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)] lg:items-start">
            <div className="space-y-4">
              <div className="rawaj-storefront-section">
                <span className="rawaj-signature-kicker">
                  {text("منتجات الواجهة", "Storefront products")}
                </span>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-xl font-extrabold text-primary sm:text-2xl">
                    {text("المعروض الآن", "Available now")}
                  </h2>
                  <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold text-primary-foreground">
                    {text(
                      `${seller.listings.length} إعلان معتمد`,
                      `${seller.listings.length} approved listings`,
                    )}
                  </span>
                </div>
              </div>

              {seller.listings.length === 0 ? (
                <div className="rawaj-color-card rawaj-world-orange rounded-[1.4rem] p-8 text-center text-sm text-muted-foreground">
                  {text("لا توجد إعلانات عامة لهذا البائع.", "This seller has no public listings.")}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {seller.listings.map((listing: ClassifiedListing) => (
                    <SellerListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <ReviewsPanel seller={seller} />
              <SafetyPanel />
            </div>
          </section>

          <script {...jsonLdScript(buildSellerStructuredData(seller))} />
        </div>
      </main>
    </div>
  );
}

function StorefrontHero({ seller }: { seller: PublicSellerProfile }) {
  const { text } = useUiPreferences();
  const displayName = seller.businessName || seller.displayName;

  return (
    <section className="rawaj-merchant-stage min-h-[19rem] overflow-hidden rounded-[1.8rem] sm:rounded-[2.1rem]">
      {seller.coverUrl ? (
        <img src={seller.coverUrl} alt="" decoding="async" className="rawaj-merchant-cover" />
      ) : null}
      <div className="rawaj-merchant-scrim" />

      <div className="relative z-10 flex min-h-[19rem] flex-col justify-end p-5 sm:p-7 lg:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-4">
            <span className="rawaj-id-avatar h-24 w-24 shrink-0 rounded-[1.45rem] text-3xl font-bold sm:h-28 sm:w-28">
              {seller.avatarUrl ? (
                <img
                  src={seller.avatarUrl}
                  alt={displayName}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                displayName.slice(0, 1).toUpperCase()
              )}
            </span>

            <div className="min-w-0 pb-1">
              <span className="rawaj-signature-kicker text-gold">
                {text("واجهة على رواج", "RAWAJ storefront")}
              </span>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-extrabold text-[#fffaf0] sm:text-3xl">
                  {displayName}
                </h1>
                {seller.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#1f7768] px-2.5 py-1 text-[10px] font-bold text-white">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {text("موثق", "Verified")}
                  </span>
                ) : null}
              </div>
              {seller.businessName && seller.businessName !== seller.displayName ? (
                <p className="mt-1 text-xs font-semibold text-[#fffaf0]/68">{seller.displayName}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#fffaf0]/72">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-gold" />
                  {seller.locationAr ?? text("سوريا", "Syria")}
                </span>
                {seller.joinedAt ? (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-gold" />
                    {text("منذ", "Since")} {new Date(seller.joinedAt).getFullYear()}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:min-w-[15rem]">
            <div className="rawaj-id-stat rounded-[1rem] p-3">
              <span className="block text-[9px] font-semibold text-[#fffaf0]/55">
                {text("المعروض", "Listings")}
              </span>
              <strong className="mt-1 block text-lg text-[#fffaf0]">
                {seller.approvedListingCount}
              </strong>
            </div>
            {seller.ratingSummary.count > 0 ? (
              <div className="rawaj-id-stat rounded-[1rem] p-3">
                <span className="block text-[9px] font-semibold text-[#fffaf0]/55">
                  {text("التقييم", "Rating")}
                </span>
                <strong className="mt-1 block text-lg text-[#fffaf0]">
                  {seller.ratingSummary.average} ★
                </strong>
              </div>
            ) : (
              <div className="rawaj-id-stat rounded-[1rem] p-3">
                <span className="block text-[9px] font-semibold text-[#fffaf0]/55">
                  {text("الحضور", "Presence")}
                </span>
                <strong className="mt-1 block text-xs text-[#fffaf0]">
                  {text("واجهة عامة", "Public")}
                </strong>
              </div>
            )}
          </div>
        </div>

        {seller.bio ? (
          <p className="mt-5 max-w-3xl rounded-[1.1rem] border border-white/10 bg-white/7 p-4 text-xs leading-6 text-[#fffaf0]/82 backdrop-blur-sm">
            {seller.bio}
          </p>
        ) : (
          <p className="mt-5 max-w-3xl text-xs leading-6 text-[#fffaf0]/68">
            {text(
              "هذه الواجهة تعرض فقط المعلومات العامة والإعلانات المعتمدة لهذا البائع.",
              "This storefront shows only public information and approved listings from this seller.",
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function StorefrontMetric({
  icon: Icon,
  world,
  label,
  value,
}: {
  icon: typeof MapPin;
  world: string;
  label: string;
  value: string;
}) {
  return (
    <article className={`rawaj-color-card ${world} rounded-[1.3rem] p-4`}>
      <div className="relative z-10 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.95rem] bg-primary text-primary-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <span className="block text-[10px] font-semibold text-muted-foreground">{label}</span>
          <strong className="mt-1 block truncate text-sm text-primary">{value}</strong>
        </div>
      </div>
    </article>
  );
}

function sellerSeoDescription(seller: PublicSellerProfile) {
  const parts = [
    plainText(seller.bio, 100),
    seller.locationAr ? `الموقع: ${seller.locationAr}` : null,
    `${seller.approvedListingCount} إعلان معتمد`,
    seller.verified ? "بائع موثق بعد مراجعة الإدارة" : null,
  ].filter(Boolean);

  return plainText(parts.join("، "), 160);
}

function buildSellerStructuredData(seller: PublicSellerProfile) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": seller.businessName ? "Organization" : "Person",
    name: seller.businessName || seller.displayName,
    url: absoluteUrl(`/seller/${seller.id}`),
    description: sellerSeoDescription(seller),
    areaServed: seller.locationAr ?? "سوريا",
  };

  if (seller.avatarUrl || seller.coverUrl) {
    data.image = absoluteUrl(seller.avatarUrl ?? seller.coverUrl ?? "");
  }

  return data;
}

type ReviewEligibilityUiState =
  "idle" | "loading" | "eligible" | "existing_review" | "no_qualifying_interaction" | "error";

function ReviewsPanel({ seller }: { seller: PublicSellerProfile }) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [eligibilityState, setEligibilityState] = useState<ReviewEligibilityUiState>("idle");
  const isOwnProfile = auth.status === "signedIn" && auth.profile?.id === seller.id;
  const shouldCheckEligibility = auth.status === "signedIn" && !isOwnProfile;

  useEffect(() => {
    if (!shouldCheckEligibility) {
      setEligibilityState("idle");
      return;
    }

    let cancelled = false;
    setEligibilityState("loading");
    setNotice("");

    void fetchSellerReviewEligibility(seller.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setEligibilityState("error");
        return;
      }

      if (result.data.eligible) {
        setEligibilityState("eligible");
        return;
      }

      if (result.data.reason === "existing_review") {
        setEligibilityState("existing_review");
        return;
      }

      if (result.data.reason === "no_qualifying_interaction") {
        setEligibilityState("no_qualifying_interaction");
        return;
      }

      setEligibilityState("error");
    });

    return () => {
      cancelled = true;
    };
  }, [auth.profile?.id, auth.status, seller.id, shouldCheckEligibility]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (eligibilityState !== "eligible") return;
    setNotice("");
    setSaving(true);
    const result = await createSellerReview({
      sellerUserId: seller.id,
      reviewerUserId: auth.profile?.id ?? null,
      rating,
      comment,
    });
    setSaving(false);
    if (result.ok) {
      setComment("");
      setRating(5);
      setEligibilityState("existing_review");
      setNotice(
        text(
          "تم إرسال التقييم للمراجعة قبل ظهوره للعامة.",
          "Review submitted for moderation before public display.",
        ),
      );
    } else {
      setNotice(result.error.message);
      if (result.error.code === "permission_denied") {
        setEligibilityState("no_qualifying_interaction");
      } else if (result.error.code === "status_mismatch") {
        setEligibilityState("existing_review");
      }
    }
  }

  return (
    <section className="rawaj-color-card rawaj-world-gold rounded-[1.5rem] p-4 sm:p-5">
      <div className="relative z-10">
        <span className="rawaj-signature-kicker">{text("صوت العملاء", "Customer voice")}</span>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-primary">
              <Star className="h-4 w-4 text-gold" />
              {text("التقييمات المعتمدة", "Approved reviews")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {seller.ratingSummary.count > 0
                ? text(
                    `${seller.ratingSummary.average} من 5 بناء على ${seller.ratingSummary.count} تقييم معتمد`,
                    `${seller.ratingSummary.average} of 5 from ${seller.ratingSummary.count} approved reviews`,
                  )
                : text("لا توجد تقييمات معتمدة بعد.", "No approved reviews yet.")}
            </p>
          </div>
          {seller.ratingSummary.count > 0 ? (
            <span className="rounded-full bg-primary px-3 py-2 text-sm font-extrabold text-primary-foreground">
              {seller.ratingSummary.average} ★
            </span>
          ) : null}
        </div>

        {seller.ratingSummary.count > 0 ? (
          <div className="mt-4 grid grid-cols-5 gap-1.5 text-center text-[10px] text-muted-foreground">
            {[5, 4, 3, 2, 1].map((star) => (
              <div key={star} className="rounded-[0.8rem] bg-white/70 p-2 hairline">
                <div className="font-bold text-foreground">
                  {seller.ratingSummary.distribution[star as 1 | 2 | 3 | 4 | 5]}
                </div>
                <div>{star} ★</div>
              </div>
            ))}
          </div>
        ) : null}

        {seller.reviews.length > 0 ? (
          <div className="mt-4 space-y-2">
            {seller.reviews.slice(0, 3).map((review) => (
              <SellerReviewCard key={review.id} review={review} canManageResponse={isOwnProfile} />
            ))}
          </div>
        ) : null}

        {auth.status !== "signedIn" ? (
          <div className="mt-4 rounded-[1rem] bg-white/72 p-3 text-xs leading-6 hairline">
            <p className="font-bold text-primary">
              {text("سجل الدخول لإرسال تقييم", "Log in to write a review")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {text(
                "التقييم متاح بعد تواصل فعلي مع البائع، ويظهر للعامة بعد المراجعة فقط.",
                "Reviews are available after real interaction with the seller and become public only after moderation.",
              )}
            </p>
            <Link
              to="/login"
              className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground"
            >
              {text("تسجيل الدخول", "Log in")}
            </Link>
          </div>
        ) : isOwnProfile ? (
          <p className="mt-4 rounded-[1rem] bg-white/72 p-3 text-xs font-semibold hairline">
            {text("لا يمكنك تقييم حسابك.", "You cannot review your own account.")}
          </p>
        ) : eligibilityState === "loading" || eligibilityState === "idle" ? (
          <p className="mt-4 rounded-[1rem] bg-white/72 p-3 text-xs font-semibold text-muted-foreground hairline">
            {text("جارٍ التحقق من أهلية التقييم…", "Checking review eligibility…")}
          </p>
        ) : eligibilityState === "existing_review" ? (
          <div className="mt-4 rounded-[1rem] bg-white/72 p-3 text-xs leading-6 hairline">
            <p className="font-bold text-primary">
              {text("لديك تقييم مسجل لهذا البائع", "You already have a review for this seller")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {notice ||
                text(
                  "التقييم الحالي قيد المراجعة أو معتمد بالفعل.",
                  "Your current review is pending moderation or already approved.",
                )}
            </p>
          </div>
        ) : eligibilityState === "no_qualifying_interaction" ? (
          <div className="mt-4 rounded-[1rem] bg-white/72 p-3 text-xs leading-6 hairline">
            <p className="font-bold text-primary">
              {text("التقييم يتطلب تواصلاً فعليًا", "A real interaction is required")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {text(
                "يمكنك تقييم البائع بعد محادثة متبادلة معه حول أحد إعلاناته. هذا يمنع التقييمات العشوائية.",
                "You can review a seller after a bidirectional conversation about one of their listings. This prevents random reviews.",
              )}
            </p>
          </div>
        ) : eligibilityState === "error" ? (
          <div className="mt-4 rounded-[1rem] bg-white/72 p-3 text-xs leading-6 hairline">
            <p className="font-bold text-primary">
              {text("التقييم غير متاح مؤقتًا", "Reviews are temporarily unavailable")}
            </p>
            <p className="mt-1 text-muted-foreground">
              {text(
                "تعذر التحقق من أهلية التقييم الآن. لم يتم فتح نموذج غير محمي.",
                "Review eligibility could not be verified. An unprotected review form was not opened.",
              )}
            </p>
          </div>
        ) : (
          <form onSubmit={(event) => void submitReview(event)} className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className={`min-h-11 rounded-lg px-3 py-2 text-xs font-bold hairline ${
                    rating >= value ? "bg-gold text-gold-foreground" : "bg-white/72"
                  }`}
                >
                  {value} ★
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1200}
              rows={3}
              disabled={saving}
              placeholder={text(
                "اكتب تجربتك مع هذا المعلن",
                "Write your experience with this seller",
              )}
              className="w-full rounded-xl bg-white/76 px-3 py-2 text-sm outline-none hairline disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
            >
              <MessageSquare className="h-4 w-4" />
              {saving
                ? text("جاري الإرسال", "Submitting")
                : text("إرسال للمراجعة", "Submit for review")}
            </button>
            {notice ? (
              <p className="rounded-xl bg-white/72 p-2 text-xs font-semibold">{notice}</p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}

function SafetyPanel() {
  const { text } = useUiPreferences();
  return (
    <section className="relative overflow-hidden rounded-[1.5rem] bg-primary p-5 text-primary-foreground shadow-premium">
      <div className="absolute -end-8 -top-8 h-28 w-28 rounded-full border border-white/10" />
      <div className="relative z-10 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[0.95rem] bg-brand-orange text-white">
          <ShieldAlert className="h-5 w-5" />
        </span>
        <div>
          <span className="rawaj-signature-kicker text-gold">
            {text("أمان التعامل", "Safer trading")}
          </span>
          <h3 className="mt-1 text-sm font-extrabold">
            {text("افحص قبل أن تدفع", "Check before you pay")}
          </h3>
          <p className="mt-2 text-xs leading-6 text-primary-foreground/72">
            {text(
              "قابل البائع في مكان عام وآمن، وافحص السلعة قبل الدفع. لا تحوّل المال قبل التأكد.",
              "Meet in a safe public place, inspect the item before paying, and do not transfer money before verifying.",
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

function SellerListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language } = useUiPreferences();

  return (
    <Link to="/listings/$id" params={{ id: listing.id }} className="rawaj-product-card block">
      <div className="rawaj-product-media aspect-[4/3]">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <span className="absolute bottom-2 end-2 rounded-full bg-primary/88 px-2.5 py-1 text-[10px] font-bold text-primary-foreground backdrop-blur-sm">
          {categoryName(listing.categoryId, listing.categoryNameAr, language)}
        </span>
      </div>
      <div className="p-3.5">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="mt-2 text-lg font-extrabold text-primary">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
        </div>
        <p className="mt-1.5 truncate text-xs text-muted-foreground">
          {governorateName(listing.governorateId, listing.governorateNameAr, language)}
          {listing.districtAr ? ` · ${listing.districtAr}` : ""}
        </p>
      </div>
    </Link>
  );
}

function SellerState({
  titleAr,
  titleEn,
  bodyAr,
  bodyEn,
}: {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}) {
  const { text } = useUiPreferences();
  return (
    <div>
      <PageHeader title={text(titleAr, titleEn)} />
      <main className="container-wide mobile-page-bottom pt-10 text-center text-sm text-muted-foreground">
        {text(bodyAr, bodyEn)}
      </main>
    </div>
  );
}

function SellerError({ reset }: { reset: () => void }) {
  const { text } = useUiPreferences();
  return (
    <div>
      <PageHeader title={text("خطأ", "Error")} />
      <main className="container-wide mobile-page-bottom pt-10 text-center">
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          {text("إعادة المحاولة", "Try again")}
        </button>
      </main>
    </div>
  );
}
