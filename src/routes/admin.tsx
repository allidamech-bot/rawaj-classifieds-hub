import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FileCheck, Flag, LayoutDashboard, Lock, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { demoNotice } from "@/data/adminMockData";
import { uiLabel } from "@/lib/i18n";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة | رَوَاج" }] }),
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", labelAr: "مركز المالك", icon: LayoutDashboard, exact: true },
  { to: "/admin/pending", labelAr: "إعلانات للمراجعة", icon: FileCheck },
  { to: "/admin/reports", labelAr: "البلاغات", icon: Flag },
  { to: "/admin/users", labelAr: "المستخدمون والصلاحيات", icon: Users },
  { to: "/admin/promotions", labelAr: "طلبات الترويج", icon: Sparkles },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const auth = useAuth();
  const { language, text } = useUiPreferences();

  if (auth.status === "loading") {
    return (
      <>
        <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title={text("جاري التحقق من الصلاحيات", "Checking permissions")}
            message={text(
              "يتم تحميل جلسة الحساب وقراءة الدور من جدول الأدوار.",
              "Loading the account session and reading the role from the role table.",
            )}
          />
        </main>
      </>
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <>
        <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title={text("لوحة الإدارة قيد التفعيل", "Admin dashboard is being activated")}
            message={text(
              "لا يمكن عرض لوحة المالك التشغيلية قبل اكتمال ربط الحسابات. التصفح العام يبقى متاحاً.",
              "The operational owner dashboard cannot be shown before account integration is complete. Public browsing remains available.",
            )}
          />
        </main>
      </>
    );
  }

  if (auth.status === "signedOut") {
    return (
      <>
        <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title={text("تسجيل الدخول مطلوب", "Login required")}
            message={text(
              "يجب تسجيل الدخول أولاً، ثم يتم التحقق من دور المالك من جدول الأدوار.",
              "Log in first, then the owner role is checked from the role table.",
            )}
            actionTo="/login"
            actionLabel={text("تسجيل الدخول", "Log in")}
          />
        </main>
      </>
    );
  }

  if (!auth.canAccessOwnerControls) {
    return (
      <>
        <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
        <main className="container-wide pt-4 pb-8">
          <AdminStateCard
            title={text("غير مخوّل", "Not authorized")}
            message={text(
              "هذه المساحة مخصّصة لمالك المنصة فقط. الصلاحية تُقرأ من جدول الأدوار ولا تُمنح من الواجهة.",
              "This area is only for the platform owner. Permission is read from the role table and is not granted by the frontend.",
            )}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
      <main className="container-wide pt-4 pb-8">
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-warning/10 p-3 hairline">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-foreground/90">
            {text(
              "لوحة إدارة مستقبلية لصاحب التطبيق والمشرفين. الحسابات والأدوار تُقرأ من مصدر الصلاحيات، ومعظم إجراءات الإدارة ما زالت غير مفعّلة أو بانتظار اكتمال الربط التشغيلي.",
              "A future admin dashboard for the app owner and moderators. Accounts and roles are read from the permission source, and most admin actions remain disabled or awaiting operational integration.",
            )}{" "}
            {uiLabel(demoNotice, language)}.
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
                {uiLabel(tab.labelAr, language)}
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
  actionLabel,
}: {
  title: string;
  message: string;
  actionTo?: "/" | "/login";
  actionLabel?: string;
}) {
  const { text } = useUiPreferences();

  return (
    <section className="rounded-2xl bg-card p-5 text-center hairline shadow-soft">
      <Lock className="mx-auto h-7 w-7 text-warning" />
      <h2 className="mt-3 text-base font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">{message}</p>
      <Link
        to={actionTo}
        className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
      >
        {actionLabel ?? text("العودة للرئيسية", "Back to home")}
      </Link>
    </section>
  );
}
