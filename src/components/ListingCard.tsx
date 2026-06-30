import { Link } from "@tanstack/react-router";
import { Heart, MapPin, Clock, BadgeCheck, Star } from "lucide-react";
import type { Listing } from "@/types";
import { PlaceholderArt } from "./PlaceholderArt";
import { useState } from "react";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";

interface Props {
  listing: Listing;
  variant?: "vertical" | "horizontal" | "compact";
}

export function ListingCard({ listing, variant = "vertical" }: Props) {
  const [fav, setFav] = useState(false);
  const { language, text } = useUiPreferences();
  const price = formatPriceLocalized(listing.price, listing.priceType, language, listing.currency);
  const category = categoryName(listing.categoryId, listing.categoryName, language);

  if (variant === "horizontal") {
    return (
      <Link
        to="/listings/$id"
        params={{ id: listing.id }}
        className="group block w-[280px] shrink-0 overflow-hidden rounded-2xl bg-card hairline shadow-soft transition-shadow hover:shadow-premium"
      >
        <div className="relative">
          <PlaceholderArt type={listing.placeholderType} aspect="wide" />
          {listing.isFeatured && (
            <span className="absolute top-2 start-2 rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
              {text("مميز", "Featured")}
            </span>
          )}
          <FavBtn
            fav={fav}
            onClick={(e) => {
              e.preventDefault();
              setFav((v) => !v);
            }}
          />
        </div>
        <div className="space-y-1.5 p-3">
          <h3 className="line-clamp-2 text-sm font-bold text-foreground">{listing.title}</h3>
          <div className="text-base font-extrabold text-foreground">{price}</div>
          <MetaRow listing={listing} />
        </div>
      </Link>
    );
  }

  if (variant === "compact") {
    return (
      <Link
        to="/listings/$id"
        params={{ id: listing.id }}
        className="flex gap-3 rounded-xl bg-card p-2 hairline transition-shadow hover:shadow-soft"
      >
        <div className="w-24 shrink-0">
          <PlaceholderArt type={listing.placeholderType} aspect="square" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="line-clamp-2 text-sm font-bold text-foreground">{listing.title}</h3>
          <div className="text-sm font-extrabold">{price}</div>
          <MetaRow listing={listing} small />
        </div>
      </Link>
    );
  }

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-2xl bg-card hairline shadow-soft transition-shadow hover:shadow-premium"
    >
      <div className="relative">
        <PlaceholderArt type={listing.placeholderType} aspect="wide" />
        <div className="absolute top-2 start-2 flex flex-wrap gap-1">
          {listing.isFeatured && (
            <span className="rounded-md bg-gold px-2 py-0.5 text-[11px] font-bold text-gold-foreground">
              {text("مميز", "Featured")}
            </span>
          )}
          {listing.isVerifiedSeller && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-trust px-2 py-0.5 text-[11px] font-bold text-emerald-trust-foreground">
              <BadgeCheck className="h-3 w-3" /> {text("بائع موثّق", "Verified seller")}
            </span>
          )}
        </div>
        <FavBtn
          fav={fav}
          onClick={(e) => {
            e.preventDefault();
            setFav((v) => !v);
          }}
        />
        <span className="absolute bottom-2 end-2 rounded-md bg-primary/85 px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
          {category}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-foreground">
          {listing.title}
        </h3>
        <div className="text-lg font-extrabold text-foreground">{price}</div>
        <MetaRow listing={listing} />
      </div>
    </Link>
  );
}

function FavBtn({ fav, onClick }: { fav: boolean; onClick: (e: React.MouseEvent) => void }) {
  const { text } = useUiPreferences();

  return (
    <button
      onClick={onClick}
      aria-label={text("حفظ", "Save")}
      className="absolute top-2 end-2 grid h-8 w-8 place-items-center rounded-full bg-card/90 backdrop-blur transition hover:bg-card"
    >
      <Heart
        className={`h-4 w-4 ${fav ? "fill-destructive text-destructive" : "text-foreground"}`}
      />
    </button>
  );
}

function MetaRow({ listing, small }: { listing: Listing; small?: boolean }) {
  const { text } = useUiPreferences();

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${small ? "text-[11px]" : "text-xs"} text-muted-foreground`}
    >
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3 w-3" /> {listing.governorate} · {listing.district}
      </span>
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" /> {text(listing.timeSincePosted, "Recently")}
      </span>
      {listing.isVerifiedSeller && !small && (
        <span className="inline-flex items-center gap-1 text-emerald-trust">
          <Star className="h-3 w-3 fill-current" /> {listing.sellerRating.toFixed(1)}
        </span>
      )}
    </div>
  );
}
