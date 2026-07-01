import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareWarning } from "lucide-react";
import { useEffect, useState } from "react";
import { adminFetchMessageReports, adminModerateMessageReport } from "@/lib/classifieds-api";
import type { ClassifiedsError, MessageReport, MessageReportStatus } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/message-reports")({
  component: AdminMessageReportsPage,
});

function AdminMessageReportsPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    const result = await adminFetchMessageReports(auth.canAccessAdmin);
    if (result.ok) {
      setReports(result.data);
      setNotes(Object.fromEntries(result.data.map((item) => [item.id, item.adminNote ?? ""])));
    } else {
      setReports([]);
      setError(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [auth.canAccessAdmin]);

  async function moderate(report: MessageReport, status: MessageReportStatus) {
    setNotice("");
    const result = await adminModerateMessageReport(auth.canAccessAdmin, {
      reportId: report.id,
      status,
      adminNote: notes[report.id] ?? null,
    });
    if (result.ok) {
      setNotice(text("تم تحديث بلاغ الرسالة.", "Message report updated."));
      await load();
    } else {
      setNotice(result.error.message);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-4 hairline">
        <h2 className="flex items-center gap-2 text-base font-extrabold">
          <MessageSquareWarning className="h-4 w-4 text-warning" />
          {text("بلاغات الرسائل", "Message reports")}
        </h2>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">
          {text(
            "تعرض هذه الصفحة الرسالة المبلّغ عنها فقط وسياق الإعلان، ولا تفتح تصفحاً عاماً للمحادثات.",
            "This page shows only the reported message and listing context; it does not provide broad chat browsing.",
          )}
        </p>
        {notice && (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{notice}</p>
        )}
      </section>

      {loading ? (
        <Panel title={text("جارٍ تحميل بلاغات الرسائل", "Loading message reports")} />
      ) : error ? (
        <Panel
          title={text("تعذر تحميل بلاغات الرسائل", "Could not load message reports")}
          body={error.message}
        />
      ) : reports.length === 0 ? (
        <Panel title={text("لا توجد بلاغات رسائل حالياً", "No message reports right now")} />
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => (
            <article key={report.id} className="rounded-2xl bg-card p-4 hairline">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-extrabold">{report.reason}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text("المبلّغ:", "Reporter:")}{" "}
                    {report.reporterDisplayName ?? report.reporterUserId}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {text("المبلّغ عنه:", "Reported:")}{" "}
                    {report.reportedDisplayName ?? report.reportedUserId}
                  </p>
                  {report.listingId && (
                    <Link
                      to="/listings/$id"
                      params={{ id: report.listingId }}
                      className="mt-1 inline-flex text-xs font-bold text-primary"
                    >
                      {report.listingTitle ?? report.listingId}
                    </Link>
                  )}
                </div>
                <span className="rounded-md bg-muted-surface px-2 py-1 text-[10px] font-bold hairline">
                  {report.status}
                </span>
              </div>
              <blockquote className="mt-3 rounded-xl bg-muted-surface p-3 text-xs leading-6">
                {formatReportedMessageBody(
                  report.messageBody,
                  text("لا يتوفر نص الرسالة.", "Message body unavailable."),
                )}
              </blockquote>
              {report.details && (
                <p className="mt-2 text-xs text-muted-foreground">{report.details}</p>
              )}
              <textarea
                value={notes[report.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                }
                rows={2}
                placeholder={text("ملاحظة إدارية", "Admin note")}
                className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {(["under_review", "resolved", "rejected"] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => void moderate(report, status)}
                    className="rounded-xl bg-card px-3 py-2 text-xs font-bold hairline hover:bg-muted-surface"
                  >
                    {status}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatReportedMessageBody(body: string | null | undefined, fallback: string) {
  if (!body) return fallback;
  const normalized = body.replace(/\s+/g, " ").trim();
  if (normalized.length <= 500) return normalized;
  return `${normalized.slice(0, 500)}...`;
}

function Panel({ title, body }: { title: string; body?: string }) {
  return (
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body && <p className="mt-1 text-xs text-muted-foreground">{body}</p>}
    </section>
  );
}
