import { Link, useRouterState } from "@tanstack/react-router";
import { Grid3X3, Home, Plus, Sparkles, User } from "lucide-react";
import {
  resolvePrimaryNavigationSection,
  shouldShowBottomNav,
  type PrimaryNavigationSection,
} from "@/lib/primary-navigation";
import { useUiPreferences } from "@/lib/ui-preferences";

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
  const activeSection = resolvePrimaryNavigationSection(pathname);

  if (!shouldShowBottomNav(pathname)) return null;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-2.5 pb-2 lg:hidden"
      style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
      aria-label={text("التنقل الرئيسي", "Primary navigation")}
    >
      <div className="pointer-events-auto mx-auto grid max-w-[34rem] grid-cols-5 items-end rounded-[1.4rem] border border-border/80 bg-card/96 px-1.5 pt-1 shadow-[0_-8px_32px_rgba(14,42,68,0.10)] backdrop-blur-xl">
        {items.map((item) => {
          const active = activeSection === item.section;
          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);

          if (item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-[4.2rem] flex-col items-center justify-end gap-0.5 pb-1.5 transition active:scale-[0.98]"
                aria-label={label}
                aria-current={active ? "page" : undefined}
              >
                <span className="-mt-5 rounded-[1.15rem] bg-gradient-to-br from-brand-orange via-gold to-brand-orange p-[2px] shadow-premium-sm">
                  <span className="grid h-12 w-12 place-items-center rounded-[1.05rem] bg-primary text-primary-foreground ring-4 ring-card">
                    <Icon className="h-5.5 w-5.5" strokeWidth={2.2} />
                  </span>
                </span>
                <span className="text-[10px] font-extrabold text-primary">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex min-h-[4.2rem] flex-col items-center justify-center gap-1 rounded-2xl py-1.5 transition active:scale-[0.98] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <span
                className={`grid h-8 w-9 place-items-center rounded-xl transition ${
                  active ? "bg-primary/8 text-primary" : ""
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.8} />
              </span>
              <span className={`text-[10px] ${active ? "font-extrabold" : "font-semibold"}`}>
                {label}
              </span>
              {active ? (
                <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand-orange" />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
