import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FileCheck, Flag, LayoutDashboard, Lock, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const auth = useAuth();
  const { language, text } = useUiPreferences();

  if (auth.status === "loading") {
    return (
      <AdminShellState
        title={text("جارٍ التحقق من الصلاحيات", "Checking permissions")}
        message={text(
          "نقرأ جلسة الحساب والدور المحفوظ في مصدر الصلاحيات.",
          "Reading the account session and stored role from the permission source.",
        )}
      />
    );
  }

  if (auth.status === "authUnavailable") {
    return (
      <AdminShellState
        title={text("لوحة الإدارة تتطلب جلسة حساب", "Admin dashboard requires an account session")}
        message={text(
          "تبقى صفحات الإدارة محمية ولا تُعرض إلا بعد توفر حساب بصلاحية مناسبة.",
          "Admin pages remain protected and are shown only with a suitable authorized account.",
        )}
      />
    );
  }

  if (auth.status === "signedOut") {
    return (
      <AdminShellState
        title={text("تسجيل الدخول مطلوب", "Login required")}
        message={text(
          "سجّل الدخول أولاً، ثم يتم التحقق من دور المالك من مصدر الصلاحيات.",
          "Log in first, then the owner role is checked from the permission source.",
        )}
        actionTo="/login"
        actionLabel={text("تسجيل الدخول", "Log in")}
      />
    );
  }

  if (!auth.canAccessOwnerControls) {
    return (
      <AdminShellState
        title={text("غير مخوّل", "Not authorized")}
        message={text(
          "هذه المساحة مخصصة للمالك فقط. الصلاحية لا تُمنح من الواجهة.",
          "This area is for the owner only. Permission is not granted by the frontend.",
        )}
      />
    );
  }

  return (
    <>
      <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
      <main className="container-wide pt-4 pb-8">
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-warning/10 p-3 hairline">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-6 text-foreground/90">
            {text(
              "لوحة الإدارة تعرض مساحة تحكم للمالك مع مراجعة الإعلانات والبلاغات وطلبات الترويج. كل وصول إداري يبقى محكوماً بالصلاحيات المخزنة خارج الواجهة.",
              "The admin dashboard provides owner controls for listings, reports, and promotion requests. Administrative access remains governed by permissions stored outside the frontend.",
            )}
          </p>
        </div>
        <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = tab.exact
              ? pathname === tab.to || pathname === "/admin/"
              : pathname.startsWith(tab.to);
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

function AdminShellState({
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
    <>
      <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
      <main className="container-wide pt-4 pb-8">
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
      </main>
    </>
  );
}
