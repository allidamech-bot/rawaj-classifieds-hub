import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { PlaceholderArt } from "@/components/PlaceholderArt";
import { deleteOwnerListing, fetchCurrentUserListings, fetchPublicSellerProfile, isOwnerDeletableStatus, OWNER_DELETABLE_STATUSES } from "@/lib/classifieds-api";
import type {
  ClassifiedListing,
  ClassifiedsError,
  PublicSellerProfile,
} from "@/lib/classifieds-types";
import { categoryName, formatPriceLocalized, governorateName } from "@/lib/i18n";
import { listingStatusLabel } from "@/lib/status-labels";
import { useUiPreferences, type Language } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/profile/listings")({
  validateSearch: z.object({
    tab: z.enum(["approved", "pending", "needs_edit", "reviews"]).optional(),
  }),
  head: () => ({
    meta: [{ title: "إعلاناتي | رواج" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: MyListingsPage,
});

type StoreTab = "approved" | "pending" | "needs_edit" | "reviews";

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

  const grouped = useMemo(
    () => ({
      approved: listings.filter((listing) => listing.status === "approved"),
      pending: listings.filter((listing) => listing.status === "pending_review"),
      needs_edit: listings.filter(
        (listing) => listing.status === "draft" || listing.status === "rejected",
      ),
    }),
    [listings],
  );

  if (auth.status !== "signedIn") {
    return (
      <>
        <PageHeader title={text("إعلاناتي / متجري", "My listings / store")} to="/profile" backMode="history" />
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
      <PageHeader title={text("إعلاناتي / متجري", "My listings / store")} to="/profile" backMode="history" />
      <main className="container-wide mobile-page-bottom space-y-5 pt-4">
        <StoreHeader
          displayName={displayName}
          avatarUrl={auth.profile?.avatarUrl}
          coverUrl={auth.profile?.coverUrl}
          bio={auth.profile?.bio}
          location={auth.profile?.cityArea || auth.profile?.governorate}
          approvedCount={grouped.approved.length}
          pendingCount={grouped.pending.length}
          needsEditCount={grouped.needs_edit.length}
          ratingAverage={ratingAverage}
          ratingCount={ratingCount}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
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
              active={activeTab === "reviews"}
              label={text("التقييمات", "Reviews")}
              count={ratingCount}
              onClick={() => setActiveTab("reviews")}
            />
          </div>
          <Link
            to="/add-listing"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
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
              "Listings appear here according to their current review status.",
            )}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleListings.map((listing) => (
              <StoreListingCard
                key={listing.id}
                listing={listing}
                language={language}
                userId={profileId}
                onDeleted={handleListingDeleted}
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
  ratingAverage: number | null;
  ratingCount: number;
}) {
  const { text } = useUiPreferences();
  return (
    <section className="overflow-hidden rounded-2xl bg-card hairline shadow-soft">
      <div className="relative aspect-[16/5] min-h-32 bg-primary">
        {coverUrl && (
          <>
            <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover opacity-25 blur-md"
            />
            <img
              src={coverUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="relative z-10 h-full w-full object-contain"
            />
          </>
        )}
      </div>
      <div className="-mt-10 px-4 pb-4">
        <div className="flex flex-wrap items-end gap-3">
          <span className="relative z-20 grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-muted-surface text-xl font-extrabold text-primary ring-4 ring-card">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              displayName.slice(0, 1)
            )}
          </span>
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-lg font-extrabold">{displayName}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {location || text("الموقع غير محدد", "Location not set")}
            </p>
          </div>
        </div>
        {bio && <p className="mt-3 max-w-3xl text-xs leading-6 text-muted-foreground">{bio}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Metric label={text("معتمدة", "Approved")} value={String(approvedCount)} />
          <Metric label={text("قيد المراجعة", "Pending")} value={String(pendingCount)} />
          <Metric label={text("تحتاج تعديل", "Needs edit")} value={String(needsEditCount)} />
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
      className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition hairline ${
        active ? "bg-primary text-primary-foreground" : "bg-card hover:bg-muted-surface"
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
}: {
  listing: ClassifiedListing;
  language: Language;
  userId: string | null;
  onDeleted: (id: string) => void;
}) {
  const { text } = useUiPreferences();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canEdit =
    listing.status === "draft" ||
    listing.status === "pending_review" ||
    listing.status === "rejected";

  // Derive canDelete from the canonical API type-safe predicate to avoid UI/API drift.
  const canDelete = isOwnerDeletableStatus(listing.status);

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

  return (
    <>
      <article className="overflow-hidden rounded-2xl bg-card shadow-soft hairline">
        {listing.primaryImageUrl ? (
          <img
            src={listing.primaryImageUrl}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover"
          />
        ) : (
          <PlaceholderArt type={listing.categoryPlaceholder ?? "misc"} aspect="wide" />
        )}
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 text-sm font-extrabold">{listing.title}</h2>
            <span className="shrink-0 rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold">
              {listingStatusLabel(listing.status, language)}
            </span>
          </div>
          <div className="text-base font-extrabold">
            {formatPriceLocalized(listing.price ?? 0, listing.priceType, language, listing.currency)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {categoryName(listing.categoryId, listing.categoryNameAr ?? undefined, language)} ·{" "}
            {governorateName(listing.governorateId, listing.governorateNameAr ?? undefined, language)}
          </p>
          {listing.rejectionReason && (
            <p className="rounded-lg bg-destructive/10 p-2 text-[11px] text-destructive">
              {listing.rejectionReason}
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
                {text("تعديل", "Edit")}
              </Link>
            ) : (
              <span className="inline-flex rounded-lg bg-muted-surface px-2 py-1 text-[10px] text-muted-foreground">
                {text(
                  "الإعلان المعتمد ظاهر للزوار ولا يعدل من هنا.",
                  "Approved listings are public and are not edited here.",
                )}
              </span>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => { setDeleteError(""); setShowDeleteConfirm(true); }}
                className="inline-flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive transition hover:bg-destructive/20"
              >
                <Trash2 className="h-3 w-3" />
                {text("حذف", "Delete")}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-card p-6 shadow-premium hairline" dir="rtl">
            <h3 id="delete-dialog-title" className="text-base font-extrabold text-foreground">
              حذف الإعلان؟
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              سيتم حذف هذا الإعلان نهائيًا. لا يمكن التراجع عن هذا الإجراء.
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
                {deleting ? "جارٍ الحذف…" : "حذف الإعلان"}
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setShowDeleteConfirm(false); setDeleteError(""); }}
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
    <div className="rounded-xl bg-muted-surface p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-extrabold">{value}</div>
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
