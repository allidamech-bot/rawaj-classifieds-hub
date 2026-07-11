import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/shell/spatial-primitives";
import { RealListingCard } from "@/features/listings/RealListingCard";
import type { ClassifiedListing } from "@/lib/classifieds-types";

interface LatestDiscoveryProps {
  listings: ClassifiedListing[];
  text: (ar: string, en: string) => string;
}

export function LatestDiscovery({ listings, text }: LatestDiscoveryProps) {
  return (
    <section className="rawaj-latest-discovery" aria-labelledby="rawaj-latest-title">
      <SectionHeader
        eyebrow={text("وصل حديثًا", "Just arrived")}
        title={<span id="rawaj-latest-title">{text("أحدث ما نُشر", "Latest listings")}</span>}
        action={
          <Link to="/listings" className="rawaj-section-link">
            {text("تصفح السوق", "Browse market")}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" strokeWidth={1.9} />
          </Link>
        }
      />

      {listings.length > 0 ? (
        <div className="listing-card-grid rawaj-latest-discovery__grid">
          {listings.map((listing) => (
            <RealListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="rawaj-latest-discovery__empty">
          {text("لا توجد إعلانات معتمدة للعرض الآن.", "No reviewed listings are available right now.")}
        </div>
      )}
    </section>
  );
}
