import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { FileCheck, Flag, LayoutDashboard, Lock, Sparkles, Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { demoNotice } from "@/data/adminMockData";

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
  return (
    <>
      <PageHeader title="لوحة الإدارة" />
      <main className="container-wide pt-4 pb-8">
        <div className="mb-4 flex items-start gap-2 rounded-2xl bg-warning/10 p-3 hairline">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs text-foreground/90">
            لوحة إدارة مستقبلية لصاحب التطبيق والمشرفين. {demoNotice}. لا يوجد Auth أو Backend أو
            صلاحيات حقيقية أو تنفيذ إجراءات.
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
