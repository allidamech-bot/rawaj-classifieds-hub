import {
  CheckCircle2,
  CircleAlert,
  Inbox,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Save,
  Settings2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  adminFetchFeedback,
  adminUpdateFeedback,
  ownerFetchFeedbackConfig,
  ownerSetFeedbackConfig,
  type FeedbackItem,
  type FeedbackPriority,
  type FeedbackStatus,
  type FeedbackType,
} from "@/lib/api/feedback";
import { useUiPreferences } from "@/lib/ui-preferences";

const statusOrder: Array<FeedbackStatus | "all"> = [
  "all",
  "new",
  "under_review",
  "resolved",
  "closed",
];

export function FeedbackAdminPanel({ canManage }: { canManage: boolean }) {
  const { text } = useUiPreferences();
  const [enabled, setEnabled] = useState(false);
  const [version, setVersion] = useState(1);
  const [configReason, setConfigReason] = useState("");
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [configBusy, setConfigBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoading(true);
    setError("");
    const [configResult, feedbackResult] = await Promise.all([
      ownerFetchFeedbackConfig(canManage),
      adminFetchFeedback(filter),
    ]);
    if (configResult.ok) {
      setEnabled(configResult.data.enabled);
      setVersion(configResult.data.version);
    } else {
      setError(configResult.error.message);
    }
    if (feedbackResult.ok) {
      setItems(feedbackResult.data);
    } else {
      setError((current) => current || feedbackResult.error.message);
    }
    setLoading(false);
  }, [canManage, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const newCount = useMemo(() => items.filter((item) => item.status === "new").length, [items]);

  async function toggleFeature() {
    if (configBusy) return;
    const reason = configReason.trim();
    if (reason.length < 3) {
      setError(text("اكتب سبباً واضحاً قبل تغيير حالة الميزة.", "Enter a clear reason before changing the feature state."));
      return;
    }
    setConfigBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await ownerSetFeedbackConfig(canManage, {
        enabled: !enabled,
        reason,
        expectedVersion: version,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setEnabled(result.data.enabled);
      if (typeof result.data.version === "number") setVersion(result.data.version);
      setConfigReason("");
      setNotice(
        result.data.enabled
          ? text("تم تفعيل استقبال الاقتراحات والشكاوى.", "Feedback submissions are now enabled.")
          : text("تم إيقاف استقبال الاقتراحات والشكاوى.", "Feedback submissions are now disabled."),
      );
      window.dispatchEvent(new Event("rawaj:feedback-config-changed"));
    } finally {
      setConfigBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl bg-card p-4 hairline sm:p-5" aria-labelledby="feedback-admin-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <MessageSquare className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold text-primary">{text("صوت المستخدمين", "User voice")}</p>
            <h2 id="feedback-admin-title" className="mt-1 text-lg font-extrabold">
              {text("الاقتراحات والشكاوى", "Suggestions and complaints")}
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              {text(
                "فعّل الخانة العامة عند الحاجة، وراجع المشاكل التي يرسلها المستخدمون مع معلومات الصفحة والجهاز المساعدة للتشخيص.",
                "Enable the global feedback entry point when needed and triage user reports with page and device diagnostics.",
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-muted-surface px-3 py-2 text-xs font-bold"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {text("تحديث", "Refresh")}
        </button>
      </div>

      <div className={`rounded-2xl p-4 hairline ${enabled ? "bg-success/10" : "bg-muted-surface"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Settings2 className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-extrabold">{text("استقبال الاقتراحات والشكاوى", "Accept suggestions and complaints")}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {enabled
                  ? text("الخانة ظاهرة الآن للمستخدمين في الموقع.", "The feedback entry point is currently visible to users.")
                  : text("الخانة مخفية، ولا يمكن إرسال طلبات جديدة.", "The entry point is hidden and new submissions are disabled.")}
              </p>
            </div>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${enabled ? "bg-success text-success-foreground" : "bg-background text-muted-foreground"}`}>
            {enabled ? text("مفعّل", "Enabled") : text("متوقف", "Off")}
          </span>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
          <input
            value={configReason}
            onChange={(event) => setConfigReason(event.target.value.slice(0, 1000))}
            className="input"
            placeholder={text("سبب التفعيل أو الإيقاف", "Reason for enabling or disabling")}
          />
          <button
            type="button"
            onClick={() => void toggleFeature()}
            disabled={configBusy}
            className={`min-h-11 rounded-xl px-4 py-2 text-xs font-extrabold ${enabled ? "bg-muted-surface text-foreground" : "bg-primary text-primary-foreground"} disabled:opacity-50`}
          >
            {configBusy
              ? text("جارٍ الحفظ...", "Saving...")
              : enabled
                ? text("إيقاف الميزة", "Disable feature")
                : text("تفعيل الميزة", "Enable feature")}
          </button>
        </div>
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-extrabold">{text("صندوق الملاحظات", "Feedback inbox")}</h3>
          {newCount > 0 ? (
            <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-extrabold text-destructive-foreground">
              {newCount} {text("جديد", "new")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={text("تصفية الملاحظات", "Filter feedback")}>
          {statusOrder.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(status)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === status ? "bg-primary text-primary-foreground" : "bg-muted-surface text-muted-foreground"}`}
            >
              {statusLabel(status, text)}
            </button>
          ))}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">{text("جارٍ تحميل الملاحظات...", "Loading feedback...")}</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-muted-surface p-6 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-success" />
          <p className="mt-2 text-sm font-extrabold">{text("ما في ملاحظات ضمن هذا التصنيف", "No feedback in this filter")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <FeedbackCard
              key={`${item.id}:${item.updatedAt}`}
              item={item}
              onUpdated={(next) =>
                setItems((current) =>
                  filter !== "all" && next.status !== filter
                    ? current.filter((entry) => entry.id !== next.id)
                    : current.map((entry) => (entry.id === next.id ? next : entry)),
                )
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FeedbackCard({ item, onUpdated }: { item: FeedbackItem; onUpdated: (item: FeedbackItem) => void }) {
  const { text } = useUiPreferences();
  const [status, setStatus] = useState<FeedbackStatus>(item.status);
  const [priority, setPriority] = useState<FeedbackPriority>(item.priority);
  const [adminNote, setAdminNote] = useState(item.adminNote ?? "");
  const [publicResponse, setPublicResponse] = useState(item.publicResponse ?? "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const Icon = feedbackTypeIcon(item.type);
  const context = item.context ?? {};

  async function save() {
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      const result = await adminUpdateFeedback({
        id: item.id,
        status,
        priority,
        adminNote: adminNote.trim() || null,
        publicResponse: publicResponse.trim() || null,
        expectedUpdatedAt: item.updatedAt,
      });
      if (!result.ok) {
        setNotice(result.error.message);
        return;
      }
      onUpdated(result.data);
      setNotice(text("تم حفظ معالجة الملاحظة.", "Feedback update saved."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl bg-background p-4 hairline">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-muted-surface px-2 py-1 text-[10px] font-bold">
                {feedbackTypeLabel(item.type, text)}
              </span>
              <span className="text-[10px] text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
            </div>
            <h4 className="mt-2 break-words text-sm font-extrabold">{item.subject}</h4>
            <p className="mt-1 break-words whitespace-pre-wrap text-xs leading-6 text-foreground/85">{item.message}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl bg-muted-surface p-3 text-[11px] text-muted-foreground sm:grid-cols-2">
        <span>{text("المستخدم", "User")}: {item.email || item.userId || text("غير متاح", "Unavailable")}</span>
        <span>{text("الصفحة", "Page")}: <code dir="ltr">{String(context.path || "-")}</code></span>
        <span>{text("الشاشة", "Viewport")}: {context.viewportWidth && context.viewportHeight ? `${context.viewportWidth}×${context.viewportHeight}` : "-"}</span>
        <span>{text("اللغة", "Language")}: {String(context.language || "-")}</span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-[11px] font-bold">{text("الحالة", "Status")}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as FeedbackStatus)} className="input">
            <option value="new">{statusLabel("new", text)}</option>
            <option value="under_review">{statusLabel("under_review", text)}</option>
            <option value="resolved">{statusLabel("resolved", text)}</option>
            <option value="closed">{statusLabel("closed", text)}</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-bold">{text("الأولوية", "Priority")}</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as FeedbackPriority)} className="input">
            <option value="low">{text("منخفضة", "Low")}</option>
            <option value="normal">{text("عادية", "Normal")}</option>
            <option value="high">{text("مهمة", "High")}</option>
            <option value="urgent">{text("عاجلة", "Urgent")}</option>
          </select>
        </label>
      </div>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-bold">{text("ملاحظة داخلية للإدارة", "Internal admin note")}</span>
        <textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value.slice(0, 2000))} rows={2} className="input resize-y" />
      </label>
      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] font-bold">{text("رد للمستخدم", "Public response")}</span>
        <textarea value={publicResponse} onChange={(event) => setPublicResponse(event.target.value.slice(0, 3000))} rows={2} className="input resize-y" />
      </label>

      {notice ? <p className="mt-2 text-[11px] font-semibold text-muted-foreground" role="status">{notice}</p> : null}
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {busy ? text("جارٍ الحفظ...", "Saving...") : text("حفظ المعالجة", "Save update")}
      </button>
    </article>
  );
}

function feedbackTypeIcon(type: FeedbackType) {
  if (type === "suggestion") return Lightbulb;
  if (type === "complaint") return CircleAlert;
  if (type === "technical_issue") return Settings2;
  return MessageSquare;
}

function feedbackTypeLabel(type: FeedbackType, text: (ar: string, en: string) => string) {
  if (type === "suggestion") return text("اقتراح", "Suggestion");
  if (type === "complaint") return text("شكوى", "Complaint");
  if (type === "technical_issue") return text("مشكلة تقنية", "Technical issue");
  return text("أخرى", "Other");
}

function statusLabel(status: FeedbackStatus | "all", text: (ar: string, en: string) => string) {
  if (status === "all") return text("الكل", "All");
  if (status === "new") return text("جديد", "New");
  if (status === "under_review") return text("قيد المراجعة", "Under review");
  if (status === "resolved") return text("تم الحل", "Resolved");
  return text("مغلق", "Closed");
}

function Notice({ children, tone }: { children: React.ReactNode; tone: "error" | "success" }) {
  return (
    <div className={`rounded-xl p-3 text-xs font-semibold hairline ${tone === "error" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
      {children}
    </div>
  );
}
