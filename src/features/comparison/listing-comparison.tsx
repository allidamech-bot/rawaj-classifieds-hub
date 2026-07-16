import { Scale } from "lucide-react";
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
  listingCardDetails,
  resolveListingCardVariant,
} from "@/features/listings/cards/listing-card-utils";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

const STORAGE_KEY = "rawaj:listing-comparison:v1";
export const MAX_COMPARISON_ITEMS = 3;

export type ComparisonGroup = "vehicles" | "real_estate" | "electronics";

export type ComparisonEntry = {
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
