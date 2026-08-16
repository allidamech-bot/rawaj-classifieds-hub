import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Archive,
  Ban,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  FileWarning,
  Flag,
  ListChecks,
  MessageSquareWarning,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  adminApplyListingModerationAction,
  adminFetchModerationListings,
  type AdminListingModerationAction,
  type AdminModerationListingSummary,
} from "@/lib/classifieds-api";
import type { ListingStatus } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { marketLocale } from "@/lib/market-locale";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/listings")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminListingModerationConsole,
});

const STATUS_FILTERS = [
  "all",
  "pending_review",
  "approved",
  "rejected",
  "archived",
  "expired",
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number];

function AdminListingModerationConsole() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const canModerateListings = auth.hasPermission("canModerateListings");
  const [listings, setListings] = useState<AdminModerationListingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [extendDays, setExtendDays] = useState<Record<string, number>>({});
  const [workingId, setWorkingId] = useState<string | null>(null);
  const loadRequestIdRef = useRef(0);
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const loadListings = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const result = await adminFetchModerationListings(canModerateListings);
      if (requestId !== loadRequestIdRef.current) return;
      if (!result.ok) {
        setLoadError(result.error.message);
        return;
      }
      setListings(result.data);
      setHasLoaded(true);
    } catch (caught) {
      if (requestId !== loadRequestIdRef.current) return;
      setLoadError(
        caught instanceof Error
          ? caught.message
          : text("تعذر تحميل الإعلانات.", "Could not load listings."),
      );
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [canModerateListings, text]);

  useEffect(() => {
    loadRequestIdRef.current += 1;
    setListings([]);
    setHasLoaded(false);
    setLoadError("");
    void loadListings();
    return () => {
      loadRequestIdRef.current += 1;
      actionInFlightRef.current.clear();
    };
  }, [loadListings]);

  const queueSummary = useMemo(
    () => ({
      pending: listings.filter((listing) => listing.status === "pending_review").length,
      approved: listings.filter((listing) => listing.status === "approved").length,
      rejected: listings.filter((listing) => listing.status === "rejected").length,
      expired: listings.filter((listing) => listing.status === "expired").length,
    }),
    [listings],
  );

  const visibleListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return listings.filter((listing) => {
      if (statusFilter !== "all" && listing.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return (
        listing.title.toLowerCase().includes(normalizedQuery) ||
        listing.id.toLowerCase().includes(normalizedQuery) ||
        listing.ownerId.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [listings, query, statusFilter]);

  async function applyAction(
    listing: AdminModerationListingSummary,
    action: AdminListingModerationAction,
  ) {
    const actionKey = listing.id;
    if (actionInFlightRef.current.has(actionKey)) return;
    setActionMessage("");
    const reason = reasons[listing.id]?.trim() ?? "";
    if (reason.length < 3) {
      setActionMessage(
        text(
          "أدخل سبباً واضحاً قبل تنفيذ القرار.",
          "Enter a clear reason before applying the action.",
        ),
      );
      return;
    }

    actionInFlightRef.current.add(actionKey);
    setWorkingId(listing.id);
    try {
      const result = await adminApplyListingModerationAction(canModerateListings, {
        listingId: listing.id,
        action,
        reason,
        expectedUpdatedAt: listing.updatedAt,
        extendDays: action === "extend_expiry" ? (extendDays[listing.id] ?? 30) : null,
      });

      if (!result.ok) {
        setActionMessage(result.error.message);
        if (result.error.code === "stale_review") await loadListings();
        return;
      }

      setActionMessage(
        text(
          "تم تنفيذ القرار وتسجيله في سجل التدقيق.",
          "Action applied and recorded in the audit log.",
        ),
      );
      setReasons((current) => ({ ...current, [listing.id]: "" }));
      await loadListings();
    } catch (caught) {
      setActionMessage(
        caught instanceof Error
          ? caught.message
          : text("تعذر تنفيذ قرار الإعلان.", "Could not apply listing decision."),
      );
    } finally {
      actionInFlightRef.current.delete(actionKey);
      setWorkingId((current) => (current === listing.id ? null : current));
    }
  }

  if (!canModerateListings) {
    return (
      <StatePanel
        title={text(
          "غير مخوّل لاتخاذ قرارات على الإعلانات",
          "Not authorized for listing decisions",
        )}
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-primary-foreground/70">
              {text("عمليات الإعلانات", "Listing operations")}
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {text("وحدة قرارات الإعلانات", "Listing moderation console")}
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-primary-foreground/80">
              {text(
                "قرارات محمية، متزامنة مع أحدث نسخة من الإعلان، ومثبتة بسبب وسجل تدقيق.",
                "Protected decisions pinned to the latest listing version, with a required reason and audit trail.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadListings()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-foreground/10 px-3 py-2 text-xs font-bold disabled:opacity-50 hairline"
          >
            <RefreshCw className="h-4 w-4" />
            {text("تحديث", "Refresh")}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QueueCard
          icon={ListChecks}
          label={text("بانتظار المراجعة", "Pending review")}
          value={queueSummary.pending}
          to="/admin/pending"
        />
        <QueueCard
          icon={CheckCircle2}
          label={text("معتمدة ضمن الوحدة", "Approved in console")}
          value={queueSummary.approved}
          to="/admin/listings"
        />
        {auth.hasPermission("canManageReports") ? (
          <QueueCard
            icon={Flag}
            label={text("بلاغات الإعلانات", "Listing reports")}
            value={null}
            to="/admin/reports"
          />
        ) : (
          <QueueCard
            icon={XCircle}
            label={text("مرفوضة ضمن الوحدة", "Rejected in console")}
            value={queueSummary.rejected}
            to="/admin/listings"
          />
        )}
        {auth.hasPermission("canManageReports") ? (
          <QueueCard
            icon={MessageSquareWarning}
            label={text("بلاغات الرسائل", "Message reports")}
            value={null}
            to="/admin/message-reports"
          />
        ) : (
          <QueueCard
            icon={Clock3}
            label={text("منتهية ضمن الوحدة", "Expired in console")}
            value={queueSummary.expired}
            to="/admin/listings"
          />
        )}
      </section>

      <section className="grid gap-3 rounded-2xl bg-card p-4 hairline sm:grid-cols-[1fr_auto]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={text(
            "ابحث بالعنوان أو ID الإعلان أو المالك",
            "Search title, listing ID, or owner",
          )}
          className="h-11 rounded-xl bg-muted-surface px-3 text-sm outline-none hairline"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          aria-label={text("تصفية الإعلانات حسب الحالة", "Filter listings by status")}
          className="h-11 rounded-xl bg-muted-surface px-3 text-sm outline-none hairline"
        >
          {STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {status === "all" ? text("كل الحالات", "All statuses") : uiLabel(status, language)}
            </option>
          ))}
        </select>
      </section>

      {actionMessage && (
        <p className="rounded-xl bg-muted-surface p-3 text-xs font-semibold hairline">
          {actionMessage}
        </p>
      )}
      {loadError && hasLoaded ? (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {loadError}
          <button type="button" onClick={() => void loadListings()} className="ms-2 underline">
            {text("إعادة المحاولة", "Try again")}
          </button>
        </p>
      ) : null}

      {loading && !hasLoaded ? (
        <StatePanel title={text("جارٍ تحميل الإعلانات...", "Loading listings...")} />
      ) : loadError && !hasLoaded ? (
        <StatePanel
          title={text("تعذر تحميل الإعلانات", "Could not load listings")}
          body={loadError}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void loadListings()}
        />
      ) : visibleListings.length === 0 ? (
        <StatePanel title={text("لا توجد إعلانات مطابقة", "No matching listings")} />
      ) : (
        <section className="space-y-3">
          {visibleListings.map((listing) => (
            <ListingDecisionCard
              key={listing.id}
              listing={listing}
              reason={reasons[listing.id] ?? ""}
              extendDays={extendDays[listing.id] ?? 30}
              working={workingId === listing.id}
              onReasonChange={(value) =>
                setReasons((current) => ({ ...current, [listing.id]: value }))
              }
              onExtendDaysChange={(value) =>
                setExtendDays((current) => ({ ...current, [listing.id]: value }))
              }
              onAction={(action) => void applyAction(listing, action)}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function QueueCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number | null;
  to: string;
}) {
  const { language } = useUiPreferences();
  return (
    <Link
      to={to as "/admin"}
      className="rounded-2xl bg-card p-4 hairline transition hover:-translate-y-0.5 hover:shadow-soft"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        {value !== null ? (
          <strong className="text-xl font-extrabold">
            {new Intl.NumberFormat(marketLocale(language)).format(value)}
          </strong>
        ) : null}
      </div>
      <p className="mt-3 text-xs font-bold">{label}</p>
    </Link>
  );
}

function ListingDecisionCard({
  listing,
  reason,
  extendDays,
  working,
  onReasonChange,
  onExtendDaysChange,
  onAction,
}: {
  listing: AdminModerationListingSummary;
  reason: string;
  extendDays: number;
  working: boolean;
  onReasonChange: (value: string) => void;
  onExtendDaysChange: (value: number) => void;
  onAction: (action: AdminListingModerationAction) => void;
}) {
  const { language, text } = useUiPreferences();
  const actions = allowedActions(listing.status);

  return (
    <article className="rounded-2xl bg-card p-4 hairline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-sm font-extrabold">{listing.title}</h3>
          <p className="mt-1 break-all text-[11px] text-muted-foreground">{listing.id}</p>
          <p className="mt-1 break-all text-[11px] text-muted-foreground">
            {text("المالك", "Owner")}: {listing.ownerId}
          </p>
        </div>
        <span className="rounded-lg bg-muted-surface px-2.5 py-1 text-[11px] font-bold hairline">
          {uiLabel(listing.status, language)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <Meta
          label={text("آخر تحديث", "Updated")}
          value={formatDateTime(listing.updatedAt, language)}
        />
        <Meta
          label={text("نشر", "Published")}
          value={formatDateTime(listing.publishedAt, language)}
        />
        <Meta
          label={text("انتهاء", "Expiry")}
          value={formatDateTime(listing.expiresAt, language)}
        />
        <Meta
          label={text("مراجعة", "Reviewed")}
          value={formatDateTime(listing.reviewedAt, language)}
        />
      </div>

      {listing.rejectionReason && (
        <p className="mt-3 rounded-xl bg-destructive/5 p-3 text-xs leading-6 hairline">
          <strong>{text("آخر سبب مسجل", "Last recorded reason")}:</strong> {listing.rejectionReason}
        </p>
      )}

      <textarea
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        rows={2}
        placeholder={text(
          "سبب القرار إلزامي وسيظهر في سجل التدقيق",
          "Decision reason is required and will be audited",
        )}
        className="mt-3 w-full resize-none rounded-xl bg-muted-surface px-3 py-2 text-xs outline-none hairline"
      />

      {actions.includes("extend_expiry") && (
        <label className="mt-3 flex items-center gap-2 text-xs font-bold">
          {text("أيام التمديد", "Extension days")}
          <input
            type="number"
            min={1}
            max={365}
            value={extendDays}
            onChange={(event) => onExtendDaysChange(Number(event.target.value))}
            className="h-9 w-24 rounded-lg bg-muted-surface px-2 outline-none hairline"
          />
        </label>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action}
            type="button"
            disabled={working}
            onClick={() => onAction(action)}
            className={actionButtonClass(action)}
          >
            {actionIcon(action)}
            {actionLabel(action, text)}
          </button>
        ))}
      </div>
    </article>
  );
}

function allowedActions(status: ListingStatus): AdminListingModerationAction[] {
  if (status === "pending_review") return ["approve", "request_changes", "reject"];
  if (status === "approved") {
    return ["suspend", "unpublish", "archive", "expire_now", "extend_expiry"];
  }
  if (status === "expired") return ["extend_expiry", "archive"];
  if (status === "rejected") return ["archive"];
  return [];
}

function actionLabel(
  action: AdminListingModerationAction,
  text: (ar: string, en: string) => string,
) {
  const labels: Record<AdminListingModerationAction, [string, string]> = {
    approve: ["اعتماد", "Approve"],
    reject: ["رفض", "Reject"],
    request_changes: ["طلب تعديل", "Request changes"],
    suspend: ["إيقاف", "Suspend"],
    unpublish: ["إلغاء نشر", "Unpublish"],
    archive: ["أرشفة", "Archive"],
    expire_now: ["إنهاء الآن", "Expire now"],
    extend_expiry: ["تمديد", "Extend expiry"],
  };
  return text(...labels[action]);
}

function actionIcon(action: AdminListingModerationAction) {
  const className = "h-3.5 w-3.5";
  if (action === "approve") return <CheckCircle2 className={className} />;
  if (action === "reject") return <XCircle className={className} />;
  if (action === "request_changes") return <FileWarning className={className} />;
  if (action === "extend_expiry") return <CalendarPlus className={className} />;
  if (action === "expire_now") return <Clock3 className={className} />;
  if (action === "archive") return <Archive className={className} />;
  return <Ban className={className} />;
}

function actionButtonClass(action: AdminListingModerationAction) {
  const base =
    "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold disabled:opacity-50";
  if (action === "approve") {
    return `${base} bg-emerald-trust text-emerald-trust-foreground`;
  }
  if (action === "reject" || action === "suspend") {
    return `${base} bg-destructive text-destructive-foreground`;
  }
  return `${base} bg-muted-surface text-foreground hairline`;
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-2.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
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

function formatDateTime(value: string | null, language: "ar" | "en") {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(marketLocale(language), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}