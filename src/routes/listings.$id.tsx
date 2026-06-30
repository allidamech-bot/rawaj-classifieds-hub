import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  Clock,
  Flag,
  Heart,
  Lock,
  Map as MapIcon,
  MapPin,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  createListingReport,
  favoriteListing,
  fetchListingImages,
  fetchListingDetail,
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
      { title: "تفاصيل الإعلان | رَوَاج" },
      { name: "description", content: "تفاصيل إعلان معتمد على رَوَاج." },
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
    const userId = auth.profile?.id ?? null;
    const result = fav ? await unfavoriteListing(userId, id) : await favoriteListing(userId, id);

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
            title={text("جارٍ تحميل الإعلان", "Loading listing")}
            body={text(
              "نجهّز تفاصيل الإعلان المعتمد للعرض.",
              "Preparing the approved listing details.",
            )}
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
            title={
              error?.code === "schema_missing" || error?.code === "supabase_unconfigured"
                ? text("الإعلانات الحقيقية قيد التفعيل", "Real listings are being activated")
                : text("الإعلان غير متاح", "Listing unavailable")
            }
            body={
              error?.code === "schema_missing" || error?.code === "supabase_unconfigured"
                ? text(
                    "ستظهر تفاصيل الإعلانات هنا بعد اكتمال الربط التشغيلي. لا نعرض بيانات تجريبية كإعلان حقيقي.",
                    "Listing details will appear here after the operational connection is complete. Demo data is not shown as a real listing.",
                  )
                : (error?.message ??
                  text(
                    "هذا الإعلان غير متاح أو لم تتم الموافقة عليه بعد.",
                    "This listing is unavailable or not approved yet.",
                  ))
            }
            actionLabel={text("تصفح الإعلانات", "Browse listings")}
            actionTo="/listings"
          />
        </main>
      </>
    );
  }

  const detailsEntries = Object.entries(listing.details).filter(
    ([, value]) => value !== undefined && value !== "",
  );

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
            {images.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto">
                {images.slice(1, 5).map((image) => (
                  <img
                    key={image.id}
                    src={image.publicUrl ?? ""}
                    alt={image.altAr ?? listing.title}
                    className="h-14 w-16 rounded-lg object-cover hairline"
                  />
                ))}
              </div>
            ) : null}
            <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-muted-surface px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Camera className="h-3 w-3" />{" "}
              {images.length
                ? text(`${images.length} صورة`, `${images.length} photos`)
                : text("لا توجد صور بعد", "No photos yet")}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {listing.isFeatured && (
              <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
                {text("مميز", "Featured")}
              </span>
            )}
            <span className="rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
              {statusLabel(listing.status, language)}
            </span>
            {listing.status !== "approved" && (
              <span className="rounded-md bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-warning">
                {text(
                  "يظهر للمالك أو صاحب الإعلان فقط",
                  "Visible only to the owner or listing owner",
                )}
              </span>
            )}
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
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="font-semibold">
              {governorateName(
                listing.governorateId,
                listing.governorateNameAr ?? undefined,
                language,
              )}
            </span>
            {listing.districtAr && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>{listing.districtAr}</span>
              </>
            )}
            <span className="ms-auto text-[11px] text-muted-foreground">
              {text("سوريا فقط", "Syria only")}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-muted-surface py-6 text-xs text-muted-foreground">
            <MapIcon className="h-4 w-4" />
            {text("الخريطة ستتوفر لاحقاً", "Map coming later")}
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">
            {text("الوصف", "Description")}
          </h2>
          <p className="whitespace-pre-line text-sm leading-7 text-foreground/90">
            {listing.description?.trim() ||
              text(
                "لم يضف البائع وصفاً مفصلاً بعد.",
                "The seller has not added a detailed description yet.",
              )}
          </p>
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
          <button
            disabled
            className="flex w-full flex-col items-center gap-1 rounded-xl bg-primary py-3 text-primary-foreground opacity-80"
          >
            <Send className="h-5 w-5" />
            <span className="text-xs font-bold">
              {text("رسائل داخل التطبيق · قريباً", "In-app messages · soon")}
            </span>
          </button>
          <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
            <p className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />{" "}
              {text(
                "التواصل الحقيقي يحتاج سياسة رسائل وخصوصية لاحقاً.",
                "Real contact requires messaging and privacy rules later.",
              )}
            </p>
            <p>
              {text(
                "لا نعرض أرقاماً حقيقية في هذه المرحلة حفاظاً على الخصوصية.",
                "Phone numbers are not shown at this stage to protect privacy.",
              )}
            </p>
            <p className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3" />{" "}
              {text(
                "لا تشارك بيانات حساسة أو تحويلات قبل التأكد من السلعة.",
                "Do not share sensitive data or transfers before verifying the item.",
              )}
            </p>
          </div>
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
                <li>
                  {text("لا تحوّل المال قبل التأكد.", "Do not transfer money before verifying.")}
                </li>
                <li>{text("بلّغ عن أي إعلان مشبوه.", "Report suspicious listings.")}</li>
              </ul>
            </div>
          </div>
        </section>

        <button
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

function formatDate(value: string, language: Language) {
  if (!value) return language === "ar" ? "تاريخ غير متاح" : "Date unavailable";
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
      return language === "ar" ? "مجاناً" : "Free";
    case "exchange":
      return language === "ar" ? "للمبادلة" : "Exchange";
    default:
      return type;
  }
}
