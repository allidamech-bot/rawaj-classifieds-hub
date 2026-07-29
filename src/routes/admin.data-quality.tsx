import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Blocks,
  CheckCircle2,
  DatabaseZap,
  FileWarning,
  Filter,
  ListTree,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Tag,
  UserRoundCog,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchListingDataQualityContext,
  type DataQualityTaxonomyVersion,
  type ListingDataQualityContext,
} from "@/lib/api/listing-data-quality-context";
import {
  fetchListingDataQualityIssues,
  refreshListingDataQualityIssues,
  reviewListingDataQualityIssue,
  type ListingDataQualityDecision,
  type ListingDataQualityIssue,
  type ListingDataQualityIssueType,
  type ListingDataQualityPage,
  type ListingDataQualitySeverity,
  type ListingDataQualityStatus,
} from "@/lib/api/listing-data-quality";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/data-quality")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminDataQualityWorkspace,
});

const PAGE_SIZE = 50;

type FilterValue<T extends string> = "all" | T;

const issueTypeOptions: Array<{
  value: FilterValue<ListingDataQualityIssueType>;
  ar: string;
  en: string;
  icon: typeof ScanSearch;
}> = [
  { value: "all", ar: "كل أنواع الخلل", en: "All issue types", icon: ScanSearch },
  { value: "taxonomy", ar: "التصنيف", en: "Taxonomy", icon: ListTree },
  { value: "required_field", ar: "حقول مطلوبة", en: "Required fields", icon: FileWarning },
  { value: "unexpected_field", ar: "حقول غير متوقعة", en: "Unexpected fields", icon: Blocks },
  { value: "invalid_value", ar: "قيم غير صالحة", en: "Invalid values", icon: AlertTriangle },
  { value: "legacy_payload", ar: "بيانات قديمة", en: "Legacy data", icon: DatabaseZap },
  {
    value: "specialized_reference",
    ar: "مراجع متخصصة",
    en: "Specialized references",
    icon: Tag,
  },
];

function AdminDataQualityWorkspace() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const userId = auth.user?.id ?? null;
  const canModerate = auth.hasPermission("canModerateListings");
  const isOwner = Boolean(auth.profile?.roles.includes("owner"));
  const [context, setContext] = useState<ListingDataQualityContext | null>(null);
  const [page, setPage] = useState<ListingDataQualityPage>({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
    items: [],
  });
  const [status, setStatus] = useState<FilterValue<ListingDataQualityStatus>>("open");
  const [issueType, setIssueType] = useState<FilterValue<ListingDataQualityIssueType>>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [severity, setSeverity] = useState<FilterValue<ListingDataQualitySeverity>>("all");
  const [offset, setOffset] = useState(0);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const requestIdRef = useRef(0);
  const actionInFlightRef = useRef<Set<string>>(new Set());

  const selectedVersion = useMemo(
    () => context?.versions.find((version) => version.id === selectedVersionId) ?? null,
    [context?.versions, selectedVersionId],
  );

  const loadContext = useCallback(async () => {
    const result = await fetchListingDataQualityContext(userId);
    if (!result.ok) {
      setError(result.error.message);
      return null;
    }
    setContext(result.data);
    setSelectedVersionId((current) => current || preferredVersion(result.data.versions)?.id || "");
    return result.data;
  }, [userId]);

  const loadIssues = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    const result = await fetchListingDataQualityIssues(userId, {
      status: status === "all" ? null : status,
      issueType: issueType === "all" ? null : issueType,
      categoryId: categoryId === "all" ? null : categoryId,
      severity: severity === "all" ? null : severity,
      limit: PAGE_SIZE,
      offset,
    });
    if (requestId !== requestIdRef.current) return;
    setLoading(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPage(result.data);
    setHasLoaded(true);
  }, [categoryId, issueType, offset, severity, status, userId]);

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([loadContext(), loadIssues()]);
  }, [loadContext, loadIssues]);

  useEffect(() => {
    requestIdRef.current += 1;
    void refreshWorkspace();
    const inFlight = actionInFlightRef.current;
    return () => {
      requestIdRef.current += 1;
      inFlight.clear();
    };
  }, [refreshWorkspace]);

  useEffect(() => {
    setOffset(0);
  }, [categoryId, issueType, severity, status]);

  async function runScan() {
    if (!isOwner || !selectedVersionId || scanning) return;
    setScanning(true);
    setError("");
    setMessage("");
    try {
      const result = await refreshListingDataQualityIssues(userId, {
        versionId: selectedVersionId,
        limit: 1000,
        offset: 0,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMessage(
        text(
          `تم فحص ${result.data.scannedCount} إعلاناً عبر جميع الأقسام. وُجد ${result.data.openIssueCount} خلل مفتوح، منها ${result.data.blockingIssueCount} حرج.`,
          `Scanned ${result.data.scannedCount} listings across all categories. Found ${result.data.openIssueCount} open issues, including ${result.data.blockingIssueCount} blocking issues.`,
        ),
      );
      await refreshWorkspace();
    } finally {
      setScanning(false);
    }
  }

  async function reviewIssue(issue: ListingDataQualityIssue, decision: ListingDataQualityDecision) {
    const actionKey = issue.id;
    if (actionInFlightRef.current.has(actionKey)) return;
    actionInFlightRef.current.add(actionKey);
    setWorkingId(issue.id);
    setError("");
    setMessage("");
    try {
      const result = await reviewListingDataQualityIssue(userId, {
        issueId: issue.id,
        decision,
        note: notes[issue.id] ?? null,
        expectedUpdatedAt: issue.updatedAt,
      });
      if (!result.ok) {
        setError(result.error.message);
        if (result.error.code === "status_mismatch") await refreshWorkspace();
        return;
      }
      setNotes((current) => ({ ...current, [issue.id]: "" }));
      setMessage(text("تم حفظ قرار الجودة في سجل التدقيق.", "Quality decision saved and audited."));
      await refreshWorkspace();
    } finally {
      actionInFlightRef.current.delete(actionKey);
      setWorkingId((current) => (current === issue.id ? null : current));
    }
  }

  if (!canModerate) {
    return (
      <StatePanel
        icon={ShieldCheck}
        title={text("غير مخوّل لمركز جودة البيانات", "Not authorized for data quality")}
        body={text(
          "هذه الوحدة تحتاج صلاحية مراجعة الإعلانات، بينما تبقى عملية الفحص الشامل للمالك فقط.",
          "This workspace requires listing moderation permission, while full scans remain owner-only.",
        )}
      />
    );
  }

  const pageBlocking = page.items.filter((issue) => issue.severity === "blocking").length;
  const representedCategories = new Set(page.items.map((issue) => issue.categoryId)).size;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-foreground/12">
              <ScanSearch className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold text-primary-foreground/70">
                {text("جودة البيانات لكل السوق", "Marketplace-wide data quality")}
              </p>
              <h2 className="mt-1 text-xl font-extrabold">
                {text("مركز جودة الأقسام والإعلانات", "Category and listing quality center")}
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-primary-foreground/80">
                {text(
                  "يفحص التصنيف والحقول والقيم والبيانات القديمة عبر الأقسام الفعالة كلها. السيارات مسار متخصص واحد داخل النظام، وليست محور الفحص.",
                  "Checks taxonomy, fields, values, and legacy data across every active category. Vehicles are one specialized path inside the system, not the center of the audit.",
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refreshWorkspace()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary-foreground/10 px-3.5 text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {text("تحديث", "Refresh")}
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={AlertTriangle}
          label={text("المشاكل المفتوحة", "Open issues")}
          value={context?.summary.open ?? page.total}
        />
        <MetricCard
          icon={XCircle}
          label={text("مشاكل حرجة", "Blocking issues")}
          value={context?.summary.blocking ?? pageBlocking}
          danger
        />
        <MetricCard
          icon={ListTree}
          label={text("أقسام متأثرة", "Affected categories")}
          value={context?.summary.affectedCategories ?? representedCategories}
        />
        <MetricCard
          icon={FileWarning}
          label={text("إعلانات متأثرة", "Affected listings")}
          value={
            context?.summary.affectedListings ??
            new Set(page.items.map((issue) => issue.listingId)).size
          }
        />
      </section>

      {isOwner ? (
        <section className="rounded-2xl bg-card p-4 hairline">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <label>
              <span className="mb-2 block text-xs font-bold text-muted-foreground">
                {text("نسخة التصنيف المراد فحصها", "Taxonomy version to scan")}
              </span>
              <select
                value={selectedVersionId}
                onChange={(event) => setSelectedVersionId(event.target.value)}
                aria-label={text("نسخة التصنيف المراد فحصها", "Taxonomy version to scan")}
                className="input"
              >
                {context?.versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {text("النسخة", "Version")} {version.versionNumber} —{" "}
                    {versionStatus(version, text)} — {version.activeLeafCount}{" "}
                    {text("ورقة", "leaves")}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void runScan()}
              disabled={scanning || !selectedVersionId}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              <ScanSearch className={`h-4 w-4 ${scanning ? "animate-pulse" : ""}`} />
              {scanning
                ? text("جارٍ فحص كل الأقسام...", "Scanning all categories...")
                : text("فحص كل الأقسام", "Scan all categories")}
            </button>
          </div>
          {selectedVersion ? (
            <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
              {text(
                `تحتوي النسخة على ${selectedVersion.activeLeafCount} ورقة و${selectedVersion.fieldRuleCount} قاعدة حقول. الفحص لا يعدّل أي إعلان تلقائياً.`,
                `This version contains ${selectedVersion.activeLeafCount} leaves and ${selectedVersion.fieldRuleCount} field rules. The scan never edits listings automatically.`,
              )}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl bg-card p-4 hairline">
        <div className="mb-3 flex items-center gap-2">
          <Filter className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-extrabold">{text("تصفية مركز الجودة", "Quality filters")}</h3>
        </div>
        <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {issueTypeOptions.map((option) => {
            const active = issueType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setIssueType(option.value)}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted-surface hairline"}`}
              >
                <option.icon className="h-4 w-4" />
                {language === "en" ? option.en : option.ar}
              </button>
            );
          })}
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
            aria-label={text("تصفية حسب القسم", "Filter by category")}
            className="input"
          >
            <option value="all">{text("كل الأقسام", "All categories")}</option>
            {context?.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {language === "en" ? category.nameEn || category.nameAr : category.nameAr}
                {category.openIssueCount > 0 ? ` (${category.openIssueCount})` : ""}
              </option>
            ))}
          </select>
          <select
            value={severity}
            onChange={(event) =>
              setSeverity(event.target.value as FilterValue<ListingDataQualitySeverity>)
            }
            aria-label={text("تصفية حسب درجة الخطورة", "Filter by severity")}
            className="input"
          >
            <option value="all">{text("كل درجات الخطورة", "All severities")}</option>
            <option value="blocking">{text("حرج", "Blocking")}</option>
            <option value="error">{text("خطأ", "Error")}</option>
            <option value="warning">{text("تحذير", "Warning")}</option>
            <option value="info">{text("معلومة", "Info")}</option>
          </select>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as FilterValue<ListingDataQualityStatus>)
            }
            aria-label={text("تصفية حسب حالة المراجعة", "Filter by review status")}
            className="input"
          >
            <option value="all">{text("كل حالات المراجعة", "All review states")}</option>
            <option value="open">{text("مفتوحة", "Open")}</option>
            <option value="needs_review">{text("تحتاج مراجعة", "Needs review")}</option>
            <option value="seller_action">{text("تحتاج إجراء من البائع", "Seller action")}</option>
            <option value="resolved">{text("محلولة", "Resolved")}</option>
            <option value="dismissed">{text("متجاهلة", "Dismissed")}</option>
          </select>
        </div>
      </section>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {message ? <Notice tone="success">{message}</Notice> : null}

      {loading && !hasLoaded ? (
        <StatePanel
          icon={RefreshCw}
          title={text("جارٍ تحميل نتائج الجودة...", "Loading quality results...")}
        />
      ) : error && !hasLoaded ? (
        <StatePanel
          icon={AlertTriangle}
          title={text("تعذر تحميل مركز الجودة", "Could not load quality center")}
          body={error}
          actionLabel={text("إعادة المحاولة", "Try again")}
          onAction={() => void refreshWorkspace()}
        />
      ) : page.items.length === 0 ? (
        <StatePanel
          icon={CheckCircle2}
          title={text("لا توجد مشاكل مطابقة للفلاتر", "No issues match these filters")}
          body={text(
            "يمكن للمالك تشغيل فحص شامل للنسخة المختارة، أو تغيير القسم ونوع المشكلة.",
            "The owner can run a full scan for the selected version, or change the category and issue filters.",
          )}
        />
      ) : (
        <section className="space-y-3">
          {page.items.map((issue) => (
            <QualityIssueCard
              key={issue.id}
              issue={issue}
              language={language}
              text={text}
              note={notes[issue.id] ?? ""}
              working={workingId === issue.id}
              onNoteChange={(value) => setNotes((current) => ({ ...current, [issue.id]: value }))}
              onDecision={(decision) => void reviewIssue(issue, decision)}
            />
          ))}
        </section>
      )}

      <section className="flex items-center justify-between gap-3 rounded-2xl bg-card p-3 hairline">
        <button
          type="button"
          onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))}
          disabled={offset === 0 || loading}
          className="min-h-10 rounded-xl bg-muted-surface px-3 text-xs font-bold disabled:opacity-40"
        >
          {text("السابق", "Previous")}
        </button>
        <p className="text-[11px] font-bold text-muted-foreground">
          {page.total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, page.total)} /{" "}
          {page.total}
        </p>
        <button
          type="button"
          onClick={() => setOffset((current) => current + PAGE_SIZE)}
          disabled={offset + PAGE_SIZE >= page.total || loading}
          className="min-h-10 rounded-xl bg-muted-surface px-3 text-xs font-bold disabled:opacity-40"
        >
          {text("التالي", "Next")}
        </button>
      </section>
    </div>
  );
}

function QualityIssueCard({
  issue,
  language,
  text,
  note,
  working,
  onNoteChange,
  onDecision,
}: {
  issue: ListingDataQualityIssue;
  language: "ar" | "en";
  text: (ar: string, en: string) => string;
  note: string;
  working: boolean;
  onNoteChange: (value: string) => void;
  onDecision: (decision: ListingDataQualityDecision) => void;
}) {
  const categoryName =
    language === "en" ? issue.categoryNameEn || issue.categoryNameAr : issue.categoryNameAr;
  const taxonomyName =
    language === "en" ? issue.taxonomyNameEn || issue.taxonomyNameAr : issue.taxonomyNameAr;
  const fieldLabel =
    language === "en" ? issue.fieldLabelEn || issue.fieldLabelAr : issue.fieldLabelAr;

  return (
    <article className="rounded-2xl bg-card p-4 hairline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={issue.severity} text={text} />
            <span className="rounded-full bg-muted-surface px-2.5 py-1 text-[10px] font-bold">
              {categoryName || issue.categoryId}
            </span>
            <span className="rounded-full bg-muted-surface px-2.5 py-1 text-[10px] font-bold">
              {issueTypeLabel(issue.issueType, text)}
            </span>
            <span className="rounded-full bg-muted-surface px-2.5 py-1 text-[10px] font-bold">
              V{issue.taxonomyVersionNumber} · {issue.taxonomyVersionStatus}
            </span>
          </div>
          <h3 className="mt-3 text-sm font-extrabold">{issue.listingTitle || issue.listingId}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {issueCodeLabel(issue.issueCode, text)}
          </p>
        </div>
        <Link
          to="/listings/$id"
          params={{ id: issue.listingId }}
          className="inline-flex min-h-10 items-center rounded-xl bg-muted-surface px-3 text-xs font-bold hairline"
        >
          {text("فتح الإعلان", "Open listing")}
        </Link>
      </div>

      <div className="mt-4 grid gap-2 text-[11px] sm:grid-cols-2 lg:grid-cols-4">
        <InfoCell
          label={text("التصنيف النهائي", "Final taxonomy")}
          value={taxonomyName || issue.taxonomyNodeId || "—"}
        />
        <InfoCell label={text("الحقل", "Field")} value={fieldLabel || issue.fieldKey || "—"} />
        <InfoCell
          label={text("حالة الإعلان", "Listing status")}
          value={issue.listingStatus || "—"}
        />
        <InfoCell
          label={text("حالة الجودة", "Quality status")}
          value={statusLabel(issue.status, text)}
        />
      </div>

      {Object.keys(issue.evidence).length > 0 ? (
        <details className="mt-3 rounded-xl bg-muted-surface p-3 text-[11px]">
          <summary className="cursor-pointer font-bold">
            {text("دليل الفحص", "Scan evidence")}
          </summary>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(issue.evidence)
              .slice(0, 12)
              .map(([key, value]) => (
                <div key={key} className="rounded-lg bg-background/70 p-2">
                  <span className="font-bold text-muted-foreground">{key}</span>
                  <p className="mt-1 break-words">{formatEvidence(value)}</p>
                </div>
              ))}
          </div>
        </details>
      ) : null}

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <label>
          <span className="mb-2 block text-[11px] font-bold text-muted-foreground">
            {text("ملاحظة المراجعة", "Review note")}
          </span>
          <input
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            maxLength={2000}
            placeholder={text(
              "سبب القرار أو المطلوب من البائع",
              "Decision reason or seller action",
            )}
            className="input"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            icon={ScanSearch}
            label={text("مراجعة", "Review")}
            disabled={working}
            onClick={() => onDecision("needs_review")}
          />
          <ActionButton
            icon={UserRoundCog}
            label={text("للبائع", "Seller action")}
            disabled={working}
            onClick={() => onDecision("seller_action")}
          />
          {issue.status === "resolved" || issue.status === "dismissed" ? (
            <ActionButton
              icon={RotateCcw}
              label={text("إعادة فتح", "Reopen")}
              disabled={working}
              onClick={() => onDecision("reopen")}
            />
          ) : (
            <>
              <ActionButton
                icon={CheckCircle2}
                label={text("حل", "Resolve")}
                disabled={working}
                onClick={() => onDecision("resolve")}
                positive
              />
              <ActionButton
                icon={XCircle}
                label={text("تجاهل", "Dismiss")}
                disabled={working}
                onClick={() => onDecision("dismiss")}
                danger
              />
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  danger = false,
}: {
  icon: typeof ScanSearch;
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 hairline">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${danger ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <strong className="text-2xl font-extrabold">{value}</strong>
      </div>
      <p className="mt-3 text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function SeverityBadge({
  severity,
  text,
}: {
  severity: ListingDataQualitySeverity;
  text: (ar: string, en: string) => string;
}) {
  const label =
    severity === "blocking"
      ? text("حرج", "Blocking")
      : severity === "error"
        ? text("خطأ", "Error")
        : severity === "warning"
          ? text("تحذير", "Warning")
          : text("معلومة", "Info");
  const className =
    severity === "blocking" || severity === "error"
      ? "bg-destructive/10 text-destructive"
      : severity === "warning"
        ? "bg-warning/15 text-warning-foreground"
        : "bg-primary/10 text-primary";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${className}`}>
      {label}
    </span>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-3">
      <p className="font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 break-words font-semibold">{value}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled,
  onClick,
  positive = false,
  danger = false,
}: {
  icon: typeof ScanSearch;
  label: string;
  disabled: boolean;
  onClick: () => void;
  positive?: boolean;
  danger?: boolean;
}) {
  const tone = positive
    ? "bg-success/12 text-success"
    : danger
      ? "bg-destructive/10 text-destructive"
      : "bg-muted-surface";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold disabled:opacity-40 ${tone}`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StatePanel({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: typeof ScanSearch;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="rounded-2xl bg-card p-6 text-center hairline">
      <Icon className="mx-auto h-7 w-7 text-primary" />
      <h2 className="mt-3 text-base font-extrabold">{title}</h2>
      {body ? (
        <p className="mx-auto mt-2 max-w-2xl text-xs leading-6 text-muted-foreground">{body}</p>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-10 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground"
        >
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function Notice({ tone, children }: { tone: "error" | "success"; children: string }) {
  return (
    <p
      className={`rounded-xl p-3 text-xs font-semibold hairline ${tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}
    >
      {children}
    </p>
  );
}

function preferredVersion(versions: DataQualityTaxonomyVersion[]) {
  return (
    versions.find((version) => version.status === "draft") ??
    versions.find((version) => version.status === "published") ??
    null
  );
}

function versionStatus(
  version: DataQualityTaxonomyVersion,
  text: (ar: string, en: string) => string,
) {
  return version.status === "draft" ? text("مسودة", "Draft") : text("منشورة", "Published");
}

function issueTypeLabel(
  issueType: ListingDataQualityIssueType,
  text: (ar: string, en: string) => string,
) {
  const labels: Record<ListingDataQualityIssueType, string> = {
    taxonomy: text("التصنيف", "Taxonomy"),
    required_field: text("حقل مطلوب", "Required field"),
    unexpected_field: text("حقل غير متوقع", "Unexpected field"),
    invalid_value: text("قيمة غير صالحة", "Invalid value"),
    legacy_payload: text("بيانات قديمة", "Legacy data"),
    specialized_reference: text("مرجع متخصص", "Specialized reference"),
  };
  return labels[issueType];
}

function statusLabel(status: ListingDataQualityStatus, text: (ar: string, en: string) => string) {
  const labels: Record<ListingDataQualityStatus, string> = {
    open: text("مفتوحة", "Open"),
    needs_review: text("تحتاج مراجعة", "Needs review"),
    seller_action: text("إجراء من البائع", "Seller action"),
    dismissed: text("متجاهلة", "Dismissed"),
    resolved: text("محلولة", "Resolved"),
  };
  return labels[status];
}

function issueCodeLabel(code: string, text: (ar: string, en: string) => string) {
  const labels: Record<string, string> = {
    taxonomy_unresolved: text(
      "لم يُحسم التصنيف النهائي للإعلان.",
      "The final listing taxonomy is unresolved.",
    ),
    taxonomy_target_not_active_leaf: text(
      "التصنيف المقترح ليس ورقة فعالة.",
      "The suggested taxonomy is not an active leaf.",
    ),
    taxonomy_category_mismatch: text(
      "التصنيف النهائي لا يطابق القسم الأساسي.",
      "The final taxonomy does not match the root category.",
    ),
    taxonomy_mapping_needs_review: text(
      "اقتراح التصنيف يحتاج مراجعة بشرية.",
      "The taxonomy suggestion needs human review.",
    ),
    required_field_missing: text(
      "حقل إلزامي مفقود لهذا التصنيف.",
      "A required field is missing for this taxonomy.",
    ),
    field_not_allowed_for_leaf: text(
      "حقل محفوظ لا ينتمي إلى هذا التصنيف.",
      "A stored field is not allowed for this taxonomy.",
    ),
    controlled_option_invalid: text(
      "القيمة ليست ضمن الخيارات الرسمية للحقل.",
      "The value is not in the controlled option set.",
    ),
    numeric_value_out_of_range: text(
      "القيمة الرقمية خارج الحدود المسموحة.",
      "The numeric value is outside the allowed range.",
    ),
    text_value_too_long: text(
      "القيمة النصية أطول من الحد المسموح.",
      "The text value exceeds the allowed length.",
    ),
    legacy_details_not_object: text(
      "صيغة البيانات القديمة غير صالحة.",
      "The legacy details payload has an invalid shape.",
    ),
    legacy_details_require_mapping: text(
      "بيانات قديمة تحتاج تحويلًا إلى الحقول المنظمة.",
      "Legacy data needs migration into governed fields.",
    ),
    vehicle_reference_resolution_pending: text(
      "مرجع مركبة متخصص ما زال قيد المراجعة.",
      "A specialized vehicle reference is still under review.",
    ),
  };
  return labels[code] ?? code;
}

function formatEvidence(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return "—";
  }
}
