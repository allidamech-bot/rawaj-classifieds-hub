import type { ReactNode } from "react";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import {
  CompareListingButton,
  isListingComparisonEligible,
} from "@/features/comparison/listing-comparison";
import { AdaptiveListingCard } from "./cards";

/**
 * Compatibility entry point for existing marketplace routes.
 * New surfaces may import a specific adaptive card variant directly.
 */
export function RealListingCard({
  listing,
  action,
}: {
  listing: ClassifiedListing;
  action?: ReactNode;
}) {
  const comparisonEligible = isListingComparisonEligible(listing);
  const cardAction =
    comparisonEligible || action ? (
      <div className="rawaj-listing-card-actions">
        {comparisonEligible ? <CompareListingButton listing={listing} /> : null}
        {action}
      </div>
    ) : undefined;

  return <AdaptiveListingCard listing={listing} action={cardAction} />;
}
