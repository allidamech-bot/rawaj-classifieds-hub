import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/shell/spatial-primitives";
import { CompactCard, FeaturedShowcaseCard } from "@/features/listings/cards";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function FeaturedListingShowcase({ listings }: { listings: ClassifiedListing[] }) {
  const { text } = useUiPreferences();
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
        <FeaturedShowcaseCard listing={primary} />

        {secondary.length > 0 ? (
          <div className="rawaj-featured-showcase__rail">
            {secondary.slice(0, 3).map((listing) => (
              <CompactCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
