import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgePercent,
  BellRing,
  BookmarkCheck,
  CircleCheckBig,
  CheckSquare,
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  Heart,
  MessageCircle,
  Pencil,
  Plus,
  Square,
  Star,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { ListingCardImage } from "@/features/listings/cards/ListingCardImage";
import {
  StorefrontIdentityHero,
  StorefrontNotice,
} from "@/features/storefront/StorefrontIdentityHero";
import {
  filterAndSortOwnerListings,
  filterOwnerPerformanceWindow,
  OwnerBulkActionBar,
  OwnerListingsToolbar,
  OwnerWorkspaceInsights,
  type OwnerListingSort,
  type OwnerPerformanceWindow,
} from "@/features/storefront/OwnerListingsWorkspaceTools";
import {
  closeOwnerListing,
  confirmOwnerListingAvailability,
  createOwnerDraftCopyRequestId,
  createOwnerDraftListingCopy,
  deleteOwnerListing,
  fetchCurrentUserListings,
  fetchPublicSellerProfile,
  isOwnerDeletableStatus,
  reactivateOwnerListing,
  reduceOwnerListingPrice,
  setOwnerListingExpiry,
  setOwnerListingReserved,
  type OwnerCloseListingStatus,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  PublicSellerProfile,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { isClosedListingStatus, isReactivatableListingStatus } from "@/lib/listing-lifecycle-ui";
import type { ListingExpiryOption } from "@/lib/api/listing-expiry";
import { listingStatusLabel } from "@/lib/status-labels";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/profile/listings")({
  validateSearch: z.object({
    tab: z.enum(["approved", "pending", "needs_edit", "closed", "reviews"]).optional(),
  }),
  head: () => ({
    meta: [{ title: "إعلاناتي | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MyListingsPage,
});

type StoreTab = "approved" | "pending" | "needs_edit" | "closed" | "reviews";

const OWNER_LISTINGS_PAGE_SIZE = 12;

type LifecycleConfirmation =
  { action: "close"; targetStatus: OwnerCloseListingStatus } | { action: "reactivate" };

interface LifecycleConfirmationCopy {
  title: string;
  description: string;
  confirmLabel: string;
}

function MyListingsPage() {
  const search = Route.useSearch();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [sellerProfile, setSellerProfile] = useState<PublicSellerProfile | null>(null);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsHasLoaded, setListingsHasLoaded] = useState(false);
  const [listingsError, setListingsError] = useState<ClassifiedsError | null>(null);
  const [sellerLoading, setSellerLoading] = useState(false);
  const [sellerHasLoaded, setSellerHasLoaded] = useState(false);
  const [sellerError, setSellerError] = useState<ClassifiedsError | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>(search.tab ?? "approved");
  const [listingSearch, setListingSearch] = useState("");
  const [listingSort, setListingSort] = useState<OwnerListingSort>("updated_desc");
  const [performanceWindow, setPerformanceWindow] = useState<OwnerPerformanceWindow>("all");
  const [visibleCount, setVisibleCount] = useState(OWNER_LISTINGS_PAGE_SIZE);
  const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(() => new Set());
  const [bulkExpiryOption, setBulkExpiryOption] = useState<ListingExpiryOption>(30);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState("");
  const [workspaceMessage, setWorkspaceMessage] = useState("");
  const [duplicatingListingId, setDuplicatingListingId] = useState<string | null>(null);
  const duplicateRequestIdsRef = useRef<Map<string, string>>(new Map());
  const listingsRequestIdRef = useRef(0);
  const sellerRequestIdRef = useRef(0);
  const profileId = auth.profile?.id ?? null;
  const profileIdRef = useRef<string | null>(profileId);
  profileIdRef.current = profileId;

  useEffect(() => {
    if (search.tab) setActiveTab(search.tab);
  }, [search.tab]);

  useEffect(() => {
    setVisibleCount(OWNER_LISTINGS_PAGE_SIZE);
    setSelectedListingIds(new Set());
    setBulkFeedback("");
  }, [activeTab, listingSearch, listingSort]);

  useEffect(() => {
    setSelectedListingIds((current) => {
      const validIds = new Set(
        listings
          .filter((listing) => listing.status === "approved" && current.has(listing.id))
          .map((listing) => listing.id),
      );
      return validIds.size === current.size ? current : validIds;
    });
  }, [listings]);

  const loadListings = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++listingsRequestIdRef.current;
    setListingsLoading(true);
    setListingsError(null);
    try {
      const result = await fetchCurrentUserListings(currentProfileId);
      if (requestId !== listingsRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (result.ok) {
        setListings(result.data);
        setListingsHasLoaded(true);
      } else setListingsError(result.error);
    } catch (caught) {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setListingsError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل إعلاناتك.", "Could not load your listings."),
          operation: "owner_listings_load",
        });
      }
    } finally {
      if (requestId === listingsRequestIdRef.current && currentProfileId === profileIdRef.current)
        setListingsLoading(false);
    }
  }, [profileId, text]);

  const loadSellerProfile = useCallback(async () => {
    if (!profileId) return;

    const currentProfileId = profileId;
    const requestId = ++sellerRequestIdRef.current;
    setSellerLoading(true);
    setSellerError(null);
    try {
      const result = await fetchPublicSellerProfile(currentProfileId);
      if (requestId !== sellerRequestIdRef.current || currentProfileId !== profileIdRef.current)
        return;
      if (result.ok) {
        setSellerProfile(result.data);
        setSellerHasLoaded(true);
      } else setSellerError(result.error);
    } catch (caught) {
      if (requestId === sellerRequestIdRef.current && currentProfileId === profileIdRef.current) {
        setSellerError({
          code: "unknown",
          message:
            caught instanceof Error
              ? caught.message
              : text("تعذر تحميل بيانات المتجر.", "Could not load store details."),
          operation: "owner_store_load",
        });
      }
    } finally {
      if (requestId === sellerRequestIdRef.current && currentProfileId === profileIdRef.current)
        setSellerLoading(false);
    }
  }, [profileId, text]);

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
  }, [auth.status, loadListings, loadSellerProfile, profileId]);

  function handleListingDeleted(actionProfileId: string | null, listingId: string) {
    if (!actionProfileId || actionProfileId !== profileIdRef.current) return;
    setListings((prev) => prev.filter((listing) => listing.id !== listingId));
  }

  function handleListingChanged(actionProfileId: string | null, nextListing: ClassifiedListing) {
    if (!actionProfileId || actionProfileId !== profileIdRef.current) return;
    setListings((prev) =>
      prev.map((listing) => (listing.id === nextListing.id ? nextListing : listing)),
    );
  }

  const grouped = useMemo(
    () => ({
      approved: listings.filter((listing) => listing.status === "approved"),
      pending: listings.filter((listing) => listing.status === "pending_review"),
      needs_edit: listings.filter(
        (listing) => listing.status === "draft" || listing.status === "rejected",
      ),
      closed: listings.filter((listing) => isClosedListingStatus(listing.status)),
    }),
    [listings],
  );
  const latestDraft = useMemo(
    () =>
      listings
        .filter((listing) => listing.status === "draft")
        .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0] ?? null,
    [listings],
  );
  const performanceListings = useMemo(
    () => filterOwnerPerformanceWindow(listings, performanceWindow),
    [listings, performanceWindow],
  );
  const performanceSummary = useMemo(
    () => summarizeOwnerListingPerformance(performanceListings),
    [performanceListings],
  );
  const tabListings = grouped[activeTab === "reviews" ? "approved" : activeTab];
  const filteredListings = useMemo(
    () => filterAndSortOwnerListings(tabListings, listingSearch, listingSort),
    [tabListings, listingSearch, listingSort],
  );
  const visibleListings = filteredListings.slice(0, visibleCount);
  const hasMoreListings = visibleCount < filteredListings.length;
  const visibleApprovedIds = visibleListings
    .filter((listing) => listing.status === "approved")
    .map((listing) => listing.id);
  const allVisibleApprovedSelected =
    visibleApprovedIds.length > 0 && visibleApprovedIds.every((id) => selectedListingIds.has(id));
  const selectedApprovedListings = listings.filter(
    (listing) => listing.status === "approved" && selectedListingIds.has(listing.id),
  );

  function handleSelectionChange(listingId: string, selected: boolean) {
    setSelectedListingIds((current) => {
      const next = new Set(current);
      if (selected) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  }

  function toggleVisibleApprovedSelection() {
    setSelectedListingIds((current) => {
      const next = new Set(current);
      if (allVisibleApprovedSelected) visibleApprovedIds.forEach((id) => next.delete(id));
      else visibleApprovedIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function handleDuplicateListing(listing: ClassifiedListing) {
    if (!profileId || duplicatingListingId) return;
    setDuplicatingListingId(listing.id);
    setWorkspaceMessage("");
    try {
      const requestId =
        duplicateRequestIdsRef.current.get(listing.id) ?? createOwnerDraftCopyRequestId();
      duplicateRequestIdsRef.current.set(listing.id, requestId);
      const result = await createOwnerDraftListingCopy(
        profileId,
        {
          categoryId: listing.categoryId,
          subcategoryId: listing.subcategoryId,
          governorateId: listing.governorateId,
          title: `${listing.title} ${text("نسخة", "copy")}`.slice(0, 120),
          description: listing.description,
          price: listing.price,
          priceType: listing.priceType,
          condition: listing.condition,
          districtAr: listing.locationNodeId ? `@${listing.locationNodeId}` : listing.districtAr,
          contactName: listing.contactName,
          contactOptions: { ...listing.contactOptions },
          details: { ...listing.details },
        },
        requestId,
      );
      if (!result.ok) {
        setWorkspaceMessage(result.error.message);
        return;
      }
      duplicateRequestIdsRef.current.delete(listing.id);
      setListings((current) => [
        result.data,
        ...current.filter((item) => item.id !== result.data.id),
      ]);
      setActiveTab("needs_edit");
      setListingSearch("");
      setWorkspaceMessage(
        text(
          "تم إنشاء نسخة كمسودة بدون الصور. افتحها لإضافة الصور ومراجعة البيانات.",
          "A draft copy was created without images. Open it to add images and review the details.",
        ),
      );
    } catch (caught) {
      setWorkspaceMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر نسخ الإعلان.", "Could not duplicate the listing."),
      );
    } finally {
      setDuplicatingListingId(null);
    }
  }

  async function runBulkAction(action: "renew" | "availability") {
    if (!profileId || bulkBusy || selectedApprovedListings.length === 0) return;
    setBulkBusy(true);
    setBulkFeedback("");
    let successCount = 0;
    const failures: string[] = [];
    for (const listing of selectedApprovedListings) {
      try {
        const result =
          action === "renew"
            ? await setOwnerListingExpiry(profileId, listing.id, bulkExpiryOption)
            : await confirmOwnerListingAvailability(profileId, listing.id);
        if (result.ok) {
          successCount += 1;
          handleListingChanged(profileId, result.data);
        } else failures.push(result.error.message);
      } catch (caught) {
        failures.push(
          caught instanceof Error
            ? caught.message
            : text("تعذر تنفيذ الإجراء.", "Could not complete the action."),
        );
      }
    }
    setSelectedListingIds(new Set());
    setBulkFeedback(
      failures.length === 0
        ? text(
            `تم تحديث ${successCount} إعلان بنجاح.`,
            `${successCount} listing(s) updated successfully.`,
          )
        : text(
            `تم تحديث ${successCount} إعلان، وتعذر تحديث ${failures.length}.`,
            `${successCount} updated; ${failures.length} failed.`,
          ),
    );
    setBulkBusy(false);
  }

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("إعلاناتي", "My listings")} to="/profile" backMode="history" />
        <main className="container-wide mobile-page-bottom pt-4">
          <Panel
            title={text("تسجيل الدخول مطلوب", "Login required")}
            body={text(
              "سجل الدخول لإدارة الإعلانات المرتبطة بحسابك وعرض متجرك العام بصورة منفصلة.",
              "Log in to manage listings linked to your account and open your public store separately.",
            )}
          />
        </main>
      </>
    );
  }

  const displayName =
    auth.profile?.businessName ||
    auth.profile?.displayName ||
    auth.profile?.email ||
    text("متجري", "My store");
  const ratingCount = sellerProfile?.ratingSummary?.count ?? 0;
  const ratingAverage = sellerProfile?.ratingSummary?.average ?? null;

  return (
    <>
      <PageHeader title={text("إعلاناتي", "My listings")} to="/profile" backMode="history" />
      <main className="rawaj-storefront-v2 rawaj-storefront-v2--owner rawaj-account-store-v3 container-wide mobile-page-bottom space-y-5 pb-8 pt-3 sm:pt-5">
        <StorefrontIdentityHero
          mode="owner"
          sellerId={profileId ?? ""}
          displayName={displayName}
          secondaryName={auth.profile?.businessName ? auth.profile?.displayName : null}
          avatarUrl={auth.profile?.avatarUrl}
          coverUrl={auth.profile?.coverUrl}
          bio={auth.profile?.bio}
          location={auth.profile?.cityArea || auth.profile?.governorate}
          verified={sellerProfile?.verified ?? false}
          joinedAt={sellerProfile?.joinedAt}
          ratingAverage={ratingAverage}
          ratingCount={ratingCount}
          approvedCount={grouped.approved.length}
          pendingCount={grouped.pending.length}
          needsEditCount={grouped.needs_edit.length}
          closedCount={grouped.closed.length}
        />

        {latestDraft ? (
          <StorefrontNotice
            tone="draft"
            title={text("لديك مسودة محفوظة", "You have a saved draft")}
            description={`${latestDraft.title} · ${text("آخر حفظ", "Last saved")} ${formatSavedAt(
              latestDraft.updatedAt,
              language,
            )}`}
            action={
              <>
                <button type="button" onClick={() => setActiveTab("needs_edit")}>
                  {text("عرض المسودات", "Show drafts")}
                </button>
                <Link to="/profile/listings/$id" params={{ id: latestDraft.id }}>
                  {text("متابعة المسودة", "Resume draft")}
                </Link>
              </>
            }
          />
        ) : null}

        <OwnerWorkspaceInsights listings={listings} onTabChange={(tab) => setActiveTab(tab)} />

        <OwnerPerformanceOverview
          summary={performanceSummary}
          scopeNote={text(
            performanceWindow === "all"
              ? "الأرقام تراكمية لكل الإعلانات المتتبعة. المشاهدات المسجلة لا تشمل الزوار غير المسجلين."
              : `الأرقام تراكمية للإعلانات المنشورة خلال آخر ${performanceWindow} يوماً، وليست سجلاً يومياً لوقت حدوث التفاعل. المشاهدات المسجلة لا تشمل الزوار غير المسجلين.`,
            performanceWindow === "all"
              ? "Metrics are lifetime totals for all tracked listings. Recorded views do not include signed-out visitors."
              : `Metrics are lifetime totals for listings published in the last ${performanceWindow} days, not event-by-event history. Recorded views do not include signed-out visitors.`,
          )}
        />

        <div className="rawaj-owner-workspace-sticky">
          <div
            className="rawaj-storefront-owner-tabs"
            role="group"
            aria-label={text("حالات الإعلانات", "Listing statuses")}
            data-rawaj-segmented-control="true"
          >
            <TabButton
              active={activeTab === "approved"}
              label={text("نشطة", "Live")}
              count={grouped.approved.length}
              onClick={() => setActiveTab("approved")}
            />
            <TabButton
              active={activeTab === "pending"}
              label={text("مراجعة", "Review")}
              count={grouped.pending.length}
              onClick={() => setActiveTab("pending")}
            />
            <TabButton
              active={activeTab === "needs_edit"}
              label={text("تعديل", "Edit")}
              count={grouped.needs_edit.length}
              onClick={() => setActiveTab("needs_edit")}
            />
            <TabButton
              active={activeTab === "closed"}
              label={text("مغلقة", "Closed")}
              count={grouped.closed.length}
              onClick={() => setActiveTab("closed")}
            />
            <TabButton
              active={activeTab === "reviews"}
              label={text("تقييمات", "Reviews")}
              count={ratingCount}
              onClick={() => setActiveTab("reviews")}
            />
          </div>
          {activeTab !== "reviews" ? (
            <OwnerListingsToolbar
              query={listingSearch}
              onQueryChange={setListingSearch}
              sort={listingSort}
              onSortChange={setListingSort}
              performanceWindow={performanceWindow}
              onPerformanceWindowChange={setPerformanceWindow}
              totalCount={filteredListings.length}
              shownCount={visibleListings.length}
              canSelect={activeTab === "approved" && visibleApprovedIds.length > 0}
              selectedCount={selectedApprovedListings.length}
              allVisibleSelected={allVisibleApprovedSelected}
              onToggleVisibleSelection={toggleVisibleApprovedSelection}
            />
          ) : null}
          {activeTab === "approved" ? (
            <OwnerBulkActionBar
              selectedCount={selectedApprovedListings.length}
              expiryOption={bulkExpiryOption}
              busy={bulkBusy}
              feedback={bulkFeedback}
              onExpiryOptionChange={setBulkExpiryOption}
              onRenew={() => void runBulkAction("renew")}
              onConfirmAvailability={() => void runBulkAction("availability")}
              onClear={() => {
                setSelectedListingIds(new Set());
                setBulkFeedback("");
              }}
            />
          ) : null}
        </div>

        {workspaceMessage ? (
          <p role="status" className="rawaj-owner-workspace-feedback">
            {workspaceMessage}
          </p>
        ) : null}

        {sellerError && activeTab !== "reviews" ? (
          <StorefrontNotice
            tone="neutral"
            title={text("تعذر تحديث بيانات المتجر", "Could not refresh store details")}
            description={sellerError.message}
            action={
              <button
                type="button"
                disabled={sellerLoading}
                onClick={() => void loadSellerProfile()}
              >
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
                  <button
                    type="button"
                    disabled={listingsLoading}
                    onClick={() => void loadListings()}
                  >
                    {text("إعادة المحاولة", "Try again")}
                  </button>
                }
              />
            ) : null}
            {filteredListings.length === 0 ? (
              <Panel
                title={text("لا توجد عناصر في هذا القسم", "Nothing in this section")}
                body={text(
                  "ستظهر الإعلانات هنا حسب حالتها الحقيقية من قاعدة البيانات.",
                  "Listings appear here according to their current lifecycle status.",
                )}
              />
            ) : (
              <>
                <div className="rawaj-storefront-owner-grid">
                  {visibleListings.map((listing) => (
                    <StoreListingCard
                      key={`${profileId ?? "signed-out"}:${listing.id}`}
                      listing={listing}
                      language={language}
                      userId={profileId}
                      selected={selectedListingIds.has(listing.id)}
                      selectable={activeTab === "approved" && listing.status === "approved"}
                      duplicating={duplicatingListingId === listing.id}
                      onSelectionChange={handleSelectionChange}
                      onDuplicate={handleDuplicateListing}
                      onDeleted={handleListingDeleted}
                      onChanged={handleListingChanged}
                    />
                  ))}
                </div>
                {hasMoreListings ? (
                  <button
                    type="button"
                    className="rawaj-owner-load-more"
                    onClick={() => setVisibleCount((current) => current + OWNER_LISTINGS_PAGE_SIZE)}
                  >
                    {text("عرض المزيد", "Load more")} · {visibleListings.length}/
                    {filteredListings.length}
                  </button>
                ) : null}
              </>
            )}
          </>
        )}
      </main>
    </>
  );
}

interface OwnerPerformanceSummary {
  trackedListings: number;
  recordedViews: number;
  favorites: number;
  conversations: number;
  unreadMessages: number;
  expiringSoon: number;
}

interface OwnerExpiryInsight {
  tone: "safe" | "warning" | "danger" | "neutral";
  title: string;
  description: string;
}

function summarizeOwnerListingPerformance(listings: ClassifiedListing[]): OwnerPerformanceSummary {
  return listings.reduce<OwnerPerformanceSummary>(
    (summary, listing) => {
      if (!isPerformanceEligibleListing(listing)) return summary;
      summary.trackedListings += 1;
      summary.recordedViews += listing.recordedViewCount ?? 0;
      summary.favorites += listing.favoriteCount ?? 0;
      summary.conversations += listing.conversationCount ?? 0;
      summary.unreadMessages += listing.unreadMessageCount ?? 0;
      const daysRemaining =
        listing.status === "approved" ? daysUntilExpiry(listing.expiresAt) : null;
      if (daysRemaining !== null && daysRemaining >= 0 && daysRemaining <= 7) {
        summary.expiringSoon += 1;
      }
      return summary;
    },
    {
      trackedListings: 0,
      recordedViews: 0,
      favorites: 0,
      conversations: 0,
      unreadMessages: 0,
      expiringSoon: 0,
    },
  );
}

function OwnerPerformanceOverview({
  summary,
  scopeNote,
}: {
  summary: OwnerPerformanceSummary;
  scopeNote: string;
}) {
  const { text } = useUiPreferences();
  const [expanded, setExpanded] = useState(false);
  const metrics = [
    {
      key: "views",
      label: text("المشاهدات", "Views"),
      value: summary.recordedViews,
      icon: <Eye className="h-4 w-4" />,
    },
    {
      key: "favorites",
      label: text("المفضلة", "Favorites"),
      value: summary.favorites,
      icon: <Heart className="h-4 w-4" />,
    },
    {
      key: "conversations",
      label: text("المحادثات", "Conversations"),
      value: summary.conversations,
      icon: <MessageCircle className="h-4 w-4" />,
    },
    {
      key: "unread",
      label: text("غير المقروء", "Unread"),
      value: summary.unreadMessages,
      icon: <BellRing className="h-4 w-4" />,
    },
  ];
  const visibleMetrics = metrics.filter((metric) => metric.value > 0);

  return (
    <section
      data-owner-performance-overview="true"
      aria-label={text("ملخص أداء الإعلانات", "Listing performance summary")}
      className="rawaj-color-card rawaj-world-blue overflow-hidden rounded-[1.2rem]"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-start"
      >
        <span className="flex min-w-0 items-center gap-2">
          <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
          <span>
            <span className="block text-sm font-extrabold text-foreground">
              {text("أداء إعلاناتك", "Your listing performance")}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {text(
                "ملخص سريع للتفاعل وحالة الإعلانات",
                "A quick summary of engagement and listing health",
              )}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-xs font-bold text-primary">
          {formatOwnerMetric(summary.recordedViews)}
          <Eye className="h-3.5 w-3.5" />
          <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border/60 px-4 pb-4 pt-3">
          <div className="grid grid-flow-col auto-cols-fr gap-2">
            {visibleMetrics.map((metric) => (
              <div
                key={metric.key}
                data-owner-summary-metric={metric.key}
                className="rounded-xl bg-card/80 p-2 text-center hairline"
              >
                <div className="mx-auto flex w-fit items-center text-primary">{metric.icon}</div>
                <p className="mt-1 text-base font-extrabold text-foreground">
                  {formatOwnerMetric(metric.value)}
                </p>
                <p className="truncate text-[9px] font-semibold text-muted-foreground">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9px] leading-4 text-muted-foreground">{scopeNote}</p>
          {summary.trackedListings === 0 ? (
            <p className="mt-3 rounded-xl bg-muted-surface p-3 text-[11px] text-muted-foreground">
              {text(
                "ستظهر بيانات الأداء بعد اعتماد أول إعلان وبدء التفاعل معه.",
                "Performance data appears after your first approved listing receives activity.",
              )}
            </p>
          ) : summary.expiringSoon > 0 ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-[11px] font-bold text-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
              {text(
                "لديك " + formatOwnerMetric(summary.expiringSoon) + " إعلان ينتهي خلال 7 أيام.",
                formatOwnerMetric(summary.expiringSoon) + " listing(s) expire within 7 days.",
              )}
            </p>
          ) : (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-trust/10 p-3 text-[11px] font-semibold text-foreground">
              <CircleCheckBig className="h-4 w-4 shrink-0 text-emerald-trust" />
              {text(
                "لا توجد إعلانات تنتهي خلال الأيام السبعة القادمة.",
                "No listings expire within the next seven days.",
              )}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function OwnerListingPerformance({ listing }: { listing: ClassifiedListing; language: Language }) {
  const { text } = useUiPreferences();
  if (!isPerformanceEligibleListing(listing)) return null;
  const metrics = [
    {
      key: "views",
      label: text("مشاهدات", "Views"),
      value: listing.recordedViewCount ?? 0,
      icon: <Eye className="h-3.5 w-3.5" />,
    },
    {
      key: "favorites",
      label: text("مفضلة", "Favorites"),
      value: listing.favoriteCount ?? 0,
      icon: <Heart className="h-3.5 w-3.5" />,
    },
    {
      key: "conversations",
      label: text("محادثات", "Conversations"),
      value: listing.conversationCount ?? 0,
      icon: <MessageCircle className="h-3.5 w-3.5" />,
    },
    {
      key: "unread",
      label: text("غير مقروء", "Unread"),
      value: listing.unreadMessageCount ?? 0,
      icon: <BellRing className="h-3.5 w-3.5" />,
    },
  ];
  const visibleMetrics = metrics.filter((metric) => metric.value > 0);
  const hasActivity = visibleMetrics.length > 0;

  return (
    <div
      data-owner-listing-performance="true"
      className="flex items-center justify-between gap-2 rounded-xl bg-primary/[0.035] px-3 py-2 hairline"
    >
      {hasActivity ? (
        <div className="grid flex-1 grid-flow-col auto-cols-fr gap-1.5">
          {visibleMetrics.map((metric) => (
            <div key={metric.key} data-owner-metric={metric.key} className="text-center">
              <p className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
                {metric.icon}
                <span>{formatOwnerMetric(metric.value)}</span>
              </p>
              <p className="mt-0.5 truncate text-[8px] font-semibold text-muted-foreground">
                {metric.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="flex-1 text-[10px] font-semibold text-muted-foreground">
          {text("لا يوجد تفاعل بعد", "No activity yet")}
        </p>
      )}
      {(listing.unreadMessageCount ?? 0) > 0 ? (
        <Link
          to="/chats"
          className="inline-flex min-h-8 items-center gap-1 rounded-lg bg-warning/10 px-2 text-[9px] font-bold text-foreground"
        >
          <BellRing className="h-3.5 w-3.5 text-warning" />
          {formatOwnerMetric(listing.unreadMessageCount ?? 0)}
        </Link>
      ) : null}
    </div>
  );
}

function ownerListingExpiryInsight(
  listing: ClassifiedListing,
  text: (ar: string, en: string) => string,
): OwnerExpiryInsight | null {
  if (listing.status !== "approved" && listing.status !== "expired") return null;
  if (listing.status === "expired") {
    return {
      tone: "danger",
      title: text("انتهت صلاحية الإعلان", "Listing expired"),
      description: text(
        "أعد تفعيل الإعلان وأرسله للمراجعة إذا كان ما زال متاحاً.",
        "Reactivate and resubmit the listing if it is still available.",
      ),
    };
  }
  if (!listing.expiresAt) {
    return {
      tone: "safe",
      title: text("بدون انتهاء تلقائي", "No automatic expiry"),
      description: text(
        "سيبقى الإعلان منشوراً حتى تغيّر حالته أو تحدد مدة صلاحية.",
        "The listing remains published until you change its status or set an expiry period.",
      ),
    };
  }
  const daysRemaining = daysUntilExpiry(listing.expiresAt);
  if (daysRemaining === null) return null;
  if (daysRemaining <= 0) {
    return {
      tone: "danger",
      title: text("تنتهي صلاحية الإعلان اليوم", "Listing expires today"),
      description: text(
        "جدد المدة الآن لتجنب اختفاء الإعلان من النتائج.",
        "Renew the duration now to prevent the listing from leaving search results.",
      ),
    };
  }
  if (daysRemaining <= 3) {
    return {
      tone: "danger",
      title: text(
        "ينتهي الإعلان خلال " + formatOwnerMetric(daysRemaining) + " يوم",
        "Listing expires in " + formatOwnerMetric(daysRemaining) + " day(s)",
      ),
      description: text(
        "هذا تنبيه عاجل: راجع توفر الإعلان وجدّد المدة.",
        "Urgent: confirm availability and renew the listing duration.",
      ),
    };
  }
  if (daysRemaining <= 7) {
    return {
      tone: "warning",
      title: text(
        "متبقي " + formatOwnerMetric(daysRemaining) + " يوم على انتهاء الإعلان",
        formatOwnerMetric(daysRemaining) + " day(s) remain",
      ),
      description: text(
        "راجع الإعلان وجدّد المدة قبل انتهائها.",
        "Review the listing and renew it before expiry.",
      ),
    };
  }
  return {
    tone: "neutral",
    title: text(
      "متبقي " + formatOwnerMetric(daysRemaining) + " يوم",
      formatOwnerMetric(daysRemaining) + " day(s) remaining",
    ),
    description: text("مدة الإعلان فعالة حالياً.", "The listing duration is currently active."),
  };
}

function ownerExpiryInsightClassName(tone: OwnerExpiryInsight["tone"]): string {
  if (tone === "danger") return "border-destructive/25 bg-destructive/10 text-destructive";
  if (tone === "warning") return "border-warning/30 bg-warning/10 text-foreground";
  if (tone === "safe") return "border-emerald-trust/25 bg-emerald-trust/10 text-foreground";
  return "border-border/70 bg-muted-surface text-foreground";
}

function daysUntilExpiry(value: string | null | undefined): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return Math.ceil((timestamp - Date.now()) / 86_400_000);
}

function isPerformanceEligibleListing(listing: ClassifiedListing): boolean {
  return listing.status === "approved" || isClosedListingStatus(listing.status);
}

function formatOwnerMetric(value: number): string {
  return Math.max(0, Math.trunc(value)).toLocaleString("en-US");
}
function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} data-active={active}>
      {label} <span className="opacity-75">({count})</span>
    </button>
  );
}

function StoreListingCard({
  listing,
  language,
  userId,
  selected,
  selectable,
  duplicating,
  onSelectionChange,
  onDuplicate,
  onDeleted,
  onChanged,
}: {
  listing: ClassifiedListing;
  language: Language;
  userId: string | null;
  selected: boolean;
  selectable: boolean;
  duplicating: boolean;
  onSelectionChange: (listingId: string, selected: boolean) => void;
  onDuplicate: (listing: ClassifiedListing) => Promise<void>;
  onDeleted: (profileId: string | null, id: string) => void;
  onChanged: (profileId: string | null, listing: ClassifiedListing) => void;
}) {
  const { text } = useUiPreferences();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [pendingLifecycleConfirmation, setPendingLifecycleConfirmation] =
    useState<LifecycleConfirmation | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");
  const [priceDropBusy, setPriceDropBusy] = useState(false);
  const [priceDropError, setPriceDropError] = useState("");
  const [reservationBusy, setReservationBusy] = useState(false);
  const [reservationError, setReservationError] = useState("");
  const [priceDropDraft, setPriceDropDraft] = useState(
    listing.price && listing.price > 0 ? String(listing.price) : "",
  );
  const [expiryOption, setExpiryOption] = useState<ListingExpiryOption>(
    listing.expiryDays ?? "never",
  );
  const deleteInFlightRef = useRef(false);
  const lifecycleInFlightRef = useRef(false);
  const reservationInFlightRef = useRef(false);
  const priceDropInFlightRef = useRef(false);

  useEffect(() => {
    setExpiryOption(listing.expiryDays ?? "never");
  }, [listing.expiryDays]);

  useEffect(() => {
    setPriceDropDraft(listing.price && listing.price > 0 ? String(listing.price) : "");
  }, [listing.price]);

  const canEdit = listing.status !== "pending_review" && !isClosedListingStatus(listing.status);
  const canDelete = isOwnerDeletableStatus(listing.status);
  const canClose = listing.status === "approved";
  const canManageReservation = listing.status === "approved";
  const canReducePrice =
    listing.status === "approved" &&
    listing.price !== null &&
    listing.price > 0 &&
    (listing.priceType === "fixed" || listing.priceType === "negotiable");
  const canReactivate = isReactivatableListingStatus(listing.status);

  async function handleConfirmDelete() {
    if (deleteInFlightRef.current) return;
    deleteInFlightRef.current = true;
    setDeleteError("");
    setDeleting(true);
    try {
      const result = await deleteOwnerListing(userId, listing.id);
      if (!result.ok) {
        setDeleteError(result.error.message);
        return;
      }
      setShowDeleteConfirm(false);
      onDeleted(userId, listing.id);
    } catch (caught) {
      setDeleteError(
        caught instanceof Error
          ? caught.message
          : text("تعذر حذف الإعلان.", "Could not delete the listing."),
      );
    } finally {
      deleteInFlightRef.current = false;
      setDeleting(false);
    }
  }

  async function handleClose(targetStatus: OwnerCloseListingStatus) {
    if (lifecycleInFlightRef.current) return;
    lifecycleInFlightRef.current = true;
    setLifecycleError("");
    setLifecycleBusy(true);
    try {
      const result = await closeOwnerListing(userId, listing.id, targetStatus);
      if (!result.ok) {
        setLifecycleError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
      setPendingLifecycleConfirmation(null);
    } catch (caught) {
      setLifecycleError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحديث حالة الإعلان.", "Could not update listing status."),
      );
    } finally {
      lifecycleInFlightRef.current = false;
      setLifecycleBusy(false);
    }
  }

  async function handleReservationToggle() {
    if (reservationInFlightRef.current || !canManageReservation) return;
    reservationInFlightRef.current = true;
    setReservationError("");
    setReservationBusy(true);
    try {
      const result = await setOwnerListingReserved(userId, listing.id, !listing.reservedAt);
      if (!result.ok) {
        setReservationError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setReservationError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحديث حالة الحجز.", "Could not update reservation status."),
      );
    } finally {
      reservationInFlightRef.current = false;
      setReservationBusy(false);
    }
  }

  async function handleAvailabilityConfirm() {
    if (lifecycleInFlightRef.current || listing.status !== "approved") return;
    lifecycleInFlightRef.current = true;
    setLifecycleError("");
    setLifecycleBusy(true);
    try {
      const result = await confirmOwnerListingAvailability(userId, listing.id);
      if (!result.ok) {
        setLifecycleError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setLifecycleError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تأكيد توفر الإعلان.", "Could not confirm listing availability."),
      );
    } finally {
      lifecycleInFlightRef.current = false;
      setLifecycleBusy(false);
    }
  }

  async function handlePriceDrop() {
    if (priceDropInFlightRef.current || !canReducePrice) return;
    const nextPrice = Number(priceDropDraft);
    setPriceDropError("");
    if (
      !Number.isFinite(nextPrice) ||
      nextPrice <= 0 ||
      (listing.price !== null && nextPrice >= listing.price)
    ) {
      setPriceDropError(
        text(
          "أدخل سعراً جديداً أقل من السعر الحالي.",
          "Enter a valid price lower than the current price.",
        ),
      );
      return;
    }
    priceDropInFlightRef.current = true;
    setPriceDropBusy(true);
    try {
      const result = await reduceOwnerListingPrice(userId, listing.id, nextPrice);
      if (!result.ok) {
        setPriceDropError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setPriceDropError(
        caught instanceof Error
          ? caught.message
          : text("تعذر خفض السعر.", "Could not reduce the price."),
      );
    } finally {
      priceDropInFlightRef.current = false;
      setPriceDropBusy(false);
    }
  }

  async function handleReactivate() {
    if (lifecycleInFlightRef.current) return;
    lifecycleInFlightRef.current = true;
    setLifecycleError("");
    setLifecycleBusy(true);
    try {
      const result = await reactivateOwnerListing(userId, listing.id);
      if (!result.ok) {
        setLifecycleError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
      setPendingLifecycleConfirmation(null);
    } catch (caught) {
      setLifecycleError(
        caught instanceof Error
          ? caught.message
          : text("تعذر إعادة تفعيل الإعلان.", "Could not reactivate the listing."),
      );
    } finally {
      lifecycleInFlightRef.current = false;
      setLifecycleBusy(false);
    }
  }

  async function handleExpiryUpdate() {
    if (lifecycleInFlightRef.current || listing.status !== "approved") return;
    lifecycleInFlightRef.current = true;
    setLifecycleError("");
    setLifecycleBusy(true);
    try {
      const result = await setOwnerListingExpiry(userId, listing.id, expiryOption);
      if (!result.ok) {
        setLifecycleError(result.error.message);
        return;
      }
      onChanged(userId, result.data);
    } catch (caught) {
      setLifecycleError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحديث مدة الإعلان.", "Could not update listing expiry."),
      );
    } finally {
      lifecycleInFlightRef.current = false;
      setLifecycleBusy(false);
    }
  }

  const lockedMessage = isClosedListingStatus(listing.status)
    ? text(
        "هذا الإعلان مغلق ولا يعدل من هنا. يمكنك إعادة تفعيله للحالات المدعومة.",
        "This listing is closed and cannot be edited here. Supported states can be reactivated.",
      )
    : listing.status === "pending_review"
      ? text(
          "هذا الإعلان قيد المراجعة ولا يعدل حتى قرار الإدارة.",
          "This listing is under review and cannot be edited until the admin decision.",
        )
      : text(
          "الإعلان المعتمد ظاهر للزوار ولا يعدل من هنا.",
          "Approved listings are public and are not edited here.",
        );

  const lifecycleConfirmationCopy = pendingLifecycleConfirmation
    ? ownerLifecycleConfirmationCopy(pendingLifecycleConfirmation, text)
    : null;
  const expiryInsight = ownerListingExpiryInsight(listing, text);

  return (
    <>
      <article className="rawaj-owner-listing-card rawaj-product-card group">
        <div className="rawaj-product-media">
          <span className="rawaj-status-ribbon" data-status={listing.status}>
            {listingStatusLabel(listing.status, language)}
          </span>
          {selectable ? (
            <button
              type="button"
              aria-pressed={selected}
              aria-label={
                selected
                  ? text("إلغاء تحديد الإعلان", "Unselect listing")
                  : text("تحديد الإعلان", "Select listing")
              }
              title={
                selected
                  ? text("إلغاء التحديد", "Unselect")
                  : text("تحديد للإجراءات الجماعية", "Select for bulk actions")
              }
              onClick={() => onSelectionChange(listing.id, !selected)}
              className="rawaj-owner-listing-select"
              data-selected={selected}
            >
              {selected ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
            </button>
          ) : null}
          <ListingCardImage
            src={listing.primaryImageUrl}
            alt={listing.title}
            placeholder={listing.categoryPlaceholder ?? "misc"}
            placeholderAspect="wide"
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.025]"
          />
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 text-sm font-bold leading-5 text-primary">
              {listing.title}
            </h2>
          </div>
          {listing.status === "draft" && (
            <p className="rounded-lg bg-gold/10 p-2 text-[11px] font-semibold text-primary">
              {text("مسودة محفوظة", "Saved draft")} · {text("آخر حفظ", "Last saved")}{" "}
              {formatSavedAt(listing.updatedAt, language)}
            </p>
          )}
          {listing.reservedAt ? (
            <p className="rounded-lg bg-warning/10 p-2 text-[11px] font-semibold text-foreground">
              {text("هذا الإعلان محجوز حالياً.", "This listing is currently reserved.")}
            </p>
          ) : null}
          {listing.status === "approved" && (
            <p className="rounded-lg bg-emerald-trust/10 p-2 text-[11px] font-semibold text-foreground">
              {listing.renewedAt
                ? `${text("آخر تأكيد للتوفر", "Availability last confirmed")}: ${formatSavedAt(listing.renewedAt, language)}`
                : text(
                    "لم يتم تأكيد استمرار التوفر بعد.",
                    "Availability has not been confirmed yet.",
                  )}
            </p>
          )}
          {expiryInsight ? (
            <div
              data-owner-expiry-insight={expiryInsight.tone}
              className={
                "rounded-xl border p-2.5 " + ownerExpiryInsightClassName(expiryInsight.tone)
              }
            >
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold">
                <Clock3 className="h-3.5 w-3.5" />
                {expiryInsight.title}
              </p>
              <p className="mt-1 text-[10px] leading-4 opacity-80">
                {expiryInsight.description}
                {listing.expiresAt
                  ? " · " +
                    text("التاريخ", "Date") +
                    ": " +
                    formatSavedAt(listing.expiresAt, language)
                  : ""}
              </p>
            </div>
          ) : null}
          <div className="text-lg font-bold text-foreground">
            {formatPriceLocalized(
              listing.price ?? 0,
              listing.priceType,
              language,
              listing.currency,
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)} ·{" "}
            {governorateName(
              listing.governorateId,
              listing.governorateNameAr ?? undefined,
              language,
            )}
          </p>
          <OwnerListingPerformance listing={listing} language={language} />
          {listing.status === "rejected" && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/8 p-3">
              <p className="text-[11px] font-bold text-destructive">
                {text("سبب رفض الإعلان", "Listing rejection reason")}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-destructive">
                {listing.rejectionReason ||
                  text(
                    "لم تضف الإدارة ملاحظة تفصيلية. راجع بيانات الإعلان والصور ثم أعد إرساله.",
                    "No detailed admin note was provided. Review the listing data and photos, then resubmit it.",
                  )}
              </p>
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                {text(
                  "عدّل الملاحظات المطلوبة واحفظ التغييرات، ثم استخدم زر إعادة الإرسال للمراجعة.",
                  "Address the requested changes, save them, then use the resubmit-for-review action.",
                )}
              </p>
            </div>
          )}
          {lifecycleError && (
            <p className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
              {lifecycleError}
            </p>
          )}
          {priceDropError && (
            <p className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
              {priceDropError}
            </p>
          )}
          {reservationError && (
            <p className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
              {reservationError}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {listing.status === "approved" ? (
                <Link
                  to="/listings/$id"
                  params={{ id: listing.id }}
                  aria-label={text("عرض الإعلان", "View listing")}
                  title={text("عرض الإعلان", "View listing")}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-muted-surface text-foreground transition hover:bg-secondary hairline"
                >
                  <Eye className="h-4 w-4" />
                </Link>
              ) : null}
              {canEdit ? (
                <Link
                  to="/profile/listings/$id"
                  params={{ id: listing.id }}
                  aria-label={text("تعديل الإعلان", "Edit listing")}
                  title={text("تعديل الإعلان", "Edit listing")}
                  className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary transition hover:bg-primary/15 hairline"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              ) : null}
              <button
                type="button"
                disabled={duplicating}
                onClick={() => void onDuplicate(listing)}
                aria-label={text("نسخ الإعلان كمسودة", "Duplicate listing as draft")}
                title={text("نسخ كمسودة بدون الصور", "Duplicate as a draft without images")}
                className="grid h-10 w-10 place-items-center rounded-xl bg-muted-surface text-foreground transition hover:bg-secondary hairline disabled:opacity-50"
              >
                <Copy className={`h-4 w-4 ${duplicating ? "animate-pulse" : ""}`} />
              </button>
            </div>
            <button
              type="button"
              aria-expanded={managementOpen}
              onClick={() => setManagementOpen((current) => !current)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 text-[10px] font-bold text-foreground hairline"
            >
              {text("إدارة الإعلان", "Manage listing")}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${managementOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {managementOpen ? (
            <div className="space-y-3 rounded-xl bg-muted-surface/55 p-3 hairline">
              {canReducePrice ? (
                <div className="rounded-xl bg-brand-orange/5 p-2.5 hairline">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                    <BadgePercent className="h-3.5 w-3.5 text-brand-orange" />
                    {text("تخفيض السعر", "Reduce price")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      inputMode="decimal"
                      value={priceDropDraft}
                      onChange={(event) => setPriceDropDraft(event.target.value)}
                      disabled={priceDropBusy}
                      aria-label={text("السعر الجديد", "New price")}
                      className="min-h-10 min-w-0 flex-1 rounded-xl bg-card px-3 py-2 text-xs font-bold outline-none hairline disabled:opacity-60"
                    />
                    <button
                      type="button"
                      disabled={priceDropBusy}
                      onClick={() => void handlePriceDrop()}
                      className="min-h-10 rounded-xl bg-brand-orange px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {priceDropBusy ? text("جارٍ الحفظ", "Saving") : text("خفض", "Reduce")}
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                {canManageReservation ? (
                  <button
                    type="button"
                    disabled={reservationBusy}
                    onClick={() => void handleReservationToggle()}
                    className={`min-h-10 rounded-xl px-3 py-2 text-[10px] font-bold disabled:opacity-60 ${listing.reservedAt ? "bg-warning/12 text-warning" : "bg-card text-foreground hairline"}`}
                  >
                    {listing.reservedAt
                      ? text("إلغاء الحجز", "Clear reservation")
                      : text("وضع محجوز", "Mark reserved")}
                  </button>
                ) : null}
                {canClose ? (
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() => void handleAvailabilityConfirm()}
                    className="min-h-10 rounded-xl bg-emerald-trust/10 px-3 py-2 text-[10px] font-bold text-emerald-trust disabled:opacity-60"
                  >
                    {text("تأكيد أنه متوفر", "Confirm availability")}
                  </button>
                ) : null}
              </div>

              {canClose ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <select
                    value={String(expiryOption)}
                    disabled={lifecycleBusy}
                    onChange={(event) => {
                      const value = event.target.value;
                      setExpiryOption(
                        value === "never" ? "never" : (Number(value) as 30 | 60 | 90),
                      );
                    }}
                    aria-label={text("مدة صلاحية الإعلان", "Listing expiry duration")}
                    className="min-h-10 rounded-xl border border-border/70 bg-card px-3 text-[10px] font-bold text-foreground disabled:opacity-60"
                  >
                    <option value="30">{text("30 يوم", "30 days")}</option>
                    <option value="60">{text("60 يوم", "60 days")}</option>
                    <option value="90">{text("90 يوم", "90 days")}</option>
                    <option value="never">{text("بدون انتهاء", "No automatic expiry")}</option>
                  </select>
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() => void handleExpiryUpdate()}
                    className="min-h-10 rounded-xl bg-primary/10 px-3 text-[10px] font-bold text-primary disabled:opacity-60"
                  >
                    {text("تطبيق", "Apply")}
                  </button>
                </div>
              ) : null}

              {canClose ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() =>
                      setPendingLifecycleConfirmation({ action: "close", targetStatus: "sold" })
                    }
                    className="min-h-10 rounded-xl bg-card px-2 text-[10px] font-bold hairline disabled:opacity-60"
                  >
                    {text("تم البيع", "Sold")}
                  </button>
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() =>
                      setPendingLifecycleConfirmation({ action: "close", targetStatus: "rented" })
                    }
                    className="min-h-10 rounded-xl bg-card px-2 text-[10px] font-bold hairline disabled:opacity-60"
                  >
                    {text("تم التأجير", "Rented")}
                  </button>
                  <button
                    type="button"
                    disabled={lifecycleBusy}
                    onClick={() =>
                      setPendingLifecycleConfirmation({
                        action: "close",
                        targetStatus: "unavailable",
                      })
                    }
                    className="min-h-10 rounded-xl bg-warning/10 px-2 text-[10px] font-bold text-warning disabled:opacity-60"
                  >
                    {text("غير متاح", "Unavailable")}
                  </button>
                </div>
              ) : null}

              {canReactivate ? (
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => setPendingLifecycleConfirmation({ action: "reactivate" })}
                  className="min-h-10 w-full rounded-xl bg-primary px-3 text-[10px] font-bold text-primary-foreground disabled:opacity-60"
                >
                  {text("إعادة التفعيل للمراجعة", "Reactivate for review")}
                </button>
              ) : null}

              {canDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError("");
                    setShowDeleteConfirm(true);
                  }}
                  className="inline-flex min-h-10 w-full items-center justify-center gap-1 rounded-xl bg-destructive/10 px-3 text-[10px] font-bold text-destructive transition hover:bg-destructive/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {listing.status === "draft"
                    ? text("حذف المسودة", "Delete draft")
                    : text("حذف الإعلان", "Delete listing")}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>

      {pendingLifecycleConfirmation && lifecycleConfirmationCopy && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${listing.id}-lifecycle-dialog-title`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/45 p-4 backdrop-blur-sm"
        >
          <div className="rawaj-color-card rawaj-world-orange w-full max-w-sm rounded-[1.5rem] p-6">
            <h3
              id={`${listing.id}-lifecycle-dialog-title`}
              className="text-base font-extrabold text-foreground"
            >
              {lifecycleConfirmationCopy.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {lifecycleConfirmationCopy.description}
            </p>
            {lifecycleError && (
              <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                {lifecycleError}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={() => {
                  if (pendingLifecycleConfirmation.action === "reactivate") {
                    void handleReactivate();
                  } else {
                    void handleClose(pendingLifecycleConfirmation.targetStatus);
                  }
                }}
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
              >
                {lifecycleBusy
                  ? text("جارٍ التنفيذ…", "Working…")
                  : lifecycleConfirmationCopy.confirmLabel}
              </button>
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={() => {
                  setPendingLifecycleConfirmation(null);
                  setLifecycleError("");
                }}
                className="flex-1 rounded-xl bg-muted-surface px-4 py-2.5 text-xs font-bold hairline disabled:opacity-60"
              >
                {text("إلغاء", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/45 p-4 backdrop-blur-sm"
        >
          <div
            className="rawaj-color-card rawaj-world-orange w-full max-w-sm rounded-[1.5rem] p-6"
            dir="rtl"
          >
            <h3 id="delete-dialog-title" className="text-base font-extrabold text-foreground">
              {listing.status === "draft" ? "حذف المسودة؟" : "حذف الإعلان؟"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {listing.status === "draft"
                ? "سيتم حذف هذه المسودة نهائيًا. لا يمكن التراجع عن هذا الإجراء."
                : "سيتم حذف هذا الإعلان نهائيًا. لا يمكن التراجع عن هذا الإجراء."}
            </p>
            {deleteError && (
              <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive">
                {deleteError}
              </p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="flex-1 rounded-xl bg-destructive px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60"
              >
                {deleting
                  ? "جارٍ الحذف…"
                  : listing.status === "draft"
                    ? "حذف المسودة"
                    : "حذف الإعلان"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteError("");
                }}
                className="flex-1 rounded-xl bg-muted-surface px-4 py-2.5 text-xs font-bold hairline disabled:opacity-60"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ownerLifecycleConfirmationCopy(
  confirmation: LifecycleConfirmation,
  text: (ar: string, en: string) => string,
): LifecycleConfirmationCopy {
  if (confirmation.action === "reactivate") {
    return {
      title: text("إعادة تفعيل الإعلان؟", "Reactivate this listing?"),
      description: text(
        "سيعود الإعلان إلى حالة قيد المراجعة، ولن يظهر للزوار قبل موافقة الإدارة من جديد.",
        "The listing will return to pending review and will not be public until an admin approves it again.",
      ),
      confirmLabel: text("إعادة الإرسال للمراجعة", "Send for review"),
    };
  }

  switch (confirmation.targetStatus) {
    case "sold":
      return {
        title: text("تأكيد إغلاق الإعلان كمباع؟", "Mark this listing as sold?"),
        description: text(
          "سيختفي الإعلان من النتائج العامة ويُنقل إلى الإعلانات المغلقة. يمكنك إعادة تفعيله لاحقاً وإرساله للمراجعة من جديد.",
          "The listing will leave public results and move to closed listings. You can reactivate and resubmit it later.",
        ),
        confirmLabel: text("نعم، تم البيع", "Yes, mark sold"),
      };
    case "rented":
      return {
        title: text("تأكيد إغلاق الإعلان كمؤجّر؟", "Mark this listing as rented?"),
        description: text(
          "سيختفي الإعلان من النتائج العامة ويُنقل إلى الإعلانات المغلقة. يمكنك إعادة تفعيله لاحقاً وإرساله للمراجعة من جديد.",
          "The listing will leave public results and move to closed listings. You can reactivate and resubmit it later.",
        ),
        confirmLabel: text("نعم، تم التأجير", "Yes, mark rented"),
      };
    case "unavailable":
      return {
        title: text("تأكيد أن الإعلان لم يعد متاحاً؟", "Mark this listing unavailable?"),
        description: text(
          "سيختفي الإعلان من النتائج العامة دون حذفه، ويمكنك إعادة تفعيله لاحقاً بعد مراجعته من الإدارة.",
          "The listing will be hidden from public results without being deleted, and can be reactivated later after review.",
        ),
        confirmLabel: text("تأكيد عدم التوفر", "Confirm unavailable"),
      };
  }
}

function ReviewsSection({ sellerProfile }: { sellerProfile: PublicSellerProfile | null }) {
  const { language, text } = useUiPreferences();
  const reviews = sellerProfile?.reviews ?? [];
  if (reviews.length === 0) {
    return (
      <Panel
        title={text("لا توجد تقييمات معتمدة بعد", "No approved reviews yet")}
        body={text(
          "تظهر هنا التقييمات المعتمدة فقط بعد المراجعة.",
          "Only approved reviews appear here after moderation.",
        )}
      />
    );
  }

  return (
    <section className="rawaj-storefront-owner-reviews grid gap-3">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-2xl bg-card p-4 hairline">
          <div className="flex items-center gap-1 text-gold">
            {Array.from({ length: review.rating }).map((_, index) => (
              <Star key={index} className="h-4 w-4 fill-current" />
            ))}
          </div>
          <p className="mt-2 whitespace-pre-line text-sm leading-7">{review.comment}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {new Date(review.createdAt).toLocaleDateString(language === "ar" ? "ar-SY" : "en-US")}
          </p>
        </article>
      ))}
    </section>
  );
}

function Panel({
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
}

function formatSavedAt(value: string, language: Language) {
  if (!value) return "";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-SY" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
