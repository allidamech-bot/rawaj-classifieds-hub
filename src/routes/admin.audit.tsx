import { createFileRoute } from "@tanstack/react-router";
import { Activity, Filter, ScrollText } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminFetchAuditLogs, type AdminAuditLogEntry } from "@/lib/classifieds-api";
import { marketLocale } from "@/lib/market-locale";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminAuditPage,
});

const PAGE_SIZE = 40;

const actionFilters = [
  { value: "", ar: "كل الإجراءات", en: "All actions" },
  { value: "user.", ar: "إجراءات المستخدمين", en: "User actions" },
  { value: "staff.", ar: "إجراءات الطاقم", en: "Staff actions" },
  { value: "listing.", ar: "إجراءات الإعلانات", en: "Listing actions" },
  { value: "notification.", ar: "إجراءات الإشعارات", en: "Notification actions" },
] as const;

function AdminAuditPage() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const canViewAuditLogs = auth.hasPermission("canViewAuditLogs");
  const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
  const [actionPrefix, setActionPrefix] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const requestIdRef = useRef(0);
  const loadMoreInFlightRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await adminFetchAuditLogs(canViewAuditLogs, {
        limit: PAGE_SIZE,
        offset: 0,
        actionPrefix: actionPrefix || null,
      });
      if (requestId !== requestIdRef.current) return;
      setOffset(0);
      if (!result.ok) {
        setLoadError(result.error.message);
        return;
      }
      setEntries(result.data);
      setHasMore(result.data.length === PAGE_SIZE);
      setHasLoaded(true);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحميل سجل التدقيق.", "Could not load audit log."),
      );
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [actionPrefix, canViewAuditLogs, text]);

  useEffect(() => {
    requestIdRef.current += 1;
    loadMoreInFlightRef.current = false;
    setEntries([]);
    setHasLoaded(false);
    setHasMore(false);
    setLoadError("");
    void loadFirstPage();
    return () => {
      requestIdRef.current += 1;
      loadMoreInFlightRef.current = false;
    };
  }, [loadFirstPage]);

  async function loadMore() {
    if (loadMoreInFlightRef.current || loadingMore || !hasMore) return;
    loadMoreInFlightRef.current = true;
    const requestId = requestIdRef.current;
    const nextOffset = offset + PAGE_SIZE;
    setLoadingMore(true);
    setLoadError("");
    try {
      const result = await adminFetchAuditLogs(canViewAuditLogs, {
        limit: PAGE_SIZE,
        offset: nextOffset,
        actionPrefix: actionPrefix || null,
      });
      if (requestId !== requestIdRef.current) return;
      if (!result.ok) {
        setLoadError(result.error.message);
        return;
      }
      setEntries((current) => {
        const byId = new Map(current.map((entry) => [entry.id, entry]));
        for (const entry of result.data) byId.set(entry.id, entry);
        return [...byId.values()];
      });
      setOffset(nextOffset);
      setHasMore(result.data.length === PAGE_SIZE);
    } catch (caught) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحميل المزيد من السجل.", "Could not load more audit entries."),
      );
    } finally {
      loadMoreInFlightRef.current = false;
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 hairline">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-muted-surface text-primary">
              <ScrollText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold">{text("سجل التدقيق", "Audit log")}</h2>
              <p className="mt-1 text-xs leading-6 text-muted-foreground">
                {text(
                  "سجل حقيقي للإجراءات الإدارية الحساسة التي تم حفظها في قاعدة البيانات.",
                  "A real feed of sensitive administrative actions persisted in the database.",
                )}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold hairline">
            <Activity className="h-4 w-4 text-primary" />
            {new Intl.NumberFormat(marketLocale(language)).format(entries.length)}
          </span>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-xl bg-muted-surface px-3 hairline sm:max-w-sm">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={actionPrefix}
            onChange={(event) => setActionPrefix(event.target.value)}
            className="h-11 w-full bg-transparent text-sm outline-none"
          >
            {actionFilters.map((filter) => (
              <option key={filter.value || "all"} value={filter.value}>
                {language === "ar" ? filter.ar : filter.en}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loadError && hasLoaded ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {loadError}
          <button type="button" onClick={() => void loadFirstPage()} className="ms-2 underline">
            {text("إعادة المحاولة", "Try again")}
          </button>
        </p>
      ) : null}

      {loading && !hasLoaded ? (
        <StatePanel title={text("جارٍ تحميل سجل التدقيق...", "Loading audit log...")} />
      ) : loadError && !hasLoaded ? (
        <StatePanel
          title={text("تعذر تحميل سجل التدقيق", "Could not load audit log")}
          body={loadError}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void loadFirstPage()}
        />
      ) : entries.length === 0 ? (
        <StatePanel
          title={text("لا توجد إجراءات مسجلة لهذا الفلتر", "No recorded actions for this filter")}
        />
      ) : (
        <section className="space-y-3">
          {entries.map((entry) => (
            <AuditEntryCard key={entry.id} entry={entry} />
          ))}
        </section>
      )}

      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          className="w-full rounded-xl bg-muted-surface px-4 py-3 text-xs font-bold disabled:opacity-50 hairline"
        >
          {loadingMore
            ? text("جارٍ تحميل المزيد...", "Loading more...")
            : text("تحميل المزيد", "Load more")}
        </button>
      )}
    </div>
  );
}

function AuditEntryCard({ entry }: { entry: AdminAuditLogEntry }) {
  const { language, text } = useUiPreferences();
  const metadataText = formatMetadata(entry.metadata);

  return (
    <article className="rounded-2xl bg-card p-4 hairline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-extrabold">{entry.action}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {text("الفاعل", "Actor")}: {entry.actorRole ?? "—"} · {entry.actorId ?? "—"}
          </p>
        </div>
        <time className="shrink-0 text-[11px] text-muted-foreground">
          {formatDateTime(entry.createdAt, language)}
        </time>
      </div>

      {(entry.targetTable || entry.targetId) && (
        <p className="mt-3 rounded-lg bg-muted-surface p-2 text-xs leading-5">
          {text("الهدف", "Target")}: {entry.targetTable ?? "—"} · {entry.targetId ?? "—"}
        </p>
      )}

      {metadataText && (
        <details className="mt-3 rounded-lg bg-muted-surface p-3 hairline">
          <summary className="cursor-pointer text-xs font-bold">
            {text("البيانات المرافقة", "Metadata")}
          </summary>
          <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-muted-foreground">
            {metadataText}
          </pre>
        </details>
      )}
    </article>
  );
}

function StatePanel({
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
      {body ? <p className="mt-2 text-xs text-muted-foreground">{body}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function formatMetadata(metadata: Record<string, unknown>) {
  if (Object.keys(metadata).length === 0) return "";
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return "";
  }
}

function formatDateTime(value: string | null, language: "ar" | "en") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(marketLocale(language), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
