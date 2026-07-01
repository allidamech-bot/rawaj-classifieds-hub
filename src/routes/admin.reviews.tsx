import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [reviews, setReviews] = useState<SellerReview[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");

  async function loadReviews() {
    setLoading(true);
    setError(null);
    const result = await adminFetchSellerReviews(auth.canAccessAdmin);
    if (result.ok) {
      setReviews(result.data);
      setNotes(
        Object.fromEntries(result.data.map((review) => [review.id, review.adminNote ?? ""])),
      );
    } else {
      setReviews([]);
      setError(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadReviews();
  }, [auth.canAccessAdmin]);

  async function moderate(review: SellerReview, status: "approved" | "rejected") {
    setMessage("");
    if (!auth.profile?.id) {
      setMessage(text("تعذر تحديد حساب المراجع الحالي.", "Could not identify current reviewer."));
      return;
    }
    const result = await adminModerateSellerReview(auth.canAccessAdmin, {
      reviewId: review.id,
      status,
      reviewerId: auth.profile.id,
      adminNote: notes[review.id] ?? null,
    });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setMessage(
      status === "approved"
        ? text("تم اعتماد التقييم.", "Review approved.")
        : text("تم رفض التقييم.", "Review rejected."),
    );
    await loadReviews();
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
        {message && (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        )}
      </section>

      {loading ? (
        <Panel title={text("جاري تحميل التقييمات", "Loading reviews")} />
      ) : error ? (
        <Panel
          title={text("تعذر تحميل التقييمات", "Could not load reviews")}
          body={error.message}
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
          {reviews.map((review) => (
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
              {review.relatedListingId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {text("الإعلان المرتبط:", "Related listing:")} {review.relatedListingId}
                </p>
              )}
              <p className="mt-3 whitespace-pre-line rounded-xl bg-muted-surface p-3 text-xs leading-6">
                {review.comment}
              </p>
              <textarea
                value={notes[review.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [review.id]: event.target.value }))
                }
                placeholder={text("ملاحظة إدارية", "Admin note")}
                rows={2}
                className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void moderate(review, "approved")}
                  className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                >
                  {text("اعتماد", "Approve")}
                </button>
                <button
                  onClick={() => void moderate(review, "rejected")}
                  className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                >
                  {text("رفض", "Reject")}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
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
