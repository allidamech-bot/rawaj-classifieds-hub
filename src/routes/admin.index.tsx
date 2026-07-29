import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  Crown,
  FileCheck,
  Flag,
  LockKeyhole,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminFetchCommandCenterMetrics,
  type AdminCommandCenterMetrics,
} from "@/lib/classifieds-api";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminOverview,
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

function AdminOverview() {
  const auth = useAuth();
  const { text } = useUiPreferences();
  const canViewCommandCenterMetrics = auth.hasPermission("canManageUsers");
  const [metrics, setMetrics] = useState<AdminCommandCenterMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  const loadMetrics = useCallback(async () => {
    if (!canViewCommandCenterMetrics) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    const result = await adminFetchCommandCenterMetrics(canViewCommandCenterMetrics);
    if (requestId !== requestIdRef.current) return;
    if (!result.ok) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    setMetrics(result.data);
    setHasLoaded(true);
    setLoading(false);
  }, [canViewCommandCenterMetrics]);

  useEffect(() => {
    requestIdRef.current += 1;
    if (!canViewCommandCenterMetrics) {
      setMetrics(EMPTY_METRICS);
      setLoading(false);
      setHasLoaded(false);
      setError("");
      return;
    }
    setMetrics(EMPTY_METRICS);
    setLoading(false);
    setHasLoaded(false);
    setError("");
    void loadMetrics();
    return () => {
      requestIdRef.current += 1;
    };
  }, [canViewCommandCenterMetrics, loadMetrics]);

  if (!canViewCommandCenterMetrics) {
    return (
      <section className="rawaj-admin-dashboard-state" data-tone="permission">
        <ShieldCheck aria-hidden="true" />
        <h2>{text("مساحات الإدارة متاحة حسب الصلاحيات", "Admin workspaces follow your permissions")}</h2>
        <p>
          {text(
            "المؤشرات التشغيلية التفصيلية متاحة للمالك والإدارة، بينما تبقى طوابير المراجعة المصرح بها متاحة من شريط التنقل.",
            "Detailed operational metrics are limited to Owner and Admin, while authorized moderation queues remain available from the navigation bar.",
          )}
        </p>
      </section>
    );
  }

  if (loading && !hasLoaded) {
    return (
      <AdminLoadState
        title={text("جارٍ تحميل مركز القيادة", "Loading command center")}
        body={text(
          "يتم الآن جلب المؤشرات التشغيلية الحقيقية.",
          "Real operational metrics are being loaded.",
        )}
      />
    );
  }

  if (error && !hasLoaded) {
    return (
      <AdminLoadState
        title={text("تعذر تحميل مؤشرات الإدارة", "Could not load admin metrics")}
        body={error}
        actionLabel={text("إعادة المحاولة", "Try again")}
        onAction={() => void loadMetrics()}
      />
    );
  }

  const queueLoad =
    metrics.pendingListings +
    metrics.openListingReports +
    metrics.openMessageReports +
    metrics.pendingVerifications +
    metrics.pendingPromotions;

  return (
    <div className="rawaj-admin-dashboard-v3">
      <section className="rawaj-admin-command-hero">
        <div className="rawaj-admin-command-hero__copy">
          <span className="rawaj-admin-command-hero__icon">
            <Crown aria-hidden="true" />
          </span>
          <div>
            <p>{text("مركز قيادة رواج", "RAWAJ command center")}</p>
            <h2>
              {auth.canAccessOwnerControls
                ? text("تحكم المالك وتشغيل المنصة", "Owner control and platform operations")
                : text("تشغيل وإدارة المنصة", "Platform operations")}
            </h2>
            <span>
              {text(
                "صورة تشغيلية واحدة للمستخدمين، المراجعات، السلامة، التوثيق، الترويج والقيود النشطة.",
                "One operational view for users, moderation, safety, verification, promotions, and active restrictions.",
              )}
            </span>
          </div>
        </div>
        <strong className="rawaj-admin-command-hero__access">
          {auth.canAccessOwnerControls
            ? text("Owner محمي", "Protected Owner")
            : text("وصول إداري", "Admin access")}
        </strong>
      </section>

      {error ? (
        <div className="rawaj-admin-dashboard-error" role="alert">
          <p>{error}</p>
          <button type="button" disabled={loading} onClick={() => void loadMetrics()}>
            {loading ? text("جارٍ التحديث", "Refreshing") : text("إعادة المحاولة", "Try again")}
          </button>
        </div>
      ) : null}

      <section className="rawaj-admin-dashboard-section" data-section="pulse">
        <SectionTitle icon={Activity} title={text("نبض التشغيل", "Operations pulse")} />
        <div className="rawaj-admin-metrics-grid">
          <MetricCard label={text("إجمالي المستخدمين", "Total users")} value={metrics.totalUsers} />
          <MetricCard
            label={text("المستخدمون النشطون", "Active users")}
            value={metrics.activeUsers}
          />
          <MetricCard
            label={text("إجمالي طوابير العمل", "Total queue load")}
            value={queueLoad}
            attention={queueLoad > 0}
          />
          <MetricCard
            label={text("القيود النشطة", "Active restrictions")}
            value={metrics.activeRestrictions}
            attention={metrics.activeRestrictions > 0}
          />
        </div>
      </section>

      <section className="rawaj-admin-dashboard-section" data-section="queues">
        <SectionTitle icon={ShieldCheck} title={text("السلامة والمراجعة", "Safety and moderation")} />
        <div className="rawaj-admin-queue-grid">
          <QueueCard
            icon={FileCheck}
            label={text("إعلانات للمراجعة", "Listings to review")}
            value={metrics.pendingListings}
            to="/admin/pending"
          />
          <QueueCard
            icon={Flag}
            label={text("بلاغات إعلانات", "Listing reports")}
            value={metrics.openListingReports}
            to="/admin/reports"
          />
          <QueueCard
            icon={MessageSquareWarning}
            label={text("بلاغات رسائل", "Message reports")}
            value={metrics.openMessageReports}
            to="/admin/message-reports"
          />
          <QueueCard
            icon={BadgeCheck}
            label={text("طلبات توثيق", "Verification requests")}
            value={metrics.pendingVerifications}
            to="/admin/verifications"
          />
          <QueueCard
            icon={Sparkles}
            label={text("طلبات ترويج", "Promotion requests")}
            value={metrics.pendingPromotions}
            to="/admin/promotions"
          />
        </div>
      </section>

      <section className="rawaj-admin-command-grid">
        <CommandCard icon={Users} title={text("حالة المستخدمين", "User health")}>
          <div className="rawaj-admin-mini-metrics" data-columns="three">
            <MiniMetric label={text("موقوف", "Suspended")} value={metrics.frozenUsers} />
            <MiniMetric label={text("محظور", "Banned")} value={metrics.disabledUsers} />
            <MiniMetric label={text("قيود", "Restrictions")} value={metrics.activeRestrictions} />
          </div>
          <CommandLink
            to="/admin/users"
            label={text("فتح إدارة المستخدمين", "Open user management")}
          />
        </CommandCard>

        <CommandCard icon={UserCog} title={text("الطاقم والصلاحيات", "Staff and permissions")}>
          <div className="rawaj-admin-mini-metrics" data-columns="two">
            <MiniMetric label="Admin" value={metrics.adminCount} />
            <MiniMetric label="Moderator" value={metrics.moderatorCount} />
          </div>
          <p className="rawaj-admin-command-card__description">
            {text(
              "إضافة أو إزالة Admin وModerator متاحة للمالك فقط من إدارة المستخدمين.",
              "Only the Owner can add or remove Admin and Moderator roles from user management.",
            )}
          </p>
          <CommandLink to="/admin/users" label={text("إدارة الطاقم", "Manage staff")} />
        </CommandCard>
      </section>

      <section className="rawaj-admin-quick-grid">
        <QuickLink
          icon={ShieldCheck}
          title={text("مركز السلامة", "Safety center")}
          body={text(
            "تجميع طوابير البلاغات ومخاطر الحسابات.",
            "Unified report and account-risk queues.",
          )}
          to="/admin/safety"
        />
        <QuickLink
          icon={Activity}
          title={text("سجل التدقيق", "Audit log")}
          body={text("تتبع الإجراءات الإدارية الحساسة.", "Trace sensitive administrative actions.")}
          to="/admin/audit"
        />
        <QuickLink
          icon={LockKeyhole}
          title={text("المستخدمون والقيود", "Users and restrictions")}
          body={text(
            "إيقاف، حظر، استعادة وقيود دقيقة.",
            "Suspend, ban, restore, and granular controls.",
          )}
          to="/admin/users"
        />
        <QuickLink
          icon={Sparkles}
          title={text("الترويج", "Promotions")}
          body={text("مراجعة طلبات إبراز الإعلانات.", "Review listing promotion requests.")}
          to="/admin/promotions"
        />
      </section>
    </div>
  );
}

function AdminLoadState({
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
    <section className="rawaj-admin-dashboard-state" data-tone="loading">
      <Activity aria-hidden="true" />
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof Crown; title: string }) {
  return (
    <header className="rawaj-admin-section-title">
      <span>
        <Icon aria-hidden="true" />
      </span>
      <h2>{title}</h2>
    </header>
  );
}

function MetricCard({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className="rawaj-admin-metric-card" data-attention={attention}>
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

function QueueCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: typeof Crown;
  label: string;
  value: number;
  to: string;
}) {
  return (
    <Link to={to as "/admin"} className="rawaj-admin-queue-card" data-active={value > 0}>
      <span className="rawaj-admin-queue-card__icon">
        <Icon aria-hidden="true" />
      </span>
      <strong>{value.toLocaleString()}</strong>
      <p>{label}</p>
    </Link>
  );
}

function CommandCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Crown;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rawaj-admin-command-card">
      <SectionTitle icon={Icon} title={title} />
      {children}
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rawaj-admin-mini-metric">
      <strong>{value.toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

function CommandLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to as "/admin"} className="rawaj-admin-command-link">
      {label}
    </Link>
  );
}

function QuickLink({
  icon: Icon,
  title,
  body,
  to,
}: {
  icon: typeof Crown;
  title: string;
  body: string;
  to: string;
}) {
  return (
    <Link to={to as "/admin"} className="rawaj-admin-quick-link">
      <span>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </Link>
  );
}
