import { Flag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  adminFetchSellerReviewReports,
  adminModerateSellerReviewReport,
  type SellerReviewReport,
  type SellerReviewReportReason,
  type SellerReviewReportStatus,
} from "@/lib/classifieds-api";
import type { ClassifiedsError } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

const statusOptions: SellerReviewReportStatus[] = ["new", "under_review", "resolved", "rejected"];

export function SellerReviewReportsAdminPanel({ canManageReports }: { canManageReports: boolean }) {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const accountId = auth.profile?.id ?? null;
  const accountIdRef = useRef(accountId);
  const requestIdRef = useRef(0);
  accountIdRef.current = accountId;
  const [reports, setReports] = useState<SellerReviewReport[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, SellerReviewReportStatus>>({});
  const [loading, setLoading] = useState(canManageReports);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");

  async function loadReports() {
    if (!canManageReports) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const requestId = ++requestIdRef.current;
    const requestAccountId = accountId;
    const result = await adminFetchSellerReviewReports();
    if (requestId !== requestIdRef.current || requestAccountId !== accountIdRef.current) return;
    if (result.ok) {
      setReports(result.data);
      setNotes(
        Object.fromEntries(result.data.map((report) => [report.id, report.adminNote ?? ""])),
      );
      setStatuses(Object.fromEntries(result.data.map((report) => [report.id, report.status])));
    } else {
      setReports([]);
      setError(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    requestIdRef.current += 1;
    setReports([]);
    setNotes({});
    setStatuses({});
    setError(null);
    setMessage("");
    setSavingId(null);
    void loadReports();
    return () => {
      requestIdRef.current += 1;
    };
  }, [accountId, canManageReports]);

  async function moderate(report: SellerReviewReport) {
    const status = statuses[report.id] ?? report.status;
    const requestAccountId = accountId;
    setMessage("");
    setSavingId(report.id);
    const result = await adminModerateSellerReviewReport({
      reportId: report.id,
      status,
      adminNote: notes[report.id] ?? null,
      expectedUpdatedAt: report.updatedAt,
    });
    if (requestAccountId !== accountIdRef.current) return;
    setSavingId(null);

    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }

    setMessage(text("تم تحديث بلاغ التقييم.", "Review report updated."));
    await loadReports();
  }

  if (!canManageReports) return null;

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-card p-4 hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Flag className="h-4 w-4 text-destructive" />
              {text("بلاغات التقييمات", "Review reports")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "راجع البلاغات دون إخفاء التقييم تلقائيا. أي قرار على محتوى التقييم يبقى ضمن مسار مراجعة التقييم نفسه.",
                "Review reports without automatically hiding reviews. Content decisions remain in the review moderation flow.",
              )}
            </p>
          </div>
          <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
            {text("صلاحية البلاغات", "Report permission")}
          </span>
        </div>
        {message ? (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{message}</p>
        ) : null}
      </div>

      {loading ? (
        <AdminReportPanel title={text("جارٍ تحميل بلاغات التقييمات", "Loading review reports")} />
      ) : error ? (
        <AdminReportPanel
          title={text("تعذر تحميل بلاغات التقييمات", "Could not load review reports")}
          body={error.message}
        />
      ) : reports.length === 0 ? (
        <AdminReportPanel
          title={text("لا توجد بلاغات تقييمات", "No review reports")}
          body={text(
            "عند إرسال بلاغات على تقييمات معتمدة ستظهر هنا.",
            "Reports on approved reviews will appear here.",
          )}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {reports.map((report) => (
            <article key={report.id} className="rounded-2xl bg-card p-4 hairline">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-md bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive">
                  {reviewReportReasonLabel(report.reason, language)}
                </span>
                <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold text-muted-foreground">
                  {reviewReportStatusLabel(report.status, language)}
                </span>
              </div>

              <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                <div>
                  <dt className="inline font-bold text-foreground">
                    {text("التقييم:", "Review:")}
                  </dt>{" "}
                  <dd className="inline break-all">
                    {report.reviewId ?? text("مرجع محفوظ", "Preserved reference")}
                  </dd>
                </div>
                <div>
                  <dt className="inline font-bold text-foreground">
                    {text("المبلّغ:", "Reporter:")}
                  </dt>{" "}
                  <dd className="inline break-all">{report.reporterUserId}</dd>
                </div>
                <div>
                  <dt className="inline font-bold text-foreground">
                    {text("صاحب التقييم:", "Review author:")}
                  </dt>{" "}
                  <dd className="inline break-all">{report.reportedReviewerUserId}</dd>
                </div>
              </dl>

              {report.details ? (
                <p className="mt-3 whitespace-pre-line rounded-xl bg-muted-surface p-3 text-xs leading-6">
                  {report.details}
                </p>
              ) : null}

              <label className="mt-3 block">
                <span className="text-[10px] font-bold text-muted-foreground">
                  {text("حالة البلاغ", "Report status")}
                </span>
                <select
                  value={statuses[report.id] ?? report.status}
                  onChange={(event) =>
                    setStatuses((current) => ({
                      ...current,
                      [report.id]: event.target.value as SellerReviewReportStatus,
                    }))
                  }
                  disabled={savingId === report.id}
                  className="mt-1 min-h-11 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline disabled:opacity-60"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {reviewReportStatusLabel(status, language)}
                    </option>
                  ))}
                </select>
              </label>

              <textarea
                value={notes[report.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                }
                maxLength={1000}
                rows={2}
                disabled={savingId === report.id}
                placeholder={text("ملاحظة إدارية", "Admin note")}
                className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline disabled:opacity-60"
              />

              <button
                type="button"
                disabled={savingId === report.id}
                onClick={() => void moderate(report)}
                className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
              >
                {savingId === report.id
                  ? text("جارٍ الحفظ", "Saving")
                  : text("حفظ القرار", "Save decision")}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function reviewReportReasonLabel(reason: SellerReviewReportReason, language: string) {
  const labels: Record<SellerReviewReportReason, [string, string]> = {
    abuse: ["إساءة أو تحرش", "Abuse or harassment"],
    spam: ["محتوى مزعج", "Spam"],
    misleading: ["معلومات مضللة", "Misleading information"],
    personal_data: ["بيانات شخصية", "Personal data"],
    prohibited_content: ["محتوى محظور", "Prohibited content"],
    other: ["سبب آخر", "Other"],
  };
  return labels[reason][language === "ar" ? 0 : 1];
}

function reviewReportStatusLabel(status: SellerReviewReportStatus, language: string) {
  const labels: Record<SellerReviewReportStatus, [string, string]> = {
    new: ["جديد", "New"],
    under_review: ["قيد المراجعة", "Under review"],
    resolved: ["تمت المعالجة", "Resolved"],
    rejected: ["مرفوض", "Rejected"],
  };
  return labels[status][language === "ar" ? 0 : 1];
}

function AdminReportPanel({ title, body }: { title: string; body?: string }) {
  return (
    <div className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs text-muted-foreground">{body}</p> : null}
    </div>
  );
}
