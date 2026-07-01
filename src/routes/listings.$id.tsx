import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  Clock,
  Flag,
  Heart,
  Map as MapIcon,
  MapPin,
  Phone,
  ShieldAlert,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  createListingReport,
  favoriteListing,
  fetchListingDetail,
  fetchListingImages,
  unfavoriteListing,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingImage,
  ListingStatus,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({
    meta: [
      { title: "تفاصيل الإعلان | رواج" },
      { name: "description", content: "تفاصيل إعلان معتمد على رواج." },
    ],
  }),
  component: ListingDetailsPage,
});

function ListingDetailsPage() {
  const { id } = Route.useParams();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
  const [images, setImages] = useState<ListingImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [fav, setFav] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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
    const result = fav
      ? await unfavoriteListing(auth.profile?.id ?? null, id)
      : await favoriteListing(auth.profile?.id ?? null, id);

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

  if (loading) {
    return (
      <>
        <PageHeader title={text("تفاصيل الإعلان", "Listing details")} />
        <main className="container-wide pt-10">
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
        <main className="container-wide pt-10">
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

  const hiddenPublicDetailKeys = new Set([
    "phone",
    "mobile",
    "contact_phone",
    "whatsapp",
    "contact_whatsapp",
    "content_flags",
    "رقم الهاتف",
    "الهاتف",
    "واتساب",
    "رقم واتساب",
  ]);
  const detailsEntries = Object.entries(listing.details).filter(
    ([key, value]) =>
      !hiddenPublicDetailKeys.has(key.toLowerCase()) &&
      value !== undefined &&
      value !== null &&
      value !== "",
  );
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
      />
      <main className="container-wide pt-3 pb-8">
        <div className="overflow-hidden rounded-2xl bg-card hairline shadow-soft">
          {images[0]?.publicUrl ? (
            <img
              src={images[0].publicUrl}
              alt={images[0].altAr ?? listing.title}
              className="aspect-[16/9] w-full object-cover"
            />
          ) : (
            <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
          )}
          <div className="flex items-center justify-between gap-2 p-2">
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {images
                  .slice(1, 5)
                  .filter((image) => image.publicUrl)
                  .map((image) => (
                    <img
                      key={image.id}
                      src={image.publicUrl ?? ""}
                      alt={image.altAr ?? listing.title}
                      className="h-14 w-16 rounded-lg object-cover hairline"
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
              {statusLabel(listing.status, language)}
            </span>
            <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {text("سوريا فقط", "Syria only")}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-extrabold leading-tight text-foreground">
            {listing.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span>
              {text("رقم الإعلان:", "Listing ID:")} {listing.id}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatDate(listing.createdAt, language)}
            </span>
          </div>
        </div>

        <section className="mt-4 rounded-2xl bg-card p-4 hairline shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">
                {text("السعر", "Price")}
              </div>
              <div className="mt-0.5 text-2xl font-extrabold text-foreground">
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
        </section>

        {detailsEntries.length > 0 && (
          <section className="mt-3 rounded-2xl bg-card p-4 hairline">
            <h2 className="mb-3 text-sm font-extrabold text-foreground">
              {text("تفاصيل الإعلان", "Listing details")}
            </h2>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {detailsEntries.map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-semibold text-foreground">{String(value)}</span>
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
          <p className="mt-3 inline-flex items-start gap-1 text-[11px] text-warning">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
            {text(
              "لا تشارك بيانات حساسة أو تحول المال قبل التأكد من السلعة.",
              "Do not share sensitive data or transfer money before verifying the item.",
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
              <ul className="list-disc space-y-1 ps-5">
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
      </main>
    </>
  );
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

function statusLabel(status: ListingStatus, language: Language) {
  switch (status) {
    case "draft":
      return language === "ar" ? "مسودة" : "Draft";
    case "pending_review":
      return language === "ar" ? "قيد المراجعة" : "Pending review";
    case "approved":
      return language === "ar" ? "إعلان معتمد" : "Approved listing";
    case "rejected":
      return language === "ar" ? "مرفوض" : "Rejected";
    case "archived":
      return language === "ar" ? "مؤرشف" : "Archived";
    case "expired":
      return language === "ar" ? "منتهي" : "Expired";
    default:
      return status;
  }
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
