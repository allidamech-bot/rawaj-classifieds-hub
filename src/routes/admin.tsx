import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileCheck, Flag, Users, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة | رَوَاج" }] }),
  component: AdminLayout,
});

const tabs: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "نظرة عامة", icon: LayoutDashboard, exact: true },
  { to: "/admin/pending", label: "إعلانات للمراجعة", icon: FileCheck },
  { to: "/admin/reports", label: "البلاغات", icon: Flag },
  { to: "/admin/users", label: "المستخدمون", icon: Users },
  { to: "/admin/promotions", label: "طلبات التمييز", icon: Sparkles },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <>
      <PageHeader title="لوحة الإدارة" />
      <main className="container-wide pt-4 pb-8">
        <nav className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to as "/admin"}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                  active ? "bg-primary text-primary-foreground" : "bg-card hairline hover:bg-muted-surface"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </nav>
        <Outlet />
      </main>
    </>
  );
}
