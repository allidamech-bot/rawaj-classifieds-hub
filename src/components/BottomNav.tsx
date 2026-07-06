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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/96 shadow-[0_-10px_30px_rgba(16,23,34,0.08)] backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label={text("التنقل الرئيسي", "Primary navigation")}
    >
      <div className="container-wide mx-auto grid grid-cols-5 items-end pt-1">
        {items.map((item) => {
          const active = activeSection === item.section;
          const Icon = item.icon;
          const label = text(item.labelAr, item.labelEn);

          if (item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex min-h-16 flex-col items-center gap-1 pb-2 pt-1 transition active:scale-[0.98]"
                aria-label={label}
                aria-current={active ? "page" : undefined}
              >
                <span className="grid h-12 w-12 -translate-y-3 place-items-center rounded-full bg-gold text-gold-foreground shadow-premium ring-4 ring-background">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="-mt-1 text-[11px] font-bold text-foreground">{label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex min-h-16 flex-col items-center gap-1 py-2 transition active:scale-[0.98] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.2]" : ""}`} />
              <span className="text-[11px] font-medium">{label}</span>
              {active && <span className="h-1 w-4 rounded-full bg-gold" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
