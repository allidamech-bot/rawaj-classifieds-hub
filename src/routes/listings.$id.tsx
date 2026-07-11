import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { Clock, MapPin, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ListingContactDock } from "@/features/listing-detail/ListingContactDock";
import { ListingMediaExperience } from "@/features/listing-detail/ListingMediaExperience";
import { ListingSafetyAndAlert } from "@/features/listing-detail/ListingSafetyAndAlert";
import { ListingSellerProfileCard } from "@/features/listing-detail/ListingSellerProfileCard";
import { SimilarListingsRail } from "@/features/listing-detail/SimilarListingsRail";
import { UnavailableListingRecovery } from "@/features/listing-detail/UnavailableListingRecovery";
import { categoryDetailDisplayRows, detectCategoryFieldKind } from "@/lib/category-fields";
import {
  createListingReport,
  createSavedSearch,
  favoriteListing,
  fetchFavoriteStatus,
  fetchListingDetail,
  fetchListingImages,
  fetchPublicListings,
  fetchPublicSellerProfile,
  startListingConversation,
  unfavoriteListing,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingImage,
  PublicSellerProfile,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import {
  absoluteUrl,
  buildBreadcrumbStructuredData,
  createSeo,
  jsonLdScript,
  plainText,
} from "@/lib/seo";
import { phoneHref, whatsappHref } from "@/lib/contact-phone";
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
  const [seller, setSeller] = useState<PublicSellerProfile | null>(null);
  const [similarListings, setSimilarListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(!initialListing);
  const [sellerLoading, setSellerLoading] = useState(true);
  const [similarLoading, setSimilarLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [imageError, setImageError] = useState<ClassifiedsError | null>(null);
  const [fav, setFav] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [alertBusy, setAlertBusy] = useState(false);
  const [alertCreated, setAlertCreated] = useState(false);
  const favoriteInFlightRef = useRef(false);
  const favoriteRequestIdRef = useRef(0);
  const imageRequestIdRef = useRef(0);

  useEffect(() => {
    setListing(initialListing);
    setLoading(false);
    setError(null);
    setAlertCreated(false);
  }, [initialListing, id]);

  useEffect(() => {
    let cancelled = false;
    const requestId = ++imageRequestIdRef.current;
    setImages([]);
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
    setSellerLoading(true);
    setSeller(null);

    async function loadSeller() {
      const result = await fetchPublicSellerProfile(initialListing.ownerId);
      if (cancelled) return;
      if (result.ok) setSeller(result.data);
      setSellerLoading(false);
    }

    void loadSeller();
    return () => {
      cancelled = true;
    };
  }, [initialListing.ownerId]);

  useEffect(() => {
    let cancelled = false;
    setSimilarLoading(true);
    setSimilarListings([]);

    async function loadSimilarListings() {
      const result = await fetchPublicListings(
        {
          categoryId: initialListing.categoryId,
          governorateId: initialListing.governorateId,
          sort: "latest",
        },
        null,
        12,
      );
      if (cancelled) return;
      if (result.ok) {
        setSimilarListings(
          result.data.items.filter((item) => item.id !== initialListing.id).slice(0, 8),
        );
      }
      setSimilarLoading(false);
    }

    void loadSimilarListings();
    return () => {
      cancelled = true;
    };
  }, [initialListing.categoryId, initialListing.governorateId, initialListing.id]);

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

  async function createPriceAlert() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      setActionMessage(text("سجّل الدخول لتفعيل تنبيه السعر.", "Log in to enable a price alert."));
      return;
    }
    if (
      !listing ||
      listing.price === null ||
      !["fixed", "negotiable"].includes(listing.priceType)
    ) {
      setActionMessage(
        text(
          "تنبيه السعر متاح للإعلانات ذات السعر الرقمي.",
          "Price alerts are available for listings with a numeric price.",
        ),
      );
      return;
    }

    setAlertBusy(true);
    const result = await createSavedSearch(auth.profile?.id ?? null, {
      nameAr: `نتائج مشابهة بسعر ${listing.price}`,
      filters: {
        categoryId: listing.categoryId,
        governorateId: listing.governorateId,
        priceMax: listing.price,
        sort: "cheapest",
      },
      alertFrequency: "daily",
    });
    setAlertBusy(false);

    if (!result.ok) {
      setActionMessage(result.error.message);
      return;
    }

    setAlertCreated(true);
    setActionMessage(
      text(
        "تم حفظ بحث يومي لإعلانات مشابهة بهذا السعر أو أقل.",
        "A daily search was saved for similar listings at this price or lower.",
      ),
    );
  }

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/listings", search: listing ? { category: listing.categoryId } : {} });
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
  const callHref = listing.contactOptions.phone ? phoneHref(phone) : null;
  const whatsappUrl = listing.contactOptions.whatsapp ? whatsappHref(whatsapp) : null;
  const canCall = Boolean(callHref);
  const canWhatsapp = Boolean(whatsappUrl);
  const sellerName = listing.contactName?.trim() || text("معلن على رواج", "RAWAJ advertiser");
  const isOwner = auth.profile?.id === listing.ownerId;
  const mediaImages =
    images.length > 0
      ? images
      : listing.primaryImageUrl
        ? [
            {
              id: `primary-${listing.id}`,
              listingId: listing.id,
              storagePath: null,
              publicUrl: listing.primaryImageUrl,
              altAr: listing.title,
              sortOrder: 0,
              createdAt: listing.createdAt,
            } satisfies ListingImage,
          ]
        : [];
  const listingCategory = categoryName(
    listing.categoryId,
    listing.categoryNameAr ?? undefined,
    language,
  );
  const listingBreadcrumbs = buildBreadcrumbStructuredData([
    { name: "RAWAJ / رواج", path: "/" },
    { name: text("الإعلانات", "Listings"), path: "/listings" },
    {
      name: listing.categoryNameAr ?? listingCategory,
      path: `/listings?category=${encodeURIComponent(listing.categoryId)}`,
    },
    { name: listing.title, path: `/listings/${listing.id}` },
  ]);

  return (
    <>
      <main className="rawaj-detail-v2">
        <ListingMediaExperience
          images={mediaImages}
          title={listing.title}
          placeholder={listing.categoryPlaceholder ?? "misc"}
          favorite={fav}
          imageError={imageError?.message}
          onBack={goBack}
          onShare={() => void shareListing()}
          onToggleFavorite={() => void toggleFavorite()}
          text={text}
        />

        <div className="rawaj-detail-v2__container">
          {listing.reservedAt ? (
            <section className="rawaj-detail-reserved">
              <Clock aria-hidden="true" />
              <div>
                <h2>{text("هذا الإعلان محجوز حالياً", "This listing is currently reserved")}</h2>
                <p>
                  {text(
                    "أبقاه المعلن ظاهراً للمرجعية، لكن قد تكون السلعة ملتزماً بها لمشترٍ آخر. يمكنك الاستفسار من البائع عن آخر حالة.",
                    "The seller kept it public for reference, but the item may be committed to another buyer. You can ask the seller for the latest status.",
                  )}
                </p>
              </div>
            </section>
          ) : null}

          <div className="rawaj-detail-v2__layout">
            <article className="rawaj-detail-v2__content">
              <section className="rawaj-detail-summary">
                <div className="rawaj-detail-summary__badges">
                  {listing.isFeatured ? <Badge>{text("مميز", "Featured")}</Badge> : null}
                  <span>{listingCategory}</span>
                  <span>
                    {listing.status === "approved"
                      ? text("متاح", "Available")
                      : listingStatusLabel(listing.status, language, true)}
                  </span>
                </div>
                <h1>{listing.title}</h1>
                <div className="rawaj-detail-summary__meta">
                  <span>
                    <MapPin aria-hidden="true" />
                    {locationLabel}
                  </span>
                  <span>
                    <Clock aria-hidden="true" />
                    {formatDate(listing.createdAt, language)}
                  </span>
                </div>
                <PriceDisplay listing={listing} language={language} text={text} />
              </section>

              {categoryRows.length > 0 ? (
                <section className="rawaj-detail-section">
                  <SectionHeading
                    title={text("المواصفات", "Specifications")}
                    subtitle={text(
                      "أهم تفاصيل الإعلان في مكان واحد",
                      "Key listing details at a glance",
                    )}
                  />
                  <div className="rawaj-detail-specs">
                    {categoryRows.map(([label, value]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="rawaj-detail-section">
                <SectionHeading
                  title={text("الوصف", "Description")}
                  subtitle={text(
                    "تفاصيل يضيفها المعلن عن السلعة",
                    "Details provided by the advertiser",
                  )}
                />
                <p className="rawaj-detail-description">
                  {listing.description?.trim() ||
                    text(
                      "لم يضف البائع وصفا مفصلا.",
                      "The seller has not added a detailed description.",
                    )}
                </p>
              </section>

              <section className="rawaj-detail-section">
                <SectionHeading
                  title={text("الموقع", "Location")}
                  subtitle={text("الموقع المعلن للسلعة", "Advertised item location")}
                />
                <div className="rawaj-detail-location">
                  <span>
                    <MapPin aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{locationLabel}</strong>
                    <p>
                      {text(
                        "اتفق على نقطة عامة وآمنة للمعاينة.",
                        "Agree on a safe public inspection point.",
                      )}
                    </p>
                  </div>
                </div>
              </section>

              <ListingSafetyAndAlert
                showVisitorActions={!isOwner}
                alertBusy={alertBusy}
                alertCreated={alertCreated}
                onCreateAlert={() => void createPriceAlert()}
                onReport={() => void reportListing()}
                text={text}
              />
            </article>

            <aside className="rawaj-detail-v2__sidebar">
              <ListingSellerProfileCard
                listing={listing}
                seller={seller}
                loading={sellerLoading}
                fallbackName={sellerName}
                onMessage={messageSeller}
                language={language}
                text={text}
              />
              <section className="rawaj-detail-reference">
                <ShieldAlert aria-hidden="true" />
                <div>
                  <span>{text("رقم مرجعي", "Reference")}</span>
                  <strong>{listing.id}</strong>
                </div>
              </section>
            </aside>
          </div>

          {actionMessage ? (
            <p className="rawaj-detail-v2__message" role="status">
              {actionMessage}
            </p>
          ) : null}

          <SimilarListingsRail
            listings={similarListings}
            categoryId={listing.categoryId}
            loading={similarLoading}
            text={text}
          />
        </div>

        <script {...jsonLdScript(buildListingStructuredData(listing))} />
        <script {...jsonLdScript(listingBreadcrumbs)} />
      </main>

      <ListingContactDock
        listingId={listing.id}
        isOwner={isOwner}
        canCall={canCall}
        canWhatsapp={canWhatsapp}
        callHref={callHref}
        whatsappUrl={whatsappUrl}
        onMessage={() => void messageSeller()}
        onOffer={() => void messageSeller()}
        text={text}
      />
    </>
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
    <div className="rawaj-detail-price">
      <span>{text("السعر", "Price")}</span>
      <strong>
        {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
      </strong>
      <small>{priceTypeLabel(listing.priceType, language)}</small>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="rawaj-detail-section__heading">
      <span aria-hidden="true" />
      <h2>{title}</h2>
      <p>{subtitle}</p>
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
      availability: listing.reservedAt
        ? "https://schema.org/LimitedAvailability"
        : "https://schema.org/InStock",
      url: absoluteUrl(`/listings/${listing.id}`),
    };
  }

  return data;
}

function Badge({ children }: { children: ReactNode }) {
  return <span data-tone="featured">{children}</span>;
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
      {actionLabel && actionTo ? (
        <Link to={actionTo} className="rawaj-button-primary mt-4 px-4 py-2">
          {actionLabel}
        </Link>
      ) : null}
    </div>
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
