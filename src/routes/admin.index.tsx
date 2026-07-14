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
      <section className="rounded-2xl bg-card p-5 text-center hairline">
        <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
        <h2 className="mt-3 text-base font-extrabold">
          {text("مساحات الإدارة متاحة حسب الصلاحيات", "Admin workspaces follow your permissions")}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">
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
    <div className="space-y-6">
      <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-premium sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold text-gold-foreground">
              <Crown className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold text-primary-foreground/70">
                {text("مركز قيادة رواج", "RAWAJ command center")}
              </p>
              <h2 className="mt-1 text-xl font-extrabold">
                {auth.canAccessOwnerControls
                  ? text("تحكم المالك وتشغيل المنصة", "Owner control and platform operations")
                  : text("تشغيل وإدارة المنصة", "Platform operations")}
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-6 text-primary-foreground/80">
                {text(
                  "صورة تشغيلية واحدة للمستخدمين، المراجعات، السلامة، التوثيق، الترويج والقيود النشطة.",
                  "One operational view for users, moderation, safety, verification, promotions, and active restrictions.",
                )}
              </p>
            </div>
          </div>
          <span className="rounded-xl bg-primary-foreground/10 px-3 py-2 text-xs font-bold hairline">
            {auth.canAccessOwnerControls
              ? text("Owner محمي", "Protected Owner")
              : text("وصول إداري", "Admin access")}
          </span>
        </div>
      </section>

      {error ? (
        <div className="rounded-xl bg-destructive/10 p-3 text-xs font-semibold text-destructive hairline">
          <p>{error}</p>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadMetrics()}
            className="mt-2 rounded-lg bg-card px-3 py-1.5 font-bold text-foreground hairline disabled:opacity-60"
          >
            {loading ? text("جارٍ التحديث", "Refreshing") : text("إعادة المحاولة", "Try again")}
          </button>
        </div>
      ) : null}

      <section>
        <SectionTitle icon={Activity} title={text("نبض التشغيل", "Operations pulse")} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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

      <section>
        <SectionTitle
          icon={ShieldCheck}
          title={text("السلامة والمراجعة", "Safety and moderation")}
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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

      <section className="grid gap-4 lg:grid-cols-2">
        <CommandCard icon={Users} title={text("حالة المستخدمين", "User health")}>
          <div className="grid grid-cols-3 gap-2">
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
          <div className="grid grid-cols-2 gap-2">
            <MiniMetric label="Admin" value={metrics.adminCount} />
            <MiniMetric label="Moderator" value={metrics.moderatorCount} />
          </div>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {text(
              "إضافة أو إزالة Admin وModerator متاحة للمالك فقط من إدارة المستخدمين.",
              "Only the Owner can add or remove Admin and Moderator roles from user management.",
            )}
          </p>
          <CommandLink to="/admin/users" label={text("إدارة الطاقم", "Manage staff")} />
        </CommandCard>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
    <section className="rounded-2xl bg-card p-8 text-center hairline">
      <p className="text-sm font-bold">{title}</p>
      {body ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{body}</p> : null}
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

function SectionTitle({ icon: Icon, title }: { icon: typeof Crown; title: string }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </h2>
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
    <div className={`rounded-2xl p-4 hairline ${attention ? "bg-warning/10" : "bg-card"}`}>
      <div className="text-2xl font-extrabold">{value.toLocaleString()}</div>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
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
    <Link
      to={to as "/admin"}
      className="rounded-2xl bg-card p-4 transition hairline hover:bg-muted-surface"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted-surface text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xl font-extrabold">{value.toLocaleString()}</span>
      </div>
      <p className="mt-3 text-xs font-bold">{label}</p>
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
    <div className="rounded-2xl bg-card p-5 hairline">
      <SectionTitle icon={Icon} title={title} />
      {children}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted-surface p-3 text-center">
      <div className="text-lg font-extrabold">{value.toLocaleString()}</div>
      <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function CommandLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to as "/admin"}
      className="mt-4 inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
    >
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
    <Link
      to={to as "/admin"}
      className="rounded-2xl bg-card p-4 transition hairline hover:bg-muted-surface"
    >
      <Icon className="h-5 w-5 text-primary" />
      <h3 className="mt-3 text-sm font-extrabold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{body}</p>
    </Link>
  );
}
