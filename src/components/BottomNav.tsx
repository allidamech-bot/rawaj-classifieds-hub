import { Link, useRouterState } from "@tanstack/react-router";
import { Grid3X3, Home, Plus, Sparkles, User } from "lucide-react";
import {
  resolvePrimaryNavigationSection,
  shouldShowBottomNav,
  type PrimaryNavigationSection,
} from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";
import { useUnreadActivityCounts } from "@/lib/unread-activity";

type NavItem = {
  to: "/" | "/categories" | "/add-listing" | "/offers" | "/more";
  section: Exclude<PrimaryNavigationSection, "none">;
  labelAr: string;
  labelEn: string;
  icon: typeof Home;
  primary?: boolean;
};

const items: NavItem[] = [
  { to: "/", section: "home", labelAr: "الرئيسية", labelEn: "Home", icon: Home },
  {
    to: "/categories",
    section: "categories",
    labelAr: "الأقسام",
    labelEn: "Categories",
    icon: Grid3X3,
  },
  {
    to: "/add-listing",
    section: "addListing",
    labelAr: "أضف إعلان",
    labelEn: "Post",
    icon: Plus,
    primary: true,
  },
  { to: "/offers", section: "offers", labelAr: "العروض", labelEn: "Offers", icon: Sparkles },
  { to: "/more", section: "account", labelAr: "حسابي", labelEn: "Account", icon: User },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { text } = useUiPreferences();
  const { counts } = useUnreadActivityCounts();
  const activeSection = resolvePrimaryNavigationSection(pathname);

  if (!shouldShowBottomNav(pathname)) return null;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pt-2 lg:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      aria-label={text("التنقل الرئيسي", "Primary navigation")}
    >
      <div className="rawaj-bottom-nav-shell pointer-events-auto mx-auto grid max-w-[32rem] grid-cols-5 items-stretch border border-border/80 bg-card/96 p-1 backdrop-blur-xl supports-[backdrop-filter]:bg-card/90">
        {items.map((item) => {
          const active = activeSection === item.section;
          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);
          const badgeCount = item.section === "account" ? counts.total : 0;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-1 rounded-[0.9rem] px-1 py-1.5 transition-colors duration-150 active:bg-muted-surface ${
                active ? "bg-primary/8 text-primary" : "text-muted-foreground"
              }`}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={`relative grid h-8 w-9 place-items-center rounded-xl transition-colors duration-150 ${
                  item.primary
                    ? "bg-primary text-primary-foreground"
                    : active
                      ? "bg-primary/8 text-primary"
                      : ""
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active || item.primary ? 2.1 : 1.8} />
                {badgeCount > 0 && (
                  <span className="absolute -end-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[8px] font-bold leading-none text-destructive-foreground ring-2 ring-card">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span className={`truncate text-[10px] ${active ? "font-bold" : "font-medium"}`}>
                {label}
              </span>
              {active ? (
                <span className="absolute inset-x-4 bottom-0.5 h-0.5 rounded-full bg-brand-orange" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
