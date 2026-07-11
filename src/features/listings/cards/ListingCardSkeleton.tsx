import { cn } from "@/lib/utils";
import type { ListingCardVariant } from "./listing-card-utils";

export function ListingCardSkeleton({
  variant = "product",
  compact = false,
  className,
}: {
  variant?: ListingCardVariant;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("rawaj-listing-card-skeleton", className)}
      data-card-variant={compact ? "compact" : variant}
      data-loading="true"
      data-loading-layout={compact ? "compact" : "standard"}
      aria-hidden="true"
    >
      <div className="rawaj-listing-card-skeleton__media" />
      <div className="rawaj-listing-card-skeleton__body">
        <span data-width="price" />
        <span data-width="title" />
        <span data-width="title-short" />
        {!compact ? (
          <div className="rawaj-listing-card-skeleton__facts">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        <span data-width="meta" />
      </div>
    </div>
  );
}
