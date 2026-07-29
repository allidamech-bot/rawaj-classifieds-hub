import { Link } from "@tanstack/react-router";
import { ArrowDown, RefreshCw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdaptiveListingCard } from "@/features/listings/cards/AdaptiveListingCard";
import { fetchPublicListings } from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  ListingCursor,
  ListingFilters,
} from "@/lib/classifieds-types";

interface CategoriesListingDiscoveryProps {
  filters: ListingFilters;
  contextLabel?: string;
  text: (ar: string, en: string) => string;
}

const PROMOTED_PAGE_SIZE = 8;
const LATEST_PAGE_SIZE = 12;

function dedupeListings(listings: ClassifiedListing[]): ClassifiedListing[] {
  return [...new Map(listings.map((listing) => [listing.id, listing])).values()];
}

export function CategoriesListingDiscovery({
  filters,
  contextLabel,
  text,
}: CategoriesListingDiscoveryProps) {
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const stableFilters = useMemo<ListingFilters>(() => JSON.parse(filterKey), [filterKey]);
  const [promotedListings, setPromotedListings] = useState<ClassifiedListing[]>([]);
  const [latestListings, setLatestListings] = useState<ClassifiedListing[]>([]);
  const [nextCursor, setNextCursor] = useState<ListingCursor | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const requestIdRef = useRef(0);

  const loadInitial = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setPromotedListings([]);
    setLatestListings([]);
    setNextCursor(null);

    const [promotedResult, latestResult] = await Promise.all([
      fetchPublicListings({ ...stableFilters, sort: "featured" }, null, PROMOTED_PAGE_SIZE),
      fetchPublicListings({ ...stableFilters, sort: "latest" }, null, LATEST_PAGE_SIZE),
    ]);

    if (requestId !== requestIdRef.current) return;

    const firstError = !promotedResult.ok
      ? promotedResult.error
      : !latestResult.ok
        ? latestResult.error
        : null;

    const promoted = promotedResult.ok
      ? promotedResult.data.items.filter((listing) => listing.isFeatured).slice(0, 6)
      : [];
    const promotedIds = new Set(promoted.map((listing) => listing.id));
    const latest = latestResult.ok
      ? latestResult.data.items.filter((listing) => !promotedIds.has(listing.id))
      : [];

    setPromotedListings(dedupeListings(promoted));
    setLatestListings(dedupeListings(latest));
    setNextCursor(latestResult.ok ? latestResult.data.nextCursor : null);
    setError(firstError);
    setLoading(false);
  }, [stableFilters]);

  useEffect(() => {
    void loadInitial();
    return () => {
      requestIdRef.current += 1;
    };
  }, [loadInitial]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const requestId = ++requestIdRef.current;
    setLoadingMore(true);
    setError(null);

    const result = await fetchPublicListings(
      { ...stableFilters, sort: "latest" },
      nextCursor,
      LATEST_PAGE_SIZE,
    );

    if (requestId !== requestIdRef.current) return;
    if (!result.ok) {
      setError(result.error);
      setLoadingMore(false);
      return;
    }

    const promotedIds = new Set(promotedListings.map((listing) => listing.id));
    setLatestListings((current) =>
      dedupeListings([
        ...current,
        ...result.data.items.filter((listing) => !promotedIds.has(listing.id)),
      ]),
    );
    setNextCursor(result.data.nextCursor);
    setLoadingMore(false);
  }

  const hasListings = promotedListings.length > 0 || latestListings.length > 0;

  return (
    <section
      className="rawaj-categories-discovery"
      aria-labelledby="rawaj-categories-discovery-title"
      data-loading={loading}
    >
      <header className="rawaj-categories-discovery__header">
        <div>
          <span>{text("اكتشف إعلانات رواج", "Discover RAWAJ listings")}</span>
          <h2 id="rawaj-categories-discovery-title">
            {contextLabel
              ? text(`إعلانات مختارة ضمن ${contextLabel}`, `Selected listings in ${contextLabel}`)
              : text("إعلانات تستحق المشاهدة", "Listings worth exploring")}
          </h2>
          <p>
            {text(
              "تظهر الإعلانات المروّجة أولًا، ثم أحدث الإعلانات المعتمدة من السوق.",
              "Promoted listings appear first, followed by the latest approved marketplace listings.",
            )}
          </p>
        </div>
        <Link to="/listings" search={stableFilters}>
          {text("كل الإعلانات", "All listings")}
        </Link>
      </header>

      {loading ? (
        <div className="rawaj-categories-discovery__skeleton" aria-label={text("جاري تحميل الإعلانات", "Loading listings")}>
          {Array.from({ length: 4 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      ) : hasListings ? (
        <>
          {promotedListings.length > 0 ? (
            <div className="rawaj-categories-discovery__group" data-tone="promoted">
              <div className="rawaj-categories-discovery__group-heading">
                <span>
                  <Sparkles aria-hidden="true" />
                  {text("إعلانات مروّجة", "Promoted listings")}
                </span>
                <small>{text("مختارة وفق أولوية الترويج", "Ordered by promotion priority")}</small>
              </div>
              <div className="rawaj-categories-discovery__promoted-grid">
                {promotedListings.map((listing) => (
                  <AdaptiveListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          ) : null}

          {latestListings.length > 0 ? (
            <div className="rawaj-categories-discovery__group" data-tone="latest">
              <div className="rawaj-categories-discovery__group-heading">
                <span>{text("أحدث الإعلانات", "Latest listings")}</span>
                <small>{text("إعلانات معتمدة وحديثة", "Recently approved listings")}</small>
              </div>
              <div className="rawaj-categories-discovery__latest-grid">
                {latestListings.map((listing) => (
                  <AdaptiveListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            </div>
          ) : null}

          {nextCursor ? (
            <button
              type="button"
              className="rawaj-categories-discovery__load-more"
              disabled={loadingMore}
              aria-busy={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? (
                <RefreshCw className="animate-spin" aria-hidden="true" />
              ) : (
                <ArrowDown aria-hidden="true" />
              )}
              {loadingMore ? text("جاري التحميل", "Loading") : text("عرض المزيد", "Show more")}
            </button>
          ) : null}
        </>
      ) : (
        <div className="rawaj-categories-discovery__empty">
          <Sparkles aria-hidden="true" />
          <strong>{text("لا توجد إعلانات ضمن هذا النطاق الآن", "No listings are available in this scope yet")}</strong>
          <p>{text("جرّب قسمًا آخر أو افتح كل الإعلانات.", "Try another category or browse all listings.")}</p>
          <Link to="/listings">{text("فتح كل الإعلانات", "Browse all listings")}</Link>
        </div>
      )}

      {error ? (
        <div className="rawaj-categories-discovery__error" role="alert">
          <p>{error.message}</p>
          <button type="button" onClick={() => void loadInitial()}>
            {text("إعادة المحاولة", "Try again")}
          </button>
        </div>
      ) : null}
    </section>
  );
}
