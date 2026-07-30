import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { ListingCardSkeleton } from "@/features/listings/cards";
import { CompactCard } from "@/features/listings/cards/CompactCard";
import {
  clearRecentListingViews,
  fetchRecentListingViews,
  type RecentListingViewItem,
} from "@/lib/classifieds-api";
import { clearLocalListingHistory } from "@/lib/listing-history";
import { useUiPreferences } from "@/lib/ui-preferences";

export function AccountRecentlyViewed({ userId }: { userId: string }) {
  const { text } = useUiPreferences();
  const [items, setItems] = useState<RecentListingViewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);
  const requestIdRef = useRef(0);
  const clearInFlightRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await fetchRecentListingViews(userId, 10);
      if (requestId !== requestIdRef.current) return;
      if (result.ok) setItems(result.data.slice(0, 10));
      else setError(result.error.message);
    } catch {
      if (requestId === requestIdRef.current) {
        setError(text("تعذر تحميل السجل.", "Could not load history."));
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [text, userId]);

  useEffect(() => {
    void load();
    return () => {
      requestIdRef.current += 1;
    };
  }, [load]);

  async function clearHistory() {
    if (clearInFlightRef.current) return;
    clearInFlightRef.current = true;
    setClearing(true);
    setError("");
    try {
      const result = await clearRecentListingViews(userId);
      if (result.ok) {
        clearLocalListingHistory();
        setItems([]);
      } else {
        setError(result.error.message);
      }
    } finally {
      clearInFlightRef.current = false;
      setClearing(false);
    }
  }

  if (!loading && !error && items.length === 0) return null;

  return (
    <section
      className="rawaj-account-section p-3 sm:p-4"
      aria-labelledby="rawaj-account-recent-title"
      aria-busy={loading || clearing}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-brand-orange">
            {text("العودة بسرعة", "Jump back in")}
          </p>
          <h2 id="rawaj-account-recent-title" className="mt-1 text-sm font-extrabold">
            {text("شوهد مؤخرًا", "Recently viewed")}
          </h2>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => void clearHistory()}
            disabled={clearing}
            aria-busy={clearing}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-muted-surface px-3 text-xs font-bold text-muted-foreground disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {clearing ? text("جارٍ المسح", "Clearing") : text("مسح السجل", "Clear history")}
          </button>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive"
        >
          <span>{text("تعذر تحميل السجل.", "Could not load history.")}</span>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 underline disabled:opacity-60"
          >
            {loading ? text("جارٍ التحميل", "Loading") : text("إعادة المحاولة", "Try again")}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <ListingCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {items.map((item) => (
            <CompactCard key={item.listingId} listing={item.listing} />
          ))}
        </div>
      )}
    </section>
  );
}
