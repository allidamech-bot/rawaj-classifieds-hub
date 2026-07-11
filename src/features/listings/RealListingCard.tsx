import type { ReactNode } from "react";
import type { ClassifiedListing } from "@/lib/classifieds-types";
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
  return <AdaptiveListingCard listing={listing} action={action} />;
}
