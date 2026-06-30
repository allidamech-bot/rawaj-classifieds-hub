import { createFileRoute } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { adminFetchReports, adminModerateReport } from "@/lib/classifieds-api";
import type { ClassifiedsError, ListingReport, ListingReportStatus } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

function ReportsPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function loadReports() {
    setLoading(true);
    setError(null);
    const result = await adminFetchReports(auth.canAccessOwnerControls);
    if (result.ok) {
      setReports(result.data);
      setNotes(
        Object.fromEntries(result.data.map((report) => [report.id, report.adminNote ?? ""])),
      );
    } else {
      setError(result.error);
      setReports([]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadReports();
  }, [auth.canAccessOwnerControls]);

  async function moderate(report: ListingReport, status: ListingReportStatus) {
    setMessage("");
    if (!auth.profile?.id) {
      setMessage(
        text("تعذر تحديد حساب المراجع الحالي.", "Could not identify the current reviewer account."),
      );
      return;
    }
    const result = await adminModerateReport(auth.canAccessOwnerControls, {
      reportId: report.id,
      status,
      assignedTo: auth.profile.id,
      adminNote: notes[report.id] ?? null,
      resolvedAt: status === "resolved" || status === "rejected" ? new Date().toISOString() : null,
    });
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    setMessage(text("تم تحديث البلاغ.", "Report updated."));
    await loadReports();
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold">
              <Flag className="h-4 w-4 text-destructive" />
              {text("بلاغات الإعلانات", "Listing reports")}
            </h2>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              {text(
                "راجع البلاغات الحقيقية وحدّث الحالة مع ملاحظة إدارية عند الحاجة.",
                "Review real reports and update status with an admin note when needed.",
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
        <Panel title={text("جارٍ تحميل البلاغات", "Loading reports")} />
      ) : error ? (
        <Panel title={text("تعذر تحميل البلاغات", "Could not load reports")} body={error.message} />
      ) : reports.length === 0 ? (
        <Panel
          title={text("لا توجد بلاغات حالياً", "No reports right now")}
          body={text("عند إرسال بلاغات جديدة ستظهر هنا.", "New reports will appear here.")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {reports.map((report) => (
            <article key={report.id} className="rounded-2xl bg-card p-4 hairline">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-extrabold">{report.reportType}</h3>
                <Badge>{uiLabel(report.status, language)}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {text("رقم البلاغ:", "Report ID:")} {report.id}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {text("الإعلان:", "Listing:")} {report.listingId} · {text("المبلّغ:", "Reporter:")}{" "}
                {report.reporterId}
              </p>
              <p className="mt-2 text-xs leading-6">{report.reason}</p>
              <textarea
                value={notes[report.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                }
                placeholder={text("ملاحظة إدارية", "Admin note")}
                rows={2}
                className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void moderate(report, "under_review")}
                  className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
                >
                  {text("قيد المراجعة", "Under review")}
                </button>
                <button
                  onClick={() => void moderate(report, "resolved")}
                  className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground"
                >
                  {text("تم الحل", "Resolved")}
                </button>
                <button
                  onClick={() => void moderate(report, "rejected")}
                  className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground"
                >
                  {text("رفض البلاغ", "Reject report")}
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
