import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifySypListingPrice,
  fetchUnclassifiedSypPriceQueue,
} from "@/lib/api/syp-denomination";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { formatPriceLocalized } from "@/lib/i18n";
import type { SypDenomination } from "@/lib/syp-redenomination";
import { useUiPreferences } from "@/lib/ui-preferences";

export function SypClassificationQueue() {
  const { language, text } = useUiPreferences();
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchUnclassifiedSypPriceQueue();
      if (requestId !== requestIdRef.current) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setListings(result.data);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحميل قائمة تصنيف الأسعار.", "Could not load the price classification queue."),
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [text]);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  async function classify(listing: ClassifiedListing, denomination: SypDenomination) {
    if (busyId) return;
    setBusyId(listing.id);
    setError(null);
    try {
      const result = await classifySypListingPrice(listing.id, denomination, listing.updatedAt);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setListings((current) => current.filter((item) => item.id !== listing.id));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تصنيف السعر.", "Could not classify the price."),
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!loading && !error && listings.length === 0) return null;

  return (
    <section className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/8 p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-foreground">
              {text("تصنيف وحدة الأسعار السورية", "Classify Syrian-pound prices")}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              {text(
                "اختر ما إذا كان السعر المخزن بالليرة القديمة أو الجديدة. لن تتغير قيمة السعر الأصلية؛ الاختيار يحدد فقط طريقة التحويل والبحث والعرض.",
                "Choose whether each stored price is in old or new Syrian pounds. The original value is not changed; the choice only governs conversion, search, and display.",
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || Boolean(busyId)}
          className="rawaj-chip min-h-10 px-3 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {text("تحديث", "Refresh")}
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/8 p-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {loading && listings.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {text("جارٍ تحميل الأسعار غير المصنفة...", "Loading unclassified prices...")}
        </div>
      ) : null}

      {listings.length > 0 ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {listings.map((listing) => {
            const busy = busyId === listing.id;
            return (
              <article
                key={listing.id}
                className="rounded-[1.15rem] border border-border/70 bg-card/90 p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold">{listing.title}</h3>
                    <p className="mt-1 text-xs font-bold text-primary">
                      {formatPriceLocalized(
                        listing.price ?? 0,
                        listing.priceType,
                        language,
                        listing.currency,
                      )}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {text("القيمة المخزنة ستبقى كما هي", "The stored value will remain unchanged")}
                    </p>
                  </div>
                  {busy ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void classify(listing, "old")}
                    className="min-h-11 rounded-xl border border-border bg-background px-3 text-xs font-semibold transition hover:border-primary/40 disabled:opacity-50"
                  >
                    {text("ليرة قديمة", "Old pounds")}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void classify(listing, "new")}
                    className="min-h-11 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-50"
                  >
                    {text("ليرة جديدة", "New pounds")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : !loading && !error ? (
        <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {text("لا توجد أسعار تحتاج تصنيفًا.", "No prices need classification.")}
        </div>
      ) : null}
    </section>
  );
}
