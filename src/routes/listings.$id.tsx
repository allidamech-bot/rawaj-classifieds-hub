import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  MapPin, Clock, Eye, Heart, BadgeCheck, Star, Phone, MessageCircle,
  Send, ShieldAlert, Flag, Ban, ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { ListingCard } from "@/components/ListingCard";
import { findListing, listings } from "@/data/mockData";
import { priceLabel } from "@/utils/format";

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
        <Link to="/" className="mt-4 inline-block text-sm font-bold text-primary">العودة للرئيسية</Link>
      </main>
    </>
  ),
  errorComponent: ({ reset }) => (
    <>
      <PageHeader title="خطأ" />
      <main className="container-wide pt-10 text-center">
        <p className="text-sm text-muted-foreground">حدث خطأ أثناء عرض الإعلان.</p>
        <button onClick={reset} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">
          إعادة المحاولة
        </button>
      </main>
    </>
  ),
  component: ListingDetailsPage,
});

function ListingDetailsPage() {
  const { listing } = Route.useLoaderData();
  const [fav, setFav] = useState(false);

  const similar = listings.filter((l) => l.id !== listing.id && l.categoryId === listing.categoryId).slice(0, 4);

  return (
    <>
      <PageHeader title={listing.categoryName} />

      <main className="container-wide pt-3 pb-8">
        {/* Gallery */}
        <div className="overflow-hidden rounded-2xl bg-card hairline shadow-soft">
          <PlaceholderArt type={listing.placeholderType} aspect="wide" />
          <div className="flex gap-2 p-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 w-16 overflow-hidden rounded-lg hairline">
                <PlaceholderArt type={listing.placeholderType} aspect="square" />
              </div>
            ))}
          </div>
        </div>

        {/* Title + badges */}
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {listing.isFeatured && (
              <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">مميز</span>
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

          <h1 className="mt-2 text-xl font-extrabold leading-tight text-foreground">{listing.title}</h1>
          <div className="mt-2 text-2xl font-extrabold text-foreground">{priceLabel(listing.price, listing.priceType)}</div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {listing.governorate} · {listing.district}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {listing.timeSincePosted}</span>
            <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {listing.viewsCount} مشاهدة</span>
            <button onClick={() => setFav((v) => !v)} className="inline-flex items-center gap-1">
              <Heart className={`h-3.5 w-3.5 ${fav ? "fill-destructive text-destructive" : ""}`} /> {listing.favoritesCount + (fav ? 1 : 0)}
            </button>
          </div>
        </div>

        {/* Description */}
        <section className="mt-5 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">الوصف</h2>
          <p className="text-sm leading-7 text-foreground/90">{listing.description}</p>
        </section>

        {/* Details */}
        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-3 text-sm font-extrabold text-foreground">تفاصيل الإعلان</h2>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            {Object.entries(listing.details).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border/60 py-1.5 text-sm last:border-b-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-semibold text-foreground">{String(v)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Seller */}
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
                <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-gold text-gold" /> {listing.sellerRating.toFixed(1)}</span>
                <span>عضو منذ {new Date(listing.sellerJoinedAt).getFullYear()}</span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 rtl:rotate-180" />
          </Link>
        </section>

        {/* Contact actions — demo only */}
        <section className="mt-3">
          <div className="grid grid-cols-3 gap-2">
            {listing.contactOptions.message && (
              <button title="عرض فقط — سيُفعَّل لاحقاً" className="flex flex-col items-center gap-1 rounded-xl bg-primary py-3 text-primary-foreground transition hover:opacity-90">
                <Send className="h-5 w-5" /> <span className="text-xs font-bold">رسالة</span>
              </button>
            )}
            {listing.contactOptions.phone && (
              <button title="عرض فقط — سيُفعَّل لاحقاً" className="flex flex-col items-center gap-1 rounded-xl bg-gold py-3 text-gold-foreground transition hover:opacity-90">
                <Phone className="h-5 w-5" /> <span className="text-xs font-bold">اتصال</span>
              </button>
            )}
            {listing.contactOptions.whatsapp && (
              <button title="عرض فقط — سيُفعَّل لاحقاً" className="flex flex-col items-center gap-1 rounded-xl bg-emerald-trust py-3 text-emerald-trust-foreground transition hover:opacity-90">
                <MessageCircle className="h-5 w-5" /> <span className="text-xs font-bold">واتساب</span>
              </button>
            )}
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            أزرار التواصل للعرض فقط في هذه النسخة التجريبية.
          </p>
        </section>

        {/* Safety */}
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-warning/10 p-4 hairline">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <p className="text-sm font-medium">لا تحول المال قبل التأكد من السلعة والبائع.</p>
        </div>

        {/* Report / block */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button title="عرض فقط — سيُفعَّل لاحقاً" className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-destructive hairline transition hover:bg-destructive/5">
            <Flag className="h-4 w-4" /> إبلاغ
          </button>
          <button title="عرض فقط — سيُفعَّل لاحقاً" className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-foreground hairline transition hover:bg-muted-surface">
            <Ban className="h-4 w-4" /> حظر المستخدم
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

function sellerTypeLabel(t: string) {
  switch (t) {
    case "verified": return "بائع موثّق";
    case "store":    return "متجر";
    case "business": return "حساب أعمال";
    default:         return "مستخدم";
  }
}
