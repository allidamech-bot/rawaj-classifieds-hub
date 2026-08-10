import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bell,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  Megaphone,
  FileCheck,
  Flag,
  LayoutDashboard,
  ListChecks,
  Lock,
  ScrollText,
  ShieldAlert,
  Siren,
  MessageSquareWarning,
  PanelsTopLeft,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AdminNotificationBell } from "@/components/AdminNotificationBell";
import { DeploymentTruthPanel } from "@/components/DeploymentTruthPanel";
import { PageHeader } from "@/components/PageHeader";
import {
  ADMIN_NOTIFICATIONS_UPDATED_EVENT,
  adminFetchNotificationSummary,
  adminMarkListedNotificationsRead,
  type AdminNotificationSummary,
} from "@/lib/api/admin-notifications";
import type { RolePermission } from "@/lib/auth-types";
import { createSeo } from "@/lib/seo";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useAuth } from "@/lib/use-auth";
import { isAdminModuleAvailable, getUnavailableAdminModuleMessage } from "@/lib/admin-availability";

export const Route = createFileRoute("/admin")({
  head: () => createSeo({ title: "لوحة الإدارة | رَوَاج", noindex: true }),
  component: AdminLayout,
});

const tabs: Array<{
  to: string;
  labelAr: string;
  labelEn: string;
  icon: typeof LayoutDashboard;
  permission: RolePermission;
  exact?: boolean;
}> = [
  {
    to: "/admin",
    labelAr: "مركز القيادة",
    labelEn: "Command center",
    icon: LayoutDashboard,
    permission: "canViewAdminDashboard",
    exact: true,
  },
  {
    to: "/admin/pending",
    labelAr: "مراجعة الإعلانات",
    labelEn: "Listing review",
    icon: FileCheck,
    permission: "canModerateListings",
  },
  {
    to: "/admin/listings",
    labelAr: "قرارات الإعلانات",
    labelEn: "Listing decisions",
    icon: ListChecks,
    permission: "canModerateListings",
  },
  {
    to: "/admin/notifications",
    labelAr: "الإشعارات",
    labelEn: "Notifications",
    icon: Bell,
    permission: "canViewAdminDashboard",
  },
  {
    to: "/admin/data-quality",
    labelAr: "جودة البيانات",
    labelEn: "Data quality",
    icon: DatabaseZap,
    permission: "canModerateListings",
  },
  {
    to: "/admin/reviews",
    labelAr: "مراجعة التقييمات",
    labelEn: "Review moderation",
    icon: Star,
    permission: "canManageReviews",
  },
  {
    to: "/admin/reports",
    labelAr: "بلاغات الإعلانات",
    labelEn: "Listing reports",
    icon: Flag,
    permission: "canManageReports",
  },
  {
    to: "/admin/message-reports",
    labelAr: "بلاغات الرسائل",
    labelEn: "Message reports",
    icon: MessageSquareWarning,
    permission: "canManageReports",
  },
  {
    to: "/admin/safety",
    labelAr: "مركز السلامة",
    labelEn: "Safety center",
    icon: ShieldAlert,
    permission: "canManageReports",
  },
  {
    to: "/admin/verifications",
    labelAr: "طلبات التوثيق",
    labelEn: "Verification requests",
    icon: BadgeCheck,
    permission: "canManageVerifications",
  },
  {
    to: "/admin/users",
    labelAr: "إدارة المستخدمين",
    labelEn: "User management",
    icon: Users,
    permission: "canManageUsers",
  },
  {
    to: "/admin/promotions",
    labelAr: "طلبات الترويج",
    labelEn: "Promotion requests",
    icon: Sparkles,
    permission: "canManagePromotions",
  },
  {
    to: "/admin/ad-placements",
    labelAr: "مساحات الإعلانات",
    labelEn: "Ad placements",
    icon: PanelsTopLeft,
    permission: "canManageAdPlacements",
  },
  {
    to: "/admin/campaigns",
    labelAr: "الحملات",
    labelEn: "Campaigns",
    icon: Megaphone,
    permission: "canManageAdCampaigns",
  },
  {
    to: "/admin/audit",
    labelAr: "سجل التدقيق",
    labelEn: "Audit log",
    icon: ScrollText,
    permission: "canViewAuditLogs",
  },
  {
    to: "/admin/owner-controls",
    labelAr: "تحكم المالك",
    labelEn: "Owner controls",
    icon: Siren,
    permission: "canManageSystemSettings",
  },
];

function tabMatchesPath(tab: (typeof tabs)[number], pathname: string): boolean {
  return tab.exact ? pathname === tab.to || pathname === "/admin/" : pathname.startsWith(tab.to);
}

function AdminLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const auth = useAuth();
  const { language, text } = useUiPreferences();
  const adminNavRef = useRef<HTMLElement | null>(null);
  const [notificationSummary, setNotificationSummary] = useState<AdminNotificationSummary | null>(
    null,
  );

  useEffect(() => {
    if (!auth.canAccessAdmin) {
      setNotificationSummary(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const result = await adminFetchNotificationSummary(true);
      if (!cancelled && result.ok) setNotificationSummary(result.data);
    };
    void load();
    const handleUpdated = () => void load();
    window.addEventListener(ADMIN_NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(ADMIN_NOTIFICATIONS_UPDATED_EVENT, handleUpdated);
    };
  }, [auth.canAccessAdmin]);

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
          "سجّل الدخول أولاً، ثم يتم التحقق من الدور الإداري من مصدر الصلاحيات.",
          "Log in first, then the admin role is checked from the permission source.",
        )}
        actionTo="/login"
        actionLabel={text("تسجيل الدخول", "Log in")}
      />
    );
  }

  if (!isAdminModuleAvailable(pathname)) {
    return (
      <AdminShellState
        title={text("هذه الوحدة غير متاحة حالياً", "This module is currently unavailable")}
        message={text(
          getUnavailableAdminModuleMessage(pathname),
          "This module is still being migrated and will be available soon.",
        )}
      />
    );
  }

  if (!auth.canAccessAdmin) {
    return (
      <AdminShellState
        title={text("غير مخوّل", "Not authorized")}
        message={text(
          "هذه المساحة مخصصة لحساب إداري مخول. الصلاحية لا تُمنح من الواجهة.",
          "This area is for an authorized admin account. Permission is not granted by the frontend.",
        )}
      />
    );
  }

  const requestedTab = tabs.find((tab) => tabMatchesPath(tab, pathname));
  if (requestedTab && !auth.hasPermission(requestedTab.permission)) {
    return (
      <AdminShellState
        title={text("لا تملك صلاحية هذه الوحدة", "You do not have access to this workspace")}
        message={text(
          "تم منع فتح الوحدة مباشرة لأن دور الحساب لا يتضمن الصلاحية المطلوبة لها.",
          "Direct access was blocked because this account role does not include the required permission.",
        )}
        actionTo="/"
      />
    );
  }

  const visibleTabs = tabs.filter((tab) => auth.hasPermission(tab.permission));
  const activeTab = visibleTabs.find((tab) => tabMatchesPath(tab, pathname));
  const PreviousIcon = language === "ar" ? ChevronRight : ChevronLeft;
  const NextIcon = language === "ar" ? ChevronLeft : ChevronRight;

  function scrollAdminNavigation(direction: "previous" | "next") {
    const rail = adminNavRef.current;
    if (!rail) return;

    const logicalDirection = direction === "next" ? 1 : -1;
    const rtlMultiplier = language === "ar" ? -1 : 1;
    const distance = Math.max(260, rail.clientWidth * 0.72);
    rail.scrollBy({ left: logicalDirection * rtlMultiplier * distance, behavior: "smooth" });
  }

  function markNotificationsOpened(entityTypes?: string[]) {
    if (!auth.canAccessAdmin) return;

    setNotificationSummary((current) => {
      if (!current) return current;
      if (!entityTypes || entityTypes.length === 0) {
        return { unreadTotal: 0, byType: {} };
      }

      const byType = { ...current.byType };
      let removed = 0;
      for (const entityType of entityTypes) {
        removed += byType[entityType] ?? 0;
        delete byType[entityType];
      }
      return {
        unreadTotal: Math.max(0, current.unreadTotal - removed),
        byType,
      };
    });

    if (!entityTypes || entityTypes.length === 0) {
      void adminMarkListedNotificationsRead(true);
      return;
    }

    void (async () => {
      for (const entityType of entityTypes) {
        await adminMarkListedNotificationsRead(true, entityType);
      }
    })();
  }

  return (
    <>
      <PageHeader title={text("لوحة الإدارة", "Admin dashboard")} />
      <div className="container-wide px-4 pb-2 pt-2 sm:px-6">
        <AdminNotificationBell
          summary={notificationSummary}
          onOpenNotifications={() => markNotificationsOpened()}
        />
      </div>
      <main className="rawaj-admin-v3 container-wide pt-3 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:pt-4">
        <div className="rawaj-admin-access-notice mb-4 flex items-start gap-2 rounded-[var(--rawaj-radius-card)] p-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="text-xs leading-6 text-foreground/90">
            {text(
              "تُعرض مساحات الإدارة حسب الدور والصلاحيات المحفوظة في مصدر الوصول. إجراءات المالك الحساسة تبقى محمية بشكل مستقل.",
              "Admin workspaces are shown according to persisted roles and permissions. Sensitive owner actions remain separately protected.",
            )}
          </p>
        </div>
        <div className="rawaj-admin-nav-shell sticky top-2 z-30 mb-4 rounded-[var(--rawaj-radius-surface)] p-2 backdrop-blur-xl sm:static sm:backdrop-blur-none">
          <div className="mb-2 flex items-center justify-between gap-3 px-1 sm:hidden">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-muted-foreground">
                {text("مساحة العمل الحالية", "Current workspace")}
              </p>
              <p className="truncate text-xs font-extrabold">
                {activeTab ? text(activeTab.labelAr, activeTab.labelEn) : text("الإدارة", "Admin")}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-extrabold text-primary">
              {auth.profile?.role ?? "admin"}
            </span>
          </div>
          <div className="rawaj-admin-nav-controls">
            <button
              type="button"
              className="rawaj-admin-nav-scroll-button"
              onClick={() => scrollAdminNavigation("previous")}
              aria-label={text("الأقسام الإدارية السابقة", "Previous admin workspaces")}
              title={text("السابق", "Previous")}
            >
              <PreviousIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <nav
              ref={adminNavRef}
              aria-label={text("تنقل الإدارة", "Admin navigation")}
              className="rawaj-admin-nav-rail flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {visibleTabs.map((tab) => {
                const active = tabMatchesPath(tab, pathname);
                const badge = tabBadge(tab, notificationSummary);
                const openedTypes = notificationTypesForTab(tab.to);
                return (
                  <Link
                    key={tab.to}
                    to={tab.to as "/admin"}
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      if (openedTypes === "all") markNotificationsOpened();
                      else if (openedTypes.length > 0) markNotificationsOpened(openedTypes);
                    }}
                    className="inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors duration-150"
                  >
                    <tab.icon className="h-4 w-4" />
                    {text(tab.labelAr, tab.labelEn)}
                    {badge > 0 ? (
                      <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-extrabold leading-5 text-white">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              className="rawaj-admin-nav-scroll-button"
              onClick={() => scrollAdminNavigation("next")}
              aria-label={text("الأقسام الإدارية التالية", "Next admin workspaces")}
              title={text("التالي", "Next")}
            >
              <NextIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-w-0">
          {pathname === "/admin/owner-controls" && auth.hasPermission("canManageSystemSettings") ? (
            <div className="mb-5">
              <DeploymentTruthPanel />
            </div>
          ) : null}
          <Outlet />
        </div>
      </main>
    </>
  );
}

function notificationTypesForTab(to: string): string[] | "all" {
  if (to === "/admin/notifications") return "all";
  const map: Record<string, string[]> = {
    "/admin/users": ["users"],
    "/admin/pending": ["listings"],
    "/admin/reports": ["reports"],
    "/admin/owner-controls": ["feedback", "support"],
  };
  return map[to] ?? [];
}

function tabBadge(
  tab: { to: string; labelAr: string; labelEn: string },
  summary: AdminNotificationSummary | null,
): number {
  if (!summary) return 0;
  if (tab.to === "/admin/notifications") return summary.unreadTotal;
  if (tab.to === "/admin/owner-controls") {
    return (summary.byType.feedback ?? 0) + (summary.byType.support ?? 0);
  }

  const map: Record<string, string> = {
    "/admin/users": "users",
    "/admin/pending": "listings",
    "/admin/reports": "reports",
  };
  const key = map[tab.to];
  return key ? (summary.byType[key] ?? 0) : 0;
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
      <main className="rawaj-admin-v3 container-wide pt-4 pb-8">
        <section className="rounded-[var(--rawaj-radius-surface)] bg-card p-5 text-center hairline shadow-none">
          <Lock className="mx-auto h-7 w-7 text-warning" />
          <h2 className="mt-3 text-base font-extrabold">{title}</h2>
          <p className="mx-auto mt-2 max-w-xl text-xs leading-6 text-muted-foreground">{message}</p>
          <Link
            to={actionTo}
            className="mt-4 inline-flex min-h-11 items-center rounded-[var(--rawaj-radius-button)] bg-primary px-4 text-xs font-bold text-primary-foreground"
          >
            {actionLabel ?? text("العودة للرئيسية", "Back to home")}
          </Link>
        </section>
      </main>
    </>
  );
}
