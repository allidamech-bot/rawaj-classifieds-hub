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
  fetchListingDetail,
  unfavoriteListing,
} from "@/lib/classifieds-api";
import type { ClassifiedListing, ClassifiedsError } from "@/lib/classifieds-types";
import { useAuth } from "@/lib/use-auth";
import { formatPrice, priceLabel, priceTypeLabel } from "@/utils/format";

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
  const [listing, setListing] = useState<ClassifiedListing | null>(null);
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
        setError(result.error);
      } else {
        setListing(result.data);
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
    const userId = auth.profile?.id ?? null;
    const result = fav ? await unfavoriteListing(userId, id) : await favoriteListing(userId, id);

    if (!result.ok) {
      setActionMessage(result.error.message);
      return;
    }

    setFav((value) => !value);
    setActionMessage(fav ? "تمت إزالة الإعلان من المفضلة." : "تم حفظ الإعلان في المفضلة.");
  }

  async function reportListing() {
    setActionMessage(null);
    const result = await createListingReport(
      auth.profile?.id ?? null,
      id,
      "suspicious_listing",
      "بلاغ سريع من صفحة الإعلان.",
    );

    setActionMessage(result.ok ? "تم إرسال البلاغ للمراجعة." : result.error.message);
  }

  if (loading) {
    return (
      <>
        <PageHeader title="تفاصيل الإعلان" />
        <main className="container-wide pt-10">
          <StateCard title="جارٍ تحميل الإعلان" body="يتم جلب الإعلان المعتمد من Supabase." />
        </main>
      </>
    );
  }

  if (error || !listing) {
    return (
      <>
        <PageHeader title="تفاصيل الإعلان" />
        <main className="container-wide pt-10">
          <StateCard
            title={
              error?.code === "schema_missing" ? "إعداد قاعدة البيانات مطلوب" : "الإعلان غير متاح"
            }
            body={error?.message ?? "هذا الإعلان غير متاح أو لم تتم الموافقة عليه بعد."}
            actionLabel="تصفح الإعلانات"
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
      <PageHeader title={listing.categoryNameAr ?? "إعلان"} />
      <main className="container-wide pt-3 pb-8">
        <div className="overflow-hidden rounded-2xl bg-card hairline shadow-soft">
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
          <div className="flex items-center justify-between gap-2 p-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-muted-surface px-2 py-1 text-[10px] font-medium text-muted-foreground">
              <Camera className="h-3 w-3" /> صور الإعلان تحتاج Supabase Storage لاحقاً
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {listing.isFeatured && (
              <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
                مميز
              </span>
            )}
            <span className="rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
              إعلان معتمد
            </span>
            <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[11px] font-semibold text-foreground">
              سوريا فقط
            </span>
          </div>

          <h1 className="mt-2 text-xl font-extrabold leading-tight text-foreground">
            {listing.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span>رقم الإعلان: {listing.id}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" /> {formatDate(listing.createdAt)}
            </span>
          </div>
        </div>

        <section className="mt-4 rounded-2xl bg-card p-4 hairline shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">السعر</div>
              <div className="mt-0.5 text-2xl font-extrabold text-foreground">
                {listing.price
                  ? formatPrice(listing.price, listing.currency)
                  : priceLabel(0, listing.priceType)}
              </div>
              <div className="mt-1 text-xs font-semibold text-gold">
                {priceTypeLabel(listing.priceType)}
              </div>
            </div>
            <button
              onClick={() => void toggleFavorite()}
              aria-label="حفظ في المفضلة"
              className="grid h-11 w-11 place-items-center rounded-full bg-muted-surface transition hover:bg-secondary"
            >
              <Heart
                className={`h-5 w-5 ${fav ? "fill-destructive text-destructive" : "text-foreground"}`}
              />
            </button>
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">الموقع</h2>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-gold" />
            <span className="font-semibold">{listing.governorateNameAr ?? "سوريا"}</span>
            {listing.districtAr && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>{listing.districtAr}</span>
              </>
            )}
            <span className="ms-auto text-[11px] text-muted-foreground">سوريا فقط</span>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-muted-surface py-6 text-xs text-muted-foreground">
            <MapIcon className="h-4 w-4" />
            الخريطة ستتوفر لاحقاً
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-card p-4 hairline">
          <h2 className="mb-2 text-sm font-extrabold text-foreground">الوصف</h2>
          <p className="whitespace-pre-line text-sm leading-7 text-foreground/90">
            {listing.description?.trim() || "لم يضف البائع وصفاً مفصلاً بعد."}
          </p>
        </section>

        {detailsEntries.length > 0 && (
          <section className="mt-3 rounded-2xl bg-card p-4 hairline">
            <h2 className="mb-3 text-sm font-extrabold text-foreground">تفاصيل الإعلان</h2>
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
          <h2 className="mb-3 text-sm font-extrabold text-foreground">التواصل مع البائع</h2>
          <button
            disabled
            className="flex w-full flex-col items-center gap-1 rounded-xl bg-primary py-3 text-primary-foreground opacity-80"
          >
            <Send className="h-5 w-5" />
            <span className="text-xs font-bold">رسائل داخل التطبيق · قريباً</span>
          </button>
          <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
            <p className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" /> التواصل الحقيقي يحتاج سياسة رسائل وخصوصية لاحقاً.
            </p>
            <p>لا نعرض أرقاماً حقيقية في هذه المرحلة حفاظاً على الخصوصية.</p>
            <p className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="h-3 w-3" /> لا تشارك بيانات حساسة أو تحويلات قبل التأكد من
              السلعة.
            </p>
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-warning/10 p-4 hairline">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="space-y-1.5 text-xs text-foreground/90">
              <p className="font-bold">نصائح أمان قبل التواصل</p>
              <ul className="list-disc space-y-1 ps-5">
                <li>قابل البائع في مكان عام وآمن.</li>
                <li>افحص السلعة قبل الدفع.</li>
                <li>لا تحوّل المال قبل التأكد.</li>
                <li>بلّغ عن أي إعلان مشبوه.</li>
              </ul>
            </div>
          </div>
        </section>

        <button
          onClick={() => void reportListing()}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-destructive hairline transition hover:bg-destructive/5"
        >
          <Flag className="h-4 w-4" /> إبلاغ عن الإعلان
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

function formatDate(value: string) {
  if (!value) return "تاريخ غير متاح";
  return new Intl.DateTimeFormat("ar-SY", { dateStyle: "medium" }).format(new Date(value));
}
