import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileWarning,
  Flag,
  MessageSquareWarning,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  safetyEscalateCase,
  safetyFetchCases,
  safetyFetchStaff,
  safetySaveCase,
  safetySetCaseStatus,
  type SafetyCaseSeverity,
  type SafetyCaseSource,
  type SafetyCaseStatus,
  type SafetyCaseSummary,
  type SafetyStaffSummary,
} from "@/lib/classifieds-api";
import { SafetyCaseEvidencePanel } from "@/components/admin/SafetyCaseEvidencePanel";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/safety")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSafetyPage,
});

interface CaseFormState {
  id: string | null;
  expectedVersion: number | null;
  sourceType: SafetyCaseSource;
  sourceId: string;
  subjectUserId: string;
  title: string;
  summary: string;
  severity: SafetyCaseSeverity;
  assignedTo: string;
}

const emptyForm: CaseFormState = {
  id: null,
  expectedVersion: null,
  sourceType: "manual",
  sourceId: "",
  subjectUserId: "",
  title: "",
  summary: "",
  severity: "medium",
  assignedTo: "",
};

const statusOptions: SafetyCaseStatus[] = ["open", "investigating", "mitigated", "closed"];
const severityOptions: SafetyCaseSeverity[] = ["low", "medium", "high", "critical"];

function AdminSafetyPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const canManageCases = auth.hasPermission("canManageReports");
  const [cases, setCases] = useState<SafetyCaseSummary[]>([]);
  const [staff, setStaff] = useState<SafetyStaffSummary[]>([]);
  const [form, setForm] = useState<CaseFormState>(emptyForm);
  const [statusFilter, setStatusFilter] = useState<SafetyCaseStatus | "all">("all");
  const [actionReason, setActionReason] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setLoading(true);
    const [caseResult, staffResult] = await Promise.all([
      safetyFetchCases(canManageCases, statusFilter),
      safetyFetchStaff(canManageCases),
    ]);
    setLoading(false);

    if (!caseResult.ok) {
      setError(caseResult.error.message);
      return;
    }
    setCases(caseResult.data);
    if (staffResult.ok) setStaff(staffResult.data);
    setError(staffResult.ok ? "" : staffResult.error.message);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      safetyFetchCases(canManageCases, statusFilter),
      safetyFetchStaff(canManageCases),
    ]).then(([caseResult, staffResult]) => {
      if (cancelled) return;
      setLoading(false);
      if (!caseResult.ok) {
        setError(caseResult.error.message);
        return;
      }
      setCases(caseResult.data);
      if (staffResult.ok) setStaff(staffResult.data);
      else setError(staffResult.error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [canManageCases, statusFilter]);

  const counts = useMemo(
    () => ({
      open: cases.filter((item) => item.status === "open").length,
      investigating: cases.filter((item) => item.status === "investigating").length,
      critical: cases.filter((item) => item.severity === "critical").length,
      escalated: cases.filter((item) => item.escalatedToOwner).length,
    }),
    [cases],
  );

  function resetForm() {
    setForm(emptyForm);
    setActionReason("");
    setResolutionNote("");
    setError("");
  }

  function editCase(item: SafetyCaseSummary) {
    setForm({
      id: item.id,
      expectedVersion: item.version,
      sourceType: item.sourceType,
      sourceId: item.sourceId ?? "",
      subjectUserId: item.subjectUserId ?? "",
      title: item.title,
      summary: item.summary,
      severity: item.severity,
      assignedTo: item.assignedTo ?? "",
    });
    setResolutionNote(item.resolutionNote ?? "");
    setActionReason("");
    setError("");
    setNotice("");
  }

  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");

    const result = await safetySaveCase(canManageCases, {
      id: form.id,
      expectedVersion: form.expectedVersion,
      sourceType: form.sourceType,
      sourceId: form.sourceId,
      subjectUserId: form.subjectUserId,
      title: form.title,
      summary: form.summary,
      severity: form.severity,
      assignedTo: form.assignedTo,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setNotice(
      form.id
        ? text("تم تحديث القضية وتسجيل العملية.", "Case updated and audited.")
        : text("تم إنشاء القضية وتسجيل العملية.", "Case created and audited."),
    );
    resetForm();
    await refresh();
  }

  async function changeStatus(item: SafetyCaseSummary, status: SafetyCaseStatus) {
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");

    const result = await safetySetCaseStatus(canManageCases, {
      id: item.id,
      status,
      expectedVersion: item.version,
      reason: actionReason,
      resolutionNote,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setActionReason("");
    setResolutionNote("");
    setNotice(text("تم تغيير حالة القضية وتسجيل السبب.", "Case status changed and audited."));
    await refresh();
  }

  async function escalate(item: SafetyCaseSummary) {
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");

    const result = await safetyEscalateCase(canManageCases, {
      id: item.id,
      expectedVersion: item.version,
      reason: actionReason,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setActionReason("");
    setNotice(
      text("تم تصعيد القضية إلى المالك وتسجيل السبب.", "Case escalated to owner and audited."),
    );
    await refresh();
  }

  if (!canManageCases) {
    return (
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <ShieldAlert className="mx-auto h-7 w-7 text-warning" />
        <h2 className="mt-3 text-base font-extrabold">
          {text("غير مخوّل لإدارة قضايا السلامة", "Not authorized for safety cases")}
        </h2>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning text-warning-foreground">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold text-primary-foreground/70">
                {text("عمليات السلامة", "Safety operations")}
              </p>
              <h2 className="mt-1 text-xl font-extrabold">
                {text("قضايا سلامة موحّدة", "Unified safety cases")}
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-primary-foreground/80">
                {text(
                  "اربط البلاغات والحسابات بقضية قابلة للتعيين والتحقيق والتصعيد والإغلاق بسجل واضح.",
                  "Link reports and accounts to assignable, investigable, escalatable, auditable cases.",
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {text("تحديث", "Refresh")}
          </button>
        </div>
      </section>

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label={text("مفتوحة", "Open")} value={counts.open} />
        <Metric label={text("قيد التحقيق", "Investigating")} value={counts.investigating} />
        <Metric
          label={text("حرجة", "Critical")}
          value={counts.critical}
          attention={counts.critical > 0}
        />
        <Metric
          label={text("مصعّدة للمالك", "Escalated")}
          value={counts.escalated}
          attention={counts.escalated > 0}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          onSubmit={(event) => void saveCase(event)}
          className="rounded-2xl bg-card p-5 hairline"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">
              {form.id ? text("تعديل القضية", "Edit case") : text("قضية جديدة", "New case")}
            </h3>
            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="rawaj-chip gap-1 px-3 py-2 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                {text("جديدة", "New")}
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label={text("المصدر", "Source")}>
              <select
                value={form.sourceType}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    sourceType: event.target.value as SafetyCaseSource,
                  }))
                }
                className="input"
              >
                <option value="manual">manual</option>
                <option value="listing_report">listing_report</option>
                <option value="message_report">message_report</option>
                <option value="account">account</option>
              </select>
            </Field>
            <Field label={text("الخطورة", "Severity")}>
              <select
                value={form.severity}
                onChange={(event) =>
                  setForm((value) => ({
                    ...value,
                    severity: event.target.value as SafetyCaseSeverity,
                  }))
                }
                className="input"
              >
                {severityOptions.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={text("معرف المصدر", "Source ID")}>
              <input
                value={form.sourceId}
                onChange={(event) =>
                  setForm((value) => ({ ...value, sourceId: event.target.value }))
                }
                className="input"
              />
            </Field>
            <Field label={text("معرف المستخدم محل القضية", "Subject user ID")}>
              <input
                value={form.subjectUserId}
                onChange={(event) =>
                  setForm((value) => ({ ...value, subjectUserId: event.target.value }))
                }
                className="input"
              />
            </Field>
            <Field label={text("العنوان", "Title")} wide>
              <input
                value={form.title}
                onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))}
                required
                className="input"
              />
            </Field>
            <Field label={text("الملخص الداخلي", "Internal summary")} wide>
              <textarea
                value={form.summary}
                onChange={(event) =>
                  setForm((value) => ({ ...value, summary: event.target.value }))
                }
                rows={4}
                className="input min-h-28"
              />
            </Field>
            <Field label={text("المسؤول", "Assignee")} wide>
              <select
                value={form.assignedTo}
                onChange={(event) =>
                  setForm((value) => ({ ...value, assignedTo: event.target.value }))
                }
                className="input"
              >
                <option value="">{text("غير معيّن", "Unassigned")}</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName} · {member.roles.join(", ")}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rawaj-button-primary mt-5 min-h-11 w-full rounded-xl px-4 py-2.5 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {text("حفظ القضية", "Save case")}
          </button>
        </form>

        <section className="rounded-2xl bg-card p-5 hairline">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-extrabold">{text("طابور القضايا", "Case queue")}</h3>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as SafetyCaseStatus | "all")}
              aria-label={text("تصفية القضايا حسب الحالة", "Filter cases by status")}
              className="input max-w-44"
            >
              <option value="all">{text("كل الحالات", "All statuses")}</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              <p className="text-xs text-muted-foreground">
                {text("جارٍ التحميل...", "Loading...")}
              </p>
            ) : cases.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {text("لا توجد قضايا مطابقة.", "No matching cases.")}
              </p>
            ) : (
              cases.map((item) => (
                <CaseCard
                  key={item.id}
                  item={item}
                  staff={staff}
                  onEdit={() => editCase(item)}
                  onStatus={(status) => void changeStatus(item, status)}
                  onEscalate={() => void escalate(item)}
                  saving={saving}
                  text={text}
                />
              ))
            )}
          </div>
        </section>
      </section>

      {form.id && (
        <SafetyCaseEvidencePanel caseId={form.id} canManage={canManageCases} text={text} />
      )}

      <section className="rounded-2xl bg-card p-5 hairline">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={text("سبب تغيير الحالة أو التصعيد", "Status/escalation reason")}>
            <input
              value={actionReason}
              onChange={(event) => setActionReason(event.target.value)}
              className="input"
            />
          </Field>
          <Field label={text("ملاحظة الإغلاق", "Resolution note")}>
            <input
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              className="input"
            />
          </Field>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <QuickLink
          icon={Flag}
          title={text("بلاغات الإعلانات", "Listing reports")}
          to="/admin/reports"
        />
        <QuickLink
          icon={MessageSquareWarning}
          title={text("بلاغات الرسائل", "Message reports")}
          to="/admin/message-reports"
        />
        <QuickLink
          icon={FileWarning}
          title={text("قرارات الإعلانات", "Listing decisions")}
          to="/admin/listings"
        />
      </section>
    </div>
  );
}

function CaseCard({
  item,
  staff,
  onEdit,
  onStatus,
  onEscalate,
  saving,
  text,
}: {
  item: SafetyCaseSummary;
  staff: SafetyStaffSummary[];
  onEdit: () => void;
  onStatus: (status: SafetyCaseStatus) => void;
  onEscalate: () => void;
  saving: boolean;
  text: (ar: string, en: string) => string;
}) {
  const assignee = staff.find((member) => member.id === item.assignedTo);
  return (
    <article className="rounded-2xl bg-muted-surface/55 p-4 hairline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-extrabold">{item.title}</h4>
            {item.escalatedToOwner && (
              <span className="rounded-md bg-warning/15 px-2 py-1 text-[10px] font-bold text-warning-foreground">
                {text("مصعّدة للمالك", "Escalated")}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {item.sourceType} · {item.severity} · {item.status} · v{item.version}
          </p>
          {item.summary && (
            <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {item.summary}
            </p>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">
            {assignee
              ? `${text("المسؤول", "Assignee")}: ${assignee.displayName}`
              : text("غير معيّنة", "Unassigned")}
          </p>
        </div>
        <button type="button" onClick={onEdit} className="rawaj-chip px-3 py-2 text-xs font-bold">
          {text("تعديل", "Edit")}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {statusOptions
          .filter((status) => status !== item.status)
          .map((status) => (
            <button
              key={status}
              type="button"
              disabled={saving}
              onClick={() => onStatus(status)}
              className="rawaj-chip px-3 py-2 text-[11px] font-bold"
            >
              {status}
            </button>
          ))}
        {!item.escalatedToOwner && (
          <button
            type="button"
            disabled={saving}
            onClick={onEscalate}
            className="inline-flex items-center gap-1 rounded-xl bg-warning/15 px-3 py-2 text-[11px] font-bold hairline"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {text("تصعيد للمالك", "Escalate to owner")}
          </button>
        )}
      </div>
    </article>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1.5 block text-[11px] font-bold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Metric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 hairline ${attention ? "bg-warning/10" : "bg-card"}`}>
      <div className="text-2xl font-extrabold">{value.toLocaleString()}</div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function QuickLink({ icon: Icon, title, to }: { icon: typeof Flag; title: string; to: string }) {
  return (
    <Link
      to={to as "/admin"}
      className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm font-bold transition hairline hover:bg-muted-surface"
    >
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </Link>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return (
    <div
      className={`rounded-xl p-3 text-xs font-semibold hairline ${tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}
    >
      {children}
    </div>
  );
}
