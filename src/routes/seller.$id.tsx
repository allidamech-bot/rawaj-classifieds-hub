import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { BadgeCheck, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { fetchPublicSellerProfile } from "@/lib/classifieds-api";
import type { ClassifiedListing, PublicSellerProfile } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";

export const Route = createFileRoute("/seller/$id")({
  loader: async ({ params }) => {
    const seller = await fetchPublicSellerProfile(params.id);
    if (!seller.ok) throw notFound();
    return seller.data;
  },
  notFoundComponent: () => (
    <SellerState
      titleAr="بائع"
      titleEn="Seller"
      bodyAr="تعذر عرض هذا البائع."
      bodyEn="This seller cannot be shown."
    />
  ),
  errorComponent: ({ reset }) => <SellerError reset={reset} />,
  head: ({ loaderData }) => ({
    meta: [{ title: loaderData ? `${loaderData.displayName} | رواج` : "بائع | رواج" }],
  }),
  component: SellerPage,
});

function SellerPage() {
  const { text } = useUiPreferences();
  const seller = Route.useLoaderData();

  return (
    <div>
      <PageHeader title={text("ملف البائع", "Seller profile")} />
      <main className="container-wide pt-4 pb-8">
        <div className="space-y-4">
          <SellerHeader seller={seller} />

          <section className="rounded-2xl bg-card p-4 hairline">
            <h3 className="text-sm font-extrabold">{text("نبذة عن البائع", "About the seller")}</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "يعرض هذا الملف الإعلانات العامة المعتمدة لهذا البائع فقط. لا تظهر أي بيانات خاصة من حسابه.",
                "This profile shows only this seller's public approved listings. Private account data is not shown.",
              )}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
              <Metric
                label={text("الموقع", "Location")}
                value={seller.locationAr ?? text("سوريا", "Syria")}
              />
              <Metric
                label={text("الحساب", "Account")}
                value={seller.verified ? text("موثق", "Verified") : text("نشط", "Active")}
              />
              <Metric label={text("الإعلانات", "Listings")} value={`${seller.listings.length}`} />
              <Metric
                label={text("منذ", "Since")}
                value={seller.joinedAt ? new Date(seller.joinedAt).getFullYear().toString() : "-"}
              />
            </div>
          </section>

          <section>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-extrabold">
                <span className="inline-block border-b-2 border-gold pb-0.5">
                  {text(
                    `الإعلانات المعتمدة (${seller.listings.length})`,
                    `Approved listings (${seller.listings.length})`,
                  )}
                </span>
              </h2>
              <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
                {text("إعلانات البائع", "Seller listings")}
              </span>
            </div>
            {seller.listings.length === 0 ? (
              <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground hairline">
                {text("لا توجد إعلانات عامة لهذا البائع.", "This seller has no public listings.")}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {seller.listings.map((listing) => (
                  <SellerListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            )}
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
        </div>
      </main>
    </div>
  );
}

function SellerHeader({ seller }: { seller: PublicSellerProfile }) {
  const { text } = useUiPreferences();
  return (
    <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary-foreground/10 text-xl font-bold text-gold">
          {seller.displayName.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-extrabold">{seller.displayName}</h1>
            {seller.verified && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold">
                <BadgeCheck className="h-3 w-3" />
                {text("موثق", "Verified")}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-primary-foreground/80">
            <span>{text("مستخدم", "User")}</span>
            {seller.joinedAt && (
              <span>
                {text("منذ", "Since")} {new Date(seller.joinedAt).getFullYear()}
              </span>
            )}
            <span>
              {text(`${seller.listings.length} إعلان`, `${seller.listings.length} listings`)}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-4 rounded-xl bg-primary-foreground/10 p-3 text-xs leading-6 text-primary-foreground/85">
        {text(
          "افتح أحد إعلانات المعلن المعتمدة لعرض طرق التواصل التي فعّلها داخل ذلك الإعلان.",
          "Open one of the seller's approved listings to view the contact methods enabled there.",
        )}
      </p>
    </section>
  );
}

function SellerListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="block overflow-hidden rounded-2xl bg-card shadow-soft transition-shadow hairline hover:shadow-premium"
    >
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
