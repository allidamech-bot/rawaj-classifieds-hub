import { MessageSquareReply, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  readSellerReviewResponse,
  setSellerReviewResponse,
} from "@/lib/classifieds-api";
import type { SellerReview } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";

export function SellerReviewCard({
  review,
  canManageResponse,
}: {
  review: SellerReview;
  canManageResponse: boolean;
}) {
  const { language, text } = useUiPreferences();
  const initialResponse = readSellerReviewResponse(review);
  const [savedResponse, setSavedResponse] = useState(initialResponse.sellerResponse);
  const [draft, setDraft] = useState(initialResponse.sellerResponse ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function persistResponse(responseText: string) {
    if (saving) return;
    setNotice("");
    setSaving(true);
    const result = await setSellerReviewResponse(review.id, responseText);
    setSaving(false);

    if (!result.ok) {
      setNotice(result.error.message);
      return;
    }

    const response = readSellerReviewResponse(result.data);
    setSavedResponse(response.sellerResponse);
    setDraft(response.sellerResponse ?? "");
    setNotice(
      response.sellerResponse
        ? text("تم حفظ رد البائع.", "Seller response saved.")
        : text("تم حذف رد البائع.", "Seller response removed."),
    );
  }

  function submitResponse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void persistResponse(draft);
  }

  return (
    <article className="rounded-[1rem] bg-white/76 p-3 hairline">
      <div className="text-xs font-bold text-gold">{"★".repeat(review.rating)}</div>
      <p className="mt-1 whitespace-pre-line text-xs leading-6">{review.comment}</p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {new Date(review.createdAt).toLocaleDateString(language === "ar" ? "ar-SY" : "en-US")}
      </p>

      {savedResponse ? (
        <div className="mt-3 rounded-xl border border-primary/12 bg-primary/[0.04] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
            <MessageSquareReply className="h-3.5 w-3.5" />
            {text("رد البائع", "Seller response")}
          </p>
          <p className="mt-1 whitespace-pre-line text-xs leading-6 text-foreground/85">
            {savedResponse}
          </p>
        </div>
      ) : null}

      {canManageResponse ? (
        <form onSubmit={submitResponse} className="mt-3 space-y-2 border-t border-border/70 pt-3">
          <label className="block">
            <span className="text-[10px] font-bold text-muted-foreground">
              {savedResponse
                ? text("تعديل ردك", "Edit your response")
                : text("أضف ردا كبائع", "Add a seller response")}
            </span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={800}
              rows={3}
              disabled={saving}
              placeholder={text(
                "رد باحترام ووضوح على تجربة العميل",
                "Respond clearly and respectfully to the customer experience",
              )}
              className="mt-1 w-full rounded-xl bg-card px-3 py-2 text-xs leading-6 outline-none hairline disabled:opacity-60"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving || (draft.trim().length > 0 && draft.trim().length < 3)}
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              {saving ? text("جارٍ الحفظ", "Saving") : text("حفظ الرد", "Save response")}
            </button>
            {savedResponse ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void persistResponse("")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {text("حذف الرد", "Remove response")}
              </button>
            ) : null}
          </div>
          {notice ? <p className="text-[11px] leading-5 text-muted-foreground">{notice}</p> : null}
        </form>
      ) : null}
    </article>
  );
}
