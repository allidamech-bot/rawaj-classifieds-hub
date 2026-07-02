import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Crown,
  FileCheck,
  Flag,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  adminFetchPendingListings,
  adminFetchPromotionRequests,
  adminFetchReports,
  adminFetchVerificationRequests,
} from "@/lib/classifieds-api";
import type { ClassifiedsError } from "@/lib/classifieds-types";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminOverview,
});

const actions = [
  { labelAr: "مراجعة الإعلانات", to: "/admin/pending" },
  { labelAr: "مراجعة البلاغات", to: "/admin/reports" },
  { labelAr: "بلاغات الرسائل", to: "/admin/message-reports" },
  { labelAr: "طلبات التوثيق", to: "/admin/verifications" },
  { labelAr: "إدارة المستخدمين", to: "/admin/users" },
  { labelAr: "طلبات الترويج", to: "/admin/promotions" },
] as const;

function AdminOverview() {
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [reportCount, setReportCount] = useState<number | null>(null);
  const [promotionCount, setPromotionCount] = useState<number | null>(null);
  const [verificationCount, setVerificationCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClassifiedsError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadOverview() {
      setLoading(true);
      setError(null);
      const [pendingResult, reportsResult, promotionsResult, verificationsResult] = await Promise.all([
        adminFetchPendingListings(auth.canAccessAdmin),
        adminFetchReports(auth.canAccessAdmin),
        adminFetchPromotionRequests(auth.canAccessAdmin),
        adminFetchVerificationRequests(auth.canAccessAdmin),
      ]);
      if (cancelled) return;

      if (pendingResult.ok) setPendingCount(pendingResult.data.length);
      else setError(pendingResult.error);

      if (reportsResult.ok) setReportCount(reportsResult.data.length);
      else if (!pendingResult.ok) setError(reportsResult.error);
      else setError(reportsResult.error);

      if (promotionsResult.ok) setPromotionCount(promotionsResult.data.length);
      else setError(promotionsResult.error);

      if (verificationsResult.ok) setVerificationCount(verificationsResult.data.length);
      else setError(verificationsResult.error);

      setLoading(false);
    }
    void loadOverview();
    return () => {
      cancelled = true;
    };
  }, [auth.canAccessAdmin]);

  const metrics = [
    {
      label: text("إعلانات قيد المراجعة", "Listings pending review"),
      value: formatMetric(pendingCount, loading),
      supported: true,
    },
    {
      label: text("بلاغات مسجلة", "Recorded reports"),
      value: formatMetric(reportCount, loading),
      supported: true,
    },
    {
      label: text("طلبات الترويج", "Promotion requests"),
      value: formatMetric(promotionCount, loading),
      supported: true,
    },
    {
      label: text("طلبات التوثيق", "Verification requests"),
      value: formatMetric(verificationCount, loading),
      supported: true,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-premium">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-gold text-gold-foreground">
              <Crown className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xs font-bold text-primary-foreground/75">
                {text("مركز الإدارة", "Admin control center")}
              </p>
              <h2 className="text-xl font-extrabold">{text("إدارة رواج", "RAWAJ management")}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-6 text-primary-foreground/80">
                {text(
                  "تابع طوابير المراجعة والبلاغات وطلبات الترويج والتوثيق من البيانات المدعومة حالياً.",
                  "Track review queues, reports, promotion requests, and verification requests from currently supported data.",
                )}
              </p>
            </div>
          </div>
          <Badge tone="gold">{text("صلاحية إدارية", "Admin access")}</Badge>
        </div>
      </section>

      <section>
        <SectionTitle icon={Activity} title={text("مؤشرات التشغيل", "Operational indicators")} />
        {error && (
          <p className="mb-3 rounded-xl bg-muted-surface p-3 text-xs font-semibold text-muted-foreground hairline">
            {error.message}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-xl bg-card p-3 hairline">
              <div className="text-xl font-extrabold">{metric.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={ShieldCheck} title={text("مهام الإدارة", "Admin tasks")} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="rounded-2xl bg-card p-4 transition hairline hover:bg-muted-surface"
            >
              <div className="text-sm font-extrabold">{uiLabel(action.labelAr, language)}</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {text("فتح مساحة العمل", "Open workspace")}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard icon={FileCheck} title={text("مراجعة الإعلانات", "Listing review")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "تعرض صفحة المراجعة الإعلانات المرسلة بانتظار قرار إداري فقط.",
              "The review page shows submitted listings waiting for an admin decision only.",
            )}
          </p>
          <AdminLink to="/admin/pending" label={text("فتح المراجعة", "Open review")} />
        </AdminCard>
        <AdminCard icon={Flag} title={text("البلاغات والسلامة", "Reports and safety")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "تعرض صفحة البلاغات السجلات المدعومة بقاعدة البيانات وتحديثات حالتها.",
              "The reports page shows database-backed reports and status updates.",
            )}
          </p>
          <AdminLink to="/admin/reports" label={text("فتح البلاغات", "Open reports")} />
        </AdminCard>
        <AdminCard icon={Users} title={text("المستخدمون", "Users")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "لا توجد واجهة آمنة لملخص المستخدمين ضمن هذا الإصدار، لذلك لا تعرض اللوحة أرقاماً تقديرية.",
              "There is no safe user summary API in this release, so the dashboard does not show estimated counts.",
            )}
          </p>
          <AdminLink to="/admin/users" label={text("فتح صفحة المستخدمين", "Open users page")} />
        </AdminCard>
        <AdminCard icon={Sparkles} title={text("الترويج", "Promotion")}>
          <p className="text-xs leading-6 text-muted-foreground">
            {text(
              "تعرض صفحة الترويج الطلبات المدعومة بالبيانات الحالية، مع بقاء أي تفاصيل دفع ضمن المراجعة اليدوية.",
              "The promotion page shows requests backed by current data, while payment details remain part of manual review.",
            )}
          </p>
          <AdminLink
            to="/admin/promotions"
            label={text("فتح طلبات الترويج", "Open promotion requests")}
          />
        </AdminCard>
      </section>

      <section className="rounded-2xl bg-card p-4 hairline">
        <SectionTitle icon={Settings} title={text("إعدادات الإدارة", "Admin settings")} compact />
        <p className="text-xs leading-6 text-muted-foreground">
          {text(
            "إعدادات المنصة تحتاج واجهات محمية قبل عرض مؤشرات أو تغييرات تنفيذية من هذه اللوحة.",
            "Platform settings need protected APIs before this dashboard shows indicators or operational changes.",
          )}
        </p>
      </section>
    </div>
  );
}

function formatMetric(value: number | null, loading: boolean) {
  if (loading) return "…";
  return value === null ? "—" : value.toLocaleString();
}

function SectionTitle({
  icon: Icon,
  title,
  compact = false,
}: {
  icon: typeof Crown;
  title: string;
  compact?: boolean;
}) {
  return (
    <h2
      className={`flex items-center gap-2 font-extrabold ${compact ? "mb-3 text-sm" : "mb-3 text-base"}`}
    >
      <Icon className="h-4 w-4 text-primary" />
      {title}
    </h2>
  );
}

function AdminCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Crown;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 hairline">
      <SectionTitle icon={Icon} title={title} compact />
      {children}
    </div>
  );
}

function AdminLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to as "/"}
      className="mt-3 inline-block rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"
    >
      {label}
    </Link>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: "gold" }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-[10px] font-bold ${
        tone === "gold" ? "bg-gold text-gold-foreground" : "bg-muted-surface text-foreground"
      }`}
    >
      {children}
    </span>
  );
}
