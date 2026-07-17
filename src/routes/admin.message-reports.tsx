import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageSquareWarning } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetchMessageReports, adminModerateMessageReport } from "@/lib/classifieds-api";
import type { ClassifiedsError, MessageReport, MessageReportStatus } from "@/lib/classifieds-types";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/message-reports")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminMessageReportsPage,
});

function AdminMessageReportsPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const canManageReports = auth.hasPermission("canManageReports");
  const accountId = auth.profile?.id ?? null;
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [notice, setNotice] = useState("");
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const loadReports = useCallback(async () => {
    if (!canManageReports) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const requestAccountId = accountId;
    const result = await adminFetchMessageReports();
    if (requestId !== requestIdRef.current || requestAccountId !== accountIdRef.current) return;
    if (result.ok) {
      setReports(result.data);
      setNotes((current) => ({
        ...Object.fromEntries(result.data.map((item) => [item.id, item.adminNote ?? ""])),
        ...Object.fromEntries(
          Object.entries(current).filter(([id]) => result.data.some((item) => item.id === id)),
        ),
      }));
      setHasLoaded(true);
    } else {
      setLoadError(result.error);
    }
    setLoading(false);
  }, [accountId, canManageReports]);

  useEffect(() => {
    requestIdRef.current += 1;
    actionInFlightRef.current.clear();
    setBusyIds(new Set());
    if (!canManageReports) {
      setReports([]);
      setNotes({});
      setLoading(false);
      setHasLoaded(false);
      setLoadError(null);
      return;
    }
    setReports([]);
    setNotes({});
    setLoading(false);
    setHasLoaded(false);
    setLoadError(null);
    void loadReports();
    return () => {
      requestIdRef.current += 1;
      actionInFlightRef.current.clear();
    };
  }, [accountId, canManageReports, loadReports]);

  async function moderate(report: MessageReport, status: MessageReportStatus) {
    if (actionInFlightRef.current.has(report.id)) return;
    setNotice("");
    actionInFlightRef.current.add(report.id);
    setBusyIds((current) => new Set(current).add(report.id));
    try {
      const requestAccountId = accountId;
      const result = await adminModerateMessageReport({
        reportId: report.id,
        status,
        adminNote: notes[report.id] ?? null,
        expectedUpdatedAt: report.updatedAt,
      });
      if (requestAccountId !== accountIdRef.current) return;
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }
      const updatedAt = new Date().toISOString();
      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? { ...item, status, adminNote: notes[report.id] ?? null, updatedAt }
            : item,
        ),
      );
      setNotice(text("تم تحديث بلاغ الرسالة.", "Message report updated."));
      void loadReports();
    } finally {
      actionInFlightRef.current.delete(report.id);
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(report.id);
        return next;
      });
    }
  }

  if (!canManageReports) {
    return (
      <Panel
        title={text("غير مخوّل لإدارة بلاغات الرسائل", "Not authorized to manage message reports")}
        body={text(
          "تتطلب هذه الصفحة صلاحية إدارة البلاغات.",
          "This page requires the report-management permission.",
        )}
      />
    );
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
        {notice ? (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">{notice}</p>
        ) : null}
      </section>

      {loadError && hasLoaded ? (
        <RecoveryNotice
          message={loadError.message}
          busy={loading}
          retryLabel={text("إعادة المحاولة", "Try again")}
          refreshingLabel={text("جارٍ التحديث", "Refreshing")}
          onRetry={() => void loadReports()}
        />
      ) : null}

      {loading && !hasLoaded ? (
        <Panel title={text("جارٍ تحميل بلاغات الرسائل", "Loading message reports")} />
      ) : loadError && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل بلاغات الرسائل", "Could not load message reports")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void loadReports()}
        />
      ) : reports.length === 0 ? (
        <Panel title={text("لا توجد بلاغات رسائل حالياً", "No message reports right now")} />
      ) : (
        <div className="grid gap-3">
          {reports.map((report) => {
            const busy = busyIds.has(report.id);
            return (
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
                    {report.listingId ? (
                      <Link
                        to="/listings/$id"
                        params={{ id: report.listingId }}
                        className="mt-1 inline-flex text-xs font-bold text-primary"
                      >
                        {report.listingTitle ?? report.listingId}
                      </Link>
                    ) : null}
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
                {report.details ? (
                  <p className="mt-2 text-xs text-muted-foreground">{report.details}</p>
                ) : null}
                <textarea
                  value={notes[report.id] ?? ""}
                  disabled={busy}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                  }
                  rows={2}
                  placeholder={text("ملاحظة إدارية", "Admin note")}
                  className="mt-3 w-full rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline disabled:opacity-60"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {(["under_review", "resolved", "rejected"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={busy}
                      aria-busy={busy}
                      onClick={() => void moderate(report, status)}
                      className="rounded-xl bg-card px-3 py-2 text-xs font-bold hairline hover:bg-muted-surface disabled:opacity-60"
                    >
                      {busy ? text("جارٍ التحديث", "Updating") : status}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
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
    <section className="rounded-2xl bg-card p-8 text-center hairline">
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
    </section>
  );
}
