import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, MessageSquare, ShieldAlert, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { createSellerReview, fetchPublicSellerProfile } from "@/lib/classifieds-api";
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
  const { text } = useUiPreferences();
  const seller = Route.useLoaderData();

  return (
    <div>
      <PageHeader title={text("ملف البائع", "Seller profile")} />
      <main className="container-wide mobile-page-bottom pt-4">
        <div className="space-y-4">
          <SellerHeader seller={seller} />

          <section className="rounded-2xl bg-card p-4 hairline">
            <h3 className="text-sm font-extrabold">{text("نبذة عن البائع", "About the seller")}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "يعرض هذا الملف الإعلانات العامة المعتمدة لهذا البائع فقط. لا تظهر أي بيانات خاصة من حسابه.",
                "This profile shows only this seller's public approved listings. Private account data is not shown.",
              )}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
              <Metric
                label={text("الموقع", "Location")}
                value={seller.locationAr ?? text("سوريا", "Syria")}
              />
              <Metric
                label={text("التقييم", "Rating")}
                value={
                  seller.ratingSummary.count > 0
                    ? `${seller.ratingSummary.average} / 5`
                    : text("لا يوجد", "None")
                }
              />
              <Metric
                label={text("الإعلانات", "Listings")}
                value={`${seller.approvedListingCount}`}
              />
              <Metric
                label={text("منذ", "Since")}
                value={seller.joinedAt ? new Date(seller.joinedAt).getFullYear().toString() : "-"}
              />
            </div>
          </section>

          <ReviewsPanel seller={seller} />

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold">
                <span className="inline-block border-b-2 border-gold pb-0.5">
                  {text(
                    `الإعلانات المعتمدة (${seller.listings.length})`,
                    `Approved listings (${seller.listings.length})`,
                  )}
                </span>
              </h2>
              <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
                {text("إعلانات البائع", "Seller listings")}
              </span>
            </div>
            {seller.listings.length === 0 ? (
              <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground hairline">
                {text("لا توجد إعلانات عامة لهذا البائع.", "This seller has no public listings.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {seller.listings.map((listing: ClassifiedListing) => (
                  <SellerListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
          </section>

          <section className="flex items-start gap-3 rounded-2xl bg-card p-4 text-xs text-muted-foreground hairline">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <p className="leading-6">
              <strong className="text-foreground">{text("تنبيه أمان", "Safety note")}: </strong>
              {text(
                "قابل البائع في مكان عام وآمن، وافحص السلعة قبل الدفع. لا تحوّل المال قبل التأكد.",
                "Meet in a safe public place, inspect the item before paying, and do not transfer money before verifying.",
              )}
            </p>
          </section>
          <script {...jsonLdScript(buildSellerStructuredData(seller))} />
        </div>
      </main>
    </div>
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

function SellerHeader({ seller }: { seller: PublicSellerProfile }) {
  const { text } = useUiPreferences();
  return (
    <section className="overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-premium">
      <div className="relative h-40 overflow-hidden bg-primary-foreground/10">
        {seller.coverUrl && (
          <>
            <img
              src={seller.coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-25 blur-md"
            />
            <img
              src={seller.coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="relative z-10 h-full w-full object-contain"
            />
          </>
        )}
      </div>
      <div className="-mt-10 flex items-end gap-4 px-5 pb-5">
        <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-primary text-xl font-bold text-gold ring-4 ring-primary">
          {seller.avatarUrl ? (
            <img
              src={seller.avatarUrl}
              alt={seller.displayName}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            seller.displayName.slice(0, 1)
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-extrabold">{seller.displayName}</h1>
            {seller.businessName && (
              <span className="rounded-md bg-primary-foreground/10 px-2 py-0.5 text-[11px] font-bold">
                {seller.businessName}
              </span>
            )}
            {seller.verified && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
                <BadgeCheck className="h-3 w-3" />
                {text("موثق", "Verified")}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/80">
            <span>
              {seller.locationAr
                ? text(seller.locationAr, seller.locationAr)
                : text("سوريا", "Syria")}
            </span>
            {seller.joinedAt && (
              <span>
                {text("منذ", "Since")} {new Date(seller.joinedAt).getFullYear()}
              </span>
            )}
            <span>
              {text(
                `${seller.approvedListingCount} إعلان`,
                `${seller.approvedListingCount} listings`,
              )}
            </span>
          </div>
        </div>
      </div>
      {seller.bio && (
        <p className="mx-5 mb-5 rounded-xl bg-primary-foreground/10 p-3 text-xs leading-6 text-primary-foreground/85">
          {seller.bio}
        </p>
      )}
    </section>
  );
}

function ReviewsPanel({ seller }: { seller: PublicSellerProfile }) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const canReview = auth.status === "signedIn" && auth.profile?.id !== seller.id;
  const isOwnProfile = auth.status === "signedIn" && auth.profile?.id === seller.id;

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      setNotice(
        text(
          "تم إرسال التقييم للمراجعة قبل ظهوره للعامة.",
          "Review submitted for moderation before public display.",
        ),
      );
    } else {
      setNotice(result.error.message);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-4 hairline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold">
            <Star className="h-4 w-4 text-gold" />
            {text("تقييمات المعلن", "Seller ratings")}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {seller.ratingSummary.count > 0
              ? text(
                  `${seller.ratingSummary.average} من 5 بناء على ${seller.ratingSummary.count} تقييم معتمد`,
                  `${seller.ratingSummary.average} of 5 from ${seller.ratingSummary.count} approved reviews`,
                )
              : text("لا توجد تقييمات معتمدة بعد.", "No approved reviews yet.")}
          </p>
        </div>
        {seller.ratingSummary.count > 0 && (
          <span className="rounded-xl bg-muted-surface px-3 py-2 text-sm font-extrabold">
            {seller.ratingSummary.average} ★
          </span>
        )}
      </div>
      {seller.ratingSummary.count > 0 && (
        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px] text-muted-foreground">
          {[5, 4, 3, 2, 1].map((star) => (
            <div key={star} className="rounded-lg bg-muted-surface p-2">
              <div className="font-bold text-foreground">
                {seller.ratingSummary.distribution[star as 1 | 2 | 3 | 4 | 5]}
              </div>
              <div>{star} ★</div>
            </div>
          ))}
        </div>
      )}
      {seller.reviews.length > 0 && (
        <div className="mt-3 space-y-2">
          {seller.reviews.slice(0, 3).map((review) => (
            <article key={review.id} className="rounded-xl bg-muted-surface p-3">
              <div className="text-xs font-bold text-gold">{"★".repeat(review.rating)}</div>
              <p className="mt-1 whitespace-pre-line text-xs leading-6">{review.comment}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString(
                  language === "ar" ? "ar-SY" : "en-US",
                )}
              </p>
            </article>
          ))}
        </div>
      )}
      {auth.status !== "signedIn" ? (
        <div className="mt-4 rounded-xl bg-muted-surface p-3 text-xs leading-6 hairline">
          <p className="font-bold">{text("سجل الدخول لإرسال تقييم", "Log in to write a review")}</p>
          <p className="mt-1 text-muted-foreground">
            {text(
              "تظهر التقييمات للعامة بعد المراجعة فقط.",
              "Reviews become public only after moderation.",
            )}
          </p>
          <Link
            to="/login"
            className="mt-3 inline-flex rounded-lg bg-primary px-3 py-2 font-bold text-primary-foreground"
          >
            {text("تسجيل الدخول", "Log in")}
          </Link>
        </div>
      ) : isOwnProfile ? (
        <p className="mt-4 rounded-xl bg-muted-surface p-3 text-xs font-semibold hairline">
          {text("لا يمكنك تقييم حسابك.", "You cannot review your own account.")}
        </p>
      ) : (
        <form onSubmit={(event) => void submitReview(event)} className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`rounded-lg px-2 py-1 text-xs font-bold hairline ${
                  rating >= value ? "bg-gold text-gold-foreground" : "bg-muted-surface"
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
            className="w-full rounded-xl bg-muted-surface px-3 py-2 text-sm outline-none hairline disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!canReview || saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
          >
            <MessageSquare className="h-4 w-4" />
            {saving
              ? text("جاري الإرسال", "Submitting")
              : text("إرسال للمراجعة", "Submit for review")}
          </button>
          {notice && (
            <p className="rounded-xl bg-muted-surface p-2 text-xs font-semibold">{notice}</p>
          )}
        </form>
      )}
    </section>
  );
}

function SellerListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="block overflow-hidden rounded-2xl bg-card shadow-soft transition-shadow hairline hover:shadow-premium"
    >
      <div className="relative">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <span className="absolute bottom-2 end-2 rounded-md bg-primary/85 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          {categoryName(listing.categoryId, listing.categoryNameAr, language)}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-lg font-extrabold text-foreground">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
        </div>
        <p className="truncate text-xs text-muted-foreground">
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-3">
      <div>{label}</div>
      <div className="mt-1 font-bold text-foreground">{value}</div>
    </div>
  );
}
