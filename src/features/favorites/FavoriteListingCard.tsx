import { Heart } from "lucide-react";
import { CompactCard } from "@/features/listings/cards";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function FavoriteListingCard({
  listing,
  onRemove,
}: {
  listing: ClassifiedListing;
  onRemove: () => void;
}) {
  const { text } = useUiPreferences();

  return (
    <CompactCard
      listing={listing}
      action={
        <button
          type="button"
          onClick={onRemove}
          aria-label={text("إزالة من المفضلة", "Remove from favorites")}
          title={text("إزالة من المفضلة", "Remove from favorites")}
          className="text-destructive"
        >
          <Heart className="h-4 w-4 fill-current" strokeWidth={1.9} />
        </button>
      }
    />
  );
}
