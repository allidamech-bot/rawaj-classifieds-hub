import { Link } from "@tanstack/react-router";
import { ArrowUpLeft } from "lucide-react";
import { RealListingCard } from "@/features/listings/RealListingCard";
import { ListingCardSkeleton } from "@/features/listings/cards";
import type { ClassifiedListing } from "@/lib/classifieds-types";

interface SimilarListingsRailProps {
  listings: ClassifiedListing[];
  categoryId: string;
  loading: boolean;
  text: (ar: string, en: string) => string;
}

export function SimilarListingsRail({
  listings,
  categoryId,
  loading,
  text,
}: SimilarListingsRailProps) {
  if (!loading && listings.length === 0) return null;

  return (
    <section className="rawaj-detail-similar" aria-labelledby="rawaj-detail-similar-title">
      <div className="rawaj-detail-similar__heading">
        <div>
          <p>{text("اكتشف المزيد", "Discover more")}</p>
          <h2 id="rawaj-detail-similar-title">{text("إعلانات مشابهة", "Similar listings")}</h2>
        </div>
        <Link to="/listings" search={{ category: categoryId }}>
          {text("عرض الكل", "View all")}
          <ArrowUpLeft className="rtl:-rotate-90" aria-hidden="true" />
        </Link>
      </div>

      <div className="rawaj-detail-similar__rail">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="rawaj-detail-similar__item">
                <ListingCardSkeleton />
              </div>
            ))
          : listings.map((listing) => (
              <div key={listing.id} className="rawaj-detail-similar__item">
                <RealListingCard listing={listing} />
              </div>
            ))}
      </div>
    </section>
  );
}
