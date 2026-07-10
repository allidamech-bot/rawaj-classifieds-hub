import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";

export function RealListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group flex h-full flex-col overflow-hidden rounded-[1.2rem] border border-border/80 bg-card shadow-[0_8px_24px_rgba(16,43,70,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-[0_16px_34px_rgba(16,43,70,0.1)]"
    >
      <div className="relative overflow-hidden bg-muted-surface">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <PlaceholderArt
            type={listing.categoryPlaceholder ?? "misc"}
            aspect="standard"
          />
        )}

        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/28 to-transparent" />

        {listing.reservedAt ? (
          <span className="absolute start-2.5 top-2.5 rounded-full bg-warning/95 px-2.5 py-1 text-[9px] font-extrabold text-warning-foreground shadow-sm backdrop-blur-sm">
            {text("محجوز", "Reserved")}
          </span>
        ) : listing.isFeatured ? (
          <span className="absolute start-2.5 top-2.5 rounded-full bg-primary/94 px-2.5 py-1 text-[9px] font-extrabold text-primary-foreground shadow-sm backdrop-blur-sm">
            {text("مميز", "Featured")}
          </span>
        ) : null}

        <span className="absolute bottom-2.5 end-2.5 max-w-[72%] truncate rounded-full bg-card/94 px-2.5 py-1 text-[9px] font-extrabold text-primary shadow-sm backdrop-blur-sm">
          {categoryName(
            listing.categoryId,
            listing.categoryNameAr ?? undefined,
            language,
          )}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <div className="text-[15px] font-extrabold leading-tight text-primary sm:text-[17px]">
          {formatPriceLocalized(
            listing.price ?? 0,
            listing.priceType,
            language,
            listing.currency,
          )}
        </div>

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.5rem] text-[12.5px] font-bold leading-[1.55] text-foreground sm:text-[13.5px]">
          {listing.title}
        </h3>

        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-border/60 pt-2.5 text-[10px] text-muted-foreground sm:text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <MapPin
              className="h-3.5 w-3.5 shrink-0 text-brand-orange"
              strokeWidth={1.9}
            />
            <span className="truncate">
              {listingLocationDisplay(listing, language)}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>{formatListingDate(listing.createdAt, language)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

function formatListingDate(value: string, language: "ar" | "en") {
  if (!value) {
    return language === "ar" ? "تاريخ غير محدد" : "Date unavailable";
  }

  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
  }).format(new Date(value));
}
