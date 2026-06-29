import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MapPin,
  Clock,
  Eye,
  Heart,
  BadgeCheck,
  Star,
  Phone,
  MessageCircle,
  Send,
  ShieldAlert,
  Flag,
  Ban,
  ChevronRight,
  Hash,
  Camera,
  Map as MapIcon,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { ListingCard } from "@/components/ListingCard";
import { findListing, listings } from "@/data/mockData";
import { priceLabel, priceTypeLabel, formatPrice } from "@/utils/format";

export const Route = createFileRoute("/listings/$id")({
  loader: ({ params }) => {
    const listing = findListing(params.id);
    if (!listing) throw notFound();
    return { listing };
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.listing.title} | رَوَاج` },
          { name: "description", content: loaderData.listing.description.slice(0, 150) },
          { property: "og:title", content: loaderData.listing.title },
          { property: "og:description", content: loaderData.listing.description.slice(0, 150) },
        ]
      : [{ title: "إعلان | رَوَاج" }],
  }),
  notFoundComponent: () => (
    <>
      <PageHeader title="غير موجود" />
      <main className="container-wide pt-10 text-center">
        <p className="text-sm text-muted-foreground">هذا الإعلان غير متاح أو تمت إزالته.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">
          العودة للرئيسية
        </Link>
      </main>
    </>
  ),
  errorComponent: ({ reset }) => (
    <>
      <PageHeader title="خطأ" />
      <main className="container-wide pt-10 text-center">
        <p className="text-sm text-muted-foreground">حدث خطأ أثناء عرض الإعلان.</p>
        <button
          onClick={reset}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          إعادة المحاولة
        </button>
      </main>
    </>
  ),
  component: ListingDetailsPage,
});

import { notFound } from "@tanstack/react-router";

function ListingDetailsPage() {
  const { listing } = Route.useLoaderData();
  const [fav, setFav] = useState(false);

  const similar = listings
    .filter((l) => l.id !== listing.id && l.categoryId === listing.categoryId)
    .slice(0, 4);
  const detailsEntries = Object.entries(listing.details).filter(
    ([, v]) => v !== undefined && v !== "",
  );

  return (
    <>
      <PageHeader title={listing.categoryName} />

      <main className="container-wide pt-3 pb-8">
        {/* Gallery */}
        <div className="overflow-hidden rounded-2xl bg-card hairline shadow-soft">
          <PlaceholderArt type={listing.placeholderType} aspect="wide" />
          <div className="flex items-center justify-between gap-2 p-2">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 w-16 overflow-hidden rounded-lg hairline">
                  <PlaceholderArt type={listing.placeholderType} aspect="square" />
                </div>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted-surface px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Camera className="h-3 w-3" /> صور تجريبية — رفع الصور غير مفعّل حالياً
            </span>
          </div>
        </div>

        {/* Title + badges */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {listing.isFeatured && (
              <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
                مميز
              </span>
            )}
            {listing.isVerifiedSeller && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
                <BadgeCheck className="h-3 w-3" /> بائع موثّق
              </span>
            )}
            <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[11px] font-semibold text-foreground">
              {listing.subcategoryName}
            </span>
          </div>

          <h1 className="mt-2 text-xl font-extrabold leading-tight text-foreground">
            {listing.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" /> رقم الإعلان: {listing.id}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {listing.timeSincePosted}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {listing.viewsCount} مشاهدة
            </span>
            <span className="inline-flex items-center gap-1">
              <Heart className="h-3.5 w-3.5" /> {listing.favoritesCount} حفظ
            </span>
          </div>
        </div>

        {/* Price block */}
        <section className="mt-4 rounded-2xl bg-card p-4 hairline shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">السعر</div>
              <div className="mt-0.5 text-2xl font-extrabold text-foreground">
                {listing.price
                  ? formatPrice(listing.price, listing.currency)
                  : priceLabel(0, listing.priceType)}
              </div>
              <div className="mt-1 text-xs text-gold font-semibold">
                {priceTypeLabel(listing.priceType)}
              </div>
            </div>
            <button
              onClick={() => setFav((v) => !v)}
              aria-label="حفظ في المفضلة"
              className="grid h-11 w-11 place-items-center rounded-full bg-muted-surface transition hover:bg-secondary"
            >
              <Heart
                className={`h-5 w-5 ${fav ? "fill-destructive text-destructive" : "text-foreground"}`}
              />
            </button>
          </div>
          {listing.priceType === "negotiable" && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              السعر قابل للتفاوض ضمن المعقول.
            </p>
          )}
        </section>

        {/* Location block */}
        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">الموقع</h2>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="font-semibold">{listing.governorate}</span>
            <span className="text-muted-foreground">·</span>
            <span>{listing.district}</span>
            <span className="ms-auto text-[11px] text-muted-foreground">سوريا فقط</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-muted-surface py-6 text-xs text-muted-foreground">
            <MapIcon className="h-4 w-4" />
            الخريطة ستتوفر لاحقاً
          </div>
        </section>

        {/* Description */}
        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">الوصف</h2>
          <p className="text-sm leading-7 text-foreground/90 whitespace-pre-line">
            {listing.description?.trim() || "لم يضف البائع وصفاً مفصلاً بعد."}
          </p>
        </section>

        {/* Details */}
        {detailsEntries.length > 0 && (
          <section className="mt-3 rounded-2xl bg-card p-4 hairline">
            <h2 className="mb-3 text-sm font-extrabold text-foreground">تفاصيل الإعلان</h2>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {detailsEntries.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-semibold text-foreground">{String(v)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Seller panel */}
        <section className="mt-3 rounded-2xl bg-card-warm p-4 hairline">
          <h2 className="mb-3 text-sm font-extrabold text-foreground">البائع</h2>
          <Link
            to="/seller/$id"
            params={{ id: listing.sellerId }}
            className="flex items-center gap-3"
          >
            <div className="grid h-12 w-12 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground">
              {listing.sellerName.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-bold">{listing.sellerName}</span>
                {listing.isVerifiedSeller && <BadgeCheck className="h-4 w-4 text-emerald-trust" />}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                <span>{sellerTypeLabel(listing.sellerType)}</span>
                <span className="inline-flex items-center gap-1">
                  <Star className="h-3 w-3 fill-gold text-gold" /> {listing.sellerRating.toFixed(1)}
                </span>
                <span>عضو منذ {new Date(listing.sellerJoinedAt).getFullYear()}</span>
                <span>{listing.governorate}</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </Link>
          <p className="mt-3 text-[11px] text-muted-foreground">
            حالة التوثيق: {listing.isVerifiedSeller ? "موثّق" : "غير موثّق"} · نظام التقييم تجريبي
            وسيُفعَّل لاحقاً بعد تسجيل الدخول.
          </p>
        </section>

        {/* Contact panel */}
        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-3 text-sm font-extrabold text-foreground">التواصل مع البائع</h2>
          <div className="grid grid-cols-3 gap-2">
            {listing.contactOptions.message && (
              <ContactBtn icon={Send} label="رسالة" tone="primary" />
            )}
            {listing.contactOptions.phone && <ContactBtn icon={Phone} label="اتصال" tone="gold" />}
            {listing.contactOptions.whatsapp && (
              <ContactBtn icon={MessageCircle} label="واتساب" tone="trust" />
            )}
          </div>
          <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
            <p className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> أزرار التواصل غير مفعّلة حالياً — سيتم تفعيلها لاحقاً.
            </p>
            <p>لا نعرض أرقاماً حقيقية في النسخة التجريبية حفاظاً على الخصوصية.</p>
            <p>وقت التواصل المفضل: حسب توفر البائع.</p>
            <p className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3" /> لا تشارك بيانات حساسة أو تحويلات قبل التأكد من
              السلعة.
            </p>
          </div>
        </section>

        {/* Safety panel */}
        <section className="mt-3 rounded-2xl bg-warning/10 p-4 hairline">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="text-xs space-y-1.5 text-foreground/90">
              <p className="font-bold">نصائح أمان قبل التواصل</p>
              <ul className="list-disc ps-5 space-y-1">
                <li>قابل البائع في مكان عام وآمن.</li>
                <li>افحص السلعة قبل الدفع.</li>
                <li>لا تحوّل المال قبل التأكد.</li>
                <li>احذر الأسعار غير المنطقية.</li>
                <li>بلّغ عن أي إعلان مشبوه.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Report / block */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            title="غير مفعّل حالياً — سيُفعَّل لاحقاً"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-destructive hairline transition hover:bg-destructive/5"
          >
            <Flag className="h-4 w-4" /> إبلاغ عن الإعلان · قريباً
          </button>
          <button
            title="غير مفعّل حالياً — سيُفعَّل لاحقاً"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-foreground hairline transition hover:bg-muted-surface"
          >
            <Ban className="h-4 w-4" /> حظر البائع · قريباً
          </button>
        </div>

        {/* Similar */}
        {similar.length > 0 && (
          <section className="mt-7">
            <h2 className="mb-3 text-lg font-extrabold">
              <span className="inline-block border-b-2 border-gold pb-0.5">إعلانات مشابهة</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function ContactBtn({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Send;
  label: string;
  tone: "primary" | "gold" | "trust";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary text-primary-foreground"
      : tone === "gold"
        ? "bg-gold text-gold-foreground"
        : "bg-emerald-trust text-emerald-trust-foreground";
  return (
    <button
      disabled
      title="غير مفعّل حالياً — سيُفعَّل لاحقاً"
      className={`flex flex-col items-center gap-1 rounded-xl ${cls} py-3 opacity-80 cursor-not-allowed`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-bold">{label}</span>
      <span className="text-[9px] font-medium opacity-80">قريباً</span>
    </button>
  );
}

function sellerTypeLabel(t: string) {
  switch (t) {
    case "verified":
      return "بائع موثّق";
    case "store":
      return "متجر";
    case "business":
      return "حساب أعمال";
    default:
      return "مستخدم";
  }
}
