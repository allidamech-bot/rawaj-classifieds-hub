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
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2.5 pb-2 lg:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      aria-label={text("التنقل الرئيسي", "Primary navigation")}
    >
      <div className="pointer-events-auto relative mx-auto grid max-w-[34rem] grid-cols-5 items-end overflow-visible rounded-[1.5rem] border border-border/80 bg-card/94 px-1.5 pt-1 shadow-[0_-10px_36px_rgba(16,43,70,0.11)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/88">
        <span className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
        {items.map((item) => {
          const active = activeSection === item.section;
          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);
          const badgeCount = item.section === "account" ? counts.total : 0;

          if (item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-[4.25rem] flex-col items-center justify-end gap-0.5 pb-1.5 transition active:scale-[0.98]"
                aria-label={label}
                aria-current={active ? "page" : undefined}
              >
                <span className="-mt-5 rounded-[1.2rem] border border-gold/45 bg-card p-[3px] shadow-[0_10px_24px_rgba(16,43,70,0.16)]">
                  <span className="relative grid h-12 w-12 place-items-center rounded-[1.05rem] bg-primary text-primary-foreground ring-2 ring-card">
                    <Icon className="h-5.5 w-5.5" strokeWidth={2.15} />
                    <span className="absolute -end-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-brand-orange" />
                  </span>
                </span>
                <span className="text-[9px] font-bold text-primary">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition active:scale-[0.98] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={`grid h-8 w-9 place-items-center rounded-xl transition ${
                  active ? "bg-primary/7 text-primary" : ""
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.15 : 1.75} />
                {badgeCount > 0 && (
                  <span className="absolute -end-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[8px] font-extrabold leading-none text-white ring-2 ring-card">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span className={`text-[9px] ${active ? "font-bold" : "font-medium"}`}>{label}</span>
              {active ? (
                <span className="absolute bottom-0.5 h-1 w-4 rounded-full bg-gradient-to-r from-brand-orange to-gold" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
