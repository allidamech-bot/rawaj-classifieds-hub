import { readFile, writeFile } from "node:fs/promises";

const routePath = new URL("../src/routes/profile/listings.tsx", import.meta.url);
let source = await readFile(routePath, "utf8");

function replaceOnce(label, before, after) {
  if (!source.includes(before)) {
    throw new Error(`Missing ${label} block`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "React imports",
  'import { useEffect, useMemo, useState } from "react";',
  'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
);

replaceOnce(
  "owner store state",
  `  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [sellerProfile, setSellerProfile] = useState<PublicSellerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>(search.tab ?? "approved");
  const profileId = auth.profile?.id ?? null;`,
  `  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [sellerProfile, setSellerProfile] = useState<PublicSellerProfile | null>(null);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsHasLoaded, setListingsHasLoaded] = useState(false);
  const [listingsError, setListingsError] = useState<ClassifiedsError | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerHasLoaded, setSellerHasLoaded] = useState(false);
  const [sellerError, setSellerError] = useState<ClassifiedsError | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>(search.tab ?? "approved");
  const listingsRequestIdRef = useRef(0);
  const sellerRequestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;`,
);

replaceOnce(
  "shared owner store load",
  `  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) return;
    const ownerId = profileId;
    let cancelled = false;
    async function loadListings() {
      setLoading(true);
      setError(null);
      const [listingsResult, sellerResult] = await Promise.all([
        fetchCurrentUserListings(ownerId),
        fetchPublicSellerProfile(ownerId),
      ]);
      if (cancelled) return;
      if (listingsResult.ok) setListings(listingsResult.data);
      else {
        setListings([]);
        setError(listingsResult.error);
      }
      if (sellerResult.ok) setSellerProfile(sellerResult.data);
      else setSellerProfile(null);
      setLoading(false);
    }
    void loadListings();
    return () => {
      cancelled = true;
    };
  }, [auth.status, profileId]);`,
  `  const loadListings = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setListingsLoading(true);
    setListingsError(null);
    const result = await fetchCurrentUserListings(currentProfileId);
    if (requestId !== listingsRequestIdRef.current || currentProfileId !== auth.profile?.id)
      return;

    if (result.ok) {
      setListings(result.data);
      setListingsHasLoaded(true);
    } else {
      setListingsError(result.error);
    }
    setListingsLoading(false);
  }, [auth.profile?.id, profileId]);

  const loadSellerProfile = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++sellerRequestIdRef.current;
    setSellerLoading(true);
    setSellerError(null);
    const result = await fetchPublicSellerProfile(currentProfileId);
    if (requestId !== sellerRequestIdRef.current || currentProfileId !== auth.profile?.id)
      return;

    if (result.ok) {
      setSellerProfile(result.data);
      setSellerHasLoaded(true);
    } else {
      setSellerError(result.error);
    }
    setSellerLoading(false);
  }, [auth.profile?.id, profileId]);

  useEffect(() => {
    if (auth.status !== "signedIn" || !profileId) {
      listingsRequestIdRef.current += 1;
      sellerRequestIdRef.current += 1;
      setListings([]);
      setSellerProfile(null);
      setListingsLoading(false);
      setListingsHasLoaded(false);
      setListingsError(null);
      setSellerLoading(false);
      setSellerHasLoaded(false);
      setSellerError(null);
      return;
    }

    listingsRequestIdRef.current += 1;
    sellerRequestIdRef.current += 1;
    setListings([]);
    setSellerProfile(null);
    setListingsLoading(false);
    setListingsHasLoaded(false);
    setListingsError(null);
    setSellerLoading(false);
    setSellerHasLoaded(false);
    setSellerError(null);
    void Promise.all([loadListings(), loadSellerProfile()]);

    return () => {
      listingsRequestIdRef.current += 1;
      sellerRequestIdRef.current += 1;
    };
  }, [auth.status, loadListings, loadSellerProfile, profileId]);`,
);

replaceOnce(
  "owner store content state",
  `        {loading ? (
          <Panel title={text("جاري تحميل واجهة المتجر", "Loading store")} />
        ) : error ? (
          <Panel
            title={text("تعذر تحميل إعلاناتك", "Could not load your listings")}
            body={error.message}
          />
        ) : activeTab === "reviews" ? (
          <ReviewsSection sellerProfile={sellerProfile} />
        ) : visibleListings.length === 0 ? (
          <Panel
            title={text("لا توجد عناصر في هذا القسم", "Nothing in this section")}
            body={text(
              "ستظهر الإعلانات هنا حسب حالتها الحقيقية من قاعدة البيانات.",
              "Listings appear here according to their current lifecycle status.",
            )}
          />
        ) : (
          <div className="rawaj-storefront-owner-grid">
            {visibleListings.map((listing) => (
              <StoreListingCard
                key={listing.id}
                listing={listing}
                language={language}
                userId={profileId}
                onDeleted={handleListingDeleted}
                onChanged={handleListingChanged}
              />
            ))}
          </div>
        )}`,
  `        {sellerError && activeTab !== "reviews" ? (
          <StorefrontNotice
            tone="neutral"
            title={text("تعذر تحديث بيانات المتجر", "Could not refresh store details")}
            description={sellerError.message}
            action={
              <button type="button" disabled={sellerLoading} onClick={() => void loadSellerProfile()}>
                {text("إعادة المحاولة", "Try again")}
              </button>
            }
          />
        ) : null}

        {listingsLoading && !listingsHasLoaded ? (
          <Panel title={text("جاري تحميل واجهة المتجر", "Loading store")} />
        ) : listingsError && !listingsHasLoaded ? (
          <Panel
            title={text("تعذر تحميل إعلاناتك", "Could not load your listings")}
            body={listingsError.message}
            actionLabel={text("إعادة المحاولة", "Try again")}
            onAction={() => void loadListings()}
            actionDisabled={listingsLoading}
          />
        ) : activeTab === "reviews" ? (
          sellerLoading && !sellerHasLoaded ? (
            <Panel title={text("جاري تحميل التقييمات", "Loading reviews")} />
          ) : sellerError && !sellerHasLoaded ? (
            <Panel
              title={text("تعذر تحميل التقييمات", "Could not load reviews")}
              body={sellerError.message}
              actionLabel={text("إعادة المحاولة", "Try again")}
              onAction={() => void loadSellerProfile()}
              actionDisabled={sellerLoading}
            />
          ) : (
            <ReviewsSection sellerProfile={sellerProfile} />
          )
        ) : (
          <>
            {listingsError ? (
              <StorefrontNotice
                tone="neutral"
                title={text("تعذر تحديث إعلاناتك", "Could not refresh your listings")}
                description={listingsError.message}
                action={
                  <button type="button" disabled={listingsLoading} onClick={() => void loadListings()}>
                    {text("إعادة المحاولة", "Try again")}
                  </button>
                }
              />
            ) : null}
            {visibleListings.length === 0 ? (
              <Panel
                title={text("لا توجد عناصر في هذا القسم", "Nothing in this section")}
                body={text(
                  "ستظهر الإعلانات هنا حسب حالتها الحقيقية من قاعدة البيانات.",
                  "Listings appear here according to their current lifecycle status.",
                )}
              />
            ) : (
              <div className="rawaj-storefront-owner-grid">
                {visibleListings.map((listing) => (
                  <StoreListingCard
                    key={listing.id}
                    listing={listing}
                    language={language}
                    userId={profileId}
                    onDeleted={handleListingDeleted}
                    onChanged={handleListingChanged}
                  />
                ))}
              </div>
            )}
          </>
        )}`,
);

replaceOnce(
  "owner store panel",
  `function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </section>
  );
}`,
  `function Panel({
  title,
  body,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          disabled={actionDisabled}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}`,
);

await writeFile(routePath, source);
