import type { ReactNode } from "react";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { ListingCardFrame, ListingCardHeading, ListingCardMeta } from "./ListingCardShared";

export function CompactCard({
  listing,
  action,
}: {
  listing: ClassifiedListing;
  action?: ReactNode;
}) {
  return (
    <ListingCardFrame
      listing={listing}
      variant="compact"
      action={action}
      className="rawaj-adaptive-card--compact"
    >
      <div className="rawaj-adaptive-card__body">
        <ListingCardHeading listing={listing} />
        <ListingCardMeta listing={listing} compact />
      </div>
    </ListingCardFrame>
  );
}
