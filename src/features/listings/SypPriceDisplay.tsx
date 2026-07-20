import type { ClassifiedListing } from "@/lib/classifieds-types";
import { formatPriceLocalized, localized } from "@/lib/i18n";
import { createClassifiedSypPrice } from "@/lib/syp-denomination";
import { useUiPreferences } from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

export function SypPriceDisplay({
  listing,
  className,
  compact = false,
}: {
  listing: ClassifiedListing;
  className?: string;
  compact?: boolean;
}) {
  const { language } = useUiPreferences();
  const primary = formatPriceLocalized(
    listing.price ?? 0,
    listing.priceType,
    language,
    listing.currency,
  );

  if (
    listing.currency !== "SYP" ||
    listing.price === null ||
    !["fixed", "negotiable"].includes(listing.priceType)
  ) {
    return <strong className={className}>{primary}</strong>;
  }

  const dual = createClassifiedSypPrice(listing.price, listing.priceDenomination);
  if (!dual) {
    return (
      <span className={cn("inline-flex min-w-0 flex-col", className)}>
        <strong>{primary}</strong>
        <small className="mt-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
          {localized(language, "الوحدة قيد التحقق", "Denomination pending")}
        </small>
      </span>
    );
  }

  const newLabel = formatPriceLocalized(dual.newSyp, "fixed", language, "SYP");
  const oldLabel = formatPriceLocalized(dual.oldSyp, "fixed", language, "SYP");

  return (
    <span className={cn("inline-flex min-w-0 flex-col", className)}>
      <strong>{newLabel}</strong>
      {!compact ? (
        <small className="mt-0.5 text-[10px] font-medium text-muted-foreground">
          {localized(language, `يعادل ${oldLabel} قديمة`, `Equivalent to ${oldLabel} old`)}
        </small>
      ) : null}
    </span>
  );
}
