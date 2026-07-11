import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";

export function FeaturedListingMiniCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="rawaj-featured-mini-card"
      data-reserved={Boolean(listing.reservedAt)}
    >
      <div className="rawaj-featured-mini-card__media">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="standard" />
        )}
        <span>{listing.reservedAt ? text("محجوز", "Reserved") : text("مميز", "Featured")}</span>
      </div>
      <div className="rawaj-featured-mini-card__body">
        <strong>
          {formatPriceLocalized(
            listing.price ?? 0,
            listing.priceType,
            language,
            listing.currency,
          )}
        </strong>
        <h3>{listing.title}</h3>
        <p>
          <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span>{listingLocationDisplay(listing, language)}</span>
        </p>
      </div>
    </Link>
  );
}
