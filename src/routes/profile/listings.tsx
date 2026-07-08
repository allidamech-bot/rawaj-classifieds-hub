import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import {
  closeOwnerListing,
  confirmOwnerListingAvailability,
  deleteOwnerListing,
  fetchCurrentUserListings,
  fetchPublicSellerProfile,
  isOwnerDeletableStatus,
  reactivateOwnerListing,
  type OwnerCloseListingStatus,
} from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  PublicSellerProfile,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { isClosedListingStatus, isReactivatableListingStatus } from "@/lib/listing-lifecycle-ui";
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

function MyListingsPage() {
  const search = Route.useSearch();
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [listings, setListings] = useState<ClassifiedListing[]>([]);
  const [sellerProfile, setSellerProfile] = useState<PublicSellerProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTab>(search.tab ?? "approved");
  const profileId = auth.profile?.id ?? null;

  useEffect(() => {
    if (search.tab) setActiveTab(search.tab);
  }, [search.tab]);

  useEffect(() => {
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
  }, [auth.status, profileId]);

  function handleListingDeleted(listingId: string) {
    setListings((prev) => prev.filter((listing) => listing.id !== listingId));
  }

  function handleListingChanged(nextListing: ClassifiedListing) {
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

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader
          title={text("إعلاناتي / متجري", "My listings / store")}
          to="/profile"
          backMode="history"
        />
        <main className="container-wide mobile-page-bottom pt-4">
          <Panel
            title={text("تسجيل الدخول مطلوب", "Login required")}
            body={text(
              "سجل الدخول لعرض واجهة متجرك والإعلانات المرتبطة بحسابك.",
              "Log in to view your store and listings linked to your account.",
            )}
          />
        </main>
      </>
    );
  }

  const visibleListings = grouped[activeTab === "reviews" ? "approved" : activeTab];
  const displayName =
    auth.profile?.businessName ||
    auth.profile?.displayName ||
    auth.profile?.email ||
    text("متجري", "My store");
  const ratingCount = sellerProfile?.ratingSummary.count ?? 0;
  const ratingAverage = sellerProfile?.ratingSummary.average ?? null;

  return (
    <>
      <PageHeader
        title={text("إعلاناتي / متجري", "My listings / store")}
        to="/profile"
        backMode="history"
      />
      <main className="rawaj-pulse-page container-wide mobile-page-bottom space-y-5 pb-8 pt-3 sm:pt-5">
        <StoreHeader
          displayName={displayName}
          avatarUrl={auth.profile?.avatarUrl}
          coverUrl={auth.profile?.coverUrl}
          bio={auth.profile?.bio}
          location={auth.profile?.cityArea || auth.profile?.governorate}
          approvedCount={grouped.approved.length}
          pendingCount={grouped.pending.length}
          needsEditCount={grouped.needs_edit.length}
          closedCount={grouped.closed.length}
          ratingAverage={ratingAverage}
          ratingCount={ratingCount}
        />

        {latestDraft && (
          <section className="rounded-[1.35rem] border border-gold/25 bg-gold/10 p-4 shadow-soft">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-extrabold text-primary">
                  {text("لديك مسودة محفوظة", "You have a saved draft")}
                </p>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">
                  {latestDraft.title} · {text("آخر حفظ", "Last saved")}{" "}
                  {formatSavedAt(latestDraft.updatedAt, language)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("needs_edit")}
                  className="rounded-xl bg-card px-3 py-2 text-xs font-bold text-foreground hairline"
                >
                  {text("عرض المسودات", "Show drafts")}
                </button>
                <Link
                  to="/profile/listings/$id"
                  params={{ id: latestDraft.id }}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  {text("متابعة المسودة", "Resume draft")}
                </Link>
              </div>
            </div>
          </section>
        )}

        <section className="rawaj-merchant-rail">
          <div className="rawaj-rail-approved">
            <span className="block text-[9px] font-semibold text-muted-foreground">
              {text("نشط", "Live")}
            </span>
            <strong className="mt-1 block text-lg font-bold text-primary">
              {grouped.approved.length}
            </strong>
          </div>
          <div className="rawaj-rail-pending">
            <span className="block text-[9px] font-semibold text-muted-foreground">
              {text("مراجعة", "Review")}
            </span>
            <strong className="mt-1 block text-lg font-bold text-primary">
              {grouped.pending.length}
            </strong>
          </div>
          <div className="rawaj-rail-needs">
            <span className="block text-[9px] font-semibold text-muted-foreground">
              {text("تحتاج تدخل", "Action")}
            </span>
            <strong className="mt-1 block text-lg font-bold text-primary">
              {grouped.needs_edit.length}
            </strong>
          </div>
          <div className="rounded-[1rem] border border-border/70 bg-card/80 p-3">
            <span className="block text-[9px] font-semibold text-muted-foreground">
              {text("مغلقة", "Closed")}
            </span>
            <strong className="mt-1 block text-lg font-bold text-primary">
              {grouped.closed.length}
            </strong>
          </div>
        </section>

        <div className="rawaj-storefront-section flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <TabButton
              active={activeTab === "approved"}
              label={text("الإعلانات المعتمدة", "Approved listings")}
              count={grouped.approved.length}
              onClick={() => setActiveTab("approved")}
            />
            <TabButton
              active={activeTab === "pending"}
              label={text("قيد المراجعة", "Pending review")}
              count={grouped.pending.length}
              onClick={() => setActiveTab("pending")}
            />
            <TabButton
              active={activeTab === "needs_edit"}
              label={text("تحتاج تعديل / مرفوضة", "Needs edit / rejected")}
              count={grouped.needs_edit.length}
              onClick={() => setActiveTab("needs_edit")}
            />
            <TabButton
              active={activeTab === "closed"}
              label={text("مغلقة / منتهية", "Closed / expired")}
              count={grouped.closed.length}
              onClick={() => setActiveTab("closed")}
            />
            <TabButton
              active={activeTab === "reviews"}
              label={text("التقييمات", "Reviews")}
              count={ratingCount}
              onClick={() => setActiveTab("reviews")}
            />
          </div>
          <Link to="/add-listing" className="rawaj-button-primary min-h-11 rounded-[1rem] px-4">
            <Plus className="h-4 w-4" />
            {text("إضافة إعلان", "Post listing")}
          </Link>
        </div>

        {loading ? (
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
      </main>
    </>
  );
}

function StoreHeader({
  displayName,
  avatarUrl,
  coverUrl,
  bio,
  location,
  approvedCount,
  pendingCount,
  needsEditCount,
  closedCount,
  ratingAverage,
  ratingCount,
}: {
  displayName: string;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  approvedCount: number;
  pendingCount: number;
  needsEditCount: number;
  closedCount: number;
  ratingAverage: number | null;
  ratingCount: number;
}) {
  const { text } = useUiPreferences();
  return (
    <section className="rawaj-merchant-stage rounded-[1.7rem] sm:rounded-[2rem]">
      <div className="relative h-44 overflow-hidden bg-primary sm:h-52">
        {coverUrl && (
          <>
            <img
              src={coverUrl}
              alt=""
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-25 blur-md"
            />
            <img
              src={coverUrl}
              alt=""
              decoding="async"
              className="relative z-10 h-full w-full object-contain"
            />
          </>
        )}
      </div>
      <div className="relative z-10 -mt-12 px-5 pb-5 sm:px-7 sm:pb-7">
        <div className="flex flex-wrap items-end gap-3">
          <span className="relative z-20 grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[1.35rem] bg-card-warm text-xl font-bold text-primary ring-4 ring-[#0d243b]">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              displayName.slice(0, 1)
            )}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-xl font-bold text-[#fffaf0]">{displayName}</h1>
            <p className="mt-1 text-xs text-[#fffaf0]/70">
              {location || text("الموقع غير محدد", "Location not set")}
            </p>
          </div>
        </div>
        {bio && <p className="mt-3 max-w-3xl text-xs leading-6 text-muted-foreground">{bio}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-6">
          <Metric label={text("معتمدة", "Approved")} value={String(approvedCount)} />
          <Metric label={text("قيد المراجعة", "Pending")} value={String(pendingCount)} />
          <Metric label={text("تحتاج تعديل", "Needs edit")} value={String(needsEditCount)} />
          <Metric label={text("مغلقة", "Closed")} value={String(closedCount)} />
          <Metric
            label={text("التقييم", "Rating")}
            value={ratingAverage ? `${ratingAverage} / 5` : text("لا يوجد", "None")}
          />
          <Metric label={text("تقييمات معتمدة", "Approved reviews")} value={String(ratingCount)} />
        </div>
      </div>
    </section>
  );
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
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-[11px] font-semibold transition ${
        active
          ? "bg-primary text-primary-foreground shadow-soft"
          : "border border-border/70 bg-card/80 text-muted-foreground hover:border-gold/40 hover:text-primary"
      }`}
    >
      {label} <span className="opacity-75">({count})</span>
    </button>
  );
}

function StoreListingCard({
  listing,
  language,
  userId,
  onDeleted,
  onChanged,
}: {
  listing: ClassifiedListing;
  language: Language;
  userId: string | null;
  onDeleted: (id: string) => void;
  onChanged: (listing: ClassifiedListing) => void;
}) {
  const { text } = useUiPreferences();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState("");

  const canEdit = listing.status === "draft" || listing.status === "rejected";
  const canDelete = isOwnerDeletableStatus(listing.status);
  const canClose = listing.status === "approved";
  const canReactivate = isReactivatableListingStatus(listing.status);

  async function handleConfirmDelete() {
    setDeleteError("");
    setDeleting(true);
    const result = await deleteOwnerListing(userId, listing.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error.message);
      return;
    }
    setShowDeleteConfirm(false);
    onDeleted(listing.id);
  }

  async function handleClose(targetStatus: OwnerCloseListingStatus) {
    if (lifecycleBusy) return;
    setLifecycleError("");
    setLifecycleBusy(true);
    const result = await closeOwnerListing(userId, listing.id, targetStatus);
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error.message);
      return;
    }
    onChanged(result.data);
  }

  async function handleReactivate() {
    if (lifecycleBusy) return;
    setLifecycleError("");
    setLifecycleBusy(true);
    const result = await reactivateOwnerListing(userId, listing.id);
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error.message);
      return;
    }
    onChanged(result.data);
  }

  async function handleConfirmAvailability() {
    if (lifecycleBusy || listing.status !== "approved") return;
    setLifecycleError("");
    setLifecycleBusy(true);
    const result = await confirmOwnerListingAvailability(userId, listing.id);
    setLifecycleBusy(false);
    if (!result.ok) {
      setLifecycleError(result.error.message);
      return;
    }
    onChanged(result.data);
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

  return (
    <>
      <article className="rawaj-product-card group">
        <div className="rawaj-product-media">
          <span className="rawaj-status-ribbon" data-status={listing.status}>
            {listingStatusLabel(listing.status, language)}
          </span>
          {listing.primaryImageUrl ? (
            <img
              src={listing.primaryImageUrl}
              alt={listing.title}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.025]"
            />
          ) : (
            <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
          )}
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
          {listing.expiresAt && (
            <p
              className={`rounded-lg p-2 text-[11px] font-semibold ${
                listing.status === "expired"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-warning/10 text-foreground"
              }`}
            >
              {listing.status === "expired"
                ? text("انتهى الإعلان", "Listing expired")
                : text("موعد انتهاء الإعلان", "Listing expiry")}
              : {formatSavedAt(listing.expiresAt, language)}
            </p>
          )}
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
          {listing.rejectionReason && (
            <p className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
              {listing.rejectionReason}
            </p>
          )}
          {lifecycleError && (
            <p className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
              {lifecycleError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {listing.status === "approved" && (
              <Link
                to="/listings/$id"
                params={{ id: listing.id }}
                className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold transition hover:bg-secondary"
              >
                <Eye className="h-3 w-3" />
                {text("عرض", "View")}
              </Link>
            )}
            {canEdit ? (
              <Link
                to="/profile/listings/$id"
                params={{ id: listing.id }}
                className="inline-flex items-center gap-1 rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold transition hover:bg-secondary"
              >
                <Pencil className="h-3 w-3" />
                {listing.status === "draft"
                  ? text("متابعة المسودة", "Resume draft")
                  : text("تعديل", "Edit")}
              </Link>
            ) : (
              <span className="inline-flex rounded-lg bg-muted-surface px-2 py-1 text-[10px] text-muted-foreground">
                {lockedMessage}
              </span>
            )}
            {canClose && (
              <>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleConfirmAvailability()}
                  className="rounded-lg bg-emerald-trust/10 px-2 py-1 text-[10px] font-bold text-emerald-trust disabled:opacity-60"
                >
                  {lifecycleBusy
                    ? text("جارٍ التحديث", "Updating")
                    : text("تأكيد استمرار التوفر", "Confirm availability")}
                </button>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleClose("sold")}
                  className="rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold disabled:opacity-60"
                >
                  {text("تم البيع", "Mark sold")}
                </button>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleClose("rented")}
                  className="rounded-lg bg-muted-surface px-2 py-1 text-[10px] font-bold disabled:opacity-60"
                >
                  {text("تم التأجير", "Mark rented")}
                </button>
                <button
                  type="button"
                  disabled={lifecycleBusy}
                  onClick={() => void handleClose("unavailable")}
                  className="rounded-lg bg-warning/10 px-2 py-1 text-[10px] font-bold text-warning disabled:opacity-60"
                >
                  {text("غير متاح", "Unavailable")}
                </button>
              </>
            )}
            {canReactivate && (
              <button
                type="button"
                disabled={lifecycleBusy}
                onClick={() => void handleReactivate()}
                className="rounded-lg bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-60"
              >
                {lifecycleBusy
                  ? text("جارٍ الإرسال", "Submitting")
                  : text("إعادة التفعيل للمراجعة", "Reactivate for review")}
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  setDeleteError("");
                  setShowDeleteConfirm(true);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive transition hover:bg-destructive/20"
              >
                <Trash2 className="h-3 w-3" />
                {listing.status === "draft"
                  ? text("حذف المسودة", "Delete draft")
                  : text("حذف", "Delete")}
              </button>
            )}
          </div>
        </div>
      </article>

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
    <section className="grid gap-3">
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/7 p-3">
      <div className="text-[10px] text-[#fffaf0]/60">{label}</div>
      <div className="mt-1 text-sm font-bold text-[#fffaf0]">{value}</div>
    </div>
  );
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
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
