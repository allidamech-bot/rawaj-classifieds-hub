import type { ReactNode } from "react";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import {
  ListingCardFacts,
  ListingCardFrame,
  ListingCardHeading,
  ListingCardMeta,
} from "./ListingCardShared";
import { productCardFacts } from "./listing-card-utils";

export function ProductCard({
  listing,
  action,
}: {
  listing: ClassifiedListing;
  action?: ReactNode;
}) {
  const { language } = useUiPreferences();
  const facts = productCardFacts(listing, language);

  return (
    <ListingCardFrame listing={listing} variant="product" action={action}>
      <div className="rawaj-adaptive-card__body">
        <ListingCardHeading listing={listing} />
        <ListingCardFacts facts={facts} />
        <ListingCardMeta listing={listing} />
      </div>
    </ListingCardFrame>
  );
}
