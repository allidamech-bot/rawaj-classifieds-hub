import { createFileRoute, Link } from "@tanstack/react-router";
import { Ban, Flag, LockKeyhole, MessageSquareWarning, ShieldAlert, Users } from "lucide-react";
import { useEffect, useState } from "react";
import {
  adminFetchCommandCenterMetrics,
  type AdminCommandCenterMetrics,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/safety")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSafetyPage,
});

const EMPTY_METRICS: AdminCommandCenterMetrics = {
  totalUsers: 0,
  activeUsers: 0,
  frozenUsers: 0,
  disabledUsers: 0,
  pendingListings: 0,
  openListingReports: 0,
  openMessageReports: 0,
  pendingVerifications: 0,
  pendingPromotions: 0,
  activeRestrictions: 0,
  adminCount: 0,
  moderatorCount: 0,
};

function AdminSafetyPage() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const [metrics, setMetrics] = useState<AdminCommandCenterMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void adminFetchCommandCenterMetrics(auth.canAccessAdmin).then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMetrics(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [auth.canAccessAdmin]);

  const openReports = metrics.openListingReports + metrics.openMessageReports;
  const accountInterventions =
    metrics.frozenUsers + metrics.disabledUsers + metrics.activeRestrictions;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-premium">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-warning text-warning-foreground">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold text-primary-foreground/70">
              {text("عمليات السلامة", "Safety operations")}
            </p>
            <h2 className="mt-1 text-xl font-extrabold">
              {text("مركز السلامة الموحد", "Unified safety center")}
            </h2>
            <p className="mt-2 max-w-3xl text-xs leading-6 text-primary-foreground/80">
              {text(
                "تجميع مؤشرات البلاغات وتدخلات الحسابات في مكان واحد، مع الانتقال إلى الطوابير الحقيقية لمعالجة كل حالة.",
                "One view of report queues and account interventions, with direct access to the real workspaces for each case.",
              )}
            </p>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          {error}
        </p>
      )}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SafetyMetric
          label={text("بلاغات مفتوحة", "Open reports")}
          value={formatMetric(openReports, loading)}
          attention={openReports > 0}
        />
        <SafetyMetric
          label={text("حسابات موقوفة", "Suspended accounts")}
          value={formatMetric(metrics.frozenUsers, loading)}
          attention={metrics.frozenUsers > 0}
        />
        <SafetyMetric
          label={text("حسابات محظورة", "Banned accounts")}
          value={formatMetric(metrics.disabledUsers, loading)}
          attention={metrics.disabledUsers > 0}
        />
        <SafetyMetric
          label={text("قيود نشطة", "Active restrictions")}
          value={formatMetric(metrics.activeRestrictions, loading)}
          attention={metrics.activeRestrictions > 0}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <SafetyQueueCard
          icon={Flag}
          title={text("بلاغات الإعلانات", "Listing reports")}
          count={metrics.openListingReports}
          body={text(
            "راجع البلاغات المفتوحة، حالة الإعلان، وسجل القرار الإداري.",
            "Review open reports, listing state, and the administrative decision flow.",
          )}
          to="/admin/reports"
        />
        <SafetyQueueCard
          icon={MessageSquareWarning}
          title={text("بلاغات الرسائل", "Message reports")}
          count={metrics.openMessageReports}
          body={text(
            "راجع البلاغات المرتبطة بالمحادثات والرسائل المحفوظة.",
            "Review conversation and message-linked reports from recorded data.",
          )}
          to="/admin/message-reports"
        />
        <SafetyQueueCard
          icon={Users}
          title={text("مخاطر الحسابات", "Account risk")}
          count={accountInterventions}
          body={text(
            "افتح المستخدمين لتطبيق إيقاف أو استعادة أو حظر أو قيود دقيقة ضمن الصلاحيات.",
            "Open users to suspend, restore, ban, or apply granular restrictions within permissions.",
          )}
          to="/admin/users"
        />
      </section>

      <section className="rounded-2xl bg-card p-5 hairline">
        <h3 className="text-sm font-extrabold">{text("مسار المعالجة", "Triage path")}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <TriageStep
            number="1"
            title={text("تحقق من المصدر", "Verify source")}
            body={text(
              "افتح البلاغ أو الحساب المرتبط واعتمد فقط على البيانات المسجلة.",
              "Open the linked report or account and rely only on recorded data.",
            )}
          />
          <TriageStep
            number="2"
            title={text("اختر أقل تدخل كافٍ", "Choose least sufficient action")}
            body={text(
              "استخدم التقييد الدقيق أو الإيقاف قبل الحظر الكامل عندما يكون ذلك مناسباً.",
              "Prefer granular restriction or suspension before full ban when appropriate.",
            )}
          />
          <TriageStep
            number="3"
            title={text("راجع الأثر", "Review impact")}
            body={text(
              "استخدم سجل التدقيق لتتبع الإجراء والفاعل والهدف والبيانات المرافقة.",
              "Use the audit log to trace the action, actor, target, and metadata.",
            )}
          />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <QuickAction
          icon={LockKeyhole}
          title={text("المستخدمون والقيود", "Users and restrictions")}
          to="/admin/users"
        />
        <QuickAction icon={Ban} title={text("سجل التدقيق", "Audit log")} to="/admin/audit" />
      </section>
    </div>
  );
}

function formatMetric(value: number, loading: boolean) {
  return loading ? "…" : value.toLocaleString();
}

function SafetyMetric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 hairline ${attention ? "bg-warning/10" : "bg-card"}`}>
      <div className="text-2xl font-extrabold">{value}</div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SafetyQueueCard({
  icon: Icon,
  title,
  count,
  body,
  to,
}: {
  icon: typeof ShieldAlert;
  title: string;
  count: number;
  body: string;
  to: string;
}) {
  return (
    <Link
      to={to as "/admin"}
      className="rounded-2xl bg-card p-5 transition hairline hover:bg-muted-surface"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted-surface text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-2xl font-extrabold">{count.toLocaleString()}</span>
      </div>
      <h3 className="mt-4 text-sm font-extrabold">{title}</h3>
      <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p>
    </Link>
  );
}

function TriageStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <div className="rounded-xl bg-muted-surface p-4 hairline">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-extrabold text-primary-foreground">
        {number}
      </span>
      <h4 className="mt-3 text-xs font-extrabold">{title}</h4>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </div>
  );
}

function QuickAction({ icon: Icon, title, to }: { icon: typeof Ban; title: string; to: string }) {
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
