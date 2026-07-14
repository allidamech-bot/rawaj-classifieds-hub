import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { SellerReviewReportsAdminPanel } from "@/features/reviews/SellerReviewReportsAdminPanel";
import { adminFetchSellerReviews, adminModerateSellerReview } from "@/lib/classifieds-api";
import type { ClassifiedsError, SellerReview } from "@/lib/classifieds-types";
import { sellerReviewStatusLabel } from "@/lib/status-labels";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({
    meta: [
      { title: "مراجعة تقييمات البائعين | رواج" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewsModerationPage,
});

function ReviewsModerationPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const canManageReviews = auth.hasPermission("canManageReviews");
  const canManageReports = auth.hasPermission("canManageReports");
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const loadReviews = useCallback(async () => {
    if (!canManageReviews) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const result = await adminFetchSellerReviews(canManageReviews);
    if (requestId !== requestIdRef.current) return;
    if (result.ok) {
      setReviews(result.data);
      setNotes((current) => ({
        ...Object.fromEntries(result.data.map((review) => [review.id, review.adminNote ?? ""])),
        ...Object.fromEntries(
          Object.entries(current).filter(([id]) => result.data.some((review) => review.id === id)),
        ),
      }));
      setHasLoaded(true);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }, [canManageReviews]);

  useEffect(() => {
    requestIdRef.current += 1;
    actionInFlightRef.current.clear();
    setBusyIds(new Set());
    if (!canManageReviews) {
      setReviews([]);
      setNotes({});
      setLoading(false);
      setHasLoaded(false);
      setLoadError(null);
      return;
    }
    setReviews([]);
    setNotes({});
    setLoading(false);
    setHasLoaded(false);
    setLoadError(null);
    void loadReviews();
    return () => {
      requestIdRef.current += 1;
      actionInFlightRef.current.clear();
    };
  }, [canManageReviews, loadReviews]);

  async function moderate(review: SellerReview, status: "approved" | "rejected") {
    if (actionInFlightRef.current.has(review.id)) return;
    setMessage("");
    if (!auth.profile?.id) {
      setMessage(text("تعذر تحديد حساب المراجع الحالي.", "Could not identify current reviewer."));
      return;
    }

    actionInFlightRef.current.add(review.id);
    setBusyIds((current) => new Set(current).add(review.id));
    try {
      const result = await adminModerateSellerReview(canManageReviews, {
        reviewId: review.id,
        status,
        reviewerId: auth.profile.id,
        adminNote: notes[review.id] ?? null,
        expectedUpdatedAt: review.updatedAt,
      });
      if (!result.ok) {
        setMessage(result.error.message);
        return;
      }
      setReviews((current) => current.filter((item) => item.id !== review.id));
      setNotes((current) => {
        const next = { ...current };
        delete next[review.id];
        return next;
      });
      setMessage(
        status === "approved"
          ? text("تم اعتماد التقييم.", "Review approved.")
          : text("تم رفض التقييم.", "Review rejected."),
      );
    } finally {
      actionInFlightRef.current.delete(review.id);
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(review.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Star className="h-4 w-4 text-gold" />
              {text("مراجعة تقييمات البائعين", "Seller review moderation")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "تظهر هنا التقييمات الجديدة قبل نشرها على ملفات المعلنين العامة.",
                "New reviews appear here before they are published on public seller profiles.",
              )}
            </p>
          </div>
          <Badge>{text("محمي بالصلاحيات", "Permission protected")}</Badge>
        </div>
        {message ? (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        ) : null}
      </section>

      {!canManageReviews ? (
        <Panel
          title={text("غير مخوّل لمراجعة التقييمات", "Not authorized to moderate reviews")}
          body={text(
            "يبقى قسم بلاغات التقييمات متاحًا بشكل مستقل حسب صلاحية البلاغات.",
            "The review-report section remains independently available according to report permissions.",
          )}
        />
      ) : (
        <>
          {loadError && hasLoaded ? (
            <RecoveryNotice
              message={loadError.message}
              busy={loading}
              retryLabel={text("إعادة المحاولة", "Try again")}
              refreshingLabel={text("جارٍ التحديث", "Refreshing")}
              onRetry={() => void loadReviews()}
            />
          ) : null}

          {loading && !hasLoaded ? (
            <Panel title={text("جاري تحميل التقييمات", "Loading reviews")} />
          ) : loadError && !hasLoaded ? (
            <Panel
              title={text("تعذر تحميل التقييمات", "Could not load reviews")}
              body={loadError.message}
              actionLabel={text("إعادة المحاولة", "Try again")}
              onAction={() => void loadReviews()}
            />
          ) : reviews.length === 0 ? (
            <Panel
              title={text("لا توجد تقييمات بانتظار المراجعة", "No reviews awaiting moderation")}
              body={text(
                "عند وصول تقييمات جديدة ستظهر هنا.",
                "New submitted reviews will appear here.",
              )}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {reviews.map((review) => {
                const busy = busyIds.has(review.id);
                return (
                  <article key={review.id} className="rounded-2xl bg-card p-4 hairline">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-extrabold">{"★".repeat(review.rating)}</h3>
                      <Badge>{sellerReviewStatusLabel(review.status, language)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text("البائع:", "Seller:")} {review.sellerUserId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text("المراجع:", "Reviewer:")} {review.reviewerUserId}
                    </p>
                    {review.relatedListingId ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {text("الإعلان المرتبط:", "Related listing:")} {review.relatedListingId}
                      </p>
                    ) : null}
                    <p className="mt-3 whitespace-pre-line rounded-xl bg-muted-surface p-3 text-xs leading-6">
                      {review.comment}
                    </p>
                    <textarea
                      value={notes[review.id] ?? ""}
                      disabled={busy}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [review.id]: event.target.value }))
                      }
                      placeholder={text("ملاحظة إدارية", "Admin note")}
                      rows={2}
                      className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline disabled:opacity-60"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        aria-busy={busy}
                        onClick={() => void moderate(review, "approved")}
                        className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground disabled:opacity-60"
                      >
                        {busy ? text("جارٍ التحديث", "Updating") : text("اعتماد", "Approve")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        aria-busy={busy}
                        onClick={() => void moderate(review, "rejected")}
                        className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
                      >
                        {busy ? text("جارٍ التحديث", "Updating") : text("رفض", "Reject")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <SellerReviewReportsAdminPanel canManageReports={canManageReports} />
    </div>
  );
}

function RecoveryNotice({
  message,
  busy,
  retryLabel,
  refreshingLabel,
  onRetry,
}: {
  message: string;
  busy: boolean;
  retryLabel: string;
  refreshingLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
      <p>{message}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onRetry}
        className="mt-2 rounded-lg bg-card px-3 py-1.5 text-foreground hairline disabled:opacity-60"
      >
        {busy ? refreshingLabel : retryLabel}
      </button>
    </div>
  );
}

function Panel({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-muted-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
      {children}
    </span>
  );
}
