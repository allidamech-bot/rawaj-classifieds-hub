import fs from "node:fs";

const path = "src/features/listings/listings-components.tsx";
const source = fs.readFileSync(path, "utf8");
const start = source.indexOf("export function RealListingCard");
const end = source.indexOf("export function SellerSearchCard");

if (start < 0 || end < 0 || end <= start) {
  throw new Error("RealListingCard block not found");
}

const replacement = `export function RealListingCard({ listing }: { listing: ClassifiedListing }) {
  const { language, text } = useUiPreferences();

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block overflow-hidden rounded-[1.15rem] border border-border/80 bg-card tap-card transition hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-premium-sm"
    >
      <div className="relative overflow-hidden bg-muted-surface">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="standard" />
        )}
        {listing.isFeatured ? (
          <span className="absolute start-2 top-2 rounded-full bg-primary/92 px-2 py-1 text-[9px] font-extrabold text-primary-foreground shadow-soft backdrop-blur-sm">
            {text("مميز", "Featured")}
          </span>
        ) : null}
      </div>

      <div className="p-2.5 sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 text-[14px] font-extrabold leading-tight text-primary sm:text-base">
            {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
          </div>
          <span className="max-w-[45%] shrink-0 truncate rounded-full bg-background px-2 py-1 text-[9px] font-bold text-muted-foreground">
            {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)}
          </span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 min-h-[2.35rem] text-[12.5px] font-bold leading-snug text-foreground sm:text-[13px]">
          {listing.title}
        </h3>

        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground sm:text-[11px]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0 text-brand-orange" strokeWidth={1.9} />
            <span className="truncate">{listingLocationDisplay(listing, language)}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1">
            <Clock className="h-3 w-3" strokeWidth={1.8} />
            <span>{formatDate(listing.createdAt, language)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
`;

fs.writeFileSync(path, source.slice(0, start) + replacement + "\n" + source.slice(end));
console.log("Mobile listing card redesign applied.");
