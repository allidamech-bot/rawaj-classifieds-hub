import type { ReactNode } from "react";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import {
  ListingCardFacts,
  ListingCardFrame,
  ListingCardHeading,
  ListingCardMeta,
} from "./ListingCardShared";
import { propertyCardFacts } from "./listing-card-utils";

export function PropertyCard({
  listing,
  action,
}: {
  listing: ClassifiedListing;
  action?: ReactNode;
}) {
  const { language } = useUiPreferences();
  const facts = propertyCardFacts(listing, language);

  return (
    <ListingCardFrame
      listing={listing}
      variant="property"
      action={action}
      mediaClassName="rawaj-adaptive-card__media--wide"
    >
      <div className="rawaj-adaptive-card__body">
        <ListingCardHeading listing={listing} />
        <ListingCardFacts facts={facts} />
        <ListingCardMeta listing={listing} />
      </div>
    </ListingCardFrame>
  );
}
