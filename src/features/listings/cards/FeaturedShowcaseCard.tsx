import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";
import {
  productCardFacts,
  propertyCardFacts,
  resolveListingCardVariant,
  vehicleCardFacts,
} from "./listing-card-utils";

export function FeaturedShowcaseCard({
  listing,
  action,
}: {
  listing: ClassifiedListing;
  action?: ReactNode;
}) {
  const { language, text } = useUiPreferences();
  const variant = resolveListingCardVariant(listing);
  const facts =
    variant === "vehicle"
      ? vehicleCardFacts(listing, language)
      : variant === "property"
        ? propertyCardFacts(listing, language)
        : productCardFacts(listing, language);

  return (
    <article
      className="rawaj-featured-card"
      data-card-variant="featured"
      data-content-variant={variant}
      data-reserved={Boolean(listing.reservedAt)}
    >
      <Link to="/listings/$id" params={{ id: listing.id }} className="rawaj-featured-card__link">
        <div className="rawaj-featured-card__media">
          {listing.primaryImageUrl ? (
            <img
              src={listing.primaryImageUrl}
              alt={listing.title}
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          ) : (
            <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="standard" />
          )}
          <div className="rawaj-featured-card__scrim" />
          <span className="rawaj-featured-card__badge">
            <Sparkles aria-hidden="true" />
            {listing.reservedAt ? text("محجوز", "Reserved") : text("مميز", "Featured")}
          </span>
        </div>

        <div className="rawaj-featured-card__content">
          <span className="rawaj-featured-card__category">
            {categoryName(listing.categoryId, listing.categoryNameAr, language)}
          </span>
          <strong className="rawaj-featured-card__price">
            {formatPriceLocalized(
              listing.price ?? 0,
              listing.priceType,
              language,
              listing.currency,
            )}
          </strong>
          <h3>{listing.title}</h3>
          {facts.length > 0 ? (
            <div className="rawaj-featured-card__facts">
              {facts.slice(0, 3).map((fact) => (
                <span key={fact.key}>{fact.value}</span>
              ))}
            </div>
          ) : null}
          <p className="rawaj-featured-card__location">
            <MapPin aria-hidden="true" />
            <span>{listingLocationDisplay(listing, language)}</span>
          </p>
          <span className="rawaj-featured-card__open">
            {text("افتح الإعلان", "Open listing")}
            <ArrowUpRight aria-hidden="true" />
          </span>
        </div>
      </Link>
      {action ? <div className="rawaj-featured-card__action">{action}</div> : null}
    </article>
  );
}
