import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FileCheck, Flag, LayoutDashboard, Lock, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { demoNotice } from "@/data/adminMockData";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة | رَوَاج" }] }),
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "مركز المالك", icon: LayoutDashboard, exact: true },
  { to: "/admin/pending", label: "إعلانات للمراجعة", icon: FileCheck },
  { to: "/admin/reports", label: "البلاغات", icon: Flag },
  { to: "/admin/users", label: "المستخدمون والصلاحيات", icon: Users },
  { to: "/admin/promotions", label: "طلبات الترويج", icon: Sparkles },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();

  if (auth.status === "loading") {
    return (
      <>
        <PageHeader title="لوحة الإدارة" />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title="جاري التحقق من الصلاحيات"
            message="يتم تحميل جلسة الحساب وقراءة الدور من جدول الأدوار."
          />
        </main>
      </>
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <>
        <PageHeader title="لوحة الإدارة" />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title="لوحة الإدارة قيد التفعيل"
            message="لا يمكن عرض لوحة المالك التشغيلية قبل اكتمال ربط الحسابات. التصفح العام يبقى متاحاً."
          />
        </main>
      </>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <>
        <PageHeader title="لوحة الإدارة" />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title="تسجيل الدخول مطلوب"
            message="يجب تسجيل الدخول أولاً، ثم يتم التحقق من دور المالك من جدول الأدوار."
            actionTo="/login"
            actionLabel="تسجيل الدخول"
          />
        </main>
      </>
    );
  }

  if (!auth.canAccessOwnerControls) {
    return (
      <>
        <PageHeader title="لوحة الإدارة" />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title="غير مخوّل"
            message="هذه المساحة مخصّصة لمالك المنصة فقط. الصلاحية تُقرأ من جدول الأدوار ولا تُمنح من الواجهة."
          />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title="لوحة الإدارة" />
      <main className="container-wide pt-4 pb-8">
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-warning/10 p-3 hairline">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-foreground/90">
            لوحة إدارة مستقبلية لصاحب التطبيق والمشرفين. الحسابات والأدوار تُقرأ من مصدر الصلاحيات،
            ومعظم إجراءات الإدارة ما زالت غير مفعّلة أو بانتظار اكتمال الربط التشغيلي. {demoNotice}.
          </p>
        </div>
        <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = tab.exact ? pathname === tab.to : pathname.startsWith(tab.to);
            return (
              <Link
                key={tab.to}
                to={tab.to as "/admin"}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-card hairline hover:bg-muted-surface"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <Outlet />
      </main>
    </>
  );
}

function AdminStateCard({
  title,
  message,
  actionTo = "/",
  actionLabel = "العودة للرئيسية",
}: {
  title: string;
  message: string;
  actionTo?: "/" | "/login";
  actionLabel?: string;
}) {
  return (
    <section className="rounded-2xl bg-card p-5 text-center hairline shadow-soft">
      <Lock className="mx-auto h-7 w-7 text-warning" />
      <h2 className="mt-3 text-base font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">{message}</p>
      <Link
        to={actionTo}
        className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
      >
        {actionLabel}
      </Link>
    </section>
  );
}
