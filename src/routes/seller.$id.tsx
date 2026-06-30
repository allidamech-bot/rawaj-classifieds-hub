import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Ban, BadgeCheck, Flag, MessageCircle, Phone, ShieldAlert, Star } from "lucide-react";
import { ListingCard } from "@/components/ListingCard";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { listings } from "@/data/mockData";
import { fetchPublicSellerProfile } from "@/lib/classifieds-api";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName, uiLabel } from "@/lib/i18n";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/seller/$id")({
  loader: async ({ params }) => {
    const realSeller = await fetchPublicSellerProfile(params.id);
    if (realSeller.ok) {
      return {
        source: "real" as const,
        realListings: realSeller.data.listings,
        localListings: [],
        seller: {
          id: realSeller.data.id,
          name: realSeller.data.displayName,
          type: "user",
          verified: realSeller.data.verified,
          rating: null,
          joinedAt: realSeller.data.joinedAt,
        },
      };
    }

    const localListings = listings.filter((listing) => listing.sellerId === params.id);
    if (localListings.length === 0) throw notFound();
    const first = localListings[0];
    return {
      source: "local" as const,
      realListings: [],
      localListings,
      seller: {
        id: first.sellerId,
        name: first.sellerName,
        type: first.sellerType,
        verified: first.isVerifiedSeller,
        rating: first.sellerRating,
        joinedAt: first.sellerJoinedAt,
      },
    };
  },
  notFoundComponent: () => (
    <SellerState
      titleAr="بائع"
      titleEn="Seller"
      bodyAr="هذا البائع تعذر عرضه الآن."
      bodyEn="This seller is not available right now."
    />
  ),
  errorComponent: ({ reset }) => <SellerError reset={reset} />,
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.seller.name} | رَوَاج` : "بائع | رَوَاج" }],
  }),
  component: SellerPage,
});

function SellerPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const { source, seller, realListings, localListings } = Route.useLoaderData();
  const listingCount = source === "real" ? realListings.length : localListings.length;
  const [notice, setNotice] = useState("");

  function setAction(ar: string, en: string) {
    setNotice(text(ar, en));
  }

  return (
    <div>
      <PageHeader title={text("ملف البائع", "Seller profile")} />
      <main className="container-wide pt-4 pb-8">
        {auth.status === "loading" ? (
          <div className="rounded-2xl bg-card p-10 text-center text-sm text-muted-foreground hairline">
            {text("جارٍ التحقق من الجلسة...", "Checking session...")}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
              <div className="flex items-center gap-4">
                <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-foreground/10 text-xl font-bold text-gold">
                  {seller.name.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-extrabold">{seller.name}</h1>
                    {seller.verified && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold">
                        <BadgeCheck className="h-3 w-3" />
                        {text("موثّق", "Verified")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/80">
                    <span>{labelType(seller.type, language)}</span>
                    {seller.rating !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-gold text-gold" />
                        {seller.rating.toFixed(1)}
                      </span>
                    )}
                    {seller.joinedAt && (
                      <span>
                        {text("منذ", "Since")} {new Date(seller.joinedAt).getFullYear()}
                      </span>
                    )}
                    <span>{text(`${listingCount} إعلان`, `${listingCount} listings`)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() =>
                    setAction(
                      "تم تجهيز محادثة محلية مع البائع.",
                      "A local seller conversation was prepared.",
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold py-2 text-xs font-bold text-gold-foreground"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  {text("مراسلة", "Message")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAction(
                      "سيتم عرض رقم الهاتف عندما يختاره البائع ضمن الإعلان.",
                      "The phone number appears when the seller enables it on a listing.",
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-foreground/10 py-2 text-xs font-bold"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {text("اتصال", "Call")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAction(
                      "تم تجهيز رابط واتساب محلياً وفق إعدادات الإعلان.",
                      "A WhatsApp handoff was prepared locally based on listing settings.",
                    )
                  }
                  className="rounded-xl bg-primary-foreground/10 py-2 text-xs font-bold"
                >
                  {text("واتساب", "WhatsApp")}
                </button>
              </div>
              {notice && (
                <p className="mt-3 rounded-xl bg-primary-foreground/10 p-3 text-[11px]">{notice}</p>
              )}
            </section>

            <section className="rounded-2xl bg-card p-4 hairline">
              <h3 className="text-sm font-extrabold">
                {text("نبذة عن البائع", "About the seller")}
              </h3>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "يعرض هذا الملف معلومات عامة تساعدك على تقييم البائع وإعلاناته داخل رَوَاج. لا تظهر أي بيانات خاصة إلا إذا اختار البائع إظهارها ضمن إعلان محدد.",
                  "This profile shows public information that helps you evaluate the seller and listings inside RAWAJ. Private details are not shown unless the seller chooses to expose them on a specific listing.",
                )}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                <Metric
                  label={text("وقت الاستجابة", "Response")}
                  value={text("خلال اليوم", "Same day")}
                />
                <Metric label={text("الموقع", "Location")} value={text("سوريا", "Syria")} />
                <Metric
                  label={text("حالة الحساب", "Account")}
                  value={seller.verified ? text("موثّق", "Verified") : text("نشط", "Active")}
                />
                <Metric label={text("الإعلانات", "Listings")} value={`${listingCount}`} />
              </div>
            </section>

            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-extrabold">
                  <span className="inline-block border-b-2 border-gold pb-0.5">
                    {text(
                      `الإعلانات النشطة (${listingCount})`,
                      `Active listings (${listingCount})`,
                    )}
                  </span>
                </h2>
                <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
                  {text("إعلانات البائع", "Seller listings")}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {source === "real"
                  ? realListings.map((listing) => (
                      <SellerListingCard key={listing.id} listing={listing} />
                    ))
                  : localListings.map((listing) => (
                      <ListingCard key={listing.id} listing={listing} />
                    ))}
              </div>
            </section>

            <section className="flex items-start gap-3 rounded-2xl bg-card p-4 text-xs text-muted-foreground hairline">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <p className="leading-6">
                <strong className="text-foreground">{text("تنبيه أمان", "Safety note")}: </strong>
                {text(
                  "قابل البائع في مكان عام وآمن، وافحص السلعة قبل الدفع. لا تحوّل المال قبل التأكد.",
                  "Meet in a safe public place, inspect the item before paying, and do not transfer money before verifying.",
                )}
              </p>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  setAction(
                    "تم تسجيل نية الإبلاغ محلياً. استخدم صفحة الدعم للحالات العاجلة.",
                    "Report intent was recorded locally. Use Support for urgent cases.",
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold text-destructive hairline"
              >
                <Flag className="h-4 w-4" />
                {text("إبلاغ", "Report")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setAction(
                    "تم تحديث تفضيل الحظر لهذه الجلسة.",
                    "Block preference was updated for this session.",
                  )
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-card py-2.5 text-xs font-bold hairline"
              >
                <Ban className="h-4 w-4" />
                {text("حظر", "Block")}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function SellerListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language } = useUiPreferences();

  return (
    <LinkCard listingId={listing.id}>
      <div className="relative">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            className="aspect-[16/9] w-full object-cover"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <span className="absolute bottom-2 end-2 rounded-md bg-primary/85 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          {categoryName(listing.categoryId, listing.categoryNameAr, language)}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-lg font-extrabold text-foreground">
          {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {governorateName(listing.governorateId, listing.governorateNameAr, language)}
          {listing.districtAr ? ` · ${listing.districtAr}` : ""}
        </p>
      </div>
    </LinkCard>
  );
}

function LinkCard({ listingId, children }: { listingId: string; children: React.ReactNode }) {
  return (
    <Link
      to="/listings/$id"
      params={{ id: listingId }}
      className="block overflow-hidden rounded-2xl bg-card hairline shadow-soft transition-shadow hover:shadow-premium"
    >
      {children}
    </Link>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-3">
      <div>{label}</div>
      <div className="mt-1 font-bold text-foreground">{value}</div>
    </div>
  );
}

function labelType(type: string, language: Language) {
  switch (type) {
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
