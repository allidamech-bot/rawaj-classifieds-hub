import { Link } from "@tanstack/react-router";
import { ArrowUpLeft, Clock3, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { RealListingCard } from "@/features/listings/RealListingCard";
import { ListingCardSkeleton } from "@/features/listings/cards";
import { ListingViewTracker } from "@/features/retention/ListingViewTracker";
import {
  clearRecentListingViews,
  fetchRecentListingViews,
  type RecentListingViewItem,
} from "@/lib/classifieds-api";
import type { ClassifiedListing } from "@/lib/classifieds-types";
import { useAuth } from "@/lib/use-auth";

interface SimilarListingsRailProps {
  listings: ClassifiedListing[];
  categoryId: string;
  loading: boolean;
  text: (ar: string, en: string) => string;
}

export function SimilarListingsRail({
  listings,
  categoryId,
  loading,
  text,
}: SimilarListingsRailProps) {
  const auth = useAuth();
  const [recentItems, setRecentItems] = useState<RecentListingViewItem[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState("");
  const [clearing, setClearing] = useState(false);
  const recentRequestIdRef = useRef(0);
  const clearInFlightRef = useRef(false);
  const userId = auth.profile?.id ?? auth.user?.id ?? null;
  const currentListingId = currentListingIdFromLocation();

  const loadRecent = useCallback(async () => {
    if (auth.status === "loading") return;
    const requestId = ++recentRequestIdRef.current;
    setRecentLoading(true);
    setRecentError("");
    const result = await fetchRecentListingViews(userId, 8);
    if (requestId !== recentRequestIdRef.current) return;

    if (result.ok) {
      setRecentItems(
        result.data.filter((item) => item.listingId !== currentListingId).slice(0, 6),
      );
    } else {
      setRecentError(result.error.message);
    }
    setRecentLoading(false);
  }, [auth.status, currentListingId, userId]);

  useEffect(() => {
    void loadRecent();
    return () => {
      recentRequestIdRef.current += 1;
    };
  }, [loadRecent]);

  async function clearRecent() {
    if (clearInFlightRef.current) return;
    clearInFlightRef.current = true;
    setClearing(true);
    setRecentError("");
    try {
      const result = await clearRecentListingViews(userId);
      if (result.ok) setRecentItems([]);
      else setRecentError(result.error.message);
    } finally {
      clearInFlightRef.current = false;
      setClearing(false);
    }
  }

  const showSimilar = loading || listings.length > 0;
  const showRecent = recentLoading || recentItems.length > 0 || Boolean(recentError);
  const viewTracker = currentListingId ? <ListingViewTracker listingId={currentListingId} /> : null;
  if (!showSimilar && !showRecent) return viewTracker;

  return (
    <>
      {viewTracker}
      {showSimilar ? (
        <section className="rawaj-detail-similar" aria-labelledby="rawaj-detail-similar-title">
          <div className="rawaj-detail-similar__heading">
            <div>
              <p>{text("اكتشف المزيد", "Discover more")}</p>
              <h2 id="rawaj-detail-similar-title">{text("إعلانات مشابهة", "Similar listings")}</h2>
            </div>
            <Link to="/listings" search={{ category: categoryId }}>
              {text("عرض الكل", "View all")}
              <ArrowUpLeft className="rtl:-rotate-90" aria-hidden="true" />
            </Link>
          </div>

          <div className="rawaj-detail-similar__rail">
            {loading
              ? Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="rawaj-detail-similar__item">
                    <ListingCardSkeleton />
                  </div>
                ))
              : listings.map((listing) => (
                  <div key={listing.id} className="rawaj-detail-similar__item">
                    <RealListingCard listing={listing} />
                  </div>
                ))}
          </div>
        </section>
      ) : null}

      {showRecent ? (
        <section className="rawaj-detail-similar" aria-labelledby="rawaj-detail-recent-title">
          <div className="rawaj-detail-similar__heading">
            <div>
              <p>{text("ارجع بسرعة", "Jump back in")}</p>
              <h2 id="rawaj-detail-recent-title">{text("شوهد مؤخرًا", "Recently viewed")}</h2>
            </div>
            {recentItems.length > 0 ? (
              <button
                type="button"
                onClick={() => void clearRecent()}
                disabled={clearing}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-muted-surface px-3 text-xs font-bold text-muted-foreground disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {clearing ? text("جارٍ المسح", "Clearing") : text("مسح السجل", "Clear history")}
              </button>
            ) : null}
          </div>

          {recentError ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              <span>{recentError}</span>
              <button
                type="button"
                onClick={() => void loadRecent()}
                className="shrink-0 underline"
              >
                {text("إعادة المحاولة", "Try again")}
              </button>
            </div>
          ) : null}

          <div className="rawaj-detail-similar__rail">
            {recentLoading
              ? Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="rawaj-detail-similar__item">
                    <ListingCardSkeleton />
                  </div>
                ))
              : recentItems.map((item) => (
                  <div key={item.listingId} className="rawaj-detail-similar__item">
                    <RealListingCard listing={item.listing} />
                  </div>
                ))}
          </div>

          {!recentLoading && !recentError && recentItems.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted-surface p-4 text-xs text-muted-foreground">
              <Clock3 className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>
                {text(
                  "ستظهر هنا الإعلانات التي شاهدتها سابقًا لتعود إليها بسرعة.",
                  "Listings you viewed earlier will appear here for quick access.",
                )}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function currentListingIdFromLocation(): string {
  if (typeof window === "undefined") return "";
  const match = window.location.pathname.match(/^\/listings\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]).trim() : "";
}
