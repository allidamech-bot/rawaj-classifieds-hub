import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MessageSquare, ShieldAlert, Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SellerReviewCard } from "@/features/reviews/SellerReviewCard";
import { AdaptiveListingCard } from "@/features/listings/cards/AdaptiveListingCard";
import {
  StorefrontIdentityHero,
  StorefrontNotice,
  StorefrontSectionHeader,
} from "@/features/storefront/StorefrontIdentityHero";
import {
  createSellerReview,
  fetchPublicSellerProfile,
  fetchSellerReviewEligibility,
  SELLER_REVIEW_TRAITS,
  sellerReviewTraitLabel,
} from "@/lib/classifieds-api";
import type { PublicSellerProfile } from "@/lib/classifieds-types";
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
    <div className="rawaj-storefront-v2 min-h-dvh" dir={language === "ar" ? "rtl" : "ltr"}>
      <PageHeader title={text("واجهة البائع", "Seller storefront")} />
      <main className="container-wide mobile-page-bottom pb-10 pt-3 sm:pt-5">
        <div className="space-y-7">
          <StorefrontIdentityHero
            mode="public"
            sellerId={seller.id}
            displayName={seller.businessName || seller.displayName}
            secondaryName={seller.businessName ? seller.displayName : null}
            avatarUrl={seller.avatarUrl}
            coverUrl={seller.coverUrl}
            bio={seller.bio}
            location={seller.locationAr}
            verified={seller.verified}
            joinedAt={seller.joinedAt}
            ratingAverage={seller.ratingSummary.average}
            ratingCount={seller.ratingSummary.count}
            approvedCount={seller.approvedListingCount}
          />

          <section className="rawaj-storefront-v2__layout">
            <div className="rawaj-storefront-v2__main">
              <StorefrontSectionHeader
                eyebrow={text("منتجات الواجهة", "Storefront products")}
                title={text("المعروض الآن", "Available now")}
                description={text(
                  "إعلانات عامة معتمدة ومتاح تصفحها مباشرة.",
                  "Approved public listings available to browse now.",
                )}
                count={seller.listings.length}
              />

              {seller.listings.length === 0 ? (
                <StorefrontNotice
                  tone="empty"
                  title={text("لا توجد إعلانات عامة الآن", "No public listings right now")}
                  description={text(
                    "ستظهر هنا الإعلانات المعتمدة عندما ينشر البائع عروضاً جديدة.",
                    "Approved listings will appear here when the seller publishes new offers.",
                  )}
                />
              ) : (
                <div id="storefront-listings" className="rawaj-storefront-v2__product-grid">
                  {seller.listings.map((listing) => (
                    <AdaptiveListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              )}
            </div>

            <div className="rawaj-storefront-v2__aside">
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
  const [selectedTraits, setSelectedTraits] = useState<(typeof SELLER_REVIEW_TRAITS)[number][]>([]);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [eligibilityState, setEligibilityState] = useState<ReviewEligibilityUiState>("idle");
  const eligibilityRequestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  const reviewSubmitProfilesRef = useRef<Set<string>>(new Set());
  profileIdRef.current = profileId;
  const isOwnProfile = auth.status === "signedIn" && profileId === seller.id;
  const shouldCheckEligibility = auth.status === "signedIn" && Boolean(profileId) && !isOwnProfile;

  useEffect(() => {
    eligibilityRequestIdRef.current += 1;
    setRating(5);
    setComment("");
    setSelectedTraits([]);
    setNotice("");
    setSaving(false);
    setEligibilityState("idle");
  }, [profileId, seller.id]);

  const loadEligibility = useCallback(async () => {
    const currentProfileId = profileId;
    if (!shouldCheckEligibility || !currentProfileId) {
      eligibilityRequestIdRef.current += 1;
      setEligibilityState("idle");
      return;
    }
    const requestId = ++eligibilityRequestIdRef.current;
    setEligibilityState("loading");
    setNotice("");
    const result = await fetchSellerReviewEligibility(seller.id);
    if (requestId !== eligibilityRequestIdRef.current || currentProfileId !== profileIdRef.current)
      return;
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
  }, [profileId, seller.id, shouldCheckEligibility]);

  useEffect(() => {
    void loadEligibility();
    return () => {
      eligibilityRequestIdRef.current += 1;
    };
  }, [loadEligibility]);

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentProfileId = profileId;
    if (eligibilityState !== "eligible" || !currentProfileId) return;
    if (reviewSubmitProfilesRef.current.has(currentProfileId)) return;

    const currentRating = rating;
    const currentComment = comment;
    const currentTraits = selectedTraits;
    reviewSubmitProfilesRef.current.add(currentProfileId);
    setNotice("");
    setSaving(true);
    try {
      const result = await createSellerReview({
        sellerUserId: seller.id,
        reviewerUserId: currentProfileId,
        rating: currentRating,
        comment: currentComment,
        traits: currentTraits,
      });
      if (currentProfileId !== profileIdRef.current) return;
      if (result.ok) {
        setComment("");
        setRating(5);
        setSelectedTraits([]);
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
    } finally {
      reviewSubmitProfilesRef.current.delete(currentProfileId);
      if (currentProfileId === profileIdRef.current) setSaving(false);
    }
  }

  return (
    <section id="seller-reviews" className="rawaj-storefront-v2__reviews">
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
              <SellerReviewCard
                key={`${profileId ?? "signed-out"}:${review.id}`}
                review={review}
                canManageResponse={isOwnProfile}
              />
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
            <button type="button" onClick={() => void loadEligibility()} className="mt-2 underline">
              {text("إعادة المحاولة", "Try again")}
            </button>
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
            <div>
              <p className="text-[10px] font-bold text-muted-foreground">
                {text("صفات سريعة — اختر حتى 3", "Quick traits — choose up to 3")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SELLER_REVIEW_TRAITS.map((trait) => {
                  const selected = selectedTraits.includes(trait);
                  return (
                    <button
                      key={trait}
                      type="button"
                      aria-pressed={selected}
                      disabled={saving || (!selected && selectedTraits.length >= 3)}
                      onClick={() =>
                        setSelectedTraits((current) =>
                          current.includes(trait)
                            ? current.filter((item) => item !== trait)
                            : current.length >= 3
                              ? current
                              : [...current, trait],
                        )
                      }
                      className={`min-h-11 rounded-xl px-3 py-2 text-[11px] font-bold hairline disabled:opacity-45 ${
                        selected ? "bg-primary text-primary-foreground" : "bg-white/72"
                      }`}
                    >
                      {sellerReviewTraitLabel(trait, language)}
                    </button>
                  );
                })}
              </div>
            </div>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={1200}
              rows={3}
              disabled={saving}
              placeholder={text(
                "تعليق كتابي اختياري — 10 أحرف على الأقل عند الكتابة",
                "Optional written comment — at least 10 characters when provided",
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
    <section className="rawaj-storefront-safety">
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
