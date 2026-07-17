import { createFileRoute } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetchReports, adminModerateReport } from "@/lib/classifieds-api";
import type { ClassifiedsError, ListingReport, ListingReportStatus } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const canManageReports = auth.hasPermission("canManageReports");
  const accountId = auth.profile?.id ?? null;
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;
  const [reports, setReports] = useState<ListingReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ClassifiedsError | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const loadReports = useCallback(async () => {
    if (!canManageReports) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError(null);
    const requestAccountId = accountId;
    const result = await adminFetchReports();
    if (requestId !== requestIdRef.current || requestAccountId !== accountIdRef.current) return;
    if (result.ok) {
      setReports(result.data);
      setNotes((current) => ({
        ...Object.fromEntries(result.data.map((report) => [report.id, report.adminNote ?? ""])),
        ...Object.fromEntries(
          Object.entries(current).filter(([id]) => result.data.some((report) => report.id === id)),
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

  async function moderate(report: ListingReport, status: ListingReportStatus) {
    if (actionInFlightRef.current.has(report.id)) return;
    setActionMessage("");
    if (!accountId) {
      setActionMessage(
        text("تعذر تحديد حساب المراجع الحالي.", "Could not identify the current reviewer account."),
      );
      return;
    }

    actionInFlightRef.current.add(report.id);
    setBusyIds((current) => new Set(current).add(report.id));
    try {
      const requestAccountId = accountId;
      const result = await adminModerateReport({
        reportId: report.id,
        status,
        adminNote: notes[report.id] ?? null,
        expectedUpdatedAt: report.updatedAt,
      });
      if (requestAccountId !== accountIdRef.current) return;
      if (!result.ok) {
        setActionMessage(result.error.message);
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
      setActionMessage(text("تم تحديث البلاغ.", "Report updated."));
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
        title={text("غير مخوّل لإدارة البلاغات", "Not authorized to manage reports")}
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
        {actionMessage ? (
          <p className="mt-3 rounded-xl bg-muted-surface p-2 text-xs font-semibold">
            {actionMessage}
          </p>
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
        <Panel title={text("جارٍ تحميل البلاغات", "Loading reports")} />
      ) : loadError && !hasLoaded ? (
        <Panel
          title={text("تعذر تحميل البلاغات", "Could not load reports")}
          body={loadError.message}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void loadReports()}
        />
      ) : reports.length === 0 ? (
        <Panel
          title={text("لا توجد بلاغات حالياً", "No reports right now")}
          body={text("عند إرسال بلاغات جديدة ستظهر هنا.", "New reports will appear here.")}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {reports.map((report) => {
            const busy = busyIds.has(report.id);
            return (
              <article key={report.id} className="rounded-2xl bg-card p-4 hairline">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-extrabold">{report.reportType}</h3>
                  <Badge>{uiLabel(report.status, language)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {text("رقم البلاغ:", "Report ID:")} {report.id}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {text("الإعلان:", "Listing:")}{" "}
                  {report.listingTitleSnapshot ??
                    report.listingId ??
                    text("غير متاح", "Unavailable")}{" "}
                  · {text("المبلّغ:", "Reporter:")} {report.reporterId}
                </p>
                <p className="mt-2 text-xs leading-6">{report.reason}</p>
                <textarea
                  value={notes[report.id] ?? ""}
                  disabled={busy}
                  onChange={(event) =>
                    setNotes((current) => ({ ...current, [report.id]: event.target.value }))
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
                    onClick={() => void moderate(report, "under_review")}
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  >
                    {busy ? text("جارٍ التحديث", "Updating") : text("قيد المراجعة", "Under review")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => void moderate(report, "resolved")}
                    className="rounded-xl bg-emerald-trust px-3 py-2 text-xs font-bold text-emerald-trust-foreground disabled:opacity-60"
                  >
                    {busy ? text("جارٍ التحديث", "Updating") : text("تم الحل", "Resolved")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-busy={busy}
                    onClick={() => void moderate(report, "rejected")}
                    className="rounded-xl bg-destructive px-3 py-2 text-xs font-bold text-destructive-foreground disabled:opacity-60"
                  >
                    {busy ? text("جارٍ التحديث", "Updating") : text("رفض البلاغ", "Reject report")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
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
