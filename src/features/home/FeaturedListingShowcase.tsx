import { Link } from "@tanstack/react-router";
import { ArrowUpRight, ChevronRight, MapPin, Sparkles } from "lucide-react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { SectionHeader } from "@/components/shell/spatial-primitives";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";
import { FeaturedListingMiniCard } from "./FeaturedListingMiniCard";

export function FeaturedListingShowcase({ listings }: { listings: ClassifiedListing[] }) {
  const { language, text } = useUiPreferences();
  const [primary, ...secondary] = listings;
  if (!primary) return null;

  return (
    <section className="rawaj-featured-showcase" aria-labelledby="rawaj-featured-title">
      <SectionHeader
        eyebrow={text("مختارات رواج", "RAWAJ selection")}
        title={
          <span id="rawaj-featured-title">
            {text("إعلانات تستحق النظرة الأولى", "Listings worth seeing first")}
          </span>
        }
        action={
          <Link to="/listings" className="rawaj-section-link">
            {text("عرض الكل", "View all")}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.9} />
          </Link>
        }
      />

      <div className="rawaj-featured-showcase__layout">
        <Link
          to="/listings/$id"
          params={{ id: primary.id }}
          className="rawaj-featured-showcase__main"
          data-reserved={Boolean(primary.reservedAt)}
        >
          <div className="rawaj-featured-showcase__media">
            {primary.primaryImageUrl ? (
              <img
                src={primary.primaryImageUrl}
                alt={primary.title}
                loading="eager"
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              <PlaceholderArt type={primary.categoryPlaceholder ?? "misc"} aspect="standard" />
            )}
            <div className="rawaj-featured-showcase__scrim" />
            <span className="rawaj-featured-showcase__badge">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
              {primary.reservedAt ? text("محجوز", "Reserved") : text("مميز", "Featured")}
            </span>
          </div>

          <div className="rawaj-featured-showcase__content">
            <div className="rawaj-featured-showcase__category">
              {categoryName(primary.categoryId, primary.categoryNameAr, language)}
            </div>
            <strong className="rawaj-featured-showcase__price">
              {formatPriceLocalized(
                primary.price ?? 0,
                primary.priceType,
                language,
                primary.currency,
              )}
            </strong>
            <h3>{primary.title}</h3>
            <p>
              <MapPin className="h-4 w-4" strokeWidth={1.8} />
              <span>{listingLocationDisplay(primary, language)}</span>
            </p>
            <span className="rawaj-featured-showcase__open">
              {text("افتح الإعلان", "Open listing")}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.9} />
            </span>
          </div>
        </Link>

        {secondary.length > 0 ? (
          <div className="rawaj-featured-showcase__rail">
            {secondary.slice(0, 3).map((listing) => (
              <FeaturedListingMiniCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
