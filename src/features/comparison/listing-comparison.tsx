import { Link } from "@tanstack/react-router";
import { GitCompareArrows, Scale, Trash2, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized } from "@/lib/i18n";
import { listingLocationDisplay } from "@/lib/listing-location-display";
import { useUiPreferences } from "@/lib/ui-preferences";
import {
  listingCardDetails,
  productCardFacts,
  propertyCardFacts,
  resolveListingCardVariant,
  vehicleCardFacts,
  type ListingCardFact,
} from "@/features/listings/cards/listing-card-utils";
import { ListingCardImage } from "@/features/listings/cards/ListingCardImage";

const STORAGE_KEY = "rawaj:listing-comparison:v1";
const MAX_COMPARISON_ITEMS = 3;

type ComparisonGroup = "vehicles" | "real_estate" | "electronics";

type ComparisonEntry = {
  id: string;
  group: ComparisonGroup;
  listing: ClassifiedListing;
};

type ComparisonContextValue = {
  entries: ComparisonEntry[];
  message: string | null;
  isCompared: (listingId: string) => boolean;
  toggle: (listing: ClassifiedListing) => void;
  remove: (listingId: string) => void;
  clear: () => void;
};

const ComparisonContext = createContext<ComparisonContextValue | null>(null);

export function comparisonGroupForListing(listing: ClassifiedListing): ComparisonGroup | null {
  const variant = resolveListingCardVariant(listing);
  if (variant === "vehicle") return "vehicles";
  if (variant === "property") return "real_estate";

  const details = listingCardDetails(listing);
  if (details.electronics_brand || details.storage || details.ram) return "electronics";

  const categorySource = `${listing.categoryNameAr ?? ""} ${listing.title}`.toLowerCase();
  const electronicsTerms = [
    "هاتف",
    "هواتف",
    "موبايل",
    "جوال",
    "إلكترون",
    "الكترون",
    "كمبيوتر",
    "حاسوب",
    "لابتوب",
    "تابلت",
    "جهاز",
    "أجهزة",
    "تقنية",
    "phone",
    "mobile",
    "electronics",
    "computer",
    "laptop",
    "tablet",
  ];

  return electronicsTerms.some((term) => categorySource.includes(term)) ? "electronics" : null;
}

export function isListingComparisonEligible(listing: ClassifiedListing) {
  return comparisonGroupForListing(listing) !== null;
}

function readStoredEntries(): ComparisonEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    const entries = parsed.filter((item): item is ComparisonEntry => {
      if (!item || typeof item !== "object") return false;
      const entry = item as Partial<ComparisonEntry>;
      return (
        typeof entry.id === "string" &&
        (entry.group === "vehicles" ||
          entry.group === "real_estate" ||
          entry.group === "electronics") &&
        Boolean(entry.listing && typeof entry.listing === "object") &&
        entry.listing?.id === entry.id
      );
    });

    if (entries.length === 0) return [];
    const group = entries[0].group;
    return entries.filter((entry) => entry.group === group).slice(0, MAX_COMPARISON_ITEMS);
  } catch {
    return [];
  }
}

function persistEntries(entries: ComparisonEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function ListingComparisonProvider({ children }: { children: ReactNode }) {
  const { text } = useUiPreferences();
  const [entries, setEntries] = useState<ComparisonEntry[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setEntries(readStoredEntries());

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setEntries(readStoredEntries());
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);

  const commit = useCallback((next: ComparisonEntry[]) => {
    setEntries(next);
    persistEntries(next);
  }, []);

  const toggle = useCallback(
    (listing: ClassifiedListing) => {
      const group = comparisonGroupForListing(listing);
      if (!group) {
        setMessage(
          text(
            "المقارنة متاحة حالياً للسيارات والعقارات والهواتف والإلكترونيات.",
            "Comparison is currently available for vehicles, property, phones, and electronics.",
          ),
        );
        return;
      }

      const existing = entries.find((entry) => entry.id === listing.id);
      if (existing) {
        commit(entries.filter((entry) => entry.id !== listing.id));
        setMessage(text("تمت إزالة الإعلان من المقارنة.", "Listing removed from comparison."));
        return;
      }

      if (entries.length > 0 && entries[0].group !== group) {
        setMessage(
          text(
            "قارن إعلانات من النوع نفسه حتى تكون النتائج دقيقة وواضحة.",
            "Compare listings of the same type for a clear and accurate result.",
          ),
        );
        return;
      }

      if (entries.length >= MAX_COMPARISON_ITEMS) {
        setMessage(
          text(
            "يمكنك مقارنة ثلاثة إعلانات كحد أقصى. أزل إعلاناً ثم أضف غيره.",
            "You can compare up to three listings. Remove one before adding another.",
          ),
        );
        return;
      }

      commit([...entries, { id: listing.id, group, listing }]);
      setMessage(text("تمت إضافة الإعلان إلى المقارنة.", "Listing added to comparison."));
    },
    [commit, entries, text],
  );

  const remove = useCallback(
    (listingId: string) => {
      const next = entries.filter((entry) => entry.id !== listingId);
      commit(next);
      setMessage(text("تمت إزالة الإعلان من المقارنة.", "Listing removed from comparison."));
    },
    [commit, entries, text],
  );

  const clear = useCallback(() => {
    commit([]);
    setMessage(null);
  }, [commit]);

  const value = useMemo<ComparisonContextValue>(
    () => ({
      entries,
      message,
      isCompared: (listingId: string) => entries.some((entry) => entry.id === listingId),
      toggle,
      remove,
      clear,
    }),
    [clear, entries, message, remove, toggle],
  );

  return <ComparisonContext.Provider value={value}>{children}</ComparisonContext.Provider>;
}

export function useListingComparison() {
  const value = useContext(ComparisonContext);
  if (!value) throw new Error("useListingComparison must be used inside ListingComparisonProvider");
  return value;
}

export function CompareListingButton({ listing }: { listing: ClassifiedListing }) {
  const { text } = useUiPreferences();
  const comparison = useListingComparison();
  const eligible = isListingComparisonEligible(listing);

  if (!eligible) return null;

  const active = comparison.isCompared(listing.id);
  return (
    <button
      type="button"
      className="rawaj-compare-toggle"
      data-active={active}
      aria-pressed={active}
      aria-label={
        active
          ? text("إزالة الإعلان من المقارنة", "Remove listing from comparison")
          : text("إضافة الإعلان إلى المقارنة", "Add listing to comparison")
      }
      title={
        active
          ? text("إزالة من المقارنة", "Remove from comparison")
          : text("أضف للمقارنة", "Add to comparison")
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        comparison.toggle(listing);
      }}
    >
      <Scale aria-hidden="true" />
    </button>
  );
}

export function ListingComparisonDock() {
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
