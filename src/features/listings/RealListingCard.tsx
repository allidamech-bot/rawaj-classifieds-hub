import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";
import { formatDate } from "./listings-components";

export function RealListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="rawaj-listing-card group flex h-full flex-col overflow-hidden bg-card transition"
    >
      <div className="rawaj-listing-media relative overflow-hidden bg-muted-surface">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="standard" />
        )}
        {listing.reservedAt ? (
          <span className="absolute start-2 top-2 rounded-full bg-warning/92 px-2 py-1 text-[9px] font-extrabold text-warning-foreground shadow-soft backdrop-blur-sm">
            {text("محجوز", "Reserved")}
          </span>
        ) : listing.isFeatured ? (
          <span className="absolute start-2 top-2 rounded-full bg-primary/92 px-2 py-1 text-[9px] font-extrabold text-primary-foreground shadow-soft backdrop-blur-sm">
            {text("مميز", "Featured")}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-[14px] font-extrabold leading-tight text-primary sm:text-base">
            {formatPriceLocalized(
              listing.price ?? 0,
              listing.priceType,
              language,
              listing.currency,
            )}
          </div>
          <span className="rawaj-listing-category max-w-[45%] shrink-0 truncate rounded-full px-2 py-1 text-[9px] font-bold text-muted-foreground">
            {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
          </span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.35rem] text-[12.5px] font-bold leading-snug text-foreground sm:text-[13px]">
          {listing.title}
        </h3>

        <div className="rawaj-listing-meta mt-auto flex items-center justify-between gap-2 pt-2 text-[10px] text-muted-foreground sm:text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-brand-orange" strokeWidth={1.9} />
            <span className="truncate">{listingLocationDisplay(listing, language)}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            <span>{formatDate(listing.createdAt, language)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
