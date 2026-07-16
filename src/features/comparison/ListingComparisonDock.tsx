import { Link } from "@tanstack/react-router";
import { GitCompareArrows, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAX_COMPARISON_ITEMS,
  useListingComparison,
  type ComparisonEntry,
  type ComparisonGroup,
} from "@/features/comparison/listing-comparison";
import { ListingCardImage } from "@/features/listings/cards/ListingCardImage";
import {
  productCardFacts,
  propertyCardFacts,
  resolveListingCardVariant,
  vehicleCardFacts,
  type ListingCardFact,
} from "@/features/listings/cards/listing-card-utils";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";

export default function ListingComparisonDock() {
  const { language, text } = useUiPreferences();
  const { entries, message, remove, clear } = useListingComparison();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (entries.length === 0) setOpen(false);
  }, [entries.length]);

  if (entries.length === 0) return null;

  const groupLabel = comparisonGroupLabel(entries[0].group, language);
  const rows = buildComparisonRows(entries, language, text);

  return (
    <>
      <section
        className="rawaj-compare-dock"
        aria-label={text("مقارنة الإعلانات", "Listing comparison")}
      >
        <button type="button" className="rawaj-compare-dock__open" onClick={() => setOpen(true)}>
          <span className="rawaj-compare-dock__icon">
            <GitCompareArrows aria-hidden="true" />
          </span>
          <span>
            <strong>{text("مقارنة الإعلانات", "Compare listings")}</strong>
            <small>
              {groupLabel} · {entries.length}/{MAX_COMPARISON_ITEMS}
            </small>
          </span>
        </button>
        <button
          type="button"
          className="rawaj-compare-dock__clear"
          onClick={clear}
          aria-label={text("مسح المقارنة", "Clear comparison")}
          title={text("مسح المقارنة", "Clear comparison")}
        >
          <Trash2 aria-hidden="true" />
        </button>
        {message ? (
          <p className="rawaj-compare-dock__message" role="status" aria-live="polite">
            {message}
          </p>
        ) : null}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rawaj-compare-dialog">
          <DialogHeader>
            <DialogTitle>{text("قارن قبل أن تختار", "Compare before choosing")}</DialogTitle>
            <DialogDescription>
              {text(
                "راجع السعر والموقع والمواصفات الأساسية جنباً إلى جنب. يمكنك مقارنة ثلاثة إعلانات من النوع نفسه.",
                "Review price, location, and key specifications side by side. You can compare three listings of the same type.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="rawaj-compare-dialog__summary">
            <span>{groupLabel}</span>
            <button type="button" onClick={clear}>
              <Trash2 aria-hidden="true" />
              {text("مسح الكل", "Clear all")}
            </button>
          </div>

          <div className="rawaj-compare-table-wrap">
            <table className="rawaj-compare-table">
              <thead>
                <tr>
                  <th scope="col">{text("المعيار", "Criteria")}</th>
                  {entries.map((entry) => (
                    <th scope="col" key={entry.id}>
                      <article className="rawaj-compare-card">
                        <button
                          type="button"
                          className="rawaj-compare-card__remove"
                          onClick={() => remove(entry.id)}
                          aria-label={text("إزالة الإعلان", "Remove listing")}
                        >
                          <X aria-hidden="true" />
                        </button>
                        <Link
                          to="/listings/$id"
                          params={{ id: entry.id }}
                          onClick={() => setOpen(false)}
                        >
                          <div className="rawaj-compare-card__media">
                            <ListingCardImage
                              src={entry.listing.primaryImageUrl}
                              alt={entry.listing.title}
                              placeholder={entry.listing.categoryPlaceholder ?? "misc"}
                              width={360}
                              height={270}
                            />
                          </div>
                          <span>
                            {categoryName(
                              entry.listing.categoryId,
                              entry.listing.categoryNameAr,
                              language,
                            )}
                          </span>
                          <strong>{entry.listing.title}</strong>
                        </Link>
                      </article>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={`${row.key}-${entries[index].id}`}>{value || "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function buildComparisonRows(
  entries: ComparisonEntry[],
  language: "ar" | "en",
  text: (ar: string, en: string) => string,
) {
  const factsByEntry = entries.map((entry) => comparisonFacts(entry.listing, language));
  const factKeys = Array.from(
    new Set(factsByEntry.flatMap((facts) => facts.map((fact) => fact.key))),
  );

  return [
    {
      key: "price",
      label: text("السعر", "Price"),
      values: entries.map((entry) =>
        formatPriceLocalized(
          entry.listing.price ?? 0,
          entry.listing.priceType,
          language,
          entry.listing.currency,
        ),
      ),
    },
    {
      key: "location",
      label: text("الموقع", "Location"),
      values: entries.map((entry) => listingLocationDisplay(entry.listing, language)),
    },
    {
      key: "condition",
      label: text("الحالة", "Condition"),
      values: entries.map((entry) => conditionLabel(entry.listing.condition, language)),
    },
    ...factKeys.map((key) => ({
      key,
      label: factsByEntry.flatMap((facts) => facts).find((fact) => fact.key === key)?.label ?? key,
      values: factsByEntry.map((facts) => facts.find((fact) => fact.key === key)?.value ?? ""),
    })),
  ];
}

function comparisonFacts(listing: ClassifiedListing, language: "ar" | "en"): ListingCardFact[] {
  const variant = resolveListingCardVariant(listing);
  if (variant === "vehicle") return vehicleCardFacts(listing, language);
  if (variant === "property") return propertyCardFacts(listing, language);
  return productCardFacts(listing, language);
}

function comparisonGroupLabel(group: ComparisonGroup, language: "ar" | "en") {
  if (group === "vehicles") return language === "ar" ? "السيارات" : "Vehicles";
  if (group === "real_estate") return language === "ar" ? "العقارات" : "Property";
  return language === "ar" ? "الهواتف والإلكترونيات" : "Phones and electronics";
}

function conditionLabel(condition: ClassifiedListing["condition"], language: "ar" | "en") {
  const labels: Record<string, { ar: string; en: string }> = {
    new: { ar: "جديد", en: "New" },
    like_new: { ar: "كالجديد", en: "Like new" },
    used: { ar: "مستعمل", en: "Used" },
    not_applicable: { ar: "غير محدد", en: "Not specified" },
  };
  return labels[condition]?.[language] ?? String(condition).replaceAll("_", " ");
}
