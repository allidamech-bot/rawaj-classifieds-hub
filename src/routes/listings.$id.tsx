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
import { categoryDetailDisplayRows, detectCategoryFieldKind } from "@/lib/category-fields";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  createListingReport,
  favoriteListing,
  fetchListingDetail,
  fetchListingImages,
  fetchFavoriteStatus,
  startListingConversation,
  unfavoriteListing,
} from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError, ListingImage } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
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
  notFoundComponent: () => (
    <ListingState
      titleAr="تفاصيل الإعلان"
      titleEn="Listing details"
      bodyAr="هذا الإعلان غير متاح للعرض العام أو لم تتم الموافقة عليه."
      bodyEn="This listing is unavailable publicly or has not been approved."
    />
  ),
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
  const [loading, setLoading] = useState(!initialListing);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [fav, setFav] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const favoriteInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadFavorite() {
      const result = await fetchFavoriteStatus(auth.profile?.id ?? null, id);
      if (!cancelled && result.ok) setFav(result.data);
    }
    if (auth.status === "signedIn") void loadFavorite();
    return () => {
      cancelled = true;
    };
  }, [auth.status, auth.profile?.id, id]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      const result = await fetchListingDetail(id);

      if (cancelled) return;

      if (!result.ok) {
        setListing(null);
        setImages([]);
        setError(result.error);
      } else {
        setListing(result.data);
        const imageResult = await fetchListingImages(id);
        if (!cancelled && imageResult.ok) setImages(imageResult.data);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function toggleFavorite() {
    setActionMessage(null);
    if (auth.status !== "signedIn") {
      setActionMessage(
        text("يجب تسجيل الدخول لحفظ الإعلان في المفضلة.", "Log in to save this listing."),
      );
      return;
    }
    if (favoriteInFlightRef.current) return;
    favoriteInFlightRef.current = true;
    const result = fav
      ? await unfavoriteListing(auth.profile?.id ?? null, id)
      : await favoriteListing(auth.profile?.id ?? null, id);
    favoriteInFlightRef.current = false;

    if (!result.ok) {
      setActionMessage(result.error.message);
      return;
    }

    setFav((value) => !value);
    setActionMessage(
      fav
        ? text("تمت إزالة الإعلان من المفضلة.", "Removed from favorites.")
        : text("تم حفظ الإعلان في المفضلة.", "Saved to favorites."),
    );
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
  const locationLabel = governorateName(
    listing.governorateId,
    listing.governorateNameAr ?? undefined,
    language,
  );
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

  return (
    <>
      <PageHeader
        title={categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
        to="/listings"
      />
      <main className="container-wide mobile-page-bottom pt-3">
        <div className="overflow-hidden rounded-2xl bg-card hairline shadow-soft">
          {images[0]?.publicUrl ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden sm:aspect-auto sm:h-auto sm:max-h-[540px] bg-muted-surface flex items-center justify-center">
              <img
                src={images[0].publicUrl}
                alt={images[0].altAr ?? listing.title}
                className="h-full w-full object-cover sm:h-auto sm:max-h-[540px] sm:w-auto sm:max-w-full sm:object-contain"
              />
            </div>
          ) : (
            <div className="bg-muted-surface p-3">
              <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
            </div>
          )}
          <div className="flex items-center justify-between gap-2 p-2">
            {images.length > 1 && (
              <div className="no-scrollbar flex gap-2 overflow-x-auto">
                {images
                  .slice(1, 5)
                  .filter((image) => image.publicUrl)
                  .map((image) => (
                    <img
                      key={image.id}
                      src={image.publicUrl ?? ""}
                      alt={image.altAr ?? listing.title}
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-14 rounded-lg object-cover opacity-80 hairline"
                    />
                  ))}
              </div>
            )}
            <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-muted-surface px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Camera className="h-3 w-3" />
              {images.length
                ? text(`${images.length} صورة`, `${images.length} photos`)
                : text("منطقة صور الإعلان", "Listing image area")}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {listing.isFeatured && <Badge>{text("مميز", "Featured")}</Badge>}
            <span className="rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
              {listing.status === "approved"
                ? text("إعلان مُراجع", "Reviewed listing")
                : listingStatusLabel(listing.status, language, true)}
            </span>
            <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {text("سوريا فقط", "Syria only")}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold leading-tight text-foreground">
            {listing.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatDate(listing.createdAt, language)}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {locationLabel}
            </span>
          </div>
        </div>

        <section className="mt-4 rounded-2xl bg-card p-4 hairline shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                {text("السعر", "Price")}
              </div>
              <div className="mt-0.5 text-3xl font-extrabold text-foreground">
                {formatPriceLocalized(
                  listing.price ?? 0,
                  listing.priceType,
                  language,
                  listing.currency,
                )}
              </div>
              <div className="mt-1 text-xs font-semibold text-gold">
                {priceTypeLabel(listing.priceType, language)}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void shareListing()}
                aria-label={text("مشاركة الإعلان", "Share listing")}
                className="grid h-11 w-11 place-items-center rounded-full bg-muted-surface transition hover:bg-secondary"
              >
                <Share2 className="h-5 w-5 text-foreground" />
              </button>
              <button
                type="button"
                onClick={() => void toggleFavorite()}
                aria-label={text("حفظ في المفضلة", "Save to favorites")}
                className="grid h-11 w-11 place-items-center rounded-full bg-muted-surface transition hover:bg-secondary"
              >
                <Heart
                  className={`h-5 w-5 ${fav ? "fill-destructive text-destructive" : "text-foreground"}`}
                />
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void messageSeller()}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-gold-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {text("راسل المعلن", "Message seller")}
          </button>
        </section>

        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">
            {text("الموقع", "Location")}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="font-semibold">{locationLabel}</span>
            {listing.districtAr && (
              <span className="text-muted-foreground">· {listing.districtAr}</span>
            )}
            <span className="ms-auto text-[11px] text-muted-foreground">
              {text("سوريا فقط", "Syria only")}
            </span>
          </div>
          <div className="mt-3 rounded-xl bg-muted-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">{text("نطاق المعاينة", "Inspection area")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {text(
                    "اتفق مع البائع على نقطة عامة وآمنة داخل المحافظة.",
                    "Agree with the seller on a safe public point within the governorate.",
                  )}
                </p>
              </div>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-card text-gold hairline">
                <MapIcon className="h-5 w-5" />
              </span>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">
            {text("الوصف", "Description")}
          </h2>
          <p className="whitespace-pre-line text-sm leading-7 text-foreground/90">
            {listing.description?.trim() ||
              text("لم يضف البائع وصفا مفصلا.", "The seller has not added a detailed description.")}
          </p>
        </section>

        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted-surface text-primary">
              <User className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-muted-foreground">
                {text("المعلن", "Advertiser")}
              </p>
              <h2 className="mt-0.5 truncate text-sm font-extrabold text-foreground">
                {sellerName}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {canCall || canWhatsapp
                  ? text(
                      "طرق التواصل المتاحة تظهر من بيانات هذا الإعلان فقط.",
                      "Available contact methods are shown from this listing only.",
                    )
                  : text(
                      "لم يفعّل المعلن طريقة تواصل مباشرة في هذا الإعلان.",
                      "The advertiser did not enable a direct contact method on this listing.",
                    )}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {canCall && (
                  <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
                    {text("هاتف متاح", "Phone available")}
                  </span>
                )}
                {canWhatsapp && (
                  <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
                    {text("واتساب متاح", "WhatsApp available")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link
            to="/seller/$id"
            params={{ id: listing.ownerId }}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
          >
            {text("عرض كل إعلانات المعلن", "View all advertiser listings")}
          </Link>
          <button
            type="button"
            onClick={() => void messageSeller()}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-2.5 text-xs font-bold text-gold-foreground"
          >
            <MessageCircle className="h-4 w-4" />
            {text("راسل المعلن", "Message seller")}
          </button>
        </section>

        {categoryRows.length > 0 && (
          <section className="mt-3 rounded-2xl bg-card p-4 hairline">
            <h2 className="mb-3 text-sm font-extrabold text-foreground">
              {text("تفاصيل الإعلان", "Listing details")}
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {categoryRows.map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted-surface px-3 py-2 text-sm">
                  <span className="block text-[11px] font-bold text-muted-foreground">{label}</span>
                  <span className="mt-0.5 block font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-3 text-sm font-extrabold text-foreground">
            {text("التواصل مع البائع", "Contact seller")}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {canCall ? (
              <a
                href={`tel:${cleanPhone}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground"
              >
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
                className="inline-flex items-center justify-center rounded-xl bg-emerald-trust py-3 text-xs font-bold text-emerald-trust-foreground"
              >
                {text("واتساب", "WhatsApp")}
              </a>
            ) : (
              <UnavailableContact label={text("واتساب", "WhatsApp")} />
            )}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            {text(
              "تظهر طرق التواصل النشطة فقط عندما يختار البائع عرضها داخل بيانات الإعلان.",
              "Active contact methods appear only when the seller provides them in listing details.",
            )}
          </p>
        </section>

        <section className="mt-3 rounded-2xl bg-warning/10 p-4 hairline">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1.5 text-xs text-foreground/90">
              <p className="font-bold">
                {text("نصائح أمان قبل التواصل", "Safety tips before contact")}
              </p>
              <ul className="grid gap-1 sm:grid-cols-3">
                <li>{text("قابل البائع في مكان عام وآمن.", "Meet in a public, safe place.")}</li>
                <li>{text("افحص السلعة قبل الدفع.", "Inspect the item before paying.")}</li>
                <li>{text("بلغ عن أي إعلان مشبوه.", "Report suspicious listings.")}</li>
              </ul>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClick={() => void reportListing()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-destructive hairline transition hover:bg-destructive/5"
        >
          <Flag className="h-4 w-4" /> {text("إبلاغ عن الإعلان", "Report listing")}
        </button>

        {actionMessage && (
          <p className="mt-2 rounded-xl bg-muted-surface p-3 text-center text-xs font-semibold text-foreground">
            {actionMessage}
          </p>
        )}
        <p className="mt-3 text-center text-[10px] text-muted-foreground">
          {text("رقم مرجعي:", "Reference:")} {listing.id}
        </p>
        <div className="fixed inset-x-0 bottom-20 z-30 px-3 lg:hidden">
          <div className="mx-auto grid max-w-md grid-cols-3 gap-2 rounded-2xl bg-card p-2 shadow-premium hairline">
            <button
              type="button"
              onClick={() => void messageSeller()}
              className="col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-gold py-2.5 text-xs font-bold text-gold-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              {text("راسل المعلن", "Message seller")}
            </button>
            {canCall && (
              <a
                href={`tel:${cleanPhone}`}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground"
              >
                <Phone className="h-3.5 w-3.5" />
                {text("اتصال", "Call")}
              </a>
            )}
            {canWhatsapp && (
              <a
                href={`https://wa.me/${normalizePhoneForWhatsapp(cleanWhatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-emerald-trust py-2 text-xs font-bold text-emerald-trust-foreground"
              >
                {text("واتساب", "WhatsApp")}
              </a>
            )}
            <button
              type="button"
              onClick={() => void shareListing()}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-muted-surface py-2 text-xs font-bold text-foreground"
            >
              <Share2 className="h-3.5 w-3.5" />
              {text("مشاركة", "Share")}
            </button>
          </div>
        </div>
        <script {...jsonLdScript(buildListingStructuredData(listing))} />
      </main>
    </>
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
    <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
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
      className="rounded-xl bg-muted-surface px-3 py-3 text-xs font-bold text-muted-foreground opacity-70"
    >
      <span className="block">{label}</span>
      <span className="mt-1 block text-[10px] font-medium leading-4">
        {text("لم يوفر البائع هذه الطريقة", "Seller did not provide this method")}
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
    <div className="rounded-2xl bg-card p-10 text-center hairline">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="mt-4 inline-block rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
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
