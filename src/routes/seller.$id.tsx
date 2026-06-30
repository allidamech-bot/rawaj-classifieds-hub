import { createFileRoute, notFound } from "@tanstack/react-router";
import { BadgeCheck, Star, Flag, Ban, Phone } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ListingCard } from "@/components/ListingCard";
import { listings } from "@/data/mockData";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/seller/$id")({
  loader: ({ params }) => {
    const sellerListings = listings.filter((l) => l.sellerId === params.id);
    if (sellerListings.length === 0) throw notFound();
    const s = sellerListings[0];
    return {
      sellerListings,
      seller: {
        id: s.sellerId,
        name: s.sellerName,
        type: s.sellerType,
        verified: s.isVerifiedSeller,
        rating: s.sellerRating,
        joinedAt: s.sellerJoinedAt,
      },
    };
  },
  notFoundComponent: () => (
    <SellerState
      titleAr="بائع"
      titleEn="Seller"
      bodyAr="هذا البائع غير متاح حالياً."
      bodyEn="This seller is not available right now."
    />
  ),
  errorComponent: ({ reset }) => <SellerError reset={reset} />,
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.seller.name} | رَوَاج` : "بائع | رَوَاج" }],
  }),
  component: SellerPage,
});

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
      <main className="container-wide pt-10 text-center text-sm text-muted-foreground">
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
      <main className="container-wide pt-10 text-center">
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

function SellerPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const { seller, sellerListings } = Route.useLoaderData();

  const bannerText =
    auth.status === "authUnavailable"
      ? text(
          "ملف البائع العام قيد التجهيز حالياً. هذه واجهة تمهيدية فقط وتستخدم بيانات تجريبية للاطلاع على التصميم النهائي.",
          "The public seller profile is being prepared. This is a preparatory interface using demo data to preview the final design.",
        )
      : text(
          "ملف البائع العام قيد التجهيز حالياً. عند التفعيل ستظهر البيانات العامة والإعلانات المعتمدة فقط دون كشف أي بيانات خاصة.",
          "The public seller profile is being prepared. When enabled, only public data and approved listings will appear without exposing private data.",
        );

  return (
    <div>
      <PageHeader title={text("ملف البائع", "Seller profile")} />
      <main className="container-wide pt-4 pb-8">
        {auth.status === "loading" ? (
          <div className="rounded-2xl bg-card p-10 text-center hairline text-sm text-muted-foreground">
            {text("جارٍ التحقق من الجلسة...", "Checking session...")}
          </div>
        ) : (
          <div>
            <div className="mb-4 rounded-2xl bg-warning/10 p-3 text-xs text-foreground/90 hairline">
              {bannerText}
            </div>
            <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-foreground/10 text-xl font-bold text-gold">
                  {seller.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-extrabold">{seller.name}</h1>
                    {seller.verified && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold">
                        <BadgeCheck className="h-3 w-3" /> {text("موثّق", "Verified")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/80">
                    <span>{labelType(seller.type, language)}</span>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3 fill-gold text-gold" />{" "}
                      {text("تقييم تجريبي", "Demo rating")} {seller.rating.toFixed(1)}
                    </span>
                    <span>
                      {text("منذ", "Since")} {new Date(seller.joinedAt).getFullYear()}
                    </span>
                    <span>
                      {text(`${sellerListings.length} إعلان`, `${sellerListings.length} listings`)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  disabled
                  title={text("غير مفعّل", "Disabled")}
                  className="rounded-xl bg-gold py-2 text-xs font-bold text-gold-foreground opacity-70 cursor-not-allowed"
                >
                  {text("رسالة · قريباً", "Message · soon")}
                </button>
                <button
                  disabled
                  title={text("غير مفعّل", "Disabled")}
                  className="inline-flex items-center justify-center gap-1 rounded-xl bg-primary-foreground/10 py-2 text-xs font-bold opacity-70 cursor-not-allowed"
                >
                  <Phone className="h-3.5 w-3.5" /> {text("اتصال · قريباً", "Call · soon")}
                </button>
                <button
                  disabled
                  title={text("غير مفعّل", "Disabled")}
                  className="rounded-xl bg-primary-foreground/10 py-2 text-xs font-bold opacity-70 cursor-not-allowed"
                >
                  {text("واتساب · قريباً", "WhatsApp · soon")}
                </button>
              </div>
              <p className="mt-2 text-[11px] text-primary-foreground/70">
                {text(
                  "وسائل التواصل ستظهر فقط حسب إعدادات البائع بعد تفعيل الحسابات.",
                  "Contact methods will appear only according to seller settings after accounts are enabled.",
                )}
              </p>
            </section>

            <section className="mt-4 rounded-2xl bg-card p-4 hairline">
              <h3 className="text-sm font-extrabold">
                {text("نبذة عن البائع", "About the seller")}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {text(
                  "لم يضف البائع نبذة بعد. ستظهر هنا معلومات النشاط، ساعات التوفر، ومدة الاستجابة لاحقاً.",
                  "The seller has not added a bio yet. Business info, availability, and response time will appear here later.",
                )}
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                <div>
                  {text("وقت الاستجابة:", "Response time:")}{" "}
                  <span className="font-bold text-foreground">—</span>
                </div>
                <div>
                  {text("الموقع:", "Location:")}{" "}
                  <span className="font-bold text-foreground">{text("سوريا", "Syria")}</span>
                </div>
              </div>
            </section>

            <section className="mt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold">
                  <span className="inline-block border-b-2 border-gold pb-0.5">
                    {text(
                      `الإعلانات النشطة (${sellerListings.length})`,
                      `Active listings (${sellerListings.length})`,
                    )}
                  </span>
                </h2>
                <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
                  {text("نموذج عرض · ليست بيانات إنتاجية", "Demo preview · not production data")}
                </span>
              </div>
              {sellerListings.length === 0 ? (
                <div className="rounded-2xl bg-card p-8 text-center hairline text-sm text-muted-foreground">
                  {text(
                    "لا توجد إعلانات نشطة لهذا البائع حالياً.",
                    "This seller has no active listings right now.",
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {sellerListings.map((l: (typeof listings)[number]) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
              )}
            </section>

            <section className="mt-4 rounded-2xl bg-card p-4 hairline text-xs text-muted-foreground">
              <p className="font-bold text-foreground">{text("تنبيه أمان", "Safety note")}</p>
              <p className="mt-1">
                {text(
                  "قابل البائع في مكان عام وآمن، وافحص السلعة قبل الدفع. لا تحوّل المال قبل التأكد.",
                  "Meet the seller in a public, safe place, and inspect the item before paying. Do not transfer money before verifying.",
                )}
              </p>
            </section>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                disabled
                title={text("غير مفعّل", "Disabled")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-destructive hairline opacity-70 cursor-not-allowed"
              >
                <Flag className="h-4 w-4" /> {text("إبلاغ · قريباً", "Report · soon")}
              </button>
              <button
                disabled
                title={text("غير مفعّل", "Disabled")}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold hairline opacity-70 cursor-not-allowed"
              >
                <Ban className="h-4 w-4" /> {text("حظر · قريباً", "Block · soon")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function labelType(t: string, language: Language) {
  switch (t) {
    case "verified":
      return uiLabel("بائع موثّق", language);
    case "store":
      return uiLabel("متجر", language);
    case "business":
      return uiLabel("حساب أعمال", language);
    default:
      return uiLabel("مستخدم", language);
  }
}
