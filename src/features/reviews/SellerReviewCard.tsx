import { Flag, MessageSquareReply, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  createSellerReviewReport,
  readSellerReviewResponse,
  sellerReviewTraitLabel,
  setSellerReviewResponse,
  type SellerReviewReportReason,
} from "@/lib/classifieds-api";
import type { SellerReview } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const reportReasons: Array<{
  value: SellerReviewReportReason;
  ar: string;
  en: string;
}> = [
  { value: "abuse", ar: "إساءة أو تحرش", en: "Abuse or harassment" },
  { value: "spam", ar: "محتوى مزعج", en: "Spam" },
  { value: "misleading", ar: "معلومات مضللة", en: "Misleading information" },
  { value: "personal_data", ar: "بيانات شخصية", en: "Personal data" },
  { value: "prohibited_content", ar: "محتوى محظور", en: "Prohibited content" },
  { value: "other", ar: "سبب آخر", en: "Other" },
];

export function SellerReviewCard({
  review,
  canManageResponse,
}: {
  review: SellerReview;
  canManageResponse: boolean;
}) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const initialResponse = readSellerReviewResponse(review);
  const [savedResponse, setSavedResponse] = useState(initialResponse.sellerResponse);
  const [draft, setDraft] = useState(initialResponse.sellerResponse ?? "");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<SellerReviewReportReason>("abuse");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSaving, setReportSaving] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  const [reported, setReported] = useState(false);
  const canReport =
    auth.status === "signedIn" &&
    Boolean(auth.profile?.id) &&
    auth.profile?.id !== review.reviewerUserId;

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

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReport || reportSaving || reported) return;

    setReportNotice("");
    setReportSaving(true);
    const result = await createSellerReviewReport(review.id, reportReason, reportDetails);
    setReportSaving(false);

    if (!result.ok) {
      setReportNotice(result.error.message);
      return;
    }

    setReported(true);
    setReportOpen(false);
    setReportDetails("");
    setReportNotice(
      text(
        "تم إرسال البلاغ للمراجعة دون إخفاء التقييم تلقائيا.",
        "Report submitted for review without automatically hiding the review.",
      ),
    );
  }

  return (
    <article className="rounded-[1rem] bg-white/76 p-3 hairline">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-bold text-gold">{"★".repeat(review.rating)}</div>
        {canReport ? (
          <button
            type="button"
            disabled={reported || reportSaving}
            onClick={() => {
              setReportOpen((current) => !current);
              setReportNotice("");
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 py-2 text-[10px] font-bold text-muted-foreground transition hover:bg-destructive/8 hover:text-destructive disabled:opacity-55"
          >
            <Flag className="h-3.5 w-3.5" />
            {reported ? text("تم الإبلاغ", "Reported") : text("إبلاغ", "Report")}
          </button>
        ) : null}
      </div>
      {review.traits.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {review.traits.map((trait) => (
            <span
              key={trait}
              className="rounded-lg bg-primary/[0.06] px-2 py-1 text-[10px] font-bold text-primary"
            >
              {sellerReviewTraitLabel(trait, language)}
            </span>
          ))}
        </div>
      ) : null}
      {review.comment ? (
        <p className="mt-2 whitespace-pre-line text-xs leading-6">{review.comment}</p>
      ) : null}
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

      {reportOpen && canReport && !reported ? (
        <form
          onSubmit={(event) => void submitReport(event)}
          className="mt-3 space-y-2 border-t border-border/70 pt-3"
        >
          <div>
            <p className="text-[10px] font-bold text-foreground">
              {text("لماذا تبلغ عن هذا التقييم؟", "Why are you reporting this review?")}
            </p>
            <select
              value={reportReason}
              onChange={(event) => setReportReason(event.target.value as SellerReviewReportReason)}
              disabled={reportSaving}
              className="mt-2 min-h-11 w-full rounded-xl bg-card px-3 py-2 text-xs outline-none hairline disabled:opacity-60"
            >
              {reportReasons.map((reason) => (
                <option key={reason.value} value={reason.value}>
                  {language === "ar" ? reason.ar : reason.en}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={reportDetails}
            onChange={(event) => setReportDetails(event.target.value)}
            maxLength={1000}
            rows={3}
            disabled={reportSaving}
            placeholder={text("تفاصيل إضافية اختيارية", "Optional additional details")}
            className="w-full rounded-xl bg-card px-3 py-2 text-xs leading-6 outline-none hairline disabled:opacity-60"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={reportSaving}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-50"
            >
              <Flag className="h-4 w-4" />
              {reportSaving
                ? text("جارٍ الإرسال", "Submitting")
                : text("إرسال البلاغ", "Submit report")}
            </button>
            <button
              type="button"
              disabled={reportSaving}
              onClick={() => setReportOpen(false)}
              className="inline-flex min-h-11 items-center rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              {text("إلغاء", "Cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {reportNotice ? (
        <p className="mt-3 rounded-xl bg-muted-surface p-2 text-[11px] leading-5 text-muted-foreground hairline">
          {reportNotice}
        </p>
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
