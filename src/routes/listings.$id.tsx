import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  Clock,
  Flag,
  Heart,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldAlert,
  User,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { UnavailableListingRecovery } from "@/features/listing-detail/UnavailableListingRecovery";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { categoryDetailDisplayRows, detectCategoryFieldKind } from "@/lib/category-fields";
import {
  createListingReport,
  favoriteListing,
  fetchFavoriteStatus,
  fetchListingDetail,
  fetchListingImages,
  startListingConversation,
  unfavoriteListing,
} from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError, ListingImage } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { absoluteUrl, createSeo, jsonLdScript, plainText } from "@/lib/seo";
import { listingStatusLabel } from "@/lib/status-labels";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/listings/$id")({
  loader: async ({ params }) => {
    const listing = await fetchListingDetail(params.id);
    if (!listing.ok) throw notFound();
    return listing.data;
  },
  notFoundComponent: UnavailableListingRecovery,
  head: ({ loaderData }) =>
    createSeo({
      title: loaderData ? `${loaderData.title} | RAWAJ / رواج` : "إعلان غير متاح | RAWAJ / رواج",
      description: loaderData
        ? plainText(loaderData.description || "تفاصيل إعلان معتمد على رواج.", 160)
        : "هذا الإعلان غير متاح للعرض العام على رواج.",
      path: loaderData ? `/listings/${loaderData.id}` : "/listings",
      type: "article",
      image: loaderData?.primaryImageUrl ?? null,
      noindex: !loaderData,
    }),
  component: ListingDetailsPage,
});

function ListingDetailsPage() {
  const { id } = Route.useParams();
  const initialListing = Route.useLoaderData();
  const navigate = useNavigate();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listing, setListing] = useState<ClassifiedListing | null>(initialListing);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(!initialListing);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [imageError, setImageError] = useState<ClassifiedsError | null>(null);
  const [fav, setFav] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const favoriteInFlightRef = useRef(false);
  const favoriteRequestIdRef = useRef(0);
  const imageRequestIdRef = useRef(0);

  useEffect(() => {
    setListing(initialListing);
    setLoading(false);
    setError(null);
  }, [initialListing, id]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++imageRequestIdRef.current;
    setImages([]);
    setSelectedImageIndex(0);
    setImageError(null);

    async function loadImages() {
      const result = await fetchListingImages(id);
      if (cancelled || requestId !== imageRequestIdRef.current) return;
      if (result.ok) setImages(result.data);
      else setImageError(result.error);
    }

    void loadImages();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++favoriteRequestIdRef.current;
    const profileId = auth.profile?.id ?? null;
    if (auth.status !== "signedIn" || !profileId) {
      setFav(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadFavorite() {
      const result = await fetchFavoriteStatus(profileId, id);
      if (!cancelled && requestId === favoriteRequestIdRef.current && result.ok) {
        setFav(result.data);
      } else if (!cancelled && requestId === favoriteRequestIdRef.current && !result.ok) {
        setActionMessage(result.error.message);
      }
    }

    void loadFavorite();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.profile?.id, id]);

  async function toggleFavorite() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      setActionMessage(
        text("يجب تسجيل الدخول لحفظ الإعلان في المفضلة.", "Log in to save this listing."),
      );
      return;
    }
    if (favoriteInFlightRef.current) return;

    const profileId = auth.profile?.id ?? null;
    const desiredFavoriteState = !fav;
    const requestId = ++favoriteRequestIdRef.current;
    favoriteInFlightRef.current = true;

    try {
      const result = desiredFavoriteState
        ? await favoriteListing(profileId, id)
        : await unfavoriteListing(profileId, id);
      if (requestId !== favoriteRequestIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
        return;
      }

      setFav(desiredFavoriteState);
      setActionMessage(
        desiredFavoriteState
          ? text("تم حفظ الإعلان في المفضلة.", "Saved to favorites.")
          : text("تمت إزالة الإعلان من المفضلة.", "Removed from favorites."),
      );
    } finally {
      favoriteInFlightRef.current = false;
    }
  }

  async function reportListing() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      setActionMessage(text("يجب تسجيل الدخول لإرسال بلاغ.", "Log in to report a listing."));
      return;
    }

    const result = await createListingReport(
      auth.profile?.id ?? null,
      id,
      "suspicious_listing",
      "بلاغ سريع من صفحة الإعلان.",
    );
    setActionMessage(
      result.ok
        ? text("تم إرسال البلاغ للمراجعة.", "Report sent for review.")
        : result.error.message,
    );
  }

  async function messageSeller() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      setActionMessage(text("يجب تسجيل الدخول لبدء محادثة.", "Log in to start a conversation."));
      return;
    }

    if (listing?.ownerId === auth.profile?.id) {
      setActionMessage(text("لا يمكنك بدء محادثة مع نفسك.", "You cannot message yourself."));
      return;
    }

    if (!listing || listing.status !== "approved") {
      setActionMessage(
        text(
          "المحادثات متاحة للإعلانات المعتمدة فقط.",
          "Messages are available for approved listings only.",
        ),
      );
      return;
    }

    const result = await startListingConversation(auth.profile?.id ?? null, listing.id);
    if (!result.ok) {
      setActionMessage(result.error.message);
      return;
    }

    void navigate({ to: "/chats", search: { conversation: result.data } });
  }

  async function shareListing() {
    if (!listing) return;
    setActionMessage(null);
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: listing.title, text: listing.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setActionMessage(text("تم نسخ رابط الإعلان.", "Listing link copied."));
    } catch {
      setActionMessage(text("تعذر مشاركة الإعلان الآن.", "Could not share the listing now."));
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title={text("تفاصيل الإعلان", "Listing details")} />
        <main className="container-wide mobile-page-bottom pt-10">
          <StateCard
            title={text("جاري تحميل الإعلان", "Loading listing")}
            body={text("نجهز تفاصيل الإعلان للعرض.", "Preparing listing details.")}
          />
        </main>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        <PageHeader title={text("تفاصيل الإعلان", "Listing details")} />
        <main className="container-wide mobile-page-bottom pt-10">
          <StateCard
            title={text("لا يمكن عرض هذا الإعلان", "Listing cannot be shown")}
            body={
              error?.message ??
              text(
                "قد يكون الإعلان خارج العرض العام أو لم تتم الموافقة عليه.",
                "The listing may be outside public display or not approved.",
              )
            }
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        </main>
      </>
    );
  }

  const categoryFieldKind = detectCategoryFieldKind(null, listing);
  const categoryRows = categoryDetailDisplayRows(categoryFieldKind, listing.details, text);
  const locationLabel = listingLocationDisplay(listing, language);
  const phone = detailString(listing, ["phone", "mobile", "contact_phone", "رقم الهاتف", "الهاتف"]);
  const whatsapp = detailString(listing, [
    "whatsapp",
    "whatsApp",
    "contact_whatsapp",
    "واتساب",
    "رقم واتساب",
  ]);
  const cleanPhone = phone || detailString(listing, ["رقم الهاتف", "الهاتف"]);
  const cleanWhatsapp = whatsapp || detailString(listing, ["واتساب", "رقم واتساب"]);
  const canCall = Boolean(listing.contactOptions.phone && cleanPhone);
  const canWhatsapp = Boolean(listing.contactOptions.whatsapp && cleanWhatsapp);
  const sellerName = listing.contactName?.trim() || text("معلن على رواج", "RAWAJ advertiser");
  const visibleImages = images.filter((image) => image.publicUrl);
  const selectedImage = visibleImages[selectedImageIndex] ?? visibleImages[0] ?? null;
  const listingCategory = categoryName(
    listing.categoryId,
    listing.categoryNameAr ?? undefined,
    language,
  );

  return (
    <>
      <PageHeader title={listingCategory} to="/listings" />
      <main className="container-wide listing-detail-mobile-bottom pb-8 pt-3 sm:pt-5">
        <div className="grid items-start gap-4 lg:grid-cols-12 lg:gap-6">
          <div className="min-w-0 lg:col-span-7">
            <section className="rawaj-surface overflow-hidden rounded-[1.5rem] sm:rounded-[1.9rem]">
              <div className="relative overflow-hidden bg-muted-surface">
                {selectedImage?.publicUrl ? (
                  <div className="flex aspect-[4/3] w-full items-center justify-center sm:aspect-[16/10] lg:aspect-[4/3]">
                    <img
                      src={selectedImage.publicUrl}
                      alt={selectedImage.altAr ?? listing.title}
                      decoding="async"
                      fetchPriority="high"
                      className="h-full w-full object-cover sm:object-contain"
                    />
                  </div>
                ) : (
                  <div className="p-3 sm:p-4">
                    <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
                  </div>
                )}

                <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 lg:hidden">
                  <span className="rawaj-chip border-white/40 bg-card/88 px-2.5 py-1.5 text-foreground shadow-soft backdrop-blur">
                    <Camera className="h-3.5 w-3.5" />
                    {visibleImages.length || 0}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void shareListing()}
                      aria-label={text("مشاركة الإعلان", "Share listing")}
                      className="rawaj-icon-button h-9 w-9 bg-card/88 backdrop-blur"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFavorite()}
                      aria-label={text("حفظ في المفضلة", "Save to favorites")}
                      className="rawaj-icon-button h-9 w-9 bg-card/88 backdrop-blur"
                    >
                      <Heart
                        className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : ""}`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {visibleImages.length > 1 && (
                <div className="no-scrollbar flex gap-2 overflow-x-auto p-2.5 sm:p-3">
                  {visibleImages.map((image, index) => (
                    <button
                      key={image.id}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      aria-label={text(`عرض الصورة ${index + 1}`, `View image ${index + 1}`)}
                      className={`relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-xl transition sm:h-16 sm:w-20 ${
                        index === selectedImageIndex
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                          : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <img
                        src={image.publicUrl ?? ""}
                        alt={image.altAr ?? listing.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              {imageError && (
                <p className="mx-3 mb-3 rounded-xl bg-warning/10 p-2.5 text-[11px] font-semibold text-foreground">
                  {imageError.message}
                </p>
              )}
            </section>

            <section className="rawaj-surface mt-4 rounded-[1.4rem] p-4 sm:rounded-3xl sm:p-5 lg:hidden">
              <ListingIdentity
                listing={listing}
                listingCategory={listingCategory}
                locationLabel={locationLabel}
                language={language}
                text={text}
              />
              <div className="mt-4 border-t border-border/70 pt-4">
                <PriceDisplay listing={listing} language={language} text={text} />
              </div>
            </section>

            {categoryRows.length > 0 && (
              <section className="rawaj-surface mt-4 rounded-[1.4rem] p-4 sm:rounded-3xl sm:p-5">
                <SectionHeading
                  title={text("المواصفات", "Specifications")}
                  subtitle={text(
                    "أهم تفاصيل الإعلان في مكان واحد",
                    "Key listing details at a glance",
                  )}
                />
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {categoryRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[1.05rem] border border-border/65 bg-card-warm/72 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]"
                    >
                      <span className="block text-[10px] font-bold text-muted-foreground sm:text-[11px]">
                        {label}
                      </span>
                      <span className="mt-1 block text-sm font-bold leading-5 text-foreground">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="rawaj-surface mt-4 rounded-[1.4rem] p-4 sm:rounded-3xl sm:p-5">
              <SectionHeading
                title={text("الوصف", "Description")}
                subtitle={text(
                  "تفاصيل يضيفها المعلن عن السلعة",
                  "Details provided by the advertiser",
                )}
              />
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-foreground/90 sm:text-[15px] sm:leading-8">
                {listing.description?.trim() ||
                  text(
                    "لم يضف البائع وصفا مفصلا.",
                    "The seller has not added a detailed description.",
                  )}
              </p>
            </section>

            <section className="rawaj-surface mt-4 rounded-[1.4rem] p-4 sm:rounded-3xl sm:p-5">
              <SectionHeading
                title={text("الموقع", "Location")}
                subtitle={text("الموقع المعلن للسلعة", "Advertised item location")}
              />
              <div className="mt-4 flex items-center gap-3 rounded-[1.15rem] border border-border/65 bg-card-warm/72 p-3.5 sm:p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-gold hairline">
                  <MapPin className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-foreground">{locationLabel}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {text(
                      "اتفق على نقطة عامة وآمنة للمعاينة",
                      "Agree on a safe public inspection point",
                    )}
                  </p>
                </div>
                <MapIcon className="h-5 w-5 shrink-0 text-muted-foreground/70" />
              </div>
            </section>

            <section className="rawaj-surface mt-4 rounded-[1.4rem] p-4 sm:rounded-3xl sm:p-5 lg:hidden">
              <SellerCard
                listing={listing}
                sellerName={sellerName}
                canCall={canCall}
                canWhatsapp={canWhatsapp}
                messageSeller={messageSeller}
                text={text}
              />
            </section>

            <section className="mt-4 rounded-[1.4rem] border border-warning/15 bg-warning/7 p-4 shadow-[0_8px_24px_rgba(16,43,70,0.035)] sm:rounded-3xl sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background/80 text-warning">
                  <ShieldAlert className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-extrabold text-foreground">
                    {text("تواصل بأمان", "Contact safely")}
                  </h2>
                  <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-foreground/85 sm:grid-cols-3">
                    <li>
                      {text("قابل البائع في مكان عام وآمن.", "Meet in a public, safe place.")}
                    </li>
                    <li>{text("افحص السلعة قبل الدفع.", "Inspect the item before paying.")}</li>
                    <li>{text("بلغ عن أي إعلان مشبوه.", "Report suspicious listings.")}</li>
                  </ul>
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={() => void reportListing()}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/12 bg-card/75 py-3 text-xs font-semibold text-destructive transition hover:bg-destructive/5"
            >
              <Flag className="h-4 w-4" /> {text("إبلاغ عن الإعلان", "Report listing")}
            </button>

            {actionMessage && (
              <p className="mt-3 rounded-2xl bg-muted-surface p-3 text-center text-xs font-semibold text-foreground">
                {actionMessage}
              </p>
            )}

            <p className="mt-4 text-center text-[10px] text-muted-foreground">
              {text("رقم مرجعي:", "Reference:")} {listing.id}
            </p>
          </div>

          <aside className="hidden lg:col-span-5 lg:block">
            <div className="sticky top-24 space-y-4">
              <section className="rawaj-surface rounded-3xl p-5">
                <ListingIdentity
                  listing={listing}
                  listingCategory={listingCategory}
                  locationLabel={locationLabel}
                  language={language}
                  text={text}
                />
                <div className="mt-5 border-t border-border/70 pt-5">
                  <PriceDisplay listing={listing} language={language} text={text} />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void shareListing()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card-warm/72 py-3 text-xs font-semibold text-foreground transition hover:border-gold/35 hover:bg-card"
                  >
                    <Share2 className="h-4 w-4" />
                    {text("مشاركة", "Share")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleFavorite()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-card-warm/72 py-3 text-xs font-semibold text-foreground transition hover:border-gold/35 hover:bg-card"
                  >
                    <Heart
                      className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : ""}`}
                    />
                    {fav ? text("محفوظ", "Saved") : text("حفظ", "Save")}
                  </button>
                </div>
              </section>

              <section className="rawaj-surface rounded-3xl p-5">
                <SellerCard
                  listing={listing}
                  sellerName={sellerName}
                  canCall={canCall}
                  canWhatsapp={canWhatsapp}
                  messageSeller={messageSeller}
                  text={text}
                />
              </section>

              <section className="rawaj-surface rounded-3xl p-4">
                <h2 className="text-sm font-extrabold text-foreground">
                  {text("التواصل المباشر", "Direct contact")}
                </h2>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {canCall ? (
                    <a href={`tel:${cleanPhone}`} className="rawaj-button-primary rounded-2xl py-3">
                      <Phone className="h-4 w-4" />
                      {text("اتصال", "Call")}
                    </a>
                  ) : (
                    <UnavailableContact label={text("اتصال", "Call")} />
                  )}
                  {canWhatsapp ? (
                    <a
                      href={`https://wa.me/${normalizePhoneForWhatsapp(cleanWhatsapp)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-2xl bg-emerald-trust py-3 text-xs font-bold text-emerald-trust-foreground"
                    >
                      {text("واتساب", "WhatsApp")}
                    </a>
                  ) : (
                    <UnavailableContact label={text("واتساب", "WhatsApp")} />
                  )}
                </div>
              </section>
            </div>
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 px-3 lg:hidden">
          <div className="rawaj-surface mx-auto flex max-w-md items-center gap-2 rounded-[1.3rem] bg-card/94 p-2 backdrop-blur-xl">
            <button
              type="button"
              onClick={() => void messageSeller()}
              className="rawaj-button-primary min-w-0 flex-1 rounded-xl px-4 py-3"
            >
              <MessageCircle className="h-4 w-4" />
              {text("مراسلة", "Message")}
            </button>
            {canCall && (
              <a
                href={`tel:${cleanPhone}`}
                aria-label={text("اتصال", "Call")}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted-surface text-foreground"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            {canWhatsapp && (
              <a
                href={`https://wa.me/${normalizePhoneForWhatsapp(cleanWhatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-emerald-trust px-3 text-[11px] font-extrabold text-emerald-trust-foreground"
              >
                {text("واتساب", "WhatsApp")}
              </a>
            )}
          </div>
        </div>

        <script {...jsonLdScript(buildListingStructuredData(listing))} />
      </main>
    </>
  );
}

function ListingIdentity({
  listing,
  listingCategory,
  locationLabel,
  language,
  text,
}: {
  listing: ClassifiedListing;
  listingCategory: string;
  locationLabel: string;
  language: Language;
  text: (ar: string, en: string) => string;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {listing.isFeatured && <Badge>{text("مميز", "Featured")}</Badge>}
        <span className="rawaj-chip px-2.5 py-1">{listingCategory}</span>
        <span className="rawaj-chip px-2.5 py-1">
          {listing.status === "approved"
            ? text("متاح", "Available")
            : listingStatusLabel(listing.status, language, true)}
        </span>
      </div>
      <h1 className="mt-3.5 text-xl font-bold leading-[1.5] text-primary text-balance sm:text-2xl">
        {listing.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-gold" />
          {locationLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {formatDate(listing.createdAt, language)}
        </span>
      </div>
    </div>
  );
}

function PriceDisplay({
  listing,
  language,
  text,
}: {
  listing: ClassifiedListing;
  language: Language;
  text: (ar: string, en: string) => string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {text("السعر", "Price")}
      </p>
      <div className="mt-1 text-2xl font-bold leading-tight text-primary text-balance sm:text-3xl">
        {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
      </div>
      <p className="mt-1.5 text-xs font-bold text-gold">
        {priceTypeLabel(listing.priceType, language)}
      </p>
    </div>
  );
}

function SellerCard({
  listing,
  sellerName,
  canCall,
  canWhatsapp,
  messageSeller,
  text,
}: {
  listing: ClassifiedListing;
  sellerName: string;
  canCall: boolean;
  canWhatsapp: boolean;
  messageSeller: () => Promise<void>;
  text: (ar: string, en: string) => string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="category-tile h-12 w-12 shrink-0 rounded-full">
          <User className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold text-muted-foreground">
            {text("المعلن", "Advertiser")}
          </p>
          <h2 className="mt-0.5 truncate text-sm font-semibold text-foreground">{sellerName}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {canCall && (
              <span className="rounded-full bg-muted-surface px-2 py-1 text-[9px] font-bold text-muted-foreground">
                {text("هاتف", "Phone")}
              </span>
            )}
            {canWhatsapp && (
              <span className="rounded-full bg-muted-surface px-2 py-1 text-[9px] font-bold text-muted-foreground">
                {text("واتساب", "WhatsApp")}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Link
          to="/seller/$id"
          params={{ id: listing.ownerId }}
          className="inline-flex items-center justify-center rounded-2xl bg-muted-surface px-3 py-3 text-[11px] font-bold text-foreground"
        >
          {text("إعلانات المعلن", "Seller listings")}
        </Link>
        <button
          type="button"
          onClick={() => void messageSeller()}
          className="rawaj-button-primary rounded-2xl px-3 py-3 text-[11px]"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {text("مراسلة", "Message")}
        </button>
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="mb-1 h-0.5 w-7 rounded-full bg-gradient-to-r from-brand-orange to-gold" />
      <h2 className="text-sm font-bold text-primary sm:text-base">{title}</h2>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function buildListingStructuredData(listing: ClassifiedListing) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: plainText(listing.description, 300),
    url: absoluteUrl(`/listings/${listing.id}`),
    category: listing.categoryNameAr,
    areaServed: listing.governorateNameAr,
  };

  if (listing.primaryImageUrl) data.image = [absoluteUrl(listing.primaryImageUrl)];
  if (listing.price !== null) {
    data.offers = {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      url: absoluteUrl(`/listings/${listing.id}`),
    };
  }

  return data;
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gold px-2.5 py-1 text-[10px] font-bold text-gold-foreground">
      {children}
    </span>
  );
}

function UnavailableContact({ label }: { label: string }) {
  const { text } = useUiPreferences();

  return (
    <button
      type="button"
      disabled
      className="rounded-2xl bg-muted-surface px-3 py-3 text-xs font-bold text-muted-foreground opacity-70"
    >
      <span className="block">{label}</span>
      <span className="mt-1 block text-[9px] font-medium leading-4">
        {text("غير متاح", "Unavailable")}
      </span>
    </button>
  );
}

function StateCard({
  title,
  body,
  actionLabel,
  actionTo,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="rawaj-surface rounded-3xl p-10 text-center">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {actionLabel && actionTo && (
        <Link to={actionTo} className="rawaj-button-primary mt-4 px-4 py-2">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

function ListingState({
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
    <>
      <PageHeader title={text(titleAr, titleEn)} />
      <main className="container-wide mobile-page-bottom pt-10">
        <StateCard
          title={text("لا يمكن عرض هذا الإعلان", "Listing cannot be shown")}
          body={text(bodyAr, bodyEn)}
          actionLabel={text("تصفح الإعلانات", "Browse listings")}
          actionTo="/listings"
        />
      </main>
    </>
  );
}

function detailString(listing: ClassifiedListing, keys: string[]) {
  for (const key of keys) {
    const value = listing.details[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizePhoneForWhatsapp(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatDate(value: string, language: Language) {
  if (!value) return language === "ar" ? "تاريخ غير محدد" : "Date unavailable";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function priceTypeLabel(type: string, language: Language) {
  switch (type) {
    case "fixed":
      return language === "ar" ? "ثابت" : "Fixed";
    case "negotiable":
      return language === "ar" ? "قابل للتفاوض" : "Negotiable";
    case "contact":
      return language === "ar" ? "عند التواصل" : "On contact";
    case "free":
      return language === "ar" ? "مجاني" : "Free";
    case "exchange":
      return language === "ar" ? "للمبادلة" : "Exchange";
    default:
      return type;
  }
}
