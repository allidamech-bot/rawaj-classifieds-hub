import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  MessageCircle,
  Star,
  Store,
  User,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SellerFollowButton } from "@/features/retention/SellerFollowButton";
import type { ClassifiedListing, PublicSellerProfile } from "@/lib/classifieds-types";
import { readableProfileLabel } from "@/lib/readable-profile-text";
import type { Language } from "@/lib/ui-preferences";

interface ListingSellerProfileCardProps {
  listing: ClassifiedListing;
  seller: PublicSellerProfile | null;
  loading: boolean;
  fallbackName: string;
  canMessage: boolean;
  messageBusy: boolean;
  onMessage: () => void;
  language: Language;
  text: (ar: string, en: string) => string;
}

export function ListingSellerProfileCard({
  listing,
  seller,
  loading,
  fallbackName,
  canMessage,
  messageBusy,
  onMessage,
  language,
  text,
}: ListingSellerProfileCardProps) {
  const displayName = seller?.businessName?.trim() || seller?.displayName?.trim() || fallbackName;
  const joinedLabel = seller?.joinedAt ? formatJoinedDate(seller.joinedAt, language) : null;
  const rating = seller?.ratingSummary?.average;
  const ratingCount = seller?.ratingSummary?.count ?? 0;
  const sellerLocation = readableProfileLabel(seller?.locationAr);

  return (
    <section
      className="rawaj-detail-seller"
      aria-labelledby="rawaj-detail-seller-title"
      data-profile-contract="public-seller-data"
    >
      <div className="rawaj-detail-seller__identity">
        <div className="rawaj-detail-seller__avatar" data-loading={loading}>
          <Avatar className="h-full w-full bg-transparent">
            {seller?.avatarUrl ? (
              <AvatarImage
                src={seller.avatarUrl}
                alt={displayName}
                loading="lazy"
                decoding="async"
                width={64}
                height={64}
              />
            ) : null}
            <AvatarFallback className="bg-transparent">
              <User aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="min-w-0 flex-1">
          <p>{text("البائع", "Seller")}</p>
          <div className="rawaj-detail-seller__name-row">
            <h2 id="rawaj-detail-seller-title">{displayName}</h2>
            {seller?.verified ? (
              <span title={text("بائع موثّق", "Verified seller")}>
                <BadgeCheck aria-hidden="true" />
                <span className="sr-only">{text("موثّق", "Verified")}</span>
              </span>
            ) : null}
          </div>
          {sellerLocation ? <small>{sellerLocation}</small> : null}
        </div>
      </div>

      <div className="rawaj-detail-seller__stats">
        {rating !== null && rating !== undefined && ratingCount > 0 ? (
          <div>
            <Star aria-hidden="true" />
            <strong>{rating.toFixed(1)}</strong>
            <span>{text(`${ratingCount} تقييم`, `${ratingCount} reviews`)}</span>
          </div>
        ) : null}
        {seller ? (
          <div>
            <Store aria-hidden="true" />
            <strong>{seller.approvedListingCount}</strong>
            <span>{text("إعلان معتمد", "approved listings")}</span>
          </div>
        ) : null}
        {joinedLabel ? (
          <div>
            <CalendarDays aria-hidden="true" />
            <strong>{joinedLabel}</strong>
            <span>{text("عضو منذ", "member since")}</span>
          </div>
        ) : null}
      </div>

      {seller?.bio ? <p className="rawaj-detail-seller__bio">{seller.bio}</p> : null}

      <div className="rawaj-detail-seller__actions">
        <Link to="/seller/$id" params={{ id: listing.ownerId }}>
          <Store aria-hidden="true" />
          {text("زيارة متجر البائع", "Visit seller store")}
          <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
        </Link>
        {canMessage ? <SellerFollowButton sellerId={listing.ownerId} /> : null}
        {canMessage ? (
          <button type="button" onClick={onMessage} disabled={messageBusy} aria-busy={messageBusy}>
            <MessageCircle aria-hidden="true" />
            {messageBusy ? text("جارٍ الفتح", "Opening") : text("مراسلة", "Message")}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function formatJoinedDate(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    month: "short",
    year: "numeric",
  }).format(date);
}
