import type { ReactNode } from "react";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { ProductCard } from "./ProductCard";
import { PropertyCard } from "./PropertyCard";
import { VehicleCard } from "./VehicleCard";
import { resolveListingCardVariant } from "./listing-card-utils";

export function AdaptiveListingCard({
  listing,
  action,
}: {
  listing: ClassifiedListing;
  action?: ReactNode;
}) {
  const variant = resolveListingCardVariant(listing);
  if (variant === "vehicle") return <VehicleCard listing={listing} action={action} />;
  if (variant === "property") return <PropertyCard listing={listing} action={action} />;
  return <ProductCard listing={listing} action={action} />;
}
