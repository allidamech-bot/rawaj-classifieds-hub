import { Link } from "@tanstack/react-router";
import { Clock, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { isLaunchDemoListing } from "@/lib/demo-listing";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";
import { formatDate } from "../listings-components";
import type { ListingCardFact } from "./listing-card-utils";

interface ListingCardFrameProps {
  listing: ClassifiedListing;
  variant: string;
  className?: string;
  mediaClassName?: string;
  imageLoading?: "eager" | "lazy";
  imagePriority?: "high" | "low" | "auto";
  action?: ReactNode;
  children: ReactNode;
}

export function ListingCardFrame({
  listing,
  variant,
  className,
  mediaClassName,
  imageLoading = "lazy",
  imagePriority,
  action,
  children,
}: ListingCardFrameProps) {
  const { text } = useUiPreferences();
  const demo = isLaunchDemoListing(listing);

  return (
    <article
      className={cn("rawaj-adaptive-card", className)}
      data-card-variant={variant}
      data-featured={listing.isFeatured}
      data-reserved={Boolean(listing.reservedAt)}
      data-demo={demo}
    >
      <Link to="/listings/$id" params={{ id: listing.id }} className="rawaj-adaptive-card__link">
        <div className={cn("rawaj-adaptive-card__media", mediaClassName)}>
          {listing.primaryImageUrl ? (
            <img
              src={listing.primaryImageUrl}
              alt={listing.title}
              loading={imageLoading}
              fetchPriority={imagePriority}
              decoding="async"
            />
          ) : (
            <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="standard" />
          )}
          {demo ? (
            <span className="rawaj-adaptive-card__status" data-tone="demo">
              {text("إعلان تجريبي", "Demo listing")}
            </span>
          ) : listing.reservedAt ? (
            <span className="rawaj-adaptive-card__status" data-tone="reserved">
              {text("محجوز", "Reserved")}
            </span>
          ) : listing.isFeatured ? (
            <span className="rawaj-adaptive-card__status" data-tone="featured">
              {text("مميز", "Featured")}
            </span>
          ) : null}
        </div>
        {children}
      </Link>
      {action ? <div className="rawaj-adaptive-card__action">{action}</div> : null}
    </article>
  );
}

export function ListingCardHeading({ listing }: { listing: ClassifiedListing }) {
  const { language } = useUiPreferences();
  return (
    <div className="rawaj-adaptive-card__heading">
      <strong className="rawaj-adaptive-card__price">
        {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
      </strong>
      <span className="rawaj-adaptive-card__category">
        {categoryName(listing.categoryId, listing.categoryNameAr, language)}
      </span>
      <h3 className="rawaj-adaptive-card__title">{listing.title}</h3>
    </div>
  );
}

export function ListingCardFacts({ facts }: { facts: ListingCardFact[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="rawaj-adaptive-card__facts">
      {facts.map((fact) => (
        <div key={fact.key}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ListingCardMeta({
  listing,
  compact = false,
}: {
  listing: ClassifiedListing;
  compact?: boolean;
}) {
  const { language } = useUiPreferences();
  return (
    <div className="rawaj-adaptive-card__meta" data-compact={compact}>
      <span>
        <MapPin aria-hidden="true" />
        <span>{listingLocationDisplay(listing, language)}</span>
      </span>
      {!compact ? (
        <span>
          <Clock aria-hidden="true" />
          <span>{formatDate(listing.createdAt, language)}</span>
        </span>
      ) : null}
    </div>
  );
}
