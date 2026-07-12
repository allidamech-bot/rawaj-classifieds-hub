import { Link } from "@tanstack/react-router";
import { ArrowLeft, MapPin, Shapes } from "lucide-react";
import { RealListingCard } from "@/features/listings/RealListingCard";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function MarketplaceLandingPage({
  kind,
  titleAr,
  titleEn,
  descriptionAr,
  descriptionEn,
  listings,
  browseSearch,
}: {
  kind: "category" | "governorate";
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  listings: ClassifiedListing[];
  browseSearch: Record<string, string>;
}) {
  const { text } = useUiPreferences();
  const Icon = kind === "category" ? Shapes : MapPin;

  return (
    <main className="container-wide mobile-page-bottom space-y-6 pb-10 pt-4 sm:pt-6">
      <section className="rawaj-surface rounded-[1.6rem] p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="rawaj-eyebrow">
              {kind === "category"
                ? text("قسم في سوق رواج", "RAWAJ marketplace category")
                : text("إعلانات حسب المحافظة", "Listings by governorate")}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight text-primary sm:text-3xl">
              {text(titleAr, titleEn)}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
              {text(descriptionAr, descriptionEn)}
            </p>
          </div>
        </div>
        <Link
          to="/listings"
          search={browseSearch}
          className="rawaj-button-primary mt-5 inline-flex items-center gap-2 px-5 py-3"
        >
          {text("عرض كل الإعلانات", "Browse all listings")}
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
        </Link>
      </section>

      <section>
        <div className="mb-3">
          <p className="rawaj-eyebrow">{text("الأحدث", "Latest")}</p>
          <h2 className="mt-1 text-lg font-extrabold text-foreground">
            {text("أحدث الإعلانات المتاحة", "Latest available listings")}
          </h2>
        </div>
        {listings.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {listings.map((listing) => (
              <RealListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="rawaj-surface rounded-2xl p-6 text-center">
            <p className="text-sm font-bold text-foreground">
              {text("لا توجد إعلانات متاحة حالياً", "No listings are available right now")}
            </p>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "يمكنك متابعة السوق أو نشر أول إعلان مناسب.",
                "Continue browsing the marketplace or publish the first relevant listing.",
              )}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
