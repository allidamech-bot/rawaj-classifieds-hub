import { Link } from "@tanstack/react-router";
import { ChevronLeft, History, Trash2 } from "lucide-react";
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

  return (
    <section className="rawaj-account-section" data-tone="default" data-user-scope={userId}>
      <Link
        to="/recently-viewed"
        className="flex min-h-16 w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-start transition hover:bg-card/65 active:scale-[0.985]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <History className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              {text("سجل المشاهدة", "Viewing history")}
            </span>
            <span className="mt-0.5 block text-[10px] leading-5 text-muted-foreground">
              {text(
                "افتح الإعلانات التي شاهدتها مؤخرًا من صفحة مستقلة.",
                "Open listings you recently viewed on a separate page.",
              )}
            </span>
          </span>
        </span>
        <ChevronLeft
          className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180"
          aria-hidden="true"
        />
      </Link>
    </section>
  );
}

export function RecentlyViewedHistory({ userId }: { userId: string }) {
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

  return (
    <section
      className="rawaj-account-section p-3 sm:p-4"
      aria-labelledby="rawaj-account-recent-title"
      aria-busy={loading || clearing}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold text-brand-orange">
            {text("سجل مستقل", "Dedicated history")}
          </p>
          <h2 id="rawaj-account-recent-title" className="mt-1 text-sm font-extrabold">
            {text("الإعلانات التي شاهدتها", "Listings you viewed")}
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
      ) : items.length === 0 && !error ? (
        <div className="rounded-2xl border border-border/70 bg-muted-surface/35 p-5 text-center">
          <History className="mx-auto h-7 w-7 text-brand-orange" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-extrabold text-foreground">
            {text("لا يوجد سجل مشاهدة بعد", "No viewing history yet")}
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs leading-6 text-muted-foreground">
            {text(
              "عندما تفتح أي إعلان سيظهر هنا لتعود إليه بسهولة.",
              "Listings you open will appear here so you can return to them easily.",
            )}
          </p>
          <Link
            to="/listings"
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground"
          >
            {text("تصفح الإعلانات", "Browse listings")}
          </Link>
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
